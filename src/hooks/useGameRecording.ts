import { useRef, useCallback } from 'react';

/**
 * Game recording event types
 */
export type RecordingEventType = 'swipe_letter' | 'keyboard_word' | 'word_submit' | 'word_clear' | 'board_rotation';

export interface SwipeLetterEvent {
  type: 'swipe_letter';
  timestamp: number; // High-resolution timestamp (performance.now())
  letter: string;
  x: number;
  y: number;
  index: number; // 0-15 board position
}

export interface KeyboardWordEvent {
  type: 'keyboard_word';
  timestamp: number;
  word: string; // Current word string
  tracePath: boolean[]; // Which tiles are highlighted (16 elements)
}

export interface WordSubmitEvent {
  type: 'word_submit';
  timestamp: number;
  word: string;
}

export interface WordClearEvent {
  type: 'word_clear';
  timestamp: number;
}

export interface BoardRotationEvent {
  type: 'board_rotation';
  timestamp: number;
  rotation: number; // Total rotation angle in degrees
}

export type RecordingEvent = SwipeLetterEvent | KeyboardWordEvent | WordSubmitEvent | WordClearEvent | BoardRotationEvent;

export interface UseGameRecordingReturn {
  startRecording: () => void;
  stopRecording: () => void;
  recordSwipeLetter: (letter: string, x: number, y: number, index: number) => void;
  recordKeyboardWord: (word: string, tracePath: boolean[]) => void;
  recordWordSubmit: (word: string) => void;
  recordWordClear: () => void;
  recordBoardRotation: (rotation: number) => void;
  getRecording: () => RecordingEvent[];
  isRecording: boolean;
}

/**
 * Hook for recording game events with high-resolution timestamps
 * Uses performance.now() for accurate timing
 */
export function useGameRecording(): UseGameRecordingReturn {
  const recordingRef = useRef<RecordingEvent[]>([]);
  const isRecordingRef = useRef<boolean>(false);
  const startTimeRef = useRef<number | null>(null);

  const startRecording = useCallback(() => {
    recordingRef.current = [];
    isRecordingRef.current = true;
    startTimeRef.current = performance.now();
  }, []);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    startTimeRef.current = null;
  }, []);

  const getRelativeTimestamp = useCallback((): number => {
    if (startTimeRef.current === null) {
      return performance.now();
    }
    return performance.now() - startTimeRef.current;
  }, []);

  const recordSwipeLetter = useCallback((letter: string, x: number, y: number, index: number) => {
    if (!isRecordingRef.current) return;
    
    const event: SwipeLetterEvent = {
      type: 'swipe_letter',
      timestamp: getRelativeTimestamp(),
      letter,
      x,
      y,
      index,
    };
    recordingRef.current.push(event);
  }, [getRelativeTimestamp]);

  const recordKeyboardWord = useCallback((word: string, tracePath: boolean[]) => {
    if (!isRecordingRef.current) return;
    
    const event: KeyboardWordEvent = {
      type: 'keyboard_word',
      timestamp: getRelativeTimestamp(),
      word,
      tracePath: [...tracePath], // Copy array
    };
    recordingRef.current.push(event);
  }, [getRelativeTimestamp]);

  const recordWordSubmit = useCallback((word: string) => {
    if (!isRecordingRef.current) return;
    
    const event: WordSubmitEvent = {
      type: 'word_submit',
      timestamp: getRelativeTimestamp(),
      word,
    };
    recordingRef.current.push(event);
  }, [getRelativeTimestamp]);

  const recordWordClear = useCallback(() => {
    if (!isRecordingRef.current) return;
    
    const event: WordClearEvent = {
      type: 'word_clear',
      timestamp: getRelativeTimestamp(),
    };
    recordingRef.current.push(event);
  }, [getRelativeTimestamp]);

  const recordBoardRotation = useCallback((rotation: number) => {
    if (!isRecordingRef.current) return;
    
    const event: BoardRotationEvent = {
      type: 'board_rotation',
      timestamp: getRelativeTimestamp(),
      rotation,
    };
    recordingRef.current.push(event);
  }, [getRelativeTimestamp]);

  const getRecording = useCallback((): RecordingEvent[] => {
    return [...recordingRef.current]; // Return a copy
  }, []);

  return {
    startRecording,
    stopRecording,
    recordSwipeLetter,
    recordKeyboardWord,
    recordWordSubmit,
    recordWordClear,
    recordBoardRotation,
    getRecording,
    isRecording: isRecordingRef.current,
  };
}

