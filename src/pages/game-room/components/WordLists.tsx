import './WordLists.css';
import { useState, useRef, useEffect } from 'react';
import type { WordData } from '../../../ws/protocol';
import { calculateWordScore } from '../utils/scoreCalculation';
import { fetchDefinition } from '../../../utils/dictionary';

interface WordListsProps {
  wordsByLength: Record<string, string[]> | Record<string, Record<string, WordData>>;
  wordsFound: Set<string>;
  gameStatus: 'waiting' | 'playing' | 'finished' | undefined;
  hasFinalScores?: boolean; // Indicates if we have final scores (game just finished)
  boojum?: string; // Bonus letter that doubles word multiplier
  snark?: string; // Bonus letter that doubles letter score
}

export function WordLists({
  wordsByLength,
  wordsFound,
  gameStatus,
  hasFinalScores = false,
  boojum,
  snark,
}: WordListsProps) {
  // Definition popup state (hooks must be called before any early returns)
  const [popup, setPopup] = useState<{ word: string; definition: string } | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Cleanup popup timeout on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  // Close popup when clicking outside of it
  useEffect(() => {
    if (!popup) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the popup
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        // Clear any existing timeout
        if (popupTimeoutRef.current) {
          clearTimeout(popupTimeoutRef.current);
        }
        setPopup(null);
      }
    };

    // Add event listener after a short delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popup]);

  // Don't show word lists during waiting UNLESS we have final scores (interval after finished game)
  // Hide only during waiting before the first game starts
  if (gameStatus === 'waiting' && !hasFinalScores) return null;

  // Handle word click to show definition
  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing timeout
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }

    // Show loading popup immediately
    setPopup({
      word,
      definition: 'Loading',
    });

    try {
      const definition = await fetchDefinition(word);
      setPopup({
        word,
        definition,
      });

      // Auto-remove after 5 seconds
      popupTimeoutRef.current = setTimeout(() => {
        setPopup(null);
      }, 5000);
    } catch {
      setPopup({
        word,
        definition: '❌ Failed to load definition.',
      });

      // Auto-remove after 5 seconds
      popupTimeoutRef.current = setTimeout(() => {
        setPopup(null);
      }, 5000);
    }
  };

  const isFinished = gameStatus === 'finished';
  const isPlaying = gameStatus === 'playing';
  const isWaitingWithFinalScores = gameStatus === 'waiting' && hasFinalScores;


  const getWordClass = (word: string, wordData?: WordData): string => {
    let wordClass = 'word';
    
    // Use final format coloring if we have wordData (final format) and game is finished or waiting with final scores
    if ((isFinished || isWaitingWithFinalScores) && wordData) {
      // Final word list coloring based on player_found and sum_players_found
      // Priority: yellow/pink (if player found AND multiple players found) > green (if player found) > blue (if others found) > default
      const { player_found, sum_players_found } = wordData;
      
      if (player_found === 1) {
        // Player found it - check how many total players found it
        if (sum_players_found === 2) {
          // Player found it AND exactly 2 players found it total
          wordClass += ' yellow';
        } else if (sum_players_found > 2) {
          // Player found it AND more than 2 players found it total
          wordClass += ' pink';
        } else {
          // Player found it AND only 1 player found it (just this player)
          wordClass += ' green';
        }
      } else if (sum_players_found > 0) {
        // Player didn't find it, but at least one other player found it
        wordClass += ' blue';
      }
      // If player_found === 0 and sum_players_found === 0, no additional class (default styling)
    } else if (isPlaying) {
      // During gameplay, only show found words in green
      if (wordsFound.has(word.toLowerCase())) {
        wordClass += ' green';
      }
    }
    
    return wordClass;
  };

  // Helper function to get color priority for sorting (green=0, yellow=1, pink=2, blue=3, default=4)
  const getColorPriority = (wordClass: string): number => {
    if (wordClass.includes('green')) return 0;
    if (wordClass.includes('yellow')) return 1;
    if (wordClass.includes('pink')) return 2;
    if (wordClass.includes('blue')) return 3;
    return 4;
  };

  const getWordsToDisplay = (length: string): Array<{ word: string; wordData?: WordData }> => {
    const words = wordsByLength[length];
    if (!words) return [];

    // Check if this specific length entry is in final format (object) or simple format (array)
    const isLengthFinalFormat = typeof words === 'object' && 
                                 words !== null && 
                                 !Array.isArray(words) &&
                                 Object.keys(words).length > 0 &&
                                 typeof Object.values(words)[0] === 'object' &&
                                 Object.values(words)[0] !== null &&
                                 'score' in (Object.values(words)[0] as unknown as Record<string, unknown>);

    if (isLengthFinalFormat) {
      // Final format: Record<string, WordData>
      const wordsDict = words as Record<string, WordData>;
      return Object.entries(wordsDict)
        .map(([word, wordData]) => ({ word, wordData }))
        .sort((a, b) => {
          // First sort by color (green, yellow, pink, blue)
          const aClass = getWordClass(a.word, a.wordData);
          const bClass = getWordClass(b.word, b.wordData);
          const aPriority = getColorPriority(aClass);
          const bPriority = getColorPriority(bClass);
          
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          
          // Then sort alphabetically
          return a.word.localeCompare(b.word);
        })
    } else if (Array.isArray(words)) {
      // Simple format: string[]
      const wordsArray = words as string[];
      if (isPlaying) {
        // During gameplay, only show found words
        // Check both uppercase and lowercase since wordsFound may contain uppercase
        return wordsArray
          .filter(word => wordsFound.has(word.toUpperCase()) || wordsFound.has(word.toLowerCase()))
          .map(word => ({ word }))
          .sort((a, b) => a.word.localeCompare(b.word));
      } else {
        // Shouldn't happen, but fallback
        return wordsArray.map(word => ({ word })).sort((a, b) => a.word.localeCompare(b.word));
      }
    } else {
      // Unknown format, return empty
      return [];
    }
  };

  return (
    <div className="centered-element">
      <div id="word-definition-banner" className="blue">
        CLICK ON A WORD TO SEE THE DEFINITION
      </div>
      {/* Color coding explanation banner - only show when game is finished or waiting with final scores */}
      {(isFinished || isWaitingWithFinalScores) && (
        <div id="color-coding-banner" className="color-coding-banner">
          <span className="color-coding-item green-text">You found it</span>
          <span className="color-coding-item yellow-text">You & 1 other found it</span>
          <span className="color-coding-item pink-text">You & 2+ others found it</span>
          <span className="color-coding-item blue-text">Others found it</span>
        </div>
      )}
      <div id="word-lists">
        {(Object.keys(wordsByLength).length > 0 ? Object.keys(wordsByLength) : ['3', '4', '5', '6', '7', '8', '9+']).map((length) => {
          const wordsToDisplay = getWordsToDisplay(length);
          // Always show headings for all word lengths, even if no words found yet (during gameplay)

          return (
            <div key={length} className="word-sublist" id={`word-length-${length}`}>
              <strong>{length === '9+' ? '9+' : length} - letters</strong>
              <div 
                className="word-sublist-scroll"
                style={isFinished || isWaitingWithFinalScores ? { flexDirection: 'column' } : undefined}
              >
                {wordsToDisplay.length > 0 ? (
                  wordsToDisplay.map(({ word, wordData }) => {
                    const wordClass = getWordClass(word, wordData);
                    // Use wordData.score if available (final format), otherwise calculate score during gameplay
                    const wordScore = wordData?.score ?? (isPlaying && wordsFound.has(word.toLowerCase()) 
                      ? calculateWordScore(word, boojum, snark) 
                      : undefined);

                    return (
                      <div
                        key={word}
                        className={wordClass}
                        onClick={(e) => handleWordClick(e, word)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>{word}</span>
                        {wordScore !== undefined && (
                          <span className="word-score">({wordScore}pts)</span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Show empty state if no words (shouldn't happen at end of game, but can during gameplay)
                  <div className="word-empty">No words found yet</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Definition Popup */}
      {popup && (
        <div 
          ref={popupRef}
          className="definition-popup"
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside popup from closing it
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{popup.word}</div>
          <div className={popup.definition === 'Loading' ? 'loading-dots' : ''}>
            {popup.definition}
          </div>
        </div>
      )}
    </div>
  );
}

