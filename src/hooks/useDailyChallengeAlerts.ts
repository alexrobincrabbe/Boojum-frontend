import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { minigamesAPI } from '../services/api';
import {
  boojumbleNeedsAttention,
  cluejumNeedsAttention,
  DAILY_CHALLENGES_UPDATED_EVENT,
  isBoojumbleSolvedFromGrid,
  markBoojumbleSolved,
  needsDoodledumGuess,
  type BoojumbleStatus,
} from '../utils/dailyChallengeStatus';

const DOODLE_POLL_MS = 15000;

export function useDailyChallengeAlerts(username?: string | null) {
  const location = useLocation();
  const [doodledumNeedsGuess, setDoodledumNeedsGuess] = useState(false);
  const [boojumbleUnsolved, setBoojumbleUnsolved] = useState(false);
  const [cluejumUnsolved, setCluejumUnsolved] = useState(false);

  const boojumblesRef = useRef<BoojumbleStatus[]>([]);
  const hasWordClueRef = useRef(false);

  const applyLocalPuzzleStatus = useCallback(() => {
    boojumblesRef.current.forEach((boojumble) => {
      if (isBoojumbleSolvedFromGrid(boojumble)) {
        markBoojumbleSolved(boojumble.id);
      }
    });
    setBoojumbleUnsolved(boojumbleNeedsAttention(boojumblesRef.current));
    setCluejumUnsolved(cluejumNeedsAttention(hasWordClueRef.current));
  }, []);

  const fetchMinigamesMetadata = useCallback(async () => {
    try {
      const minigamesData = await minigamesAPI.getMinigamesData();
      boojumblesRef.current = (minigamesData.boojumbles || []) as BoojumbleStatus[];
      hasWordClueRef.current = Boolean(minigamesData.word_clue);
      applyLocalPuzzleStatus();
    } catch (error) {
      console.error('Error loading minigames metadata for alerts:', error);
    }
  }, [applyLocalPuzzleStatus]);

  const pollDoodledum = useCallback(async () => {
    try {
      const doodleData = await minigamesAPI.checkDoodledum();
      setDoodledumNeedsGuess(needsDoodledumGuess(doodleData, username));
    } catch (error) {
      console.error('Error polling doodledum alerts:', error);
    }
  }, [username]);

  useEffect(() => {
    fetchMinigamesMetadata();
    pollDoodledum();
  }, [fetchMinigamesMetadata, pollDoodledum]);

  useEffect(() => {
    const interval = setInterval(pollDoodledum, DOODLE_POLL_MS);
    return () => clearInterval(interval);
  }, [pollDoodledum]);

  useEffect(() => {
    const onUpdated = () => {
      applyLocalPuzzleStatus();
      void pollDoodledum();
    };

    const onStorage = (event: StorageEvent) => {
      const key = event.key;
      if (
        key?.startsWith('minigames-solved-') ||
        key?.startsWith('minigames-') ||
        key?.startsWith('wordClues-') ||
        key?.startsWith('cluejumScore-')
      ) {
        applyLocalPuzzleStatus();
      }
    };

    window.addEventListener(DAILY_CHALLENGES_UPDATED_EVENT, onUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(DAILY_CHALLENGES_UPDATED_EVENT, onUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [applyLocalPuzzleStatus, pollDoodledum]);

  useEffect(() => {
    applyLocalPuzzleStatus();
    void pollDoodledum();
  }, [location.pathname, applyLocalPuzzleStatus, pollDoodledum]);

  return { doodledumNeedsGuess, boojumbleUnsolved, cluejumUnsolved };
}
