import './WordLists.css';
import { useState, useRef, useEffect } from 'react';
import type { WordData as ProtocolWordData } from '../../../ws/protocol';
import { calculateWordScore } from '../utils/scoreCalculation';
import { fetchDefinition } from '../../../utils/dictionary';
import { GameInstructionsModal } from './GameInstructionsModal';

// Extended WordData type to support both formats
type ExtendedWordData = 
  | ProtocolWordData // { score, player_found: 0|1, sum_players_found }
  | { word: string; sum_players_found: number; players_found: (number | null)[] }; // Daily board format

interface WordListsProps {
  wordsByLength: Record<string, string[]> | Record<string, Record<string, ExtendedWordData>>;
  wordsFound: Set<string>;
  gameStatus: 'waiting' | 'playing' | 'finished' | undefined;
  hasFinalScores?: boolean; // Indicates if we have final scores (game just finished)
  boojum?: string; // Bonus letter that doubles word multiplier
  snark?: string; // Bonus letter that doubles letter score
  // Optional props for daily board solution color coding
  currentUserId?: number | null; // Current user ID for daily board solution
  filteredPlayerIds?: Set<number | null>; // Filtered player IDs for daily board solution
  showColorBanner?: boolean; // Whether to show color coding banner (default: true for finished games)
  showDefinitionBanner?: boolean; // Whether to show definition banner (default: true)
  isLiveGameRoom?: boolean; // Whether this is a live game room (not daily board, tournament, or timeless board)
}

// Type guard to check if WordData is in protocol format
function isProtocolWordData(data: ExtendedWordData): data is ProtocolWordData {
  return 'player_found' in data && typeof data.player_found === 'number';
}

// Type guard to check if WordData is in daily board format
function isDailyBoardWordData(data: ExtendedWordData): data is { word: string; sum_players_found: number; players_found: (number | null)[] } {
  return 'players_found' in data && Array.isArray(data.players_found);
}

export function WordLists({
  wordsByLength,
  wordsFound,
  gameStatus,
  hasFinalScores = false,
  boojum,
  snark,
  currentUserId,
  filteredPlayerIds = new Set(),
  showColorBanner,
  showDefinitionBanner = true,
  isLiveGameRoom = false,
}: WordListsProps) {
  // Definition popup state (hooks must be called before any early returns)
  const [popup, setPopup] = useState<{ word: string; definition: string } | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);

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

  // Get word class for color coding - supports both protocol and daily board formats
  const getWordClass = (word: string, wordData?: ExtendedWordData): string => {
    let wordClass = 'word';
    
    // Use final format coloring if we have wordData (final format) and game is finished or waiting with final scores
    if ((isFinished || isWaitingWithFinalScores) && wordData) {
      if (isProtocolWordData(wordData)) {
        // Protocol format: { score, player_found: 0|1, sum_players_found }
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
      } else if (isDailyBoardWordData(wordData)) {
        // Daily board format: { word, sum_players_found, players_found: (number | null)[] }
        const { players_found, sum_players_found } = wordData;
        
        // Always check from current user's perspective
        const currentUserFound = currentUserId && players_found.includes(currentUserId) ? 1 : 0;
        
        if (filteredPlayerIds.size === 0) {
          // No filter: count all other players
          if (currentUserFound === 1) {
            // Current user found it
            if (sum_players_found === 1) {
              // Only current user found it
              wordClass += ' green';
            } else if (sum_players_found === 2) {
              // Current user + 1 other found it
              wordClass += ' yellow';
            } else if (sum_players_found > 2) {
              // Current user + 2+ others found it
              wordClass += ' pink';
            }
          } else if (sum_players_found > 0) {
            // Current user didn't find it, but others did
            wordClass += ' blue';
          }
        } else {
          // Filter is applied: only count selected players as "other players"
          // Count how many selected players found it (these are the "other players" we consider)
          const selectedPlayersFound = players_found.filter(id => filteredPlayerIds.has(id));
          const selectedPlayersCount = selectedPlayersFound.length;
          
          if (currentUserFound === 1) {
            // Current user found it
            if (selectedPlayersCount === 0) {
              // Current user found it, and no selected players found it
              // This means only current user found it (from the perspective of selected players)
              wordClass += ' green';
            } else if (selectedPlayersCount === 1) {
              // Current user found it, and exactly 1 selected player also found it
              wordClass += ' yellow';
            } else if (selectedPlayersCount >= 2) {
              // Current user found it, and 2+ selected players also found it
              wordClass += ' pink';
            }
          } else if (selectedPlayersCount > 0) {
            // Current user didn't find it, but at least one selected player found it
            wordClass += ' blue';
          }
          // If no one found it (from the perspective of current user and selected players), no additional class
        }
      }
    } else if (isPlaying) {
      // During gameplay, only show found words in green
      // wordsFound stores lowercase, so check lowercase
      const wordLower = word.toLowerCase();
      if (wordsFound.has(wordLower)) {
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

  const getWordsToDisplay = (length: string): Array<{ word: string; wordData?: ExtendedWordData }> => {
    const words = wordsByLength[length];
    if (!words) return [];

    // Check if this specific length entry is in final format (object) or simple format (array)
    const isLengthFinalFormat = typeof words === 'object' && 
                                 words !== null && 
                                 !Array.isArray(words) &&
                                 Object.keys(words).length > 0 &&
                                 typeof Object.values(words)[0] === 'object' &&
                                 Object.values(words)[0] !== null;

    if (isLengthFinalFormat) {
      // Final format: Record<string, ExtendedWordData>
      const wordsDict = words as Record<string, ExtendedWordData>;
      return Object.entries(wordsDict)
        .map(([word, wordData]) => {
          // For daily board format, word is in wordData, not the key
          if (isDailyBoardWordData(wordData)) {
            return { word: wordData.word, wordData };
          }
          return { word, wordData };
        })
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
        // wordsFound may store lowercase (GameRoom) or uppercase (TimelessBoardGameRoom)
        // Check both cases to handle both formats
        return wordsArray
          .filter(word => {
            const wordLower = word.toLowerCase();
            const wordUpper = word.toUpperCase();
            return wordsFound.has(wordLower) || wordsFound.has(wordUpper);
          })
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

  // Determine if we should show color banner
  const shouldShowColorBanner = showColorBanner !== undefined 
    ? showColorBanner 
    : (isFinished || isWaitingWithFinalScores);

  return (
    <div className="centered-element">
      {showDefinitionBanner && (
        <div id="word-definition-banner-container" className="word-definition-banner-container">
          <div id="word-definition-banner" className="blue">
            CLICK ON A WORD TO SEE THE DEFINITION
          </div>
          {isLiveGameRoom && (
            <button
              className="game-instructions-button"
              onClick={() => setIsInstructionsModalOpen(true)}
              aria-label="How to play"
            >
              How to Play
            </button>
          )}
        </div>
      )}
      {/* Color coding explanation banner */}
      {shouldShowColorBanner && (
        <div id="color-coding-banner" className="color-coding-banner">
          <span className="color-coding-item green-text">You found it</span>
          <span className="color-coding-item yellow-text">You & 1 other found it</span>
          <span className="color-coding-item pink-text">You & 2+ others found it</span>
          <span className="color-coding-item blue-text">Others found it</span>
        </div>
      )}
      <div className="word-lists-wrapper">
        <div id="word-lists">
        {(Object.keys(wordsByLength).length > 0 ? Object.keys(wordsByLength) : ['3', '4', '5', '6', '7', '8', '9+']).map((length) => {
          const wordsToDisplay = getWordsToDisplay(length);
          // Always show headings for all word lengths, even if no words found yet (during gameplay)

          return (
            <div key={length} className="word-sublist" id={`word-length-${length}`}>
              <strong className="word-sublist-header">
                <span className="word-sublist-number">{length === '9+' ? '9+' : length} -</span>
                <span className="word-sublist-label">letters</span>
              </strong>
              <div 
                className="word-sublist-scroll"
                style={isFinished || isWaitingWithFinalScores ? { flexDirection: 'column' } : undefined}
              >
                {wordsToDisplay.length > 0 ? (
                  wordsToDisplay.map(({ word, wordData }) => {
                    const wordClass = getWordClass(word, wordData);
                    // Use wordData.score if available (final format), otherwise calculate score during gameplay
                    // wordsFound stores lowercase, so check lowercase
                    const wordLower = word.toLowerCase();
                    const isFound = wordsFound.has(wordLower);
                    
                    // Get score from wordData if available, otherwise calculate
                    let wordScore: number | undefined;
                    if (wordData) {
                      if (isProtocolWordData(wordData)) {
                        wordScore = wordData.score;
                      } else {
                        // For daily board format, always calculate score (solution view shows all words with scores)
                        wordScore = calculateWordScore(word, boojum, snark);
                      }
                    } else {
                      // No wordData, calculate during gameplay
                      wordScore = isPlaying && isFound 
                        ? calculateWordScore(word, boojum, snark) 
                        : undefined;
                    }

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
      {/* Game Instructions Modal */}
      {isLiveGameRoom && (
        <GameInstructionsModal
          isOpen={isInstructionsModalOpen}
          onClose={() => setIsInstructionsModalOpen(false)}
        />
      )}
    </div>
  );
}
