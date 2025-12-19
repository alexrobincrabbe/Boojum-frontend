import { useEffect, useState } from 'react';
import { lobbyAPI } from '../../../services/api';

export function useRoomColor(roomId: string | undefined): string {
  const [roomColor, setRoomColor] = useState<string>('#f5ce45'); // Default to yellow

  useEffect(() => {
    const fetchRoomColor = async () => {
      if (!roomId) return;
      try {
        const data = await lobbyAPI.getLobbyData();
        const room = data.rooms?.find((r: any) => r.room_slug === roomId);
        if (room?.color) {
          setRoomColor(room.color);
        }
      } catch (error) {
        console.error('Error fetching room color:', error);
      }
    };
    fetchRoomColor();
  }, [roomId]);

  return roomColor;
}

