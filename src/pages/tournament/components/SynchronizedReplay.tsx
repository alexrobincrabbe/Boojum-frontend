import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { RecordingEvent } from '../../../hooks/useGameRecording';
import { calculateWordScore } from '../../game-room/utils/scoreCalculation';
import '../../game-room/GameRoom.css';
import './GameReplay.css';

interface PlayerReplayData {
  recording: RecordingEvent[];
  playerColor: string;
  playerName: string;
  foundWords?: boolean[];
}

interface SynchronizedReplayProps {
  player1: PlayerReplayData | null;
  player2: PlayerReplayData | null;
  board: string[][];
  boardWords: string[];
  boojum?: string;
  snark?: string;
  boojumArray?: number[][];
  totalPoints?: number; // Total available points on the board
  onClose?: () => void;
}

interface PlayerState {
  currentSwipePath: boolean[];
  currentKeyboardWord: string;
  currentKeyboardTracePath: boolean[];
  swipeLines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  foundWordsSet: Set<string>;
  currentSwipeWord: string;
  boardRotation: number;
  score: number;
  swipePathIndexes: Array<[number, number]>;
}

export function SynchronizedReplay({
  player1,
  player2,
  board,
  boardWords,
  boojum,
  snark,
  boojumArray,
  totalPoints,
  onClose,
}: SynchronizedReplayProps) {
  // Calculate total points if not provided
  const calculatedTotalPoints = useMemo(() => {
    if (totalPoints !== undefined) {
      return totalPoints;
    }
    let total = 0;
    for (const word of boardWords) {
      total += calculateWordScore(word, boojum, snark);
    }
    return total;
  }, [totalPoints, boardWords, boojum, snark]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const [player1State, setPlayer1State] = useState<PlayerState>({
    currentSwipePath: Array(16).fill(false),
    currentKeyboardWord: '',
    currentKeyboardTracePath: Array(16).fill(false),
    swipeLines: [],
    foundWordsSet: new Set(),
    currentSwipeWord: '',
    boardRotation: 0,
    score: 0,
    swipePathIndexes: [],
  });

  const [player2State, setPlayer2State] = useState<PlayerState>({
    currentSwipePath: Array(16).fill(false),
    currentKeyboardWord: '',
    currentKeyboardTracePath: Array(16).fill(false),
    swipeLines: [],
    foundWordsSet: new Set(),
    currentSwipeWord: '',
    boardRotation: 0,
    score: 0,
    swipePathIndexes: [],
  });

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const board1Ref = useRef<HTMLDivElement>(null);
  const board2Ref = useRef<HTMLDivElement>(null);
  const svg1Ref = useRef<SVGSVGElement>(null);
  const svg2Ref = useRef<SVGSVGElement>(null);
  const initialFoundWords1Ref = useRef<Set<string>>(new Set());
  const initialFoundWords2Ref = useRef<Set<string>>(new Set());

  // Find the maximum timestamp across both recordings
  const allEvents = [
    ...(player1?.recording || []),
    ...(player2?.recording || []),
  ];
  const maxTime = allEvents.length > 0 
    ? Math.max(...allEvents.map(e => e.timestamp))
    : 0;

  // Helper functions for word matching are defined locally in renderBoard

  const processEventsForPlayer = useCallback((
    recording: RecordingEvent[],
    time: number,
    initialFoundWords: Set<string>
  ): PlayerState => {
    const newState: PlayerState = {
      currentSwipePath: Array(16).fill(false),
      currentKeyboardTracePath: Array(16).fill(false),
      currentKeyboardWord: '',
      swipeLines: [],
      swipePathIndexes: [],
      foundWordsSet: new Set(initialFoundWords),
      currentSwipeWord: '',
      boardRotation: 0,
      score: 0,
    };

    let lastSwipeStartTime = 0;
    const seenIndexes = new Set<string>();

    for (const event of recording) {
      if (event.timestamp <= time) {
        if (event.type === 'swipe_letter') {
          if (event.timestamp >= lastSwipeStartTime) {
            const idx = event.y + event.x * 4;
            const positionKey = `${event.x},${event.y}`;
            
            const eventWord = 'word' in event ? event.word : undefined;
            const currentPathWord = newState.swipePathIndexes.map(([x, y]) => board[x][y]).join('');
            const isNewWordStart = eventWord !== undefined && newState.swipePathIndexes.length > 0 && (
              (eventWord.length === 1 && currentPathWord.length >= 2) ||
              (eventWord.length > 0 && !eventWord.startsWith(currentPathWord) && !currentPathWord.startsWith(eventWord))
            );
            
            if (isNewWordStart) {
              newState.currentSwipePath.fill(false);
              newState.swipePathIndexes.length = 0;
              seenIndexes.clear();
              lastSwipeStartTime = event.timestamp;
            }
            
            const existingIndex = newState.swipePathIndexes.findIndex(([px, py]) => px === event.x && py === event.y);
            
            if (existingIndex >= 0) {
              const removeCount = newState.swipePathIndexes.length - existingIndex - 1;
              for (let i = 0; i < removeCount; i++) {
                const [removedX, removedY] = newState.swipePathIndexes.pop()!;
                const removedIdx = removedY + removedX * 4;
                newState.currentSwipePath[removedIdx] = false;
                seenIndexes.delete(`${removedX},${removedY}`);
              }
              newState.currentSwipePath[idx] = true;
              seenIndexes.add(positionKey);
            } else {
              newState.currentSwipePath[idx] = true;
              newState.swipePathIndexes.push([event.x, event.y]);
              seenIndexes.add(positionKey);
            }
          }
        } else if (event.type === 'keyboard_word') {
          newState.currentKeyboardWord = event.word;
          newState.currentKeyboardTracePath = [...event.tracePath];
        } else if (event.type === 'word_clear') {
          newState.currentKeyboardWord = '';
          newState.currentKeyboardTracePath = Array(16).fill(false);
          newState.currentSwipePath.fill(false);
          newState.swipePathIndexes.length = 0;
          seenIndexes.clear();
          lastSwipeStartTime = event.timestamp;
        } else if (event.type === 'word_submit') {
          newState.foundWordsSet.add(event.word.toLowerCase());
          // Calculate and add score
          const wordScore = calculateWordScore(event.word, boojum, snark);
          newState.score += wordScore;
          newState.currentSwipePath.fill(false);
          newState.swipePathIndexes.length = 0;
          seenIndexes.clear();
          lastSwipeStartTime = event.timestamp;
        } else if (event.type === 'board_rotation') {
          newState.boardRotation = event.rotation;
        }
      }
    }

    // Build swipe lines
    for (let i = 1; i < newState.swipePathIndexes.length; i++) {
      const [x1, y1] = newState.swipePathIndexes[i - 1];
      const [x2, y2] = newState.swipePathIndexes[i];
      newState.swipeLines.push({ x1, y1, x2, y2 });
    }

    // Build current swipe word
    if (newState.swipePathIndexes.length > 0) {
      newState.currentSwipeWord = newState.swipePathIndexes.map(([x, y]) => board[x][y]).join('');
    } else {
      newState.currentSwipeWord = '';
    }

    return newState;
  }, [board, boojum, snark]);

  const processEventsUpToTime = useCallback((time: number) => {
    if (player1?.recording) {
      const newState1 = processEventsForPlayer(
        player1.recording,
        time,
        initialFoundWords1Ref.current
      );
      setPlayer1State(newState1);
    }

    if (player2?.recording) {
      const newState2 = processEventsForPlayer(
        player2.recording,
        time,
        initialFoundWords2Ref.current
      );
      setPlayer2State(newState2);
    }
  }, [player1?.recording, player2?.recording, processEventsForPlayer]);

  const processEventsRef = useRef(processEventsUpToTime);
  useEffect(() => {
    processEventsRef.current = processEventsUpToTime;
  }, [processEventsUpToTime]);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || maxTime === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const startTime = performance.now() - (currentTimeRef.current / playbackSpeed);
    startTimeRef.current = startTime;

    const update = () => {
      const now = performance.now();
      const elapsed = (now - startTime) * playbackSpeed;
      const newTime = Math.min(elapsed, maxTime);
      setCurrentTime(newTime);
      processEventsRef.current(newTime);

      if (newTime < maxTime) {
        animationFrameRef.current = requestAnimationFrame(update);
      } else {
        setIsPlaying(false);
      }
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, maxTime]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentTime >= maxTime) {
        setCurrentTime(0);
        processEventsUpToTime(0);
      }
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setPlayer1State({
      currentSwipePath: Array(16).fill(false),
      currentKeyboardWord: '',
      currentKeyboardTracePath: Array(16).fill(false),
      swipeLines: [],
      foundWordsSet: new Set(),
      currentSwipeWord: '',
      boardRotation: 0,
      score: 0,
      swipePathIndexes: [],
    });
    setPlayer2State({
      currentSwipePath: Array(16).fill(false),
      currentKeyboardWord: '',
      currentKeyboardTracePath: Array(16).fill(false),
      swipeLines: [],
      foundWordsSet: new Set(),
      currentSwipeWord: '',
      boardRotation: 0,
      score: 0,
      swipePathIndexes: [],
    });
    processEventsUpToTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    setIsPlaying(false);
    processEventsUpToTime(newTime);
  };

  // Initialize on mount
  useEffect(() => {
    if (player1?.recording && player1.recording.length > 0) {
      initialFoundWords1Ref.current = new Set();
    }
    if (player2?.recording && player2.recording.length > 0) {
      initialFoundWords2Ref.current = new Set();
    }
    processEventsUpToTime(0);
  }, [player1?.recording, player2?.recording, processEventsUpToTime]);

  // Draw swipe lines for both players
  useEffect(() => {
    const drawLines = (svgRef: React.RefObject<SVGSVGElement | null>, boardRef: React.RefObject<HTMLDivElement | null>, lines: Array<{ x1: number; y1: number; x2: number; y2: number }>) => {
      if (!svgRef.current || !boardRef.current || lines.length === 0) {
        if (svgRef.current) {
          svgRef.current.innerHTML = '';
        }
        return;
      }

      const svg = svgRef.current;
      svg.innerHTML = '';

      for (const line of lines) {
        const letter1 = boardRef.current?.querySelector(`[data-x="${line.x1}"][data-y="${line.y1}"]`) as HTMLElement;
        const letter2 = boardRef.current?.querySelector(`[data-x="${line.x2}"][data-y="${line.y2}"]`) as HTMLElement;
        
        if (letter1 && letter2 && boardRef.current) {
          const rect1 = letter1.getBoundingClientRect();
          const rect2 = letter2.getBoundingClientRect();
          const svgRect = svg.getBoundingClientRect();

          const x1 = rect1.left + rect1.width / 2 - svgRect.left;
          const y1 = rect1.top + rect1.height / 2 - svgRect.top;
          const x2 = rect2.left + rect2.width / 2 - svgRect.left;
          const y2 = rect2.top + rect2.height / 2 - svgRect.top;

          const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          lineEl.setAttribute('x1', x1.toString());
          lineEl.setAttribute('y1', y1.toString());
          lineEl.setAttribute('x2', x2.toString());
          lineEl.setAttribute('y2', y2.toString());
          lineEl.setAttribute('stroke', 'white');
          lineEl.setAttribute('stroke-width', '15');
          lineEl.setAttribute('stroke-opacity', '0.3');
          lineEl.setAttribute('stroke-linecap', 'round');
          lineEl.setAttribute('pointer-events', 'none');
          svg.appendChild(lineEl);
        }
      }
    };

    drawLines(svg1Ref, board1Ref, player1State.swipeLines);
    drawLines(svg2Ref, board2Ref, player2State.swipeLines);
  }, [player1State.swipeLines, player2State.swipeLines]);

  // Update SVG sizes
  useEffect(() => {
    const updateSize = (svgRef: React.RefObject<SVGSVGElement | null>, boardRef: React.RefObject<HTMLDivElement | null>) => {
      if (!svgRef.current || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      svgRef.current.style.width = `${rect.width}px`;
      svgRef.current.style.height = `${rect.height}px`;
    };

    updateSize(svg1Ref, board1Ref);
    updateSize(svg2Ref, board2Ref);

    const handleResize = () => {
      updateSize(svg1Ref, board1Ref);
      updateSize(svg2Ref, board2Ref);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderBoard = (
    playerState: PlayerState,
    _playerData: PlayerReplayData | null,
    boardRef: React.RefObject<HTMLDivElement | null>,
    isGreyedOut: boolean
  ) => {
    const checkMatchLocal = (word: string, availableWords: string[]): boolean => {
      if (!word || !availableWords || availableWords.length === 0) return false;
      const wordLower = word.toLowerCase();
      return availableWords.some(w => w.toLowerCase() === wordLower);
    };

    const checkPartialMatchLocal = (word: string, availableWords: string[]): boolean => {
      if (!word || !availableWords || availableWords.length === 0) return false;
      const wordLower = word.toLowerCase();
      return availableWords.some(w => w.toLowerCase().startsWith(wordLower));
    };

    const checkAlreadyFound = (word: string): boolean => {
      if (!word) return false;
      return playerState.foundWordsSet.has(word.toLowerCase());
    };

    return (
      <div className="synchronized-replay-board-wrapper">
        <div
          ref={boardRef}
          id="board"
          className={`board-dark ${isGreyedOut ? 'board-greyed-out' : ''}`}
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            padding: '16px',
            transform: `rotate(${playerState.boardRotation}deg)`,
            WebkitTransform: `rotate(${playerState.boardRotation}deg)`,
            MozTransform: `rotate(${playerState.boardRotation}deg)`,
            msTransform: `rotate(${playerState.boardRotation}deg)`,
            OTransform: `rotate(${playerState.boardRotation}deg)`,
            opacity: isGreyedOut ? 0.5 : 1,
          }}
        >
          {board.map((row, rowIdx) =>
            row.map((letter, colIdx) => {
              const idx = colIdx + rowIdx * 4;
              const isSwipeHighlighted = playerState.currentSwipePath[idx];
              const isKeyboardHighlighted = playerState.currentKeyboardTracePath[idx];
              const isHighlighted = isSwipeHighlighted || isKeyboardHighlighted;

              let tileClass = '';
              if (isHighlighted && !isGreyedOut) {
                let currentWord = '';
                if (isKeyboardHighlighted && playerState.currentKeyboardWord) {
                  currentWord = playerState.currentKeyboardWord;
                } else if (isSwipeHighlighted && playerState.currentSwipeWord) {
                  currentWord = playerState.currentSwipeWord;
                }

                if (currentWord) {
                  const availableWords = boardWords.filter(w => !playerState.foundWordsSet.has(w.toLowerCase()));
                  const exactMatch = checkMatchLocal(currentWord, availableWords);
                  const partialMatch = checkPartialMatchLocal(currentWord, availableWords);
                  const alreadyFound = checkAlreadyFound(currentWord);

                  if (exactMatch && !alreadyFound) {
                    tileClass = 'tile-match-dark';
                  } else if (partialMatch) {
                    tileClass = 'tile-partial-match-dark';
                  } else {
                    tileClass = 'tile-no-match-dark';
                  }
                }
              }

              const boojumRow = boojumArray?.[rowIdx];
              const bonusValue = boojumRow?.[colIdx] ?? 0;
              const isSnark = bonusValue === 1;
              const isBoojum = bonusValue === 2;

              if (isSnark) {
                tileClass += ' snark';
              }
              if (isBoojum) {
                tileClass += ' boojum';
              }

              return (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className={`letter dark-mode ${tileClass}`}
                  data-x={rowIdx}
                  data-y={colIdx}
                  data-index={idx}
                  data-letter={letter}
                  style={{
                    transform: `rotate(${-playerState.boardRotation}deg)`,
                    WebkitTransform: `rotate(${-playerState.boardRotation}deg)`,
                    MozTransform: `rotate(${-playerState.boardRotation}deg)`,
                    msTransform: `rotate(${-playerState.boardRotation}deg)`,
                    OTransform: `rotate(${-playerState.boardRotation}deg)`,
                  }}
                >
                  <div className="letValue">{letter}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const replayContent = (
    <div className="game-replay-container synchronized-replay-container">
      <div className="game-replay-header">
        <h3>Synchronized Replay</h3>
        {onClose && <button onClick={onClose} className="close-button">×</button>}
      </div>

      <div className="game-replay-controls">
        <button onClick={handlePlayPause} className="play-pause-button">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={handleReset} className="reset-button">⏮</button>
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(maxTime)}
        </div>
        <div className="speed-control">
          <label>Speed:</label>
          <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}>
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
            <option value="3">3x</option>
            <option value="4">4x</option>
            <option value="5">5x</option>
            <option value="6">6x</option>
            <option value="7">7x</option>
            <option value="8">8x</option>
            <option value="9">9x</option>
            <option value="10">10x</option>
          </select>
        </div>
      </div>

      <div className="game-replay-seekbar">
        <input
          type="range"
          min="0"
          max={maxTime}
          value={currentTime}
          onChange={handleSeek}
          step="100"
          className="seekbar-input"
        />
      </div>

      {/* Score bars stacked together for comparison */}
      <div className="synchronized-replay-score-bars">
        {/* Player 1 Score Bar */}
        <div className="synchronized-replay-score-bar-container">
          <span className="synchronized-replay-player-name" style={{ color: player1?.playerColor || '#fff' }}>
            {player1?.playerName || 'Player 1'}
          </span>
          <div className="synchronized-replay-score-bar-fill-wrapper">
            <div 
              className="synchronized-replay-score-bar-fill"
              style={{
                width: `${calculatedTotalPoints > 0 ? (player1State.score / calculatedTotalPoints) * 100 : 0}%`,
                backgroundColor: player1?.playerColor || '#71bbe9',
              }}
            />
          </div>
          <span className="synchronized-replay-score">{player1State.score} / {calculatedTotalPoints}</span>
        </div>

        {/* Player 2 Score Bar */}
        <div className="synchronized-replay-score-bar-container">
          <span className="synchronized-replay-player-name" style={{ color: player2?.playerColor || '#fff' }}>
            {player2?.playerName || 'Player 2'}
          </span>
          <div className="synchronized-replay-score-bar-fill-wrapper">
            <div 
              className="synchronized-replay-score-bar-fill"
              style={{
                width: `${calculatedTotalPoints > 0 ? (player2State.score / calculatedTotalPoints) * 100 : 0}%`,
                backgroundColor: player2?.playerColor || '#71bbe9',
              }}
            />
          </div>
          <span className="synchronized-replay-score">{player2State.score} / {calculatedTotalPoints}</span>
        </div>
      </div>

      <div className="synchronized-replay-boards">
        {/* Player 1 */}
        <div className="synchronized-replay-player">
          <div className="synchronized-replay-board-name" style={{ color: player1?.playerColor || '#fff' }}>
            {player1?.playerName || 'Player 1'}
          </div>
          <div className="synchronized-replay-board-container">
            {renderBoard(player1State, player1, board1Ref, !player1)}
            <svg
              ref={svg1Ref}
              className="replay-svg-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
              }}
            />
          </div>
          <div className="game-replay-keyboard-word" style={{ color: player1?.playerColor || '#fff' }}>
            {player1State.currentKeyboardWord || player1State.currentSwipeWord || '\u00A0'}
          </div>
        </div>

        {/* Player 2 */}
        <div className="synchronized-replay-player">
          <div className="synchronized-replay-board-name" style={{ color: player2?.playerColor || '#fff' }}>
            {player2?.playerName || 'Player 2'}
          </div>
          <div className="synchronized-replay-board-container">
            {renderBoard(player2State, player2, board2Ref, !player2)}
            <svg
              ref={svg2Ref}
              className="replay-svg-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
              }}
            />
          </div>
          <div className="game-replay-keyboard-word" style={{ color: player2?.playerColor || '#fff' }}>
            {player2State.currentKeyboardWord || player2State.currentSwipeWord || '\u00A0'}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(replayContent, document.body);
}

