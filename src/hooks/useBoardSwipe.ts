import { useRef, useState, useCallback, useEffect } from "react";
import { playSound } from "../utils/sounds";
import { useBoardTheme } from "../contexts/BoardThemeContext";

interface LetterElement {
    element: HTMLDivElement;
    x: number;
    y: number;
    letter: string;
    index: number;
}

interface SwipeState {
    selectedLetters: LetterElement[];
    lastX: number | null;
    lastY: number | null;
    isMouseDown: boolean;
    tracePath: boolean[];
    tracePathIndexes: Array<[number, number]>;
}

type DebugPoint = { x: number; y: number; overLetter: boolean };

export function useBoardSwipe(
    boardRef: React.RefObject<HTMLDivElement | null>,
    gameStatus: "waiting" | "playing" | "finished" | undefined,
    onWordSubmit?: (word: string) => void,
    boardWords?: string[],
    wordsFound?: Set<string>,
    colorsOffOverride?: boolean,
    onExactMatch?: (word: string) => void,
    debugMode: boolean = false,
    boardRotationDeg: number = 0
) {

    const { darkMode, colorsOff: globalColorsOff } = useBoardTheme();
    const colorsOff =
        colorsOffOverride !== undefined ? colorsOffOverride : globalColorsOff;

    const [debugDot, setDebugDot] = useState<DebugPoint | null>(null);
    const [debugPath, setDebugPath] = useState<DebugPoint[]>([]);
    const debugPathRef = useRef<DebugPoint[]>([]);

    const [swipeState, setSwipeState] = useState<SwipeState>({
        selectedLetters: [],
        lastX: null,
        lastY: null,
        isMouseDown: false,
        tracePath: Array(16).fill(false),
        tracePathIndexes: [],
    });

    const swipeStateRef = useRef<SwipeState>({
        selectedLetters: [],
        lastX: null,
        lastY: null,
        isMouseDown: false,
        tracePath: Array(16).fill(false),
        tracePathIndexes: [],
    });

    useEffect(() => {
        swipeStateRef.current = swipeState;
    }, [swipeState]);

    const [currentWord, setCurrentWord] = useState("");
    const svgContainerRef = useRef<SVGSVGElement | null>(null);

    const isMouseDownRef = useRef(false);
    const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
    const processedLettersInMoveRef = useRef<Set<number>>(new Set());

    const lastSoundIndexRef = useRef<number | null>(null);
    const lastExactMatchRef = useRef<string>("");
    const isFinalizingRef = useRef(false);

    // ---------- helpers ----------
    const getContainerDiv = useCallback((element: Element | null): LetterElement | null => {
        if (!element) return null;

        if (element.classList.contains("letter")) {
            const x = parseInt(element.getAttribute("data-x") || "0");
            const y = parseInt(element.getAttribute("data-y") || "0");
            const letter = element.getAttribute("data-letter") || "";
            const index = parseInt(element.getAttribute("data-index") || "0");
            return { element: element as HTMLDivElement, x, y, letter, index };
        } else if (element.parentElement?.classList.contains("letter")) {
            const parent = element.parentElement;
            const x = parseInt(parent.getAttribute("data-x") || "0");
            const y = parseInt(parent.getAttribute("data-y") || "0");
            const letter = parent.getAttribute("data-letter") || "";
            const index = parseInt(parent.getAttribute("data-index") || "0");
            return { element: parent as HTMLDivElement, x, y, letter, index };
        }
        return null;
    }, []);

    const getLetterUnderPoint = useCallback(
        (clientX: number, clientY: number) => {
            const el = document.elementFromPoint(clientX, clientY);
            const letter = getContainerDiv(el);
            if (!letter) return null;

            // circle-only acceptance
            if (!isPointInsideCircle(letter.element, clientX, clientY)) return null;

            return letter;
        },
        [getContainerDiv]
    );

    const pushDebugPoint = useCallback(
        (clientX: number, clientY: number) => {
            if (!debugMode) return;
            const boardEl = boardRef.current;
            if (!boardEl) return;
            // ✅ Convert to board-local coords (works even when rotated)
            const { x, y } = clientToBoardLocal(boardEl, clientX, clientY, boardRotationDeg);

            const hit = getLetterUnderPoint(clientX, clientY);
            const p = { x, y, overLetter: !!hit };

            setDebugDot(p);

            setDebugPath(prev => {
                const next = [...prev, p];
                const capped = next.length > 250 ? next.slice(next.length - 250) : next;
                debugPathRef.current = capped;
                return capped;
            });
        },
        [boardRef, getLetterUnderPoint, debugMode, boardRotationDeg]
    );

    const isAdjacent = useCallback(
        (x: number, y: number, lastX: number | null, lastY: number | null) => {
            if (lastX === null || lastY === null) return true;
            return y >= lastY - 1 && y <= lastY + 1 && x >= lastX - 1 && x <= lastX + 1;
        },
        []
    );

    const alreadySelected = useCallback((letter: LetterElement, selected: LetterElement[]) => {
        return selected.some((l) => l.element === letter.element);
    }, []);

    const currentlySelected = useCallback(
        (x: number, y: number, lastX: number | null, lastY: number | null) => {
            return x === lastX && y === lastY;
        },
        []
    );

    const isPreviousLetter = useCallback((letter: LetterElement, selected: LetterElement[]) => {
        return selected.length > 1 && selected.slice(0, -1).some((l) => l.element === letter.element);
    }, []);



    // ---------- drawing ----------
    const drawLine = useCallback((letter1: LetterElement, letter2: LetterElement) => {
        if (!svgContainerRef.current) return;

        const rect1 = letter1.element.getBoundingClientRect();
        const rect2 = letter2.element.getBoundingClientRect();
        const svgRect = svgContainerRef.current.getBoundingClientRect();

        const x1 = rect1.left + rect1.width / 2 - svgRect.left;
        const y1 = rect1.top + rect1.height / 2 - svgRect.top;
        const x2 = rect2.left + rect2.width / 2 - svgRect.left;
        const y2 = rect2.top + rect2.height / 2 - svgRect.top;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1.toString());
        line.setAttribute("y1", y1.toString());
        line.setAttribute("x2", x2.toString());
        line.setAttribute("y2", y2.toString());
        line.setAttribute("stroke", "white");
        line.setAttribute("stroke-width", "15");
        line.setAttribute("stroke-opacity", "0.3");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("pointer-events", "none");
        svgContainerRef.current.appendChild(line);
    }, []);

    const clearLines = useCallback(() => {
        if (svgContainerRef.current) svgContainerRef.current.innerHTML = "";
    }, []);

    const removeLine = useCallback(() => {
        if (svgContainerRef.current && svgContainerRef.current.lastElementChild) {
            svgContainerRef.current.removeChild(svgContainerRef.current.lastElementChild);
        }
    }, []);

    // ---------- matching / colors ----------
    const checkMatch = useCallback((word: string, wordsOnBoard: string[]) => {
        return wordsOnBoard.includes(word);
    }, []);

    const checkPartialMatch = useCallback((word: string, wordsOnBoard: string[]) => {
        return wordsOnBoard.some((w) => w.startsWith(word));
    }, []);

    const clearTileColors = useCallback(() => {
        if (!boardRef.current) return;
        const letterContainers = boardRef.current.getElementsByClassName("letter");
        for (let i = 0; i < letterContainers.length; i++) {
            const el = letterContainers[i] as HTMLElement;
            el.classList.remove(
                "tile-no-match-dark",
                "tile-match-dark",
                "tile-partial-match-dark",
                "tile-no-match-light",
                "tile-match-light",
                "tile-partial-match-light",
                "tile-no-match-grey-dark",
                "tile-no-match-grey-light",
                "tile-match-grey-light"
            );
        }
    }, [boardRef]);

    const updateTileColors = useCallback(
        (tracePath: boolean[], word: string, wordsOnBoard: string[], foundWords: Set<string>) => {
            if (!boardRef.current || !wordsOnBoard || wordsOnBoard.length === 0) return;

            clearTileColors();

            const availableWords = wordsOnBoard.filter(
                (w) => !foundWords.has(w.toLowerCase()) && !foundWords.has(w.toUpperCase())
            );

            const exactMatch = checkMatch(word, availableWords);
            const partialMatch = checkPartialMatch(word, availableWords);

            if (exactMatch && onExactMatch && word && word !== lastExactMatchRef.current) {
                const upper = word.toUpperCase();
                if (!foundWords.has(upper) && !foundWords.has(upper.toLowerCase())) {
                    lastExactMatchRef.current = word;
                    onExactMatch(word);
                }
            }

            if (!exactMatch && lastExactMatchRef.current === word) {
                lastExactMatchRef.current = "";
            }

            const modeSuffix = darkMode ? "dark" : "light";

            let tileClass: string;
            if (colorsOff) {
                tileClass = exactMatch ? `tile-match-${modeSuffix}` : `tile-no-match-grey-${modeSuffix}`;
            } else {
                if (exactMatch) tileClass = `tile-match-${modeSuffix}`;
                else if (partialMatch) tileClass = `tile-partial-match-${modeSuffix}`;
                else tileClass = `tile-no-match-${modeSuffix}`;
            }

            const letterContainers = boardRef.current.getElementsByClassName("letter");
            for (let i = 0; i < letterContainers.length; i++) {
                const el = letterContainers[i] as HTMLElement;
                if (tracePath[i]) el.classList.add(tileClass);
            }
        },
        [boardRef, checkMatch, checkPartialMatch, clearTileColors, darkMode, colorsOff, onExactMatch]
    );

    // ---------- main selection ----------
    const handleLetterTouch = useCallback(
        (letter: LetterElement | null) => {
            if (!letter || gameStatus !== "playing") return;

            const { x, y } = letter;

            setSwipeState((prev) => {
                const { selectedLetters, lastX, lastY } = prev;

                if (alreadySelected(letter, selectedLetters) || currentlySelected(x, y, lastX, lastY)) {
                    if (isPreviousLetter(letter, selectedLetters)) {
                        const matchIndex = selectedLetters.findIndex((l) => l.element === letter.element);
                        if (matchIndex === -1) return prev;

                        const lettersToRemove = selectedLetters.length - 1 - matchIndex;
                        const newSelected = selectedLetters.slice(0, matchIndex + 1);
                        const newTracePath = Array(16).fill(false);
                        const newTracePathIndexes = prev.tracePathIndexes.slice(0, matchIndex + 1);

                        for (const [tx, ty] of newTracePathIndexes) {
                            const idx = ty + tx * 4;
                            newTracePath[idx] = true;
                        }

                        for (let i = 0; i < lettersToRemove; i++) removeLine();

                        clearLines();
                        for (let i = 1; i < newSelected.length; i++) {
                            drawLine(newSelected[i - 1], newSelected[i]);
                        }

                        const word = newSelected.length > 0 ? newSelected.map((l) => l.letter).join("") : "";

                        if (lettersToRemove > 0 && lastSoundIndexRef.current !== letter.index) {
                            playSound("tick");
                            lastSoundIndexRef.current = letter.index;
                        }

                        const currentFound = wordsFound || new Set<string>();
                        if (boardWords && boardWords.length > 0 && word) {
                            updateTileColors(newTracePath, word, boardWords, currentFound);
                        }

                        const newLastX = newSelected.length ? newSelected[newSelected.length - 1].x : null;
                        const newLastY = newSelected.length ? newSelected[newSelected.length - 1].y : null;

                        setCurrentWord(word);

                        const newState = {
                            ...prev,
                            selectedLetters: newSelected,
                            lastX: newLastX,
                            lastY: newLastY,
                            tracePath: newTracePath,
                            tracePathIndexes: newTracePathIndexes,
                        };
                        swipeStateRef.current = newState;
                        return newState;
                    }

                    swipeStateRef.current = prev;
                    return prev;
                }

                if (lastX === null || isAdjacent(x, y, lastX, lastY)) {
                    const newSelected = [...selectedLetters, letter];
                    const newTracePath = [...prev.tracePath];
                    const idx = y + x * 4;
                    newTracePath[idx] = true;

                    const newTracePathIndexes = [...prev.tracePathIndexes, [x, y] as [number, number]];

                    if (newSelected.length > 1) {
                        drawLine(newSelected[newSelected.length - 2], newSelected[newSelected.length - 1]);
                    }

                    const word = newSelected.map((l) => l.letter).join("");

                    if (lastSoundIndexRef.current !== letter.index) {
                        playSound("tick");
                        lastSoundIndexRef.current = letter.index;
                    }

                    const currentFound = wordsFound || new Set<string>();
                    if (boardWords && boardWords.length > 0) {
                        updateTileColors(newTracePath, word, boardWords, currentFound);
                    }

                    setCurrentWord(word);

                    const newState = {
                        ...prev,
                        selectedLetters: newSelected,
                        lastX: x,
                        lastY: y,
                        tracePath: newTracePath,
                        tracePathIndexes: newTracePathIndexes,
                    };
                    swipeStateRef.current = newState;
                    return newState;
                }

                swipeStateRef.current = prev;
                return prev;
            });
        },
        [
            gameStatus,
            alreadySelected,
            currentlySelected,
            isAdjacent,
            isPreviousLetter,
            drawLine,
            removeLine,
            clearLines,
            boardWords,
            updateTileColors,
            wordsFound,
        ]
    );

    const finalizeWordSelection = useCallback(() => {
        if (isFinalizingRef.current) return;
        isFinalizingRef.current = true;

        clearTileColors();

        const currentState = swipeStateRef.current;
        const word = currentState.selectedLetters.map((l) => l.letter).join("");
        const wordToSubmit = currentState.selectedLetters.length > 0 && word ? word : null;

        const clearedState: SwipeState = {
            selectedLetters: [],
            lastX: null,
            lastY: null,
            isMouseDown: false,
            tracePath: Array(16).fill(false),
            tracePathIndexes: [],
        };

        swipeStateRef.current = clearedState;
        setSwipeState(clearedState);

        if (wordToSubmit && onWordSubmit) onWordSubmit(wordToSubmit);

        setCurrentWord("");
        clearLines();

        lastSoundIndexRef.current = null;
        lastExactMatchRef.current = "";
        lastPointerPositionRef.current = null;
        processedLettersInMoveRef.current.clear();

        setDebugDot(null);
        setDebugPath([]);
        debugPathRef.current = [];

        setTimeout(() => {
            isFinalizingRef.current = false;
        }, 100);
    }, [onWordSubmit, clearLines, clearTileColors]);

    /**
     * IMPORTANT: pointerType is used to prevent "mouse hover selects letters"
     * - mouse: only track while isMouseDownRef.current === true
     * - touch/pen: track while pointer is active (your component should call setPointerCapture)
     */
    const pointerRef = useRef({
        isActive: false,
        id: -1,
        type: "mouse" as string,
    });



    const handlePointerPosition = useCallback(
        (clientX: number, clientY: number) => {
            if (!boardRef.current) return;
            if (gameStatus !== "playing") return;
            if (!pointerRef.current.isActive) return;

            const currentPos = { x: clientX, y: clientY };
            const last = lastPointerPositionRef.current;

            // --- breadcrumb trail + letter sampling ---
            if (last) {
                const dx = currentPos.x - last.x;
                const dy = currentPos.y - last.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const step = 10;
                const steps = Math.max(1, Math.ceil(dist / step));

                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const sx = last.x + dx * t;
                    const sy = last.y + dy * t;

                    pushDebugPoint(sx, sy);

                    const letter = getLetterUnderPoint(sx, sy);
                    if (letter) handleLetterTouch(letter);
                }
            } else {
                pushDebugPoint(clientX, clientY);

                const letter = getLetterUnderPoint(clientX, clientY);
                if (letter) handleLetterTouch(letter);
            }

            lastPointerPositionRef.current = currentPos;
        },
        [boardRef, gameStatus, pushDebugPoint, getLetterUnderPoint, handleLetterTouch]
    );

    // Mouse down only starts the swipe
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (gameStatus !== "playing") return;
            e.preventDefault();

            isMouseDownRef.current = true;

            lastPointerPositionRef.current = { x: e.clientX, y: e.clientY };
            processedLettersInMoveRef.current.clear();

            // ensure first point is processed
            handlePointerPosition(e.clientX, e.clientY);

            setSwipeState((prev) => {
                const ns = { ...prev, isMouseDown: true };
                swipeStateRef.current = ns;
                return ns;
            });
        },
        [gameStatus, handlePointerPosition]
    );

    const handlePointerDown = useCallback(
        (pointerId: number, pointerType: string, clientX: number, clientY: number) => {
            if (gameStatus !== "playing") return;

            pointerRef.current.isActive = true;
            pointerRef.current.id = pointerId;
            pointerRef.current.type = pointerType;

            lastPointerPositionRef.current = null;
            processedLettersInMoveRef.current.clear();

            handlePointerPosition(clientX, clientY);
        },
        [gameStatus, handlePointerPosition]
    );

    const handlePointerMove = useCallback(
        (pointerId: number, clientX: number, clientY: number) => {
            if (!pointerRef.current.isActive) return;
            if (pointerRef.current.id !== pointerId) return;

            handlePointerPosition(clientX, clientY);
        },
        [handlePointerPosition]
    );

    const handlePointerUp = useCallback(() => {
        if (!pointerRef.current.isActive) return;

        pointerRef.current.isActive = false;
        pointerRef.current.id = -1;

        finalizeWordSelection();
    }, [finalizeWordSelection]);



    // document mouse move/up (drag outside board)
    useEffect(() => {
        if (!boardRef.current) return;

        const handleDocumentMouseMove = (e: MouseEvent) => {
            if (isMouseDownRef.current && gameStatus === "playing") {
                e.preventDefault();
                handlePointerPosition(e.clientX, e.clientY);
            }
        };

        const handleDocumentMouseUp = (e: MouseEvent) => {
            if (!isMouseDownRef.current) return;

            e.preventDefault();
            isMouseDownRef.current = false;

            lastPointerPositionRef.current = null;
            processedLettersInMoveRef.current.clear();

            setSwipeState((prev) => {
                const ns = { ...prev, isMouseDown: false };
                swipeStateRef.current = ns;
                return ns;
            });

            finalizeWordSelection();
        };

        document.addEventListener("mousemove", handleDocumentMouseMove);
        document.addEventListener("mouseup", handleDocumentMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleDocumentMouseMove);
            document.removeEventListener("mouseup", handleDocumentMouseUp);
        };
    }, [gameStatus, handlePointerPosition, finalizeWordSelection, boardRef]);

    // keep svg overlay sized
    useEffect(() => {
        if (!svgContainerRef.current || !boardRef.current) return;

        const updateSize = () => {
            if (!svgContainerRef.current || !boardRef.current) return;
            const rect = boardRef.current.getBoundingClientRect();
            svgContainerRef.current.style.width = `${rect.width}px`;
            svgContainerRef.current.style.height = `${rect.height}px`;
            svgContainerRef.current.style.pointerEvents = "none";
        };

        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, [boardRef]);

    return {
        swipeState,
        currentWord,
        svgContainerRef,
        handleMouseDown,
        handleLetterTouch,
        finalizeWordSelection,
        handlePointerPosition,
        debugDot,
        debugPath,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    };
}

function isPointInsideCircle(el: HTMLElement, clientX: number, clientY: number) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    // shrink a bit so you don't accept near-edge grazing
    const radius = Math.min(r.width, r.height) / 2 - 2;

    const dx = clientX - cx;
    const dy = clientY - cy;

    return dx * dx + dy * dy <= radius * radius;
}

function clientToBoardLocal(
    boardEl: HTMLElement,
    clientX: number,
    clientY: number,
    rotationDeg: number
) {
    const rect = boardEl.getBoundingClientRect();

    // Center of the *transformed* element in viewport coords
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Board's *untransformed* size (the coordinate system your children use)
    const w = boardEl.clientWidth;
    const h = boardEl.clientHeight;

    // Inverse rotation (undo the board rotation)
    const a = (-rotationDeg * Math.PI) / 180;

    const dx = clientX - cx;
    const dy = clientY - cy;

    const lx = dx * Math.cos(a) - dy * Math.sin(a) + w / 2;
    const ly = dx * Math.sin(a) + dy * Math.cos(a) + h / 2;

    return { x: lx, y: ly };
}
