import React, { useState, useEffect, useRef, useCallback } from 'react';
import { minigamesAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { Loading } from '../../../components/Loading';
import './Doodledum.css';

interface FeedItem {
  is_doodle: boolean;
  doodle_url: string | null;
  guess: string | null;
  correct: boolean;
  created_at: string;
  user: string;
  chat_color: string;
}

const COLORS = [
  '#000000', '#FFFFFF', '#5C5C5C', '#999999', '#583300', '#785800', '#FD6708', '#FF8648',
  '#FEB43F', '#F3E1BD', '#FEF20B', '#96D35F', '#089E09', '#085A08', '#008C80', '#0BA4F3',
  '#1EECF2', '#8BD0FA', '#011D57', '#371A94', '#8738FA', '#6A0999', '#D413FD', '#FF5596',
  '#FF97B0', '#A0000D', '#E80B08'
];

const Doodledum: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [activeDoodledum, setActiveDoodledum] = useState<{
    drawer?: string;
    is_doodledum?: string;
    is_drawn?: string;
    word?: string;
    is_current_user_drawing?: boolean;
  } | null>(null);
  const [guess, setGuess] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingWord, setDrawingWord] = useState<string | null>(null);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const guessInputRef = useRef<HTMLInputElement>(null);
  
  // Drawing state
  const [tool, setTool] = useState<'draw' | 'eraser' | 'fill'>('draw');
  const [brushSize, setBrushSize] = useState(4);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const drawingStartedInsideCanvas = useRef(false);
  const mouseButtonDown = useRef(false);
  const isMousePointer = useRef(false);

  useEffect(() => {
    loadFeed();
    checkDoodledum();
    
    const interval = setInterval(() => {
      loadFeed();
      checkDoodledum();
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset lastPos when tool, brush size, or color changes to prevent drawing from old position
  useEffect(() => {
    lastPos.current = null;
    drawing.current = false;
    drawingStartedInsideCanvas.current = false;
  }, [tool, brushSize, currentColor]);

  const updateCursor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (tool === 'fill') {
      // Use bucket cursor icon for fill mode
      canvas.style.cursor = `url("/images/bucket-cursor-icon.png") 34 28, auto`;
      return;
    }
    
    const size = tool === 'eraser' ? 25 : brushSize * 2 + 6; // add a little padding for border
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const cx = c.getContext('2d');
    if (!cx) return;
    
    cx.fillStyle = 'rgba(255,255,255,0)';
    cx.fillRect(0, 0, size, size);
    
    if (tool === 'eraser') {
      cx.strokeStyle = '#000';
      cx.lineWidth = 2;
      cx.strokeRect(1, 1, 23, 23);
    } else {
      const radius = brushSize / 2;
      cx.beginPath();
      cx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
      cx.fillStyle = currentColor;
      cx.fill();
      // Add a border to keep the cursor visible; white border if brush is black
      cx.strokeStyle = currentColor.toLowerCase() === '#000000' ? '#ffffff' : '#000000';
      cx.lineWidth = 2;
      cx.stroke();
    }
    
    const url = c.toDataURL('image/png');
    canvas.style.cursor = `url(${url}) ${size / 2} ${size / 2}, auto`;
  }, [tool, brushSize, currentColor]);

  useEffect(() => {
    if (isDrawing && canvasRef.current) {
      resizeCanvas();
      updateCursor();
    }
  }, [isDrawing, isFullscreen, updateCursor]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as { msFullscreenElement?: Element }).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      if (isCurrentlyFullscreen && canvasRef.current) {
        // Delay resize to ensure fullscreen dimensions are set
        setTimeout(() => {
          resizeCanvas();
          updateCursor();
        }, 100);
      } else if (canvasRef.current) {
        // Exit fullscreen - resize back
        setTimeout(() => {
          resizeCanvas();
          updateCursor();
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [updateCursor]);

  // Global mouse down/up/move listeners to track mouse button state and position
  // Note: Touch events are handled by pointer events on the canvas, so we only need global mouse listeners
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      // Track mouse button down globally (mouse only)
      if (e.button === 0) { // Left mouse button
        isMousePointer.current = true;
        mouseButtonDown.current = true;
        // Prevent default drag behavior
        e.preventDefault();
        // Initialize lastPos if not set (for clicks outside canvas)
        if (!lastPos.current) {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            lastPos.current = {
              x: (e.clientX - rect.left) * scaleX,
              y: (e.clientY - rect.top) * scaleY
            };
          }
        }
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Track mouse position globally when button is down (for clicks outside canvas) - mouse only
      if (mouseButtonDown.current && !drawing.current) {
        // Prevent default drag behavior
        e.preventDefault();
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          lastPos.current = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
          };
        }
      }
    };

    const handleGlobalMouseUp = () => {
      // Always reset mouse button state on global mouse up
      if (isMousePointer.current) {
        mouseButtonDown.current = false;
        // Only stop drawing if we were actually drawing
        if (drawing.current || drawingStartedInsideCanvas.current) {
          drawing.current = false;
          drawingStartedInsideCanvas.current = false;
          lastPos.current = null;
        }
      }
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousedown', handleGlobalMouseDown);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const loadFeed = async () => {
    try {
      const data = await minigamesAPI.getDoodledumFeed();
      setFeed(data.doodledum_feed || []);
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDoodledum = async () => {
    try {
      const data = await minigamesAPI.checkDoodledum();
      setActiveDoodledum(data);
      
      if (data.is_current_user_drawing || (isAuthenticated && user && data.drawer && data.is_doodledum === 'yes' && data.is_drawn === 'no')) {
        const currentUsername = user?.username;
        const isUserDrawing = data.is_current_user_drawing || (currentUsername && data.drawer && data.drawer.toLowerCase() === currentUsername.toLowerCase());
        
        if (isUserDrawing) {
          setIsDrawing(true);
          if (data.word) {
            setDrawingWord(data.word);
          }
        } else {
          setIsDrawing(false);
          setDrawingWord(null);
        }
      } else if (data.is_drawn === 'yes' || data.is_doodledum === 'no') {
        setIsDrawing(false);
        setDrawingWord(null);
      }
    } catch (error) {
      console.error('Failed to check doodledum:', error);
    }
  };

  const handleFetchDoodledum = async (difficulty: string) => {
    if (!isAuthenticated) {
      toast.error('Please login to draw a sketch');
      return;
    }

    try {
      const data = await minigamesAPI.fetchDoodledum(difficulty);
      if (data.already_active === 'yes') {
        toast.error('Someone is already drawing. Please wait.');
      } else if (data.word) {
        toast.success(`Your word to draw: ${data.word}`);
        setDrawingWord(data.word);
        setIsDrawing(true);
        resetCanvas();
      }
    } catch (error: unknown) {
      console.error('Failed to fetch doodledum:', error);
      const errorMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to fetch doodledum';
      toast.error(errorMessage);
    }
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    // Save current canvas content
    const temp = document.createElement('canvas');
    const oldWidth = canvas.width || rect.width;
    const oldHeight = canvas.height || rect.height;
    temp.width = oldWidth;
    temp.height = oldHeight;
    const tempCtx = temp.getContext('2d');
    if (tempCtx) {
      // Only copy existing content if canvas has been drawn on
      if (oldWidth > 0 && oldHeight > 0) {
        tempCtx.drawImage(canvas, 0, 0);
      } else {
        // Initialize with white background
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, oldWidth, oldHeight);
      }
    }
    
    // Set new canvas dimensions
    const newWidth = rect.width;
    const newHeight = rect.height;
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // Restore content, scaling if size changed
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Fill with white background first
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, newWidth, newHeight);
      
      if (tempCtx && oldWidth > 0 && oldHeight > 0) {
        // Scale the existing drawing to fit the new size
        ctx.drawImage(temp, 0, 0, oldWidth, oldHeight, 0, 0, newWidth, newHeight);
      }
    }
  };

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const newState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack(prev => {
      const newStack = [...prev, newState];
      return newStack.slice(-100);
    });
    setRedoStack([]);
  };

  const resetDrawingState = () => {
    lastPos.current = null;
    drawing.current = false;
    drawingStartedInsideCanvas.current = false;
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (undoStack.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setUndoStack([]);
      setRedoStack([]);
      resetDrawingState();
      return;
    }
    
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setRedoStack(prev => [...prev, currentState]);
    
    const prevState = undoStack[undoStack.length - 1];
    ctx.putImageData(prevState, 0, 0);
    setUndoStack(prev => prev.slice(0, -1));
    resetDrawingState();
    updateCursor();
  };

  const handleRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (redoStack.length === 0) return;
    
    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack(prev => [...prev, currentState]);
    
    const nextState = redoStack[redoStack.length - 1];
    ctx.putImageData(nextState, 0, 0);
    setRedoStack(prev => prev.slice(0, -1));
    resetDrawingState();
    updateCursor();
  };

  const resetCanvas = () => {
    saveState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    resetDrawingState();
    updateCursor();
  };

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    
    const fr = parseInt(fillColor.slice(1, 3), 16);
    const fg = parseInt(fillColor.slice(3, 5), 16);
    const fb = parseInt(fillColor.slice(5, 7), 16);
    const fa = 255;
    
    const pos = (startY * w + startX) * 4;
    const sr = data[pos];
    const sg = data[pos + 1];
    const sb = data[pos + 2];
    const sa = data[pos + 3];
    
    if (sr === fr && sg === fg && sb === fb && sa === fa) return;
    
    const stack = [[startX, startY]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const idx = (y * w + x) * 4;
      if (
        data[idx] === sr &&
        data[idx + 1] === sg &&
        data[idx + 2] === sb &&
        data[idx + 3] === sa
      ) {
        data[idx] = fr;
        data[idx + 1] = fg;
        data[idx + 2] = fb;
        data[idx + 3] = fa;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const clampToCanvasBounds = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x, y };
    return {
      x: Math.max(0, Math.min(canvas.width, x)),
      y: Math.max(0, Math.min(canvas.height, y))
    };
  };

  const getEdgeCoordinates = (fromX: number, fromY: number, toX: number, toY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Check if line crosses any boundary
    let edgeX = toX;
    let edgeY = toY;
    
    // Calculate intersection with canvas boundaries
    const dx = toX - fromX;
    const dy = toY - fromY;
    
    if (dx === 0 && dy === 0) return null;
    
    // Check left edge (x = 0)
    if (toX < 0 && fromX >= 0) {
      const t = -fromX / dx;
      edgeY = fromY + dy * t;
      edgeX = 0;
    }
    // Check right edge (x = width)
    else if (toX > width && fromX <= width) {
      const t = (width - fromX) / dx;
      edgeY = fromY + dy * t;
      edgeX = width;
    }
    // Check top edge (y = 0)
    else if (toY < 0 && fromY >= 0) {
      const t = -fromY / dy;
      edgeX = fromX + dx * t;
      edgeY = 0;
    }
    // Check bottom edge (y = height)
    else if (toY > height && fromY <= height) {
      const t = (height - fromY) / dy;
      edgeX = fromX + dx * t;
      edgeY = height;
    }
    
    // Clamp to ensure it's within bounds
    return clampToCanvasBounds(edgeX, edgeY);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Track if this is a mouse pointer (not touch)
    const isMouse = e.pointerType === 'mouse';
    isMousePointer.current = isMouse;
    
    if (tool === 'fill') {
      e.preventDefault();
      e.stopPropagation();
      const coords = getCanvasCoordinates(e);
      if (!coords) return;
      saveState();
      floodFill(Math.floor(coords.x), Math.floor(coords.y), currentColor);
      return;
    }
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // For mouse, track button state
    if (isMouse) {
      mouseButtonDown.current = true;
    }
    
    // Check if click started inside or outside canvas (applies to both mouse and touch)
    const isInside = coords.x >= 0 && coords.x <= canvas.width && coords.y >= 0 && coords.y <= canvas.height;
    
    if (isInside) {
      // Click started inside canvas - normal behavior
      drawingStartedInsideCanvas.current = true;
      drawing.current = true;
      saveState();
      handleDown(coords.x, coords.y);
    } else {
      // Click started outside canvas - wait for pointer to enter (applies to both mouse and touch)
      // Store the outside position for edge calculation
      lastPos.current = { x: coords.x, y: coords.y };
      drawingStartedInsideCanvas.current = false;
      drawing.current = false;
      // Don't save state yet - wait until we actually start drawing
    }
  };

  const handleDown = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    drawing.current = true;
    lastPos.current = { x, y };
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    
    if (tool === 'eraser') {
      const half = 12.5;
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(x - half, y - half, 25, 25);
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = 'round';
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
      ctx.lineTo(x + 0.01, y + 0.01);
      ctx.stroke();
      ctx.closePath();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const isMouse = e.pointerType === 'mouse';
    
    // For mouse, only continue if button is still down
    if (isMouse && !mouseButtonDown.current) {
      return;
    }
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check if coordinates are inside canvas bounds
    const isInside = coords.x >= 0 && coords.x <= canvas.width && coords.y >= 0 && coords.y <= canvas.height;
    
    // Handle entry from outside (either re-entry or initial entry) - applies to both mouse and touch
    // Check if we have a last position and if we're entering from outside
    if (lastPos.current) {
      const lastX = lastPos.current.x;
      const lastY = lastPos.current.y;
      const wasOutside = lastX < 0 || lastX > canvas.width || lastY < 0 || lastY > canvas.height;
      
      if (wasOutside && isInside) {
        // Entering canvas: calculate entry point on edge and start drawing from there
        const edgeCoords = getEdgeCoordinates(lastX, lastY, coords.x, coords.y);
        if (edgeCoords) {
          // If we weren't drawing yet, initialize drawing
          if (!drawing.current) {
            saveState();
            drawing.current = true;
            drawingStartedInsideCanvas.current = true;
            // Initialize drawing context at the edge point
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
              }
            }
            // Set lastPos to the outside position first, then draw to edge
            lastPos.current = { x: lastX, y: lastY };
            // Draw from outside position to edge
            handleMove(edgeCoords.x, edgeCoords.y);
            // Now update lastPos to edge and continue to current position
            lastPos.current = { x: edgeCoords.x, y: edgeCoords.y };
            handleMove(coords.x, coords.y);
          } else {
            // Already drawing (re-entry), we need to draw from exit edge to entry edge, then from entry to current
            // Calculate exit edge: where we left the canvas
            // We can find this by calculating the intersection from the outside point to the inside point
            const insideX = coords.x;
            const insideY = coords.y;
            const dx = insideX - lastX;
            const dy = insideY - lastY;
            
            let exitEdgeX = lastX;
            let exitEdgeY = lastY;
            
            // Determine which edge we exited through based on outside position and direction
            if (lastX < 0 && dx > 0) {
              // Exited through left edge, entering from left
              exitEdgeX = 0;
              if (dx !== 0) {
                const t = -lastX / dx;
                exitEdgeY = lastY + dy * t;
              }
            } else if (lastX > canvas.width && dx < 0) {
              // Exited through right edge, entering from right
              exitEdgeX = canvas.width;
              if (dx !== 0) {
                const t = (canvas.width - lastX) / dx;
                exitEdgeY = lastY + dy * t;
              }
            } else if (lastY < 0 && dy > 0) {
              // Exited through top edge, entering from top
              exitEdgeY = 0;
              if (dy !== 0) {
                const t = -lastY / dy;
                exitEdgeX = lastX + dx * t;
              }
            } else if (lastY > canvas.height && dy < 0) {
              // Exited through bottom edge, entering from bottom
              exitEdgeY = canvas.height;
              if (dy !== 0) {
                const t = (canvas.height - lastY) / dy;
                exitEdgeX = lastX + dx * t;
              }
            }
            
            const exitEdge = clampToCanvasBounds(exitEdgeX, exitEdgeY);
            
            // Update lastPos to exit edge
            lastPos.current = { x: exitEdge.x, y: exitEdge.y };
            // Draw from exit edge to entry edge
            handleMove(edgeCoords.x, edgeCoords.y);
            // Update lastPos to entry edge
            lastPos.current = { x: edgeCoords.x, y: edgeCoords.y };
            // Now draw from entry edge to current position
            handleMove(coords.x, coords.y);
          }
        }
        return;
      } else if (!isInside) {
        // Still outside, don't draw but update lastPos for edge calculation (applies to both mouse and touch)
        lastPos.current = { x: coords.x, y: coords.y };
        return;
      }
    }
    
    // Normal drawing inside canvas (applies to both mouse and touch)
    if (drawing.current && drawingStartedInsideCanvas.current && isInside) {
      handleMove(coords.x, coords.y);
    }
  };

  const handleMove = (x: number, y: number) => {
    if (!drawing.current || !lastPos.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clamp coordinates to canvas bounds
    const clamped = clampToCanvasBounds(x, y);
    const clampedLast = clampToCanvasBounds(lastPos.current.x, lastPos.current.y);
    
    if (tool === 'eraser') {
      const dx = clamped.x - clampedLast.x;
      const dy = clamped.y - clampedLast.y;
      const distance = Math.hypot(dx, dy);
      const steps = Math.ceil(distance / 12.5);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ix = clampedLast.x + dx * t;
        const iy = clampedLast.y + dy * t;
        const half = 12.5;
        ctx.fillRect(ix - half, iy - half, 25, 25);
      }
      lastPos.current = { x, y }; // Store actual position, not clamped
    } else {
      ctx.beginPath();
      ctx.moveTo(clampedLast.x, clampedLast.y);
      ctx.lineTo(clamped.x, clamped.y);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.closePath();
      lastPos.current = { x, y }; // Store actual position, not clamped
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    // Only reset mouse button state for mouse events
    if (e && e.pointerType === 'mouse') {
      mouseButtonDown.current = false;
    } else if (!e) {
      // Global mouse up (no event parameter) - reset if it was a mouse
      if (isMousePointer.current) {
        mouseButtonDown.current = false;
      }
    }
    // For touch, always stop drawing (original behavior)
    drawing.current = false;
    drawingStartedInsideCanvas.current = false;
    lastPos.current = null;
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const isMouse = e.pointerType === 'mouse';
    
    // For mouse, check if button is still down
    if (isMouse && !mouseButtonDown.current) {
      handlePointerUp(e);
      return;
    }
    
    // Pointer is leaving canvas but might still be active (mouse button down or touch still active)
    // Draw to the edge of the canvas (applies to both mouse and touch)
    const canvas = canvasRef.current;
    if (!canvas || !lastPos.current) {
      // If we were drawing, stop
      if (drawing.current) {
        handlePointerUp(e);
      }
      return;
    }
    
    // Only draw to edge if we were actually drawing
    if (drawing.current && drawingStartedInsideCanvas.current) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      // Get pointer position relative to canvas
      const pointerX = (e.clientX - rect.left) * scaleX;
      const pointerY = (e.clientY - rect.top) * scaleY;
      
      // Calculate edge coordinates
      const edgeCoords = getEdgeCoordinates(
        lastPos.current.x,
        lastPos.current.y,
        pointerX,
        pointerY
      );
      
      if (edgeCoords) {
        // Draw to the edge - ensure we reach the exact edge
        handleMove(edgeCoords.x, edgeCoords.y);
        // Update lastPos to outside position for re-entry calculation
        lastPos.current = { x: pointerX, y: pointerY };
      }
    } else {
      // Not drawing yet, just update position
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const pointerX = (e.clientX - rect.left) * scaleX;
      const pointerY = (e.clientY - rect.top) * scaleY;
      lastPos.current = { x: pointerX, y: pointerY };
    }
    
    // Don't stop drawing yet - wait for pointer up
  };

  const handleSubmitDrawing = async () => {
    if (!window.confirm('Are you sure you want to submit your drawing? This action cannot be undone.')) {
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    try {
      await minigamesAPI.uploadDrawing(dataUrl);
      toast.success('Drawing submitted!');
      setIsDrawing(false);
      setDrawingWord(null);
      resetCanvas();
      loadFeed();
      checkDoodledum();
    } catch (error: unknown) {
      console.error('Failed to upload drawing:', error);
      const errorMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to upload drawing';
      toast.error(errorMessage);
    }
  };

  const handleToggleFullscreen = async () => {
    const widget = widgetRef.current;
    if (!widget) return;

    try {
      const doc = document as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };
      
      const widgetEl = widget as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      if (!doc.fullscreenElement && 
          !doc.webkitFullscreenElement && 
          !doc.mozFullScreenElement && 
          !doc.msFullscreenElement) {
        // Enter fullscreen
        if (widgetEl.requestFullscreen) {
          await widgetEl.requestFullscreen();
        } else if (widgetEl.webkitRequestFullscreen) {
          await widgetEl.webkitRequestFullscreen();
        } else if (widgetEl.mozRequestFullScreen) {
          await widgetEl.mozRequestFullScreen();
        } else if (widgetEl.msRequestFullscreen) {
          await widgetEl.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  const handleCancelDrawing = async () => {
    if (!window.confirm('Are you sure you want to cancel your drawing? Your progress will be lost.')) {
      return;
    }
    
    // Exit fullscreen if active
    if (isFullscreen) {
      try {
        const doc = document as {
          exitFullscreen?: () => Promise<void>;
          webkitExitFullscreen?: () => Promise<void>;
          mozCancelFullScreen?: () => Promise<void>;
          msExitFullscreen?: () => Promise<void>;
        };
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      } catch (error) {
        console.error('Error exiting fullscreen:', error);
      }
    }
    
    try {
      await minigamesAPI.cancelDrawing();
    } catch (error) {
      console.error('Failed to cancel drawing:', error);
    } finally {
      setIsDrawing(false);
      setDrawingWord(null);
      resetCanvas();
      checkDoodledum();
    }
  };

  const handleGuess = async () => {
    if (!guess.trim() || isSubmittingGuess) {
      if (!guess.trim()) {
        toast.error('Please enter a guess');
      }
      return;
    }

    setIsSubmittingGuess(true);
    try {
      await minigamesAPI.makeDoodledumGuess(guess.trim());
      setGuess('');
      toast.success('Guess submitted!');
      await Promise.all([loadFeed(), checkDoodledum()]);
    } catch (error: unknown) {
      console.error('Failed to submit guess:', error);
      const errorMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to submit guess';
      toast.error(errorMessage);
    } finally {
      setIsSubmittingGuess(false);
      // Re-focus the input after submission completes
      setTimeout(() => {
        if (guessInputRef.current) {
          guessInputRef.current.focus();
        }
      }, 100);
    }
  };

  return (
    <div id="doodledum-controls">
      <div>
        <span id="feed-message">
          {activeDoodledum?.is_doodledum === 'yes' && (() => {
            const currentUsername = user?.username;
            const isCurrentUserDrawer = currentUsername && activeDoodledum.drawer && 
              currentUsername.toLowerCase() === activeDoodledum.drawer.toLowerCase();
            
            return (
              <>
                {activeDoodledum.is_drawn === 'yes' ? (
                  !isCurrentUserDrawer && (
                    <div className="yellow">
                      There's a drawing waiting to be guessed! Drawer: {activeDoodledum.drawer}
                    </div>
                  )
                ) : (
                  !isDrawing && (
                    <div className="yellow">
                      {activeDoodledum.drawer} is drawing...
                    </div>
                  )
                )}
              </>
            );
          })()}
        </span>
      </div>

      {activeDoodledum?.is_drawn === 'yes' && (() => {
        const currentUsername = user?.username;
        const isCurrentUserDrawer = currentUsername && activeDoodledum.drawer && 
          currentUsername.toLowerCase() === activeDoodledum.drawer.toLowerCase();
        
        if (isCurrentUserDrawer) {
          const getRandomBeingGuessedMessage = (): string => {
            const messages = [
              "Your artwork is being interpreted.",
              "Your drawing is being solved.",
              "Your artwork is being deciphered.",
              "Your picture is being identified.",
              "Your masterpiece is being unraveled.",
              "Your artwork is being decoded.",
            ];
            // Use a consistent index based on the drawer name for pseudo-randomness
            const index = activeDoodledum.drawer ? activeDoodledum.drawer.length % messages.length : 0;
            return messages[index];
          };
          
          return (
            <div className="yellow" style={{ textAlign: 'center', margin: '20px 0' }}>
              {getRandomBeingGuessedMessage()}
            </div>
          );
        }
        
        return (
          <div id="guess-button-container">
            <div id="doodledum-guess">
              <input
                ref={guessInputRef}
                type="text"
                value={guess}
                onChange={(e) => {
                  if (!isSubmittingGuess) {
                    setGuess(e.target.value);
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isSubmittingGuess) {
                    handleGuess();
                  }
                }}
                placeholder={isSubmittingGuess ? "Submitting..." : "Enter your guess"}
                className="doodle-guess-input"
                autoFocus
                disabled={isSubmittingGuess}
              />
            </div>
            <img
              id="submit-doodledum"
              className="enter-button"
              src="/images/enter-button.svg"
              alt="Submit"
              onClick={handleGuess}
              style={{ 
                cursor: isSubmittingGuess ? 'not-allowed' : 'pointer', 
                marginLeft: '10px',
                opacity: isSubmittingGuess ? 0.5 : 1
              }}
            />
          </div>
        );
      })()}

      {(!activeDoodledum || activeDoodledum.is_doodledum === 'no') && (
        <div id="draw-button-container">
          {isAuthenticated ? (
            <>
              <p style={{ textAlign: 'center', marginBottom: '15px' }} className="blue">
                Choose a difficulty level to start drawing. You'll receive a word to sketch, and others will try to guess it!
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'nowrap' }}>
                <button
                  className="draw-button green"
                  id="draw-button-easy"
                  onClick={() => handleFetchDoodledum('easy')}
                >
                  EASY
                </button>
                <button
                  className="draw-button yellow"
                  id="draw-button-medium"
                  onClick={() => handleFetchDoodledum('medium')}
                >
                  MEDIUM
                </button>
                <button
                  className="draw-button pink"
                  id="draw-button-hard"
                  onClick={() => handleFetchDoodledum('hard')}
                >
                  HARD
                </button>
              </div>
            </>
          ) : (
            <em className="yellow" style={{ display: 'block', textAlign: 'center' }}>
              Please <a style={{ textDecoration: 'underline' }} href="/login">login</a> to draw a sketch
            </em>
          )}
        </div>
      )}

      {isDrawing && (
        <div id="widget" ref={widgetRef}>
          {isFullscreen && (
            <button 
              id="fullscreenBtn-top" 
              onClick={handleToggleFullscreen}
            >
              Exit Fullscreen
            </button>
          )}
          <div id="feed-message" style={{ marginBottom: '10px' }}>
            {drawingWord && (
              <div className="green" style={{ fontSize: '1.5em' }}>
                Your word to draw: <span className="blue">{drawingWord}</span>
              </div>
            )}
          </div>
          <div>
            <em>Note: you have <span className="pink">one hour</span> to submit your sketch</em>
          </div>
          <div id="drawing-controls">
            {!isFullscreen && (
              <button 
                id="fullscreenBtn" 
                className="desktop-button"
                onClick={handleToggleFullscreen}
                style={{ marginBottom: '10px' }}
              >
                Fullscreen
              </button>
            )}
            <div id="tool-controls-wrapper">
              <div id="tool-controls">
                <div id="clear-undo-controls" className="button-group mobile-undo-row">
                  <button id="clearBtn" onClick={resetCanvas}>
                    <img style={{ height: '16px', width: '16px' }} src="/images/trashcan.png" alt="Clear" />
                  </button>
                  <button id="undoBtn" disabled={undoStack.length === 0} onClick={handleUndo}>↺</button>
                  <button id="redoBtn" disabled={redoStack.length === 0} onClick={handleRedo}>↻</button>
                </div>
                <div id="brushSizeControls" className="button-group">
                  {[4, 5, 10].map(size => (
                    <button
                      key={size}
                      className={`brushSizeBtn ${brushSize === size ? 'active' : ''}`}
                      data-size={size}
                      onClick={() => {
                        setBrushSize(size);
                        updateCursor();
                      }}
                    >
                      <span className="brushPreview" style={{ height: `${size}px` }}></span>
                    </button>
                  ))}
                </div>
                <div id="draw-eraser-container" className="button-group">
                  <button
                    id="drawBtn"
                    className={tool === 'draw' ? 'active' : ''}
                    onClick={() => {
                      setTool('draw');
                      updateCursor();
                    }}
                  >
                    <img style={{ height: '20px' }} src="/images/brush.png" alt="Draw" />
                  </button>
                  <button
                    id="eraserBtn"
                    className={tool === 'eraser' ? 'active' : ''}
                    onClick={() => {
                      setTool('eraser');
                      updateCursor();
                    }}
                  >
                    <img style={{ height: '20px' }} src="/images/eraser.png" alt="Eraser" />
                  </button>
                  <button
                    id="fillBtn"
                    className={tool === 'fill' ? 'active' : ''}
                    onClick={() => {
                      setTool('fill');
                      updateCursor();
                    }}
                  >
                    <img style={{ height: '20px' }} src="/images/bucket-icon.png" alt="Fill" />
                  </button>
                </div>
              </div>
            </div>
            <div id="brush-controls">
              <div id="fixedPalette">
                {COLORS.map(color => (
                  <button
                    key={color}
                    className={`colorBtn ${currentColor === color ? 'active' : ''}`}
                    data-color={color}
                    style={{ background: color }}
                    onClick={() => {
                      setCurrentColor(color);
                      if (tool === 'eraser') {
                        setTool('draw');
                      }
                      updateCursor();
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div id="canvas-wrapper">
            <canvas
              id="drawCanvas"
              ref={canvasRef}
              draggable={false}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerEnter={handlePointerMove}
              onDragStart={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
          <div id="submit-cancel-container">
            <button className="desktop-button" id="cancelBtn" onClick={handleCancelDrawing}>Cancel</button>
            <button className="desktop-button" id="saveBtn" onClick={handleSubmitDrawing}>Submit</button>
          </div>
          <div id="save-button-container">
            <button className="yellow mobile-button" id="saveBtn-mob" onClick={handleSubmitDrawing}>Submit</button>
            <button className="yellow mobile-button" id="cancelBtn-mob" onClick={handleCancelDrawing}>Cancel</button>
          </div>
        </div>
      )}

      <button className="blue" id="refresh-button" onClick={() => {
        setLoading(true);
        loadFeed();
      }}>
        Refresh Feed
      </button>

      <div id="feed-container-container">
        <div id="feed-container">
          {loading ? (
            <Loading minHeight="400px" />
          ) : feed.length === 0 ? (
            <div>No recent activity</div>
          ) : (
            feed.map((item, index) => {
              const formatTimeAgo = (dateString: string): string => {
                const date = new Date(dateString);
                const now = new Date();
                const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
                
                if (diffInSeconds < 60) {
                  return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`;
                } else if (diffInSeconds < 3600) {
                  const minutes = Math.floor(diffInSeconds / 60);
                  return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
                } else if (diffInSeconds < 86400) {
                  const hours = Math.floor(diffInSeconds / 3600);
                  return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
                } else {
                  const days = Math.floor(diffInSeconds / 86400);
                  return `${days} day${days !== 1 ? 's' : ''} ago`;
                }
              };

              const getRandomDrawMessage = (): { prefix: string; suffix: string } => {
                const messages = [
                  { prefix: 'has crafted a work of art', suffix: '' },
                  { prefix: 'has produced a masterpiece', suffix: '' },
                  { prefix: 'has unleashed their inner artist', suffix: '' },
                  { prefix: 'wanted to share this beautiful portrait', suffix: '' },
                  { prefix: 'drew this just for you', suffix: '' },
                  { prefix: 'sketched something amazing', suffix: '' },
                  { prefix: 'created an oil painting', suffix: '' },
                  { prefix: 'painted something of unparalleled beauty', suffix: '' },
                  { prefix: 'presents', suffix: ':' },
                  { prefix: 'unveiled their dazzling creation', suffix: ':' },
                  { prefix: 'is donating this to the Louvre', suffix: '' },
                  { prefix: 'painstakingly etched this wonderous gem', suffix: '' },
                ];
                // Use index to get a consistent message per item (pseudo-random)
                return messages[index % messages.length];
              };

              return (
                <div key={index} className="feed-item">
                  {item.is_doodle ? (
                    <div>
                      <span style={{ color: item.chat_color }}>{item.user}</span>{' '}
                      {(() => {
                        const message = getRandomDrawMessage();
                        return <>{message.prefix}{message.suffix}</>;
                      })()}
                      {item.doodle_url && (
                        <img src={item.doodle_url} alt="Doodle" className="doodle-image" />
                      )}
                      <span className="feed-time"> {formatTimeAgo(item.created_at)}</span>
                    </div>
                  ) : (
                    <div>
                      <span style={{ color: item.chat_color }}>{item.user}</span>{' '}
                      <span className="blue" style={{ textTransform: 'uppercase' }}>{item.guess}</span>
                      {item.correct ? (
                        <span className="green" style={{ fontWeight: 'bold' }}> ✓ CORRECT!</span>
                      ) : (
                        <span style={{ fontWeight: 'bold', color: '#eb5497' }}> ✗ INCORRECT</span>
                      )}
                      <span className="feed-time"> {formatTimeAgo(item.created_at)}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Doodledum;
