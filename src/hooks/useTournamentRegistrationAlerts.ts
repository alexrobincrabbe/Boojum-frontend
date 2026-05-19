import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tournamentAPI } from '../services/api';

const TOURNAMENT_POLL_MS = 15000;

export function useTournamentRegistrationAlerts() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [soloRegistrationOpen, setSoloRegistrationOpen] = useState(false);
  const [teamRegistrationOpen, setTeamRegistrationOpen] = useState(false);

  const poll = useCallback(async () => {
    try {
      const data = await tournamentAPI.getRegistrationAlerts();
      setSoloRegistrationOpen(Boolean(data.solo));
      setTeamRegistrationOpen(Boolean(data.team));
    } catch (error) {
      console.error('Error polling tournament registration alerts:', error);
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, TOURNAMENT_POLL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    poll();
  }, [location.pathname, isAuthenticated, poll]);

  return { soloRegistrationOpen, teamRegistrationOpen };
}
