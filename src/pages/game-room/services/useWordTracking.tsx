import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState } from '../../../ws/protocol';
import { playBloop, playSound } from '../../../utils/sounds';
import { triggerBoardAnimation, triggerWordCounterAnimation } from '../utils/borderAnimation';
import { calculateWordScore } from '../utils/scoreCalculation';
import { 
  saveGameState, 
  loadGameState, 
  clearGameState, 
  wordsArrayToSet 
} from '../../../utils/gameStatePersistence';

interface UseWordTrackingReturn {
  wordsFound: Set<string>;
  wordCounts: Record<string, number>;
  wordCountMax: Record<string, number>;
  wordsByLength: Record<string, string[]> | Record<string, Record<string, any>>;
  handleWordSubmit: (word: string) => void | Promise<boolean>; // Returns Promise<boolean> for one-shot confirmation
  initializeWordLists: (wordsByLength: Record<string, string[]>, gameState?: GameState | null, sendJson?: (message: any) => void) => void;
  updateWordsFromChat: (message: string, user: string) => void;
  submitFinalScore: (sendJson: (message: any) => void) => void;
  submitOneShotWord: (word: string, time: number, sendJson: (message: any) => void) => void;
  oneShotSubmitted: boolean;
}

export function useWordTracking(gameState: GameState | null): UseWordTrackingReturn {
  // Get current player's username from gameState
  const getCurrentUsername = useCallback((): string | null => {
    if (!gameState?.currentPlayerId || !gameState?.players) {
      return null;
    }
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    return currentPlayer?.username || null;
  }, [gameState?.currentPlayerId, gameState?.players]);
  // Word lists and counters state
  const [wordsFound, setWordsFound] = useState<Set<string>>(new Set());
  const [oneShotSubmitted, setOneShotSubmitted] = useState(false);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({
    '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0
  });
  const [wordCountMax, setWordCountMax] = useState<Record<string, number>>({
    '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0
  });
  const [wordsByLength, setWordsByLength] = useState<Record<string, string[]> | Record<string, Record<string, any>>>({
    '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9+': []
  });

  // Overwrite wordsByLength with final format when game finishes
  useEffect(() => {
    if (!gameState?.wordsByLength) return;

    const firstValue = Object.values(gameState.wordsByLength)[0];
    
    if (gameState.gameStatus === 'finished' || gameState.gameStatus === 'waiting') {
      // Check if it's the final format (with WordData)
      if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue)) {
        const firstWordData = Object.values(firstValue)[0];
        if (firstWordData && typeof firstWordData === 'object' && 'score' in firstWordData) {
          // This is the final format - overwrite the simple format
          setWordsByLength(gameState.wordsByLength as any);
        }
      }
    } else if (gameState.gameStatus === 'playing') {
      // During gameplay, use simple format from gameState if available
      if (Array.isArray(firstValue)) {
        setWordsByLength(gameState.wordsByLength as Record<string, string[]>);
      }
    }
  }, [gameState?.gameStatus, gameState?.wordsByLength]);

  // Score tracking state
  const totalScoreRef = useRef<number>(0);
  const bestWordRef = useRef<{ word: string; score: number }>({ word: '', score: 0 });
  const wordsFoundArrayRef = useRef<string[]>([]);

  // Track previous gameRoundId to detect game changes
  const previousGameRoundIdRef = useRef<string | undefined>(undefined);

  // Initialize word lists and counters when board updates
  const initializeWordLists = useCallback((newWordsByLength: Record<dstring, string[]>, passedGameState?: GameState | null, sendJson?: (message: any) => void) => {
    // Use passed gameState if provided (for STATE_SNAPSHOT), otherwise use current gameState
    const stateToUse = passedGameState ?? gameState;
    
    setWordsByLength(newWordsByLength);
    
    // Calculate max counts for each word length
    const maxCounts: Record<string, number> = {};
    for (const length in newWordsByLength) {
      const key = length === '9+' ? '9' : length;
      maxCounts[key] = newWordsByLength[length].length;
    }
    setWordCountMax(maxCounts);
    
    // Check if this is a new game (gameRoundId changed)
    const currentGameRoundId = stateToUse?.gameRoundId;
    const isNewGame = currentGameRoundId && currentGameRoundId !== previousGameRoundIdRef.current;
    
    // Get username from the state being used
    let username: string | null = null;
    if (stateToUse?.currentPlayerId && stateToUse?.players) {
      const currentPlayer = stateToUse.players.find(p => p.id === stateToUse.currentPlayerId);
      username = currentPlayer?.username || null;
    }
    
    if (isNewGame && currentGameRoundId && stateToUse?.roomId && username) {
      // New game - try to restore from localStorage
      const restored = loadGameState(stateToUse.roomId, username, currentGameRoundId);
      if (restored) {
        // Restore player state
        setWordsFound(wordsArrayToSet(restored.wordsFound));
        setWordCounts(restored.wordCounts);
        totalScoreRef.current = restored.totalScore;
        bestWordRef.current = restored.bestWord;
        wordsFoundArrayRef.current = restored.wordsFoundArray;
        setOneShotSubmitted(restored.oneShotSubmitted);
        console.log('[GameState] Restored state from localStorage:', {
          username,
          gameRoundId: currentGameRoundId,
          totalScore: restored.totalScore,
          wordsFound: restored.wordsFound.length,
        });
        
        // Send restored score to backend if game is in progress
        if (stateToUse?.gameStatus === 'playing' && sendJson && stateToUse?.boardWords) {
          // Create which_words_found array: 1 if word was found, 0 otherwise
          const whichWordsFound = stateToUse.boardWords.map((word) =>
            restored.wordsFoundArray.some((foundWord) => foundWord === word) ? 1 : 0
          );
          
          sendJson({
            type: 'UPDATE_SCORE',
            finalScore: restored.totalScore,
            bestWord: restored.bestWord,
            numberOfWordsFound: restored.wordsFoundArray.length,
            whichWordsFound: whichWordsFound,
          });
          console.log('[GameState] Sent restored score to backend:', {
            finalScore: restored.totalScore,
            numberOfWordsFound: restored.wordsFoundArray.length,
          });
        }
      } else {
        // No saved state - check if we have existing score refs (from before disconnect)
        // If refs have values, preserve them and send to backend (for incognito mode or first-time reconnect)
        const hasExistingScore = totalScoreRef.current > 0 || wordsFoundArrayRef.current.length > 0;
        
        if (!hasExistingScore) {
          // No existing score - reset to defaults
          setWordCounts({ '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0 });
          setWordsFound(new Set());
          totalScoreRef.current = 0;
          bestWordRef.current = { word: '', score: 0 };
          wordsFoundArrayRef.current = [];
          setOneShotSubmitted(false);
        } else {
          // We have existing score refs - preserve them and send to backend
          console.log('[GameState] No localStorage, using existing score refs:', {
            username,
            gameRoundId: currentGameRoundId,
            totalScore: totalScoreRef.current,
            wordsFound: wordsFoundArrayRef.current.length,
          });
          
          // Send existing score to backend if game is in progress
          if (stateToUse?.gameStatus === 'playing' && sendJson && stateToUse?.boardWords) {
            // Create which_words_found array: 1 if word was found, 0 otherwise
            const whichWordsFound = stateToUse.boardWords.map((word) =>
              wordsFoundArrayRef.current.some((foundWord) => foundWord === word) ? 1 : 0
            );
            
            sendJson({
              type: 'UPDATE_SCORE',
              finalScore: totalScoreRef.current,
              bestWord: bestWordRef.current,
              numberOfWordsFound: wordsFoundArrayRef.current.length,
              whichWordsFound: whichWordsFound,
            });
            console.log('[GameState] Sent existing score to backend (no localStorage):', {
              finalScore: totalScoreRef.current,
              numberOfWordsFound: wordsFoundArrayRef.current.length,
            });
          }
        }
      }
      previousGameRoundIdRef.current = currentGameRoundId;
    } else if (!currentGameRoundId || currentGameRoundId !== previousGameRoundIdRef.current) {
      // Game round ID changed or cleared - reset state
      setWordCounts({ '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0 });
      setWordsFound(new Set());
      totalScoreRef.current = 0;
      bestWordRef.current = { word: '', score: 0 };
      wordsFoundArrayRef.current = [];
      setOneShotSubmitted(false);
      if (stateToUse?.roomId && username && previousGameRoundIdRef.current) {
        // Clear old game state for this username
        clearGameState(stateToUse.roomId, username);
      }
      previousGameRoundIdRef.current = currentGameRoundId;
    }
    // If gameRoundId matches, keep existing state (already restored or continuing current game)
  }, [gameState]);

  // Save game state to localStorage whenever player state changes
  useEffect(() => {
    if (!gameState?.roomId || !gameState?.gameRoundId || gameState.gameStatus !== 'playing') {
      return;
    }

    const username = getCurrentUsername();
    if (!username) {
      return; // Can't save without username
    }

    // Save current player state
    saveGameState(
      gameState.roomId,
      username,
      gameState.gameRoundId,
      {
        wordsFound,
        wordCounts,
        totalScore: totalScoreRef.current,
        bestWord: bestWordRef.current,
        wordsFoundArray: wordsFoundArrayRef.current,
        oneShotSubmitted,
      }
    );
  }, [wordsFound, wordCounts, oneShotSubmitted, gameState?.roomId, gameState?.gameRoundId, gameState?.gameStatus, getCurrentUsername]);
 
  // Handle word submission from swipe
  const handleWordSubmit = useCallback((word: string) => {
    if (!word || gameState?.gameStatus !== 'playing') return;
    
    // Check if word is valid (case-sensitive match, matching original)
    const isValidWord = gameState.boardWords?.includes(word) || false;
    if (!isValidWord) return;
    
    // Check if word is already found (case-insensitive for tracking)
    const wordLower = word.toLowerCase();
    const isAlreadyFound = wordsFound.has(wordLower);
    if (isAlreadyFound) return;
    
    // Calculate word score
    const wordScore = calculateWordScore(word, gameState.boojum, gameState.snark);
    
    // Update score tracking
    totalScoreRef.current += wordScore;
    if (wordScore > bestWordRef.current.score) {
      bestWordRef.current = { word, score: wordScore };
    }
    wordsFoundArrayRef.current.push(word);
    
    console.log('[Score] Word found:', { 
      word, 
      wordScore, 
      totalScore: totalScoreRef.current,
      boojum: gameState.boojum,
      snark: gameState.snark
    });
    
    // Word is valid and not found - update state
    setWordsFound((prev) => {
      const newSet = new Set(prev);
      newSet.add(wordLower);
      return newSet;
    });
    
    // Play sound for found word (different sound for each word length)
    playBloop(word);
    
    // Play twinkle (pop) sound and trigger board animation if word is 8+ letters (matches showBoardBoarderAnimation)
    if (word.length >= 8) {
      playSound('pop');
      triggerBoardAnimation();
    }
    
    // Update word counts
    const wordLength = word.length >= 9 ? '9' : word.length.toString();
    setWordCounts((prev) => {
      if (wordLength in wordCountMax) {
        const newCount = (prev[wordLength] || 0) + 1;
        const max = wordCountMax[wordLength] || 0;
        const percentage = max > 0 ? newCount / max : 0;
        
        // Play twinkle (pop) sound and trigger word counter animation based on word count conditions (matches updateWordCounters):
        // 1. Word length < 8 AND count >= 50%: Play pop and animate (matches original: triggers every time when >= 50%)
        // 2. Count == 100%: Play pop and animate (regardless of word length)
        // Note: For 8+ words, we already played pop above, but we still check for 100% completion
        if (word.length < 8 && percentage >= 0.5) {
          // Condition: Half or more words found for words < 8
          playSound('pop');
          triggerWordCounterAnimation(wordLength, percentage === 1);
        } else if (percentage === 1) {
          // Condition: All words of this length found (100%) - play pop and animate regardless of length
          // (For 8+ words, this might play twice, but that matches original behavior)
          playSound('pop');
          triggerWordCounterAnimation(wordLength, true);
        }
        
        return { ...prev, [wordLength]: newCount };
      }
      return prev;
    });
    
    // Note: Words are not sent to backend during gameplay in original implementation
    // They are only submitted as part of final scores at game end
  }, [gameState, wordsFound, wordCountMax]);

  // Track if score has been submitted to prevent duplicate submissions
  const scoreSubmittedRef = useRef<boolean>(false);

  // Reset score submission flag when new board is initialized
  useEffect(() => {
    if (gameState?.gameStatus === 'playing') {
      scoreSubmittedRef.current = false;
    }
  }, [gameState?.gameStatus, gameState?.boardWords]);

  // Submit final score when game ends
  const submitFinalScore = useCallback((sendJson: (message: any) => void) => {
    if (!gameState?.boardWords || gameState.gameStatus !== 'finished' || scoreSubmittedRef.current) {
      console.log('[Score] Not submitting:', { 
        hasBoardWords: !!gameState?.boardWords, 
        gameStatus: gameState?.gameStatus, 
        alreadySubmitted: scoreSubmittedRef.current 
      });
      return;
    }
    
    scoreSubmittedRef.current = true;
    
    // Create which_words_found array: 1 if word was found, 0 otherwise
    // Use case-sensitive matching to match original implementation
    const whichWordsFound = gameState.boardWords.map((word) =>
      wordsFoundArrayRef.current.some((foundWord) => foundWord === word) ? 1 : 0
    );
    
    const scoreData = {
      final_score: totalScoreRef.current,
      best_word: bestWordRef.current.word,
      best_word_score: bestWordRef.current.score,
      number_of_words_found: wordsFoundArrayRef.current.length,
      which_words_found: whichWordsFound,
    };
    
    console.log('[Score] Submitting final score:', scoreData);
    
    sendJson({
      type: 'PLAYER_ACTION',
      action: 'submit_final_score',
      data: scoreData,
    });
  }, [gameState]);

  // Update words from chat messages (when other players find words)
  const updateWordsFromChat = useCallback((message: string, user: string) => {
    // Check if this is a word found message (format: "word: score pts")
    const wordMatch = message.match(/^([a-z]+):\s*(\d+)\s*pts$/i);
    if (wordMatch && user !== 'System') {
      const word = wordMatch[1];
      const wordLower = word.toLowerCase();
      
      // Update word found state
      setWordsFound((prev) => {
        if (prev.has(wordLower)) return prev; // Already found
        const newSet = new Set(prev);
        newSet.add(wordLower);
        return newSet;
      });
      
      // Play twinkle (pop) sound and trigger board animation if word is 8+ letters (matches showBoardBoarderAnimation)
      if (word.length >= 8) {
        playSound('pop');
        triggerBoardAnimation();
      }
      
      // Update word counts
      const wordLength = word.length >= 9 ? '9' : word.length.toString();
      setWordCounts((prev) => {
        if (wordLength in wordCountMax) {
          const newCount = (prev[wordLength] || 0) + 1;
          const max = wordCountMax[wordLength] || 0;
          const percentage = max > 0 ? newCount / max : 0;
          
          // Play twinkle (pop) sound and trigger word counter animation based on word count conditions (matches updateWordCounters):
          // 1. Word length < 8 AND count >= 50%: Play pop and animate (matches original: triggers every time when >= 50%)
          // 2. Count == 100%: Play pop and animate (regardless of word length)
          if (word.length < 8 && percentage >= 0.5) {
            // Condition: Half or more words found for words < 8
            playSound('pop');
            triggerWordCounterAnimation(wordLength, percentage === 1);
          } else if (percentage === 1) {
            // Condition: All words of this length found (100%) - play pop and animate regardless of length
            playSound('pop');
            triggerWordCounterAnimation(wordLength, true);
          }
          
          return { ...prev, [wordLength]: newCount };
        }
        return prev;
      });
    }
  }, [wordCountMax]);

  // Submit one-shot word (immediately, with time)
  const submitOneShotWord = useCallback((
    word: string,
    time: number,
    sendJson: (message: any) => void
  ) => {
    if (oneShotSubmitted) return; // Prevent duplicate submissions
    
    setOneShotSubmitted(true);
    
    // Calculate word score
    const wordScore = calculateWordScore(word, gameState?.boojum, gameState?.snark);
    
    // Don't send chat message directly - backend will send show_score_in_chat event
    // which will be handled by useGameWebSocket
    
    // Create which_words_found array: 1 if word matches, 0 otherwise
    const whichWordsFound = gameState?.boardWords?.map((w) => (w === word ? 1 : 0)) || [];
    
    // Submit score immediately (not at game end for one-shot)
    const scoreData = {
      final_score: wordScore,
      best_word: word,
      best_word_score: wordScore,
      number_of_words_found: 1,
      which_words_found: whichWordsFound,
      time: time, // Time in seconds
    };
    
    console.log('[OneShot] Submitting word:', scoreData);
    
    sendJson({
      type: 'PLAYER_ACTION',
      action: 'submit_final_score',
      data: scoreData,
    });
    
    // Update local state
    const wordLower = word.toLowerCase();
    setWordsFound((prev) => {
      const newSet = new Set(prev);
      newSet.add(wordLower);
      return newSet;
    });
    
    // Play sound
    playBloop(word);
    
    // Update word counts (only one word in one-shot)
    const wordLength = word.length >= 9 ? '9' : word.length.toString();
    setWordCounts((prev) => {
      if (wordLength in wordCountMax) {
        return { ...prev, [wordLength]: 1 };
      }
      return prev;
    });
  }, [gameState, oneShotSubmitted, wordCountMax]);

  return {
    wordsFound,
    wordCounts,
    wordCountMax,
    wordsByLength,
    handleWordSubmit,
    initializeWordLists,
    updateWordsFromChat,
    submitFinalScore,
    submitOneShotWord,
    oneShotSubmitted,
  };
}

