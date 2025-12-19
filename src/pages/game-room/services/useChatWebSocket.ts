import { useState, useCallback, useEffect, useMemo, useRef } from "react";

interface ChatWebSocketMessage {
  event_type: string;
  message_type?: string;
  message_content?: string;
  username?: string;
  chat_color?: string;
  profile_url?: string;
  user_list?: Array<{
    username: string;
    profile_picture_url?: string;
    profile_url?: string;
    chat_color?: string;
  }>;
}

export interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
  chatColor?: string;
  profileUrl?: string;
  messageType?: "chat_message" | "user_join_or_leave";
}

interface UseChatWebSocketParams {
    roomId: string;
    token: string;
    isGuest: boolean;
    guestName: string; // ✅ new
  }
  
type ConnectionState =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "closing";

interface UseChatWebSocketReturn {
  messages: ChatMessage[];
  connectionState: ConnectionState;
  sendMessage: (message: string) => void;
  reconnect: () => void;
  addSystemMessage: (message: string) => void; // Add system message (no username)
}

export function useChatWebSocket({
  roomId,
  token,
  isGuest,
}: UseChatWebSocketParams): UseChatWebSocketReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isManualCloseRef = useRef(false);

  const maxReconnectAttempts = 10;

  // ✅ Same guest-name logic as your game hook (stable + stored)
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
    const name = `Guest_${
      crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10)
    }`;
    localStorage.setItem("guest_name", name);
    setGuestName(name);
  }, [isGuest]);

  const guestParam = isGuest ? guestName : "user";

  // ✅ Build WS url only when guestName is ready (for guests)
  const chatWsUrl = useMemo(() => {
    if (!roomId) return "";
    const guestParam = isGuest ? guestName : "user";

    if (isGuest && !guestName) return ""; // wait for guestName

    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
    const djangoBaseUrl = apiBaseUrl.replace("/api", "");
    const wsBaseUrl =
      import.meta.env.VITE_WS_BASE_URL ||
      djangoBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");

    const base = `${wsBaseUrl}/ws/chat/${roomId}/${guestParam}/`;
    const url = new URL(base);

    // token is optional for guests; required for authed
    if (token) url.searchParams.set("token", token);

    return url.toString();
  }, [roomId, isGuest, guestName, guestParam, token]);

  // --- connect() uses a ref so scheduleReconnect can call it without lint errors
  const connectRef = useRef<() => void>(() => {});
  const scheduleReconnect = useCallback(() => {
    if (isManualCloseRef.current) return;

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setConnectionState("closed");
      return;
    }

    reconnectAttemptsRef.current += 1;
    const attempt = reconnectAttemptsRef.current;
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);

    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    reconnectTimeoutRef.current = window.setTimeout(() => {
      connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (!chatWsUrl) return;
    if (isManualCloseRef.current) return;

    // ✅ If there is already a socket connecting/open, do NOT replace it.
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.CONNECTING ||
        existing.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    const isReconnecting = reconnectAttemptsRef.current > 0;
    setConnectionState(isReconnecting ? "reconnecting" : "connecting");

    console.log("[ChatWS] Connecting:", chatWsUrl);
    const ws = new WebSocket(chatWsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setConnectionState("open");
    };

    ws.onmessage = (event) => {
      try {
        const data: ChatWebSocketMessage = JSON.parse(event.data);

        if (data.event_type === "chat_update") {
          const newMessage: ChatMessage = {
            user: data.username || "System",
            message: data.message_content || "",
            timestamp: Date.now(),
            chatColor: data.chat_color,
            profileUrl: data.profile_url,
            messageType: data.message_type as
              | "chat_message"
              | "user_join_or_leave",
          };
          setMessages((prev) => [...prev, newMessage]);
        } else if (data.event_type === "user_list_update") {
          // ignore for now (or store separately if you want)
        }
      } catch (error) {
        console.error("[ChatWS] Error parsing message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[ChatWS] WebSocket error:", error, {
        url: chatWsUrl,
        readyState: ws.readyState,
      });
      // onclose will handle reconnect
    };

      ws.onclose = (event) => {
      if (wsRef.current === ws) wsRef.current = null;

      console.log("[ChatWS] WebSocket closed:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        url: chatWsUrl,
      });

      if (isManualCloseRef.current) {
        setConnectionState("closed");
        return;
      }

      // 1008 often means auth/policy violation (don't spam reconnect)
      if (event.code === 1008) {
        setConnectionState("closed");
        return;
      }

      setConnectionState("reconnecting");
      scheduleReconnect();
    };
  }, [chatWsUrl, scheduleReconnect]);

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (connectionState === "closed" || connectionState === "reconnecting") {
        reconnectAttemptsRef.current = 0;
        setConnectionState("reconnecting");
        connect();
      }
    };
    const handleOffline = () => {
      // Immediately update connection state when going offline
      if (connectionState === "open" || connectionState === "connecting") {
        setConnectionState("closed");
      }
      // Close any open connections
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connectionState, connect]);

  // keep ref updated
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const sendMessage = useCallback((message: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ message_content: message }));
  }, []);

  const reconnect = useCallback(() => {
    isManualCloseRef.current = false;
    reconnectAttemptsRef.current = 0;

    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close any existing socket before reconnecting (intentional)
    const ws = wsRef.current;
    wsRef.current = null;
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
    ) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }

    connect();
  }, [connect]);

  useEffect(() => {
    isManualCloseRef.current = false;
    connect();

    return () => {
      isManualCloseRef.current = true;

      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const ws = wsRef.current;
      wsRef.current = null;
      if (
        ws &&
        (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
      ) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, [connect]);

  // Add system message (no username prefix)
  const addSystemMessage = useCallback((message: string) => {
    const systemMessage: ChatMessage = {
      user: 'System',
      message,
      timestamp: Date.now(),
      messageType: 'user_join_or_leave',
    };
    setMessages((prev) => [...prev, systemMessage]);
  }, []);

  return {
    messages,
    connectionState,
    sendMessage,
    reconnect,
    addSystemMessage,
  };
}
