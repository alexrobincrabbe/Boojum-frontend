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
    const [guestId, setGuestId] = useState<string | null>(null);

    // Load guest_id from localStorage on mount
    useEffect(() => {
        if (!isGuest) {
            setGuestName("");
            setGuestId(null);
            return;
        }

        const existingName = localStorage.getItem("guest_name");
        if (existingName) {
            setGuestName(existingName);
        } else {
            // Safe: runs in effect, not render
            const name = `Guest_${crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10)}`;
            localStorage.setItem("guest_name", name);
            setGuestName(name);
        }

        // Load guest_id from localStorage
        const existingGuestId = localStorage.getItem("guest_id");
        if (existingGuestId) {
            setGuestId(existingGuestId);
        }
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
        // Convert VITE_WS_BASE_URL from https:// to wss:// if set, otherwise use fallback
        const wsBaseUrlEnv = import.meta.env.VITE_WS_BASE_URL;
        const wsBaseUrl = wsBaseUrlEnv
            ? wsBaseUrlEnv.replace(/^http:/, "ws:").replace(/^https:/, "wss:")
            : djangoBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");

        // Build URL with guest_id query parameter if available
        const baseUrl = `${wsBaseUrl}/ws/game/${roomId}/${guestParam}/`;
        if (isGuest && guestId) {
            const url = new URL(baseUrl);
            url.searchParams.set("guest_id", guestId);
            return url.toString();
        }
        return baseUrl;
    }, [roomId, isGuest, guestName, guestId, customWsUrl]);


    // Handle incoming WebSocket messages
    const handleMessage = useCallback(
        (message: InboundMessage) => {
            switch (message.type) {
                case 'STATE_SNAPSHOT': {
                    const newState = message.state;
                    
                    // Store guest_id if provided (for guests)
                    if (newState.guestId && isGuest) {
                        localStorage.setItem("guest_id", newState.guestId);
                        setGuestId(newState.guestId);
                    }
                    
                    setGameState(newState);
                    onGameStateChange?.(newState);

                    // Update timer using phase-based timing (new Redis system) or legacy timing
                    const timer = timerRef.current;
                    let shouldUpdateTimer = false;
                    let remainingTime = 0;
                    let initialTime = 0;

                    // Check for timer data in order of preference:
                    // 1. Server-provided remainingTime (most accurate)
                    // 2. Legacy timeRemaining
                    // 3. Calculate from phase info if available
                    
                    if (newState.remainingTime !== undefined || newState.timeRemaining !== undefined) {
                        // Don't start timer if phase_started_at is 0 (no timer running yet)
                        if (newState.phaseStartedAt === 0) {
                            shouldUpdateTimer = false;
                        } else {
                            // Use provided remainingTime or timeRemaining (preferred)
                            remainingTime = newState.remainingTime ?? newState.timeRemaining ?? 0;
                            // Determine initial time from phase duration or legacy fields
                            if (newState.phaseDuration !== undefined) {
                                initialTime = newState.phaseDuration;
                            } else if (newState.initialTimer !== undefined) {
                                initialTime = newState.initialTimer;
                            } else if (newState.gameTime !== undefined) {
                                initialTime = newState.gameTime;
                            } else {
                                // Default fallback
                                initialTime = newState.gameStatus === 'playing' ? (newState.gameTime || 90) : 45;
                            }
                            shouldUpdateTimer = true;
                        }
                    } else if (newState.phase && newState.phaseStartedAt !== undefined && newState.phaseDuration !== undefined && newState.serverNow !== undefined) {
                        // Don't start timer if phase_started_at is 0 (no timer running yet)
                        if (newState.phaseStartedAt === 0) {
                            shouldUpdateTimer = false;
                        } else {
                            // Calculate remaining time from phase info (fallback if remainingTime not provided)
                            const serverNow = newState.serverNow;
                            const phaseStartedAt = newState.phaseStartedAt;
                            const phaseDuration = newState.phaseDuration;
                            
                            // Calculate elapsed time: serverNow is when message was sent, so elapsed = serverNow - phaseStartedAt
                            const phaseElapsed = serverNow - phaseStartedAt;
                            remainingTime = Math.max(0, phaseDuration - phaseElapsed);
                            
                            initialTime = phaseDuration;
                            shouldUpdateTimer = true;
                        }
                    } else if (newState.initialTimer !== undefined) {
                        // Legacy timer support - only initialTimer provided
                        initialTime = newState.initialTimer;
                        // If no remaining time provided, assume full duration
                        remainingTime = initialTime;
                        shouldUpdateTimer = true;
                    }

                    if (shouldUpdateTimer) {
                        timer.time = remainingTime;
                        timer.progressBar = remainingTime;
                        timer.initialTimer = initialTime;
                        timer.initialProgressBar = initialTime;
                        setDisplayTime(remainingTime);
                        setInitialTimer(initialTime);
                        
                        // Restart timer sync when receiving STATE_SNAPSHOT with timer data
                        timer.lastUpdateTime = performance.now();
                        timer.lastUpdateTimeProgressBar = performance.now();

                        // Clear existing intervals
                        if (timer.timerInterval) clearInterval(timer.timerInterval);
                        if (timer.progressBarInterval) clearInterval(timer.progressBarInterval);

                        // Start new intervals to restart the offline timer
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
                        // Merge delta with previous state (or create new state)
                        const updated: GameState = prev ? { ...prev, ...message.delta } : {
                            roomId: '',
                            players: [],
                            gameStatus: (message.delta.gameStatus as 'waiting' | 'playing' | 'finished') || 'waiting',
                            ...message.delta,
                        } as GameState;
                        
                        // If board is in delta update, always use it (for new players joining mid-game)
                        if (message.delta.board) {
                            // Track when a board is first shown - set it immediately if board exists
                            if (updated?.board && !hasBoardBeenShownRef.current) {
                                hasBoardBeenShownRef.current = true;
                                setHasBoardBeenShown(true);
                            }
                        } else {
                            // Ensure board is preserved if it exists in prev but not in delta
                            if (prev?.board && !message.delta.board && updated) {
                                updated.board = prev.board;
                            }
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

                    // Sync timer when server sends timer updates (phase-based or legacy)
                    const delta = message.delta;
                    let shouldUpdateTimer = false;
                    let remainingTime = 0;
                    let initialTime = 0;

                    // Prefer phase-based timing if available
                    // Don't skip timer initialization for intermission phase (it should start)
                    if (delta.phase && delta.phaseStartedAt !== undefined && delta.phaseDuration !== undefined && delta.serverNow !== undefined) {
                        // Only skip if phase_started_at is 0 (no timer running yet)
                        if (delta.phaseStartedAt === 0) {
                            shouldUpdateTimer = false;
                        } else {
                            const now = Math.floor(Date.now() / 1000);
                            const serverNow = delta.serverNow as number;
                            const phaseStartedAt = delta.phaseStartedAt as number;
                            const phaseDuration = delta.phaseDuration as number;
                            
                            const clientElapsed = now - serverNow;
                            const phaseElapsed = (now - phaseStartedAt) - clientElapsed;
                            remainingTime = Math.max(0, phaseDuration - phaseElapsed);
                            initialTime = phaseDuration;
                            shouldUpdateTimer = true;
                        }
                    } else if (delta.remainingTime !== undefined) {
                        // Use remainingTime if provided (e.g., from intermission_start message)
                        remainingTime = delta.remainingTime as number;
                        // Determine initial time from phase duration or other fields
                        if (delta.phaseDuration !== undefined) {
                            initialTime = delta.phaseDuration as number;
                        } else if (delta.initialTimer !== undefined) {
                            initialTime = delta.initialTimer as number;
                        } else if (delta.gameTime !== undefined) {
                            initialTime = delta.gameTime as number;
                        } else {
                            initialTime = 90; // Default fallback
                        }
                        // Start timer if remainingTime is provided (intermission and game phases should start)
                        // Only skip if remainingTime is 0 (no timer running yet)
                        if (remainingTime !== 0) {
                            shouldUpdateTimer = true;
                        }
                    } else if (delta.timeRemaining !== undefined || delta.initialTimer !== undefined) {
                        // Legacy timer support
                        if (delta.timeRemaining !== undefined) {
                            remainingTime = delta.timeRemaining as number;
                        }
                        if (delta.initialTimer !== undefined) {
                            initialTime = delta.initialTimer as number;
                        } else if (delta.gameTime !== undefined) {
                            initialTime = delta.gameTime as number;
                        }
                        shouldUpdateTimer = true;
                    }

                    if (shouldUpdateTimer) {
                        const timer = timerRef.current;
                        timer.time = remainingTime;
                        timer.progressBar = remainingTime;
                        timer.initialTimer = initialTime;
                        timer.initialProgressBar = initialTime;
                        setDisplayTime(remainingTime);
                        setInitialTimer(initialTime);

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
                    setGameState((prev) => {
                        if (!prev) return prev;
                        const updated = {
                            ...prev,
                            gameStatus: 'finished' as const,
                            finalScores: message.finalScores,
                            totalPoints: message.totalPoints,
                            wordsByLength: message.wordsByLength,
                        };
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
                    // Unknown message type, ignore
                }
            }
        },
        [initializeWordLists, onGameStateChange, onPreviousBoardChange, isGuest, guestId]
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
        guestId: guestId,
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

