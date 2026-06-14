import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tournamentAPI } from '../services/api';

const TOURNAMENT_POLL_MS = 15000;

export function useTournamentRegistrationAlerts() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [soloTournamentActive, setSoloTournamentActive] = useState(false);
  const [teamTournamentActive, setTeamTournamentActive] = useState(false);

  const poll = useCallback(async () => {
    try {
      const data = await tournamentAPI.getRegistrationAlerts();
      setSoloTournamentActive(Boolean(data.solo));
      setTeamTournamentActive(Boolean(data.team));
    } catch (error) {
      console.error('Error polling tournament alerts:', error);
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

  return { soloTournamentActive, teamTournamentActive };
}
