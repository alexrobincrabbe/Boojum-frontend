# WebSocket Integration for Django Channels

This directory contains the WebSocket client implementation for connecting to Django Channels game servers.

## Files

- **`protocol.ts`**: TypeScript type definitions for all WebSocket messages (inbound and outbound)
- **`useGameSocket.ts`**: React hook for managing WebSocket connections with automatic reconnection
- **`../components/GameRoom.tsx`**: Example component demonstrating how to use the hook

## Usage

```typescript
import { useGameSocket } from '../ws/useGameSocket';

const { connectionState, lastMessage, sendJson, close, reconnect } = useGameSocket({
  url: 'wss://your-domain.com/ws/game/room123/',
  roomId: 'room123',
  token: 'your-auth-token',
  maxAttempts: 10,
  heartbeatInterval: 30000,
  onMessage: (message) => {
    // Handle incoming messages
  },
});
```

## Django Channels Consumer Implementation Notes

### 1. JOIN_ROOM Handling

When a client sends `JOIN_ROOM`, the consumer should:

```python
async def receive_json(self, content):
    if content['type'] == 'JOIN_ROOM':
        room_id = content['roomId']
        # Add user to the room group
        await self.channel_layer.group_add(
            f"room_{room_id}",
            self.channel_name
        )
        # Send initial state snapshot
        await self.send_json({
            'type': 'STATE_SNAPSHOT',
            'seq': self.get_next_sequence(),
            'state': await self.get_room_state(room_id)
        })
```

**Important**: `JOIN_ROOM` should be handled **per-connection**, not broadcast to the group. This avoids RabbitMQ fanout.

### 2. RESYNC Handling

When a client sends `RESYNC` after reconnecting:

```python
async def receive_json(self, content):
    if content['type'] == 'RESYNC':
        last_seq = content.get('lastSeq')
        last_timestamp = content.get('lastTimestamp')
        
        # Fetch missed updates since last_seq or last_timestamp
        missed_updates = await self.get_missed_updates(
            room_id=self.room_id,
            since_seq=last_seq,
            since_timestamp=last_timestamp
        )
        
        # Send missed updates (not via group, direct to this connection)
        for update in missed_updates:
            await self.send_json(update)
```

**Important**: `RESYNC` responses should be sent **directly to the connection** (`self.send_json`), not via `group_send`. This prevents RabbitMQ fanout.

### 3. Heartbeat (PING/PONG)

**Option A: Server-side WebSocket ping/pong frames (Recommended)**

Django Channels supports WebSocket ping/pong frames. Configure your consumer to send pings:

```python
class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        # Start ping task
        self.ping_task = asyncio.create_task(self.send_pings())
    
    async def send_pings(self):
        while True:
            await asyncio.sleep(30)  # Every 30 seconds
            try:
                await self.send(text_data='', type='ping')
            except:
                break
    
    async def receive(self, text_data=None, bytes_data=None):
        # Handle pong frames (browsers send these automatically)
        if text_data == '' and self.scope.get('type') == 'websocket.pong':
            # Connection is alive
            pass
```

**Option B: App-level PING/PONG messages**

If you need app-level heartbeat:

```python
async def receive_json(self, content):
    if content['type'] == 'PING':
        # Respond directly (not via group) to avoid RabbitMQ fanout
        await self.send_json({'type': 'PONG'})
```

**Important**: PONG responses should be sent **directly** (`self.send_json`), not via `group_send`.

### 4. Message Broadcasting

For game state updates that need to reach all players:

```python
async def broadcast_update(self, update_type, data, seq):
    await self.channel_layer.group_send(
        f"room_{self.room_id}",
        {
            'type': 'game_update',
            'update_type': update_type,
            'data': data,
            'seq': seq
        }
    )

async def game_update(self, event):
    # This is called for each connection in the group
    await self.send_json({
        'type': event['update_type'],
        'seq': event['seq'],
        **event['data']
    })
```

### 5. Sequence Numbers

Maintain a sequence number for each room to support resync:

```python
class RoomSequenceManager:
    def __init__(self):
        self.sequences = {}  # room_id -> current_seq
    
    def get_next(self, room_id):
        self.sequences[room_id] = self.sequences.get(room_id, 0) + 1
        return self.sequences[room_id]
    
    async def store_update(self, room_id, seq, update):
        # Store in Redis/DB for resync queries
        await redis.zadd(
            f"room_{room_id}_updates",
            {json.dumps(update): seq}
        )
    
    async def get_missed_updates(self, room_id, since_seq):
        # Retrieve updates with seq > since_seq
        updates = await redis.zrangebyscore(
            f"room_{room_id}_updates",
            since_seq + 1,
            '+inf'
        )
        return [json.loads(u) for u in updates]
```

### 6. Avoiding RabbitMQ Fanout

**DO NOT** broadcast these messages via `group_send`:
- `PONG` responses (direct only)
- `RESYNC` responses (direct only)
- `STATE_SNAPSHOT` on JOIN_ROOM (direct only)

**DO** broadcast these via `group_send`:
- `DELTA_UPDATE` (game state changes)
- `SCORE_UPDATE` (score changes)
- `CHAT` messages (chat messages)

### 7. Authentication

Pass the token via WebSocket URL query parameter:

```python
class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        token = self.scope['query_string'].decode().split('token=')[1].split('&')[0]
        user = await self.authenticate(token)
        if not user:
            await self.close()
            return
        self.user = user
        await self.accept()
```

## Testing

Test the WebSocket connection:

```typescript
// In browser console or test file
const ws = new WebSocket('wss://your-domain.com/ws/game/room123/?token=test-token');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: 'room123' }));
```

## Error Handling

The hook handles:
- Network disconnections (automatic reconnect)
- Server errors (reconnect with backoff)
- Browser offline/online events
- Tab visibility changes (optional pause)
- Max reconnect attempts

All errors are passed to the `onError` callback for custom handling.

