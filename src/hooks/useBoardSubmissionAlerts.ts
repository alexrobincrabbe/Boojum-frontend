import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { lobbyAPI } from '../services/api';
import { BOARD_SCORES_UPDATED_EVENT } from '../utils/boardAlerts';

const BOARD_POLL_MS = 15000;

export function useBoardSubmissionAlerts() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [dailyNeedsPlay, setDailyNeedsPlay] = useState(false);
  const [timelessNeedsPlay, setTimelessNeedsPlay] = useState(false);

  const poll = useCallback(async () => {
    if (!isAuthenticated) {
      setDailyNeedsPlay(false);
      setTimelessNeedsPlay(false);
      return;
    }

    try {
      const data = await lobbyAPI.getBoardSubmissionAlerts();
      setDailyNeedsPlay(Boolean(data.daily));
      setTimelessNeedsPlay(Boolean(data.timeless));
    } catch (error) {
      console.error('Error polling board submission alerts:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, BOARD_POLL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    const onUpdated = () => {
      void poll();
    };
    window.addEventListener(BOARD_SCORES_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(BOARD_SCORES_UPDATED_EVENT, onUpdated);
  }, [poll]);

  useEffect(() => {
    void poll();
  }, [location.pathname, isAuthenticated, poll]);

  return { dailyNeedsPlay, timelessNeedsPlay };
}
