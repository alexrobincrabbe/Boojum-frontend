import { useState, useRef, useEffect } from 'react';
import { fetchDefinition } from '../../../utils/dictionary';
import { calculateWordScore } from '../../game-room/utils/scoreCalculation';
import './TeamWordLists.css';

interface TeamWordData {
  word: string;
  team_1_found: boolean;
  team_1_count: number;
  team_1_type: 'single' | 'double' | 'triple' | null;
  team_2_found: boolean;
  team_2_count: number;
  team_2_type: 'single' | 'double' | 'triple' | null;
  players_found?: (number | null)[];
}

interface Player {
  id: number;
  team: 'team_1' | 'team_2';
  position: 'player_1' | 'player_2' | 'player_3';
}

interface TeamWordListsProps {
  wordsByLength: Record<string, TeamWordData[]>;
  team1Name: string;
  team2Name: string;
  selectedPlayerIds?: Set<number>;
  allPlayers?: Player[];
  selectedTeam?: 'team_1' | 'team_2' | null;
  boojum?: string;
  snark?: string;
}

export function TeamWordLists({ 
  wordsByLength, 
  team1Name, 
  team2Name,
  selectedPlayerIds = new Set(),
  allPlayers = [],
  selectedTeam = null,
  boojum,
  snark
}: TeamWordListsProps) {
  const [popup, setPopup] = useState<{ word: string; definition: string } | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!popup) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        if (popupTimeoutRef.current) {
          clearTimeout(popupTimeoutRef.current);
        }
        setPopup(null);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popup]);

  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }

    setPopup({ word, definition: 'Loading...' });

    try {
      const definition = await fetchDefinition(word);
      setPopup({ word, definition });

      popupTimeoutRef.current = setTimeout(() => {
        setPopup(null);
      }, 5000);
    } catch {
      setPopup({ word, definition: '❌ Failed to load definition.' });
      popupTimeoutRef.current = setTimeout(() => {
        setPopup(null);
      }, 5000);
    }
  };

  // Filter word data based on selected players
  const getFilteredWordData = (wordData: TeamWordData): TeamWordData => {
    // If no players are selected, show no highlights
    if (selectedPlayerIds.size === 0) {
      return {
        ...wordData,
        team_1_found: false,
        team_1_count: 0,
        team_1_type: null,
        team_2_found: false,
        team_2_count: 0,
        team_2_type: null,
      };
    }
    
    // If we have player data, use it to recalculate based on selected players
    if (wordData.players_found && wordData.players_found.length > 0) {
      // Count how many selected players found this word
      const selectedPlayersFound = wordData.players_found.filter(
        playerId => playerId !== null && selectedPlayerIds.has(playerId)
      ).length;
      
      if (selectedPlayersFound === 0) {
        // No selected players found this word
        return {
          ...wordData,
          team_1_found: false,
          team_1_count: 0,
          team_1_type: null,
          team_2_found: false,
          team_2_count: 0,
          team_2_type: null,
        };
      }
      
      // Recalculate team counts based on selected players only
      const team1SelectedPlayers = allPlayers.filter(p => 
        p.team === 'team_1' && selectedPlayerIds.has(p.id)
      );
      const team2SelectedPlayers = allPlayers.filter(p => 
        p.team === 'team_2' && selectedPlayerIds.has(p.id)
      );
      
      const team1SelectedIds = new Set(team1SelectedPlayers.map(p => p.id));
      const team2SelectedIds = new Set(team2SelectedPlayers.map(p => p.id));
      
      const team1SelectedFound = wordData.players_found.filter(
        playerId => playerId !== null && team1SelectedIds.has(playerId)
      ).length;
      
      const team2SelectedFound = wordData.players_found.filter(
        playerId => playerId !== null && team2SelectedIds.has(playerId)
      ).length;
      
      
      // Determine types based on selected players only
      let team_1_type: 'single' | 'double' | 'triple' | null = null;
      let team_2_type: 'single' | 'double' | 'triple' | null = null;
      
      if (team1SelectedFound === 1) {
        team_1_type = 'single';
      } else if (team1SelectedFound === 2) {
        team_1_type = 'double';
      } else if (team1SelectedFound === 3) {
        team_1_type = 'triple';
      }
      
      if (team2SelectedFound === 1) {
        team_2_type = 'single';
      } else if (team2SelectedFound === 2) {
        team_2_type = 'double';
      } else if (team2SelectedFound === 3) {
        team_2_type = 'triple';
      }
      
      return {
        ...wordData,
        team_1_found: team1SelectedFound > 0,
        team_1_count: team1SelectedFound,
        team_1_type: team_1_type,
        team_2_found: team2SelectedFound > 0,
        team_2_count: team2SelectedFound,
        team_2_type: team_2_type,
      };
    }
    
    // Fallback if no player data available
    return wordData;
  };

  const getWordClass = (wordData: TeamWordData): string => {
    const filteredData = getFilteredWordData(wordData);
    const classes: string[] = ['word'];
    
    // When filtering by team, only show colors for that team
    if (selectedTeam) {
      if (selectedTeam === 'team_1' && filteredData.team_1_found) {
        if (filteredData.team_1_type === 'triple') {
          classes.push('pink');
        } else if (filteredData.team_1_type === 'double') {
          classes.push('yellow');
        } else if (filteredData.team_1_type === 'single') {
          classes.push('green');
        }
      } else if (selectedTeam === 'team_2' && filteredData.team_2_found) {
        if (filteredData.team_2_type === 'triple') {
          classes.push('pink');
        } else if (filteredData.team_2_type === 'double') {
          classes.push('yellow');
        } else if (filteredData.team_2_type === 'single') {
          classes.push('green');
        }
      }
    } else {
      // No filter - show both teams
      // Determine color based on team counts
      // Priority: triples (pink) > doubles (yellow) > singles (green) > none (white/default)
      if (filteredData.team_1_found && filteredData.team_2_found) {
        // Both teams found it - use the highest multiplier
        if (filteredData.team_1_type === 'triple' || filteredData.team_2_type === 'triple') {
          classes.push('pink');
        } else if (filteredData.team_1_type === 'double' || filteredData.team_2_type === 'double') {
          classes.push('yellow');
        } else {
          classes.push('green');
        }
      } else if (filteredData.team_1_found) {
        // Only team 1 found it
        if (filteredData.team_1_type === 'triple') {
          classes.push('pink');
        } else if (filteredData.team_1_type === 'double') {
          classes.push('yellow');
        } else if (filteredData.team_1_type === 'single') {
          classes.push('green');
        }
      } else if (filteredData.team_2_found) {
        // Only team 2 found it
        if (filteredData.team_2_type === 'triple') {
          classes.push('pink');
        } else if (filteredData.team_2_type === 'double') {
          classes.push('yellow');
        } else if (filteredData.team_2_type === 'single') {
          classes.push('green');
        }
      }
    }
    // If neither team found it, no color class (defaults to white)
    
    return classes.join(' ');
  };

  // Calculate word score with team multipliers
  const getWordScore = (wordData: TeamWordData): number => {
    const filteredData = getFilteredWordData(wordData);
    const baseScore = calculateWordScore(wordData.word, boojum, snark);
    
    // Apply team multipliers based on how many players found it
    if (selectedTeam) {
      if (selectedTeam === 'team_1' && filteredData.team_1_found) {
        if (filteredData.team_1_type === 'double') {
          return baseScore * 2;
        } else if (filteredData.team_1_type === 'triple') {
          return baseScore * 3;
        }
        return baseScore;
      } else if (selectedTeam === 'team_2' && filteredData.team_2_found) {
        if (filteredData.team_2_type === 'double') {
          return baseScore * 2;
        } else if (filteredData.team_2_type === 'triple') {
          return baseScore * 3;
        }
        return baseScore;
      }
    } else {
      // No filter - calculate based on both teams
      // Use the highest multiplier if both teams found it
      let multiplier = 1;
      if (filteredData.team_1_found) {
        if (filteredData.team_1_type === 'triple') {
          multiplier = Math.max(multiplier, 3);
        } else if (filteredData.team_1_type === 'double') {
          multiplier = Math.max(multiplier, 2);
        }
      }
      if (filteredData.team_2_found) {
        if (filteredData.team_2_type === 'triple') {
          multiplier = Math.max(multiplier, 3);
        } else if (filteredData.team_2_type === 'double') {
          multiplier = Math.max(multiplier, 2);
        }
      }
      return baseScore * multiplier;
    }
    
    return baseScore;
  };

  // Get color priority for sorting (green=0, yellow=1, pink=2, default=3)
  const getColorPriority = (wordClass: string): number => {
    if (wordClass.includes('green')) return 0;
    if (wordClass.includes('yellow')) return 1;
    if (wordClass.includes('pink')) return 2;
    return 3;
  };

  // Determine color coding banner text based on filter
  const getColorBannerText = () => {
    if (selectedPlayerIds.size === 0) {
      return {
        single: "No highlights (no players selected)",
        double: "No highlights (no players selected)",
        triple: "No highlights (no players selected)",
        none: "No highlights (no players selected)"
      };
    } else if (selectedTeam && selectedPlayerIds.size > 0) {
      return {
        single: "1 selected player found it",
        double: "2 selected players found it",
        triple: "3 selected players found it",
        none: "No selected players found it"
      };
    } else {
      return {
        single: "1 player found it",
        double: "2 players found it",
        triple: "3 players found it",
        none: "No one found it"
      };
    }
  };

  const colorBannerText = getColorBannerText();

  return (
    <div className="team-word-lists">
      <div id="word-definition-banner" className="blue">
        CLICK ON A WORD TO SEE THE DEFINITION
      </div>
      {/* Color coding banner */}
      <div id="color-coding-banner" className="color-coding-banner">
        <span className="color-coding-item green-text">{colorBannerText.single} (Singles)</span>
        <span className="color-coding-item yellow-text">{colorBannerText.double} (Doubles - 2x score)</span>
        <span className="color-coding-item pink-text">{colorBannerText.triple} (Triples - 3x score)</span>
        <span className="color-coding-item white-text">{colorBannerText.none}</span>
      </div>
      <div className="centered-element">
        <div className="word-lists-wrapper">
          <div id="word-lists">
            {(Object.keys(wordsByLength).length > 0 ? Object.keys(wordsByLength) : ['3', '4', '5', '6', '7', '8', '9+']).map((length) => {
              const words = wordsByLength[length] || [];
              if (words.length === 0) return null;

              // Sort words by color, then alphabetically
              const sortedWords = [...words]
                .map(wordData => {
                  const filteredData = getFilteredWordData(wordData);
                  const wordClass = getWordClass(wordData);
                  const wordScore = getWordScore(wordData);
                  return {
                    wordData,
                    filteredData,
                    wordClass,
                    wordScore
                  };
                })
                .sort((a, b) => {
                  // First sort by color
                  const aPriority = getColorPriority(a.wordClass);
                  const bPriority = getColorPriority(b.wordClass);
                  if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                  }
                  // Then sort alphabetically
                  return a.wordData.word.localeCompare(b.wordData.word);
                });

              return (
                <div key={length} className="word-sublist" id={`word-length-${length}`}>
                  <strong className="word-sublist-header">
                    <span className="word-sublist-number">{length === '9+' ? '9+' : length} -</span>
                    <span className="word-sublist-label">letters</span>
                    <span className="word-sublist-count">({words.length})</span>
                  </strong>
                  <div className="word-sublist-scroll">
                    {sortedWords.map(({ wordData, wordClass, wordScore, filteredData }, idx) => (
                      <div
                        key={`${wordData.word}-${idx}`}
                        className={wordClass}
                        onClick={(e) => handleWordClick(e, wordData.word)}
                        style={{ cursor: 'pointer' }}
                        title={`${team1Name}: ${filteredData.team_1_count} player(s) | ${team2Name}: ${filteredData.team_2_count} player(s)`}
                      >
                        <span>{wordData.word}</span>
                        <span className="word-score">({wordScore}pts)</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {popup && (
        <div ref={popupRef} className="word-definition-popup">
          <div className="popup-word">{popup.word}</div>
          <div className="popup-definition">{popup.definition}</div>
        </div>
      )}
    </div>
  );
}

