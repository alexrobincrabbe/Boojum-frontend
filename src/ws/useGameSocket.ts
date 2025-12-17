// src/ws/useGameSocket.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InboundMessage, OutboundMessage } from './protocol';

export type ConnectionState =
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed'
  | 'reconnecting';

export interface UseGameSocketOptions {
  url: string;
  roomId: string;
  token: string;
  maxAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  pauseOnHidden?: boolean;
  heartbeatInterval?: number; // ms, 0 disables
  onMessage?: (message: InboundMessage) => void;
  onError?: (error: Event | Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UseGameSocketReturn {
  connectionState: ConnectionState;
  lastMessage: InboundMessage | null;
  sendJson: (message: OutboundMessage) => void;
  close: () => void;
  reconnect: () => void;
}

/**
 * Normalize Django Channels "event_type" messages into your frontend protocol.
 * Your React app expects messages with a `type` field.
 */
function normalizeInboundMessage(raw: any): InboundMessage | null {
  // Already in frontend protocol
  if (raw?.type) return raw as InboundMessage;

  // Heartbeat coming from backend
  if (raw?.event_type === 'pong') {
    return { type: 'PONG' } as InboundMessage;
  }

  // Backend -> Frontend mapping
  switch (raw?.event_type) {
    case 'timer_update':
      // You can adjust this mapping to match your GameState shape.
      return {
        type: 'DELTA_UPDATE',
        delta: {
          timeRemaining: raw.timer,
          initialTimer: raw.initial_timer,
          gameStatus: raw.status === 'in_progress' ? 'playing' : raw.status === 'waiting_for_next_game' ? 'waiting' : 'finished',
        },
      } as any;

    case 'board_update':
      console.log('[useGameSocket] Normalizing board_update:', {
        hasBoardLetters: !!raw.board_letters,
        boardLettersType: Array.isArray(raw.board_letters) ? 'array' : typeof raw.board_letters,
        boardWordsCount: raw.board_words?.length,
      });
      return {
        type: 'DELTA_UPDATE',
        seq: raw.seq ?? 0,
        delta: {
          // NOTE: if your GameState expects a 2D grid, convert here.
          // For now we pass through what backend sends.
          board: raw.board_letters,
          boardWords: raw.board_words,
          wordsByLength: raw.board_sublists,
          boojumBonus: raw.boojum_bonus,
          snark: raw.snark,
          boojum: raw.boojum,
          oneShot: raw.one_shot,
          gameRoundId: raw.game_round_id,  // Include game round ID
        },
      } as any;

    case 'final_scores':
      return {
        type: 'FINAL_SCORES',
        seq: raw.seq ?? 0,
        finalScores: raw.final_scores,
        wordsByLength: raw.words_by_length,
        totalPoints: raw.total_points,
      } as any;

    case 'show_score_in_chat':
      // Format as score message for one-shot games
      return {
        type: 'SCORE_IN_CHAT',
        playerName: raw.player_name ?? 'Player',
        score: raw.score ?? 0,
        timestamp: Date.now(),
      } as any;

    case 'game_over':
      // Game has ended - trigger score submission by setting status to finished
      // Don't show as ERROR message
      return {
        type: 'DELTA_UPDATE',
        seq: raw.seq ?? 0,
        delta: {
          gameStatus: 'finished',
        },
      } as any;

    default:
      console.warn('[useGameSocket] Unhandled backend message:', raw);
      return null;
  }
}

/**
 * Convert your frontend OutboundMessage into the backend event_type format.
 * Your backend reads `event_type`, not `type`.
 */
function convertOutboundToBackend(message: OutboundMessage): any {
  const backend: any = { ...message };

  if (message.type === 'JOIN_ROOM') {
    backend.event_type = 'join_room';
    backend.roomId = message.roomId;
  } else if (message.type === 'RESYNC') {
    backend.event_type = 'resync';
    if (message.lastSeq !== undefined) backend.last_seq = message.lastSeq;
    if (message.lastTimestamp !== undefined)
      backend.last_timestamp = message.lastTimestamp;
  } else if (message.type === 'PING') {
    backend.event_type = 'ping';
  } else if (message.type === 'LEAVE_ROOM') {
    backend.event_type = 'leave_room';
    backend.roomId = message.roomId;
  } else if (message.type === 'PLAYER_ACTION') {
    backend.event_type = message.action; // your backend expects 'ready', 'move', etc.
    Object.assign(backend, message.data);
  } else if (message.type === 'CHAT') {
    backend.event_type = 'chat';
    backend.message = message.message;
  } else if (message.type === 'UPDATE_SCORE') {
    backend.event_type = 'update_score';
    backend.final_score = message.finalScore;
    backend.best_word = message.bestWord.word;
    backend.best_word_score = message.bestWord.score;
    backend.number_of_words_found = message.numberOfWordsFound;
    backend.which_words_found = message.whichWordsFound;
  } else if (message.type === 'START_GAME') {
    backend.event_type = 'start_game';
  }

  return backend;
}

export function useGameSocket({
  url,
  roomId,
  token,
  maxAttempts = 10,
  initialReconnectDelay = 1000,
  maxReconnectDelay = 30000,
  pauseOnHidden = true,
  heartbeatInterval = 30000,
  onMessage,
  onError,
  onOpen,
  onClose,
}: UseGameSocketOptions): UseGameSocketReturn {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('closed');
  const [lastMessage, setLastMessage] = useState<InboundMessage | null>(null);

  // Socket + timers
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);

  // Control flags
  const reconnectAttemptsRef = useRef(0);
  const isManualCloseRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Online/visibility state
  const isOnlineRef = useRef<boolean>(navigator.onLine);
  const isVisibleRef = useRef<boolean>(!document.hidden);

  // Callback refs so changes don’t trigger reconnect loops
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Track last seq for resync if you implement it later
  const lastSeqRef = useRef<number | null>(null);
  const updateLastSeq = useCallback((message: InboundMessage) => {
    if ('seq' in message && typeof (message as any).seq === 'number') {
      lastSeqRef.current = (message as any).seq;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current !== null) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const cleanup = useCallback(
    (forceClose: boolean) => {
      clearTimers();

      const ws = wsRef.current;
      wsRef.current = null;
      isConnectingRef.current = false;

      if (!ws) return;

      // Clear handlers
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;

      try {
        if (
          forceClose &&
          (ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING)
        ) {
          ws.close();
        }
      } catch (e) {
        console.error('[useGameSocket] cleanup close error:', e);
      }
    },
    [clearTimers]
  );

  const getReconnectDelay = useCallback(
    (attempt: number) => {
      const exp = Math.min(
        initialReconnectDelay * Math.pow(2, attempt),
        maxReconnectDelay
      );
      const jitter = exp * 0.2 * (Math.random() * 2 - 1);
      return Math.max(250, Math.floor(exp + jitter));
    },
    [initialReconnectDelay, maxReconnectDelay]
  );

  const sendRawOnSocket = useCallback((ws: WebSocket, msg: OutboundMessage) => {
    const payload = convertOutboundToBackend(msg);
    ws.send(JSON.stringify(payload));
  }, []);

  const startHeartbeat = useCallback(
    (ws: WebSocket) => {
      if (heartbeatInterval === 0) return;
      if (heartbeatIntervalRef.current !== null) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Track last successful heartbeat
      let lastPingTime = Date.now();
      const heartbeatTimeout = heartbeatInterval * 2; // Allow 2x interval before considering dead

      heartbeatIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            sendRawOnSocket(ws, { type: 'PING' });
            lastPingTime = Date.now();
          } catch (e) {
            console.warn('[useGameSocket] heartbeat send failed:', e);
            // If send fails, connection is likely dead
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(); // Force close to trigger onclose handler
            }
          }
        } else if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
          // Connection is already closing/closed, clear interval
          if (heartbeatIntervalRef.current !== null) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        } else {
          // Check if we haven't received a response in too long
          const timeSinceLastPing = Date.now() - lastPingTime;
          if (timeSinceLastPing > heartbeatTimeout) {
            console.warn('[useGameSocket] Heartbeat timeout - connection may be dead');
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(); // Force close to trigger onclose handler
            }
          }
        }
      }, heartbeatInterval);
    },
    [heartbeatInterval, sendRawOnSocket]
  );

  const handleResync = useCallback(
    (ws: WebSocket) => {
      // IMPORTANT: use the socket that opened, not wsRef.current
      if (ws.readyState !== WebSocket.OPEN) return;

      try {
        sendRawOnSocket(ws, { type: 'JOIN_ROOM', roomId });

        // You can later implement true seq-based resync.
        if (lastSeqRef.current !== null) {
          sendRawOnSocket(ws, { type: 'RESYNC', lastSeq: lastSeqRef.current });
        } else {
          sendRawOnSocket(ws, { type: 'RESYNC', lastTimestamp: Date.now() });
        }
      } catch (e) {
        console.error('[useGameSocket] resync failed:', e);
      }
    },
    [roomId, sendRawOnSocket]
  );

  const connect = useCallback(() => {
    if (!url || !roomId) return;

    // Block conditions
    if (isManualCloseRef.current) return;
    if (!isOnlineRef.current) return;
    if (pauseOnHidden && !isVisibleRef.current) return;

    // Attempt limit
    if (reconnectAttemptsRef.current >= maxAttempts) {
      setConnectionState('closed');
      console.error('[useGameSocket] max reconnect attempts reached');
      return;
    }

    // Prevent overlapping connect() calls
    if (isConnectingRef.current) {
      return;
    }

    // Always close any existing socket before creating a new one
    if (wsRef.current) {
      cleanup(true);
    }

    const isReconnecting = reconnectAttemptsRef.current > 0;
    setConnectionState(isReconnecting ? 'reconnecting' : 'connecting');

    // Build URL + token param
    const wsUrl = new URL(url);
    if (token) wsUrl.searchParams.set('token', token);

    const finalUrl = wsUrl.toString();

    isConnectingRef.current = true;

    const ws = new WebSocket(finalUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectingRef.current = false;
      reconnectAttemptsRef.current = 0;
      setConnectionState('open');

      startHeartbeat(ws);
      handleResync(ws);
      onOpenRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);

        // If backend ever sends raw PONG as {type:'PONG'}
        if (raw?.type === 'PONG') return;

        const msg = normalizeInboundMessage(raw);
        if (!msg) return;

        updateLastSeq(msg);
        setLastMessage(msg);
        onMessageRef.current?.(msg);
      } catch (e) {
        console.error('[useGameSocket] message parse error:', e, {
          raw: event.data,
        });
        onErrorRef.current?.(e as Error);
      }
    };

    ws.onerror = (e) => {
      console.error('[useGameSocket] error', e);
      onErrorRef.current?.(e);
    };

    ws.onclose = (_event) => {
      clearTimers();
      isConnectingRef.current = false;
      
      // Update connection state based on close reason
      if (isManualCloseRef.current) {
        setConnectionState('closed');
      } else {
        // Set to reconnecting if we're going to attempt reconnect
        setConnectionState('reconnecting');
      }
      
      onCloseRef.current?.();

      // No reconnect if manual close
      if (isManualCloseRef.current) return;

      // Schedule reconnect
      const delay = getReconnectDelay(reconnectAttemptsRef.current);
      reconnectAttemptsRef.current += 1;

      reconnectTimeoutRef.current = window.setTimeout(() => {
        setConnectionState('reconnecting');
        connect();
      }, delay);
    };
  }, [
    url,
    roomId,
    token,
    pauseOnHidden,
    maxAttempts,
    cleanup,
    clearTimers,
    getReconnectDelay,
    startHeartbeat,
    handleResync,
    updateLastSeq,
  ]);

  const sendJson = useCallback(
    (message: OutboundMessage) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('[useGameSocket] sendJson: socket not open', {
          message,
          readyState: ws?.readyState,
        });
        return;
      }
      try {
        sendRawOnSocket(ws, message);
      } catch (e) {
        console.error('[useGameSocket] sendJson failed:', e);
        onErrorRef.current?.(e as Error);
      }
    },
    [sendRawOnSocket]
  );

  const close = useCallback(() => {
    isManualCloseRef.current = true;
    setConnectionState('closing');
    cleanup(true);
    setConnectionState('closed');
  }, [cleanup]);

  const reconnect = useCallback(() => {
    isManualCloseRef.current = false;
    reconnectAttemptsRef.current = 0;
    cleanup(true);
    connect();
  }, [cleanup, connect]);

  // Online/offline
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      if (!isManualCloseRef.current && (connectionState === 'closed' || connectionState === 'reconnecting')) {
        reconnectAttemptsRef.current = 0;
        setConnectionState('reconnecting');
        connect();
      }
    };
    const handleOffline = () => {
      isOnlineRef.current = false;
      // Immediately update connection state when going offline
      if (connectionState === 'open' || connectionState === 'connecting') {
        setConnectionState('closed');
      }
      // Close any open connections
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connect, connectionState]);

  // Visibility pause/resume
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;

      if (document.hidden) {
        // Stop scheduled reconnects while hidden
        if (reconnectTimeoutRef.current !== null) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      } else {
        // Resume if closed and not manual close
        if (!isManualCloseRef.current && connectionState === 'closed' && isOnlineRef.current) {
          reconnectAttemptsRef.current = 0;
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pauseOnHidden, connect, connectionState]);

  // Initial connection
  useEffect(() => {
    isManualCloseRef.current = false;
    isOnlineRef.current = navigator.onLine;
    isVisibleRef.current = !document.hidden;

    connect();

    return () => {
      // On unmount, don’t schedule reconnects
      isManualCloseRef.current = true;
      cleanup(true);
    };
  }, [connect, cleanup]);

  return {
    connectionState,
    lastMessage,
    sendJson,
    close,
    reconnect,
  };
}
