import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { RecordingEvent } from '../../../hooks/useGameRecording';
import '../../game-room/GameRoom.css';
import './GameReplay.css';

interface GameReplayProps {
  recording: RecordingEvent[];
  board: string[][];
  boardWords: string[];
  playerColor: string;
  playerName: string;
  foundWords?: boolean[]; // Array indicating which words were found (1 = found, 0 = not found)
  onClose?: () => void;
}

export function GameReplay({
  recording,
  board,
  boardWords,
  playerColor,
  playerName,
  foundWords: _foundWords, // Prefixed with _ to indicate intentionally unused
  onClose,
}: GameReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentSwipePath, setCurrentSwipePath] = useState<boolean[]>(Array(16).fill(false));
  const [currentKeyboardWord, setCurrentKeyboardWord] = useState('');
  const [currentKeyboardTracePath, setCurrentKeyboardTracePath] = useState<boolean[]>(Array(16).fill(false));
  const [swipeLines, setSwipeLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([]);
  const [foundWordsSet, setFoundWordsSet] = useState<Set<string>>(new Set());
  const [currentSwipeWord, setCurrentSwipeWord] = useState('');
  const [boardRotation, setBoardRotation] = useState(0);
  
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const initialFoundWordsRef = useRef<Set<string>>(new Set());

  // Find the maximum timestamp in the recording
  const maxTime = recording.length > 0 
    ? Math.max(...recording.map(e => e.timestamp))
    : 0;

  // Playback loop
  useEffect(() => {
    if (!isPlaying || recording.length === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const startTime = performance.now() - (currentTime / playbackSpeed);
    startTimeRef.current = startTime;

    const update = () => {
      const now = performance.now();
      const elapsed = (now - startTime) * playbackSpeed;
      const newTime = Math.min(elapsed, maxTime);
      setCurrentTime(newTime);

      // Process events up to current time
      processEventsUpToTime(newTime);

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
  }, [isPlaying, playbackSpeed, recording, maxTime]);

  // Helper functions for word matching (same as in useBoardSwipe and useKeyboardInput)
  const checkMatch = useCallback((word: string, availableWords: string[]): boolean => {
    if (!word || !availableWords || availableWords.length === 0) return false;
    const wordLower = word.toLowerCase();
    return availableWords.some(w => w.toLowerCase() === wordLower);
  }, []);

  const checkPartialMatch = useCallback((word: string, availableWords: string[]): boolean => {
    if (!word || !availableWords || availableWords.length === 0) return false;
    const wordLower = word.toLowerCase();
    return availableWords.some(w => w.toLowerCase().startsWith(wordLower));
  }, []);

  const checkAlreadyFound = useCallback((word: string): boolean => {
    if (!word) return false;
    return foundWordsSet.has(word.toLowerCase());
  }, [foundWordsSet]);

  const processEventsUpToTime = useCallback((time: number) => {
    // Clear current state
    const newSwipePath = Array(16).fill(false);
    let newKeyboardTracePath = Array(16).fill(false);
    let newKeyboardWord = '';
    const newSwipeLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const swipePathIndexes: Array<[number, number]> = [];
    // Build found words set from initial + all word_submit events up to current time
    let newFoundWordsSet = new Set<string>(initialFoundWordsRef.current);
    let newBoardRotation = 0;

    // Track when the current swipe sequence started (after last word_submit or word_clear)
    let lastSwipeStartTime = 0;

    // Process all events up to current time in chronological order
    const seenIndexes = new Set<string>(); // Track seen positions to avoid duplicates
    for (const event of recording) {
      if (event.timestamp <= time) {
        if (event.type === 'swipe_letter') {
          // Only show swipe if it's part of the current active swipe sequence
          if (event.timestamp >= lastSwipeStartTime) {
            const idx = event.y + event.x * 4;
            const positionKey = `${event.x},${event.y}`;
            // Only add if we haven't seen this position in the current swipe sequence
            if (!seenIndexes.has(positionKey)) {
              newSwipePath[idx] = true;
              swipePathIndexes.push([event.x, event.y]);
              seenIndexes.add(positionKey);
            }
          }
        } else if (event.type === 'keyboard_word') {
          newKeyboardWord = event.word;
          newKeyboardTracePath = [...event.tracePath];
        } else if (event.type === 'word_clear') {
          newKeyboardWord = '';
          newKeyboardTracePath = Array(16).fill(false);
          // Clear swipe path when word is cleared
          newSwipePath.fill(false);
          swipePathIndexes.length = 0;
          seenIndexes.clear(); // Clear seen indexes when word is cleared
          lastSwipeStartTime = event.timestamp;
        } else if (event.type === 'word_submit') {
          // Track found words
          newFoundWordsSet.add(event.word.toLowerCase());
          // Clear swipe path and lines when word is submitted
          newSwipePath.fill(false);
          swipePathIndexes.length = 0;
          seenIndexes.clear(); // Clear seen indexes when word is submitted
          lastSwipeStartTime = event.timestamp;
        } else if (event.type === 'board_rotation') {
          newBoardRotation = event.rotation;
        }
      }
    }

    // Build swipe lines from path indexes (only for current active swipe)
    for (let i = 1; i < swipePathIndexes.length; i++) {
      const [x1, y1] = swipePathIndexes[i - 1];
      const [x2, y2] = swipePathIndexes[i];
      newSwipeLines.push({ x1, y1, x2, y2 });
    }

    // Build current swipe word from path indexes
    let currentSwipeWord = '';
    if (swipePathIndexes.length > 0) {
      currentSwipeWord = swipePathIndexes.map(([x, y]) => board[x][y]).join('');
    }

    setFoundWordsSet(newFoundWordsSet);
    setCurrentSwipePath(newSwipePath);
    setCurrentKeyboardWord(newKeyboardWord);
    setCurrentKeyboardTracePath(newKeyboardTracePath);
    setSwipeLines(newSwipeLines);
    setCurrentSwipeWord(currentSwipeWord);
    setSwipePathIndexes(swipePathIndexes);
    setBoardRotation(newBoardRotation);
  }, [recording, board]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentTime >= maxTime) {
        // Reset to beginning
        setCurrentTime(0);
        processEventsUpToTime(0);
      }
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentSwipePath(Array(16).fill(false));
    setCurrentKeyboardWord('');
    setCurrentKeyboardTracePath(Array(16).fill(false));
    setSwipeLines([]);
    processEventsUpToTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    setIsPlaying(false);
    processEventsUpToTime(newTime);
  };

  // Initialize on mount and when recording changes
  useEffect(() => {
    if (recording.length > 0) {
      // Start with empty found words - they will be added as word_submit events are processed
      initialFoundWordsRef.current = new Set();
      setFoundWordsSet(new Set());
      processEventsUpToTime(0);
    }
  }, [recording, processEventsUpToTime]);

  // Draw swipe lines
  useEffect(() => {
    if (!svgRef.current || !boardRef.current || swipeLines.length === 0) {
      if (svgRef.current) {
        svgRef.current.innerHTML = '';
      }
      return;
    }

    const svg = svgRef.current;
    svg.innerHTML = '';

    for (const line of swipeLines) {
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
  }, [swipeLines]);

  // Update SVG size
  useEffect(() => {
    if (!svgRef.current || !boardRef.current) return;

    const updateSize = () => {
      if (!svgRef.current || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      svgRef.current.style.width = `${rect.width}px`;
      svgRef.current.style.height = `${rect.height}px`;
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const replayContent = recording.length === 0 ? (
    <div className="game-replay-container">
      <div className="game-replay-header">
        <h3 style={{ color: playerColor }}>Game Replay - {playerName}</h3>
        {onClose && <button onClick={onClose} className="close-button">×</button>}
      </div>
      <div className="game-replay-message">No recording available for this game.</div>
    </div>
  ) : (
    <div className="game-replay-container">
      <div className="game-replay-header">
        <h3 style={{ color: playerColor }}>Game Replay - {playerName}</h3>
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

      <div className="game-replay-board-container">
        <div
          ref={boardRef}
          id="board"
          className="board-dark"
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            padding: '16px',
            transform: `rotate(${boardRotation}deg)`,
            WebkitTransform: `rotate(${boardRotation}deg)`,
            MozTransform: `rotate(${boardRotation}deg)`,
            msTransform: `rotate(${boardRotation}deg)`,
            OTransform: `rotate(${boardRotation}deg)`,
          }}
        >
          {board.map((row, rowIdx) =>
            row.map((letter, colIdx) => {
              const idx = colIdx + rowIdx * 4;
              const isSwipeHighlighted = currentSwipePath[idx];
              const isKeyboardHighlighted = currentKeyboardTracePath[idx];
              const isHighlighted = isSwipeHighlighted || isKeyboardHighlighted;

              // Determine color based on word validity
              let tileClass = '';
              if (isHighlighted) {
                // Build current word from swipe or keyboard
                let currentWord = '';
                if (isKeyboardHighlighted && currentKeyboardWord) {
                  currentWord = currentKeyboardWord;
                } else if (isSwipeHighlighted && currentSwipeWord) {
                  currentWord = currentSwipeWord;
                }

                if (currentWord) {
                  // Filter out found words from available words
                  const availableWords = boardWords.filter(w => !foundWordsSet.has(w.toLowerCase()));
                  const exactMatch = checkMatch(currentWord, availableWords);
                  const partialMatch = checkPartialMatch(currentWord, availableWords);
                  const alreadyFound = checkAlreadyFound(currentWord);

                  // Apply color classes (same as game)
                  if (exactMatch && !alreadyFound) {
                    tileClass = 'tile-match-dark'; // Green
                  } else if (partialMatch) {
                    tileClass = 'tile-partial-match-dark'; // Yellow
                  } else {
                    tileClass = 'tile-no-match-dark'; // Pink
                  }
                }
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
                    transform: `rotate(${-boardRotation}deg)`,
                    WebkitTransform: `rotate(${-boardRotation}deg)`,
                    MozTransform: `rotate(${-boardRotation}deg)`,
                    msTransform: `rotate(${-boardRotation}deg)`,
                    OTransform: `rotate(${-boardRotation}deg)`,
                  }}
                >
                  <div className="letValue">{letter}</div>
                </div>
              );
            })
          )}
        </div>
        <svg
          ref={svgRef}
          className="replay-svg-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        />
      </div>

      <div className="game-replay-keyboard-word" style={{ color: playerColor }}>
        {currentKeyboardWord || '\u00A0'}
      </div>
    </div>
  );

  return createPortal(replayContent, document.body);
}

