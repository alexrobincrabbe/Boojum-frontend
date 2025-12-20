import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useGameSocket } from '../../../ws/useGameSocket';
import type { InboundMessage, GameState, OutboundMessage } from '../../../ws/protocol';

interface TimerState {
    displayTime: number | null;
    progressBarWidth: number;
    initialTimer: number;
}

interface UseGameWebSocketParams {
    roomId: string | undefined;
    token: string;
    isGuest: boolean;
    initializeWordLists: (wordsByLength: Record<string, string[]>, gameState?: GameState | null, sendJson?: (message: any) => void) => void;
    onGameStateChange?: (gameState: GameState | null) => void;
    onPreviousBoardChange?: (board: string[][] | null) => void;
    onScoreInChat?: (playerName: string, score: number) => void; // Callback for one-shot score messages
    wsUrl?: string; // Optional custom WebSocket URL (for daily boards)
    onMessage?: (message: InboundMessage) => void; // Optional message handler
}

interface UseGameWebSocketReturn {
    connectionState: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'closing';
    gameState: GameState | null;
    timerState: TimerState;
    hasBoardBeenShown: boolean;
    previousBoard: string[][] | null;
    sendJson: (message: OutboundMessage) => void;
    reconnect: () => void;
    resetState: () => void;
}

export function useGameWebSocket({
    roomId,
    token,
    isGuest,
    initializeWordLists,
    onGameStateChange,
    onPreviousBoardChange,
    onScoreInChat,
    wsUrl: customWsUrl,
    onMessage: customOnMessage,
}: UseGameWebSocketParams): UseGameWebSocketReturn {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [hasBoardBeenShown, setHasBoardBeenShown] = useState(false);
    const hasBoardBeenShownRef = useRef(false);
    const [previousBoard, setPreviousBoard] = useState<string[][] | null>(null);

    // Timer state using refs to avoid re-renders
    const timerRef = useRef({
        time: 0,
        initialTimer: 0,
        lastUpdateTime: 0,
        lastUpdateTimeProgressBar: 0,
        progressBar: 0,
        initialProgressBar: 0,
        timerInterval: null as ReturnType<typeof setInterval> | null,
        progressBarInterval: null as ReturnType<typeof setInterval> | null,
    });

    // Local timer display state (updated by intervals)
    const [displayTime, setDisplayTime] = useState<number | null>(null);
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const [initialTimer, setInitialTimer] = useState(0);

    // Build WebSocket URL (matches Django Channels routing: ws/game/{room_slug}/{guest}/)
    // Use the Django server URL, not the Vite dev server

    const [guestName, setGuestName] = useState<string>("");

    useEffect(() => {
        if (!isGuest) {
            setGuestName("");
            return;
        }

        const existing = localStorage.getItem("guest_name");
        if (existing) {
            setGuestName(existing);
            return;
        }

        // Safe: runs in effect, not render
        const name = `Guest_${crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10)}`;
        localStorage.setItem("guest_name", name);
        setGuestName(name);
    }, [isGuest]);


    const wsUrl = useMemo(() => {
        // If custom URL is provided (for daily boards or tournament), use it
        // If customWsUrl is explicitly provided (even if empty string), use it
        // This prevents falling back to default URL construction when waiting for matchInfo
        if (customWsUrl !== undefined) return customWsUrl;
        
        if (!roomId) return "";
        const guestParam = isGuest ? guestName : "user";

        if (isGuest && !guestName) return ""; // wait until guestName is ready

        // build base url exactly like you already do
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
        const djangoBaseUrl = apiBaseUrl.replace("/api", "");
        const wsBaseUrl =
            import.meta.env.VITE_WS_BASE_URL ||
            djangoBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");

        return `${wsBaseUrl}/ws/game/${roomId}/${guestParam}/`;
    }, [roomId, isGuest, guestName, customWsUrl]);


    // Handle incoming WebSocket messages
    const handleMessage = useCallback(
        (message: InboundMessage) => {
            switch (message.type) {
                case 'STATE_SNAPSHOT': {
                    const newState = message.state;
                    setGameState(newState);
                    onGameStateChange?.(newState);

                    // Track when a board is first shown - set it immediately if board exists
                    if (newState.board && !hasBoardBeenShownRef.current) {
                        hasBoardBeenShownRef.current = true;
                        setHasBoardBeenShown(true);
                    }

                    // Initialize word lists if board is present (for reconnection restoration)
                    // Pass newState directly so initializeWordLists has access to gameRoundId and other state
                    if (newState.wordsByLength && Array.isArray(Object.values(newState.wordsByLength)[0])) {
                        const wordsByLength = newState.wordsByLength as Record<string, string[]>;
                        initializeWordLists(wordsByLength, newState, sendJson);
                    }
                    break;
                }

                case 'DELTA_UPDATE': {
                    setGameState((prev) => {
                        // If board is in delta update, always use it (for new players joining mid-game)
                        if (message.delta.board) {
                            // Board update - merge with existing state or create new state
                            const updated: GameState = prev ? { ...prev, ...message.delta } : {
                                roomId: '',
                                players: [],
                                gameStatus: (message.delta.gameStatus as 'waiting' | 'playing' | 'finished') || 'waiting',
                                ...message.delta,
                            } as GameState;
                            
                            // Track when a board is first shown - set it immediately if board exists
                            if (updated?.board && !hasBoardBeenShownRef.current) {
                                hasBoardBeenShownRef.current = true;
                                setHasBoardBeenShown(true);
                            }
                            
                            onGameStateChange?.(updated);
                            return updated;
                        }
                        
                        // For non-board updates, preserve board if it's not in the delta update
                        const updated = prev ? { ...prev, ...message.delta } : prev;
                        // Ensure board is preserved if it exists in prev but not in delta
                        if (prev?.board && !message.delta.board && updated) {
                            updated.board = prev.board;
                        }

                        // Clear finalScores when new game starts (status changes to 'playing')
                        if (message.delta.gameStatus === 'playing' && prev?.finalScores && updated) {
                            const { finalScores, totalPoints, wordsByLength, ...rest } = updated;
                            Object.assign(updated, rest);
                            delete (updated as any).finalScores;
                            delete (updated as any).totalPoints;
                            delete (updated as any).wordsByLength;
                        } else {
                            // Preserve finalScores and wordsByLength if game is still finished or waiting
                            if (updated && (updated.gameStatus === 'finished' || updated.gameStatus === 'waiting')) {
                                // Preserve finalScores if it exists in prev
                                if (prev?.finalScores) {
                                    updated.finalScores = prev.finalScores;
                                }
                                if (prev?.totalPoints !== undefined) {
                                    updated.totalPoints = prev.totalPoints;
                                }
                                // Always preserve wordsByLength if it exists in prev and is in final format (with WordData)
                                if (prev?.wordsByLength) {
                                    const firstValue = Object.values(prev.wordsByLength)[0];
                                    if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue)) {
                                        // This is the final format - preserve it
                                        updated.wordsByLength = prev.wordsByLength;
                                    } else if (!message.delta.wordsByLength) {
                                        // Simple format - preserve if not being overwritten
                                        updated.wordsByLength = prev.wordsByLength;
                                    }
                                }
                            }
                        }

                        // Store boojum and snark for score calculation (they're already in message.delta)
                        // No need to set them separately as they're already merged above

                        // Track when a board is first shown - set it immediately if board exists
                        if (updated?.board && !hasBoardBeenShownRef.current) {
                            hasBoardBeenShownRef.current = true;
                            setHasBoardBeenShown(true);
                        }

                        // Store previous board when game status changes to waiting
                        if (updated?.gameStatus === 'waiting' && updated?.board) {
                            setPreviousBoard(updated.board);
                            onPreviousBoardChange?.(updated.board);
                        }

                        onGameStateChange?.(updated);
                        return updated;
                    });

                    // Initialize word lists and counters when board updates
                    // For DELTA_UPDATE, we need to merge with previous state to get full gameState
                    if (message.delta.wordsByLength) {
                        const wordsByLength = message.delta.wordsByLength as Record<
                            string,
                            string[]
                        >;
                        // Get the updated state by merging current gameState with delta
                        setGameState((currentState) => {
                            const updatedState = currentState ? { ...currentState, ...message.delta } : null;
                            initializeWordLists(wordsByLength, updatedState, sendJson);
                            return currentState; // Return unchanged to avoid double update
                        });
                    }

                    // Sync timer when server sends timer updates
                    if (
                        message.delta.timeRemaining !== undefined ||
                        message.delta.initialTimer !== undefined
                    ) {
                        const timer = timerRef.current;
                        if (message.delta.timeRemaining !== undefined) {
                            timer.time = message.delta.timeRemaining as number;
                            timer.progressBar = message.delta.timeRemaining as number;
                            setDisplayTime(message.delta.timeRemaining as number);
                        }
                        if (message.delta.initialTimer !== undefined) {
                            const initial = message.delta.initialTimer as number;
                            timer.initialTimer = initial;
                            timer.initialProgressBar = initial;
                            setInitialTimer(initial);
                        }

                        // Restart offline timer when synced
                        timer.lastUpdateTime = performance.now();
                        timer.lastUpdateTimeProgressBar = performance.now();

                        // Clear existing intervals
                        if (timer.timerInterval) clearInterval(timer.timerInterval);
                        if (timer.progressBarInterval)
                            clearInterval(timer.progressBarInterval);

                        // Start new intervals
                        timer.timerInterval = setInterval(() => {
                            const t = timerRef.current;
                            const elapsed = (performance.now() - t.lastUpdateTime) / 1000;
                            t.lastUpdateTime = performance.now();
                            if (t.time > 0) {
                                t.time = Math.max(0, t.time - Math.round(elapsed));
                                setDisplayTime(t.time);
                            }
                        }, 1000);

                        timer.progressBarInterval = setInterval(() => {
                            const t = timerRef.current;
                            const elapsed =
                                (performance.now() - t.lastUpdateTimeProgressBar) / 1000;
                            t.lastUpdateTimeProgressBar = performance.now();

                            if (t.initialProgressBar > 0) {
                                const container = document.getElementById('timer-bar-container');
                                if (container) {
                                    const containerWidth = parseFloat(
                                        window.getComputedStyle(container).width
                                    );
                                    const width =
                                        (containerWidth * t.progressBar) / t.initialProgressBar;
                                    setProgressBarWidth(Math.max(0, width));
                                }
                                t.progressBar = Math.max(0, t.progressBar - elapsed);
                            }
                        }, 100);
                    }
                    break;
                }

                case 'SCORE_UPDATE': {
                    setGameState((prev) => {
                        if (!prev) return prev;
                        const updatedPlayers = prev.players.map((player) =>
                            player.id === message.scores.playerId
                                ? { ...player, score: message.scores.score }
                                : player
                        );
                        const updated = { ...prev, players: updatedPlayers };
                        onGameStateChange?.(updated);
                        return updated;
                    });
                    break;
                }


                case 'SCORE_IN_CHAT': {
                    // Handle one-shot score message - format as "player got x points" in blue italics
                    if (onScoreInChat) {
                        onScoreInChat(message.playerName, message.score);
                    }
                    break;
                }

                case 'ERROR': {
                    toast.error(message.message);
                    break;
                }

                case 'SHOW_BACK_BUTTON': {
                    // This is handled by custom message handler if provided
                    break;
                }

                case 'FINAL_SCORES': {
                    // Final scores are handled by the parent component
                    // We just pass them through via onGameStateChange
                    const receiveTime = performance.now();
                    const receiveTimestamp = new Date().toISOString();
                    console.log(`[Frontend] [TIMESTAMP] Received FINAL_SCORES at ${receiveTimestamp} (${receiveTime.toFixed(3)}ms)`);
                    setGameState((prev) => {
                        if (!prev) return prev;
                        const updateTime = performance.now();
                        const updated = {
                            ...prev,
                            gameStatus: 'finished' as const,
                            finalScores: message.finalScores,
                            totalPoints: message.totalPoints,
                            wordsByLength: message.wordsByLength,
                        };
                        console.log(`[Frontend] [TIMESTAMP] Updated gameState with finalScores at ${new Date().toISOString()} (${updateTime.toFixed(3)}ms, ${(updateTime - receiveTime).toFixed(3)}ms after receive)`);
                        onGameStateChange?.(updated);
                        return updated;
                    });
                    break;
                }

                case 'PONG': {
                    // Heartbeat response, no action needed
                    break;
                }

                default: {
                    console.warn('Unknown message type:', message);
                }
            }
        },
        [initializeWordLists, onGameStateChange, onPreviousBoardChange]
    );

    const handleWsError = useCallback((err: Event | Error) => {
        console.error('WebSocket error:', err);
        toast.error('Connection error occurred');
    }, []);

    const handleWsOpen = useCallback(() => {
        // Connection opened successfully
    }, []);

    const handleWsClose = useCallback(() => {
        // Connection closed
    }, []);

    const { connectionState, sendJson, reconnect } = useGameSocket({
        url: wsUrl,
        roomId: roomId || '',
        token,
        maxAttempts: 10,
        initialReconnectDelay: 1000,
        maxReconnectDelay: 30000,
        pauseOnHidden: true,
        heartbeatInterval: 15000, // 15 seconds
        onMessage: (message) => {
            // Call custom message handler if provided (before main handler)
            if (customOnMessage) {
                customOnMessage(message);
            }
            // Always call the main handler
            handleMessage(message);
        },
        onError: handleWsError,
        onOpen: handleWsOpen,
        onClose: handleWsClose,
    });

    // Reset state function
    const resetState = useCallback(() => {
        setGameState(null);
        // Error cleared
        setHasBoardBeenShown(false);
        hasBoardBeenShownRef.current = false;
        setPreviousBoard(null);
        setDisplayTime(null);
        setProgressBarWidth(0);
        setInitialTimer(0);
        // Clear timer intervals
        if (timerRef.current.timerInterval) {
            clearInterval(timerRef.current.timerInterval);
            timerRef.current.timerInterval = null;
        }
        if (timerRef.current.progressBarInterval) {
            clearInterval(timerRef.current.progressBarInterval);
            timerRef.current.progressBarInterval = null;
        }
    }, []);

    // Cleanup intervals on unmount
    useEffect(() => {
        const timer = timerRef.current;
        return () => {
            if (timer.timerInterval) {
                clearInterval(timer.timerInterval);
            }
            if (timer.progressBarInterval) {
                clearInterval(timer.progressBarInterval);
            }
        };
    }, []);

    return {
        connectionState,
        gameState,
        timerState: {
            displayTime,
            progressBarWidth,
            initialTimer,
        },
        hasBoardBeenShown,
        previousBoard,
        sendJson,
        reconnect,
        resetState,
    };
}

