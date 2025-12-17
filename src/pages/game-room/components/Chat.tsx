import { useEffect, useState, useRef } from 'react';
import { filterProfanity, getProfanityFilterSetting } from '../../../utils/profanityFilter';
import './Chat.css';

interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
  chatColor?: string;
  profileUrl?: string;
  messageType?: 'chat_message' | 'user_join_or_leave';
}

interface ChatProps {
  messages: ChatMessage[];
  connectionState: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'closing';
  onSendMessage: (message: string) => void;
  onReconnect?: () => void;
}

export function Chat({ messages, connectionState, onSendMessage, onReconnect }: ChatProps) {
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Initialize from localStorage, default to true if not set
  const [profanityFilterEnabled, setProfanityFilterEnabled] = useState(() => {
    const stored = localStorage.getItem('profanityFilter');
    return stored !== null ? stored === 'true' : true;
  });

  // Load profanity filter setting
  useEffect(() => {
    setProfanityFilterEnabled(getProfanityFilterSetting());

    // Listen for changes to localStorage
    const handleStorageChange = () => {
      setProfanityFilterEnabled(getProfanityFilterSetting());
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case localStorage was changed in the same window
    const interval = setInterval(() => {
      setProfanityFilterEnabled(getProfanityFilterSetting());
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  };

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScrollEnabled && chatMessagesRef.current) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]); // Only scroll when messages array length changes (new message)

  // Handle scroll events
  useEffect(() => {
    const chatMessages = chatMessagesRef.current;
    if (!chatMessages) return;

    const handleScroll = () => {
      if (!chatMessages) return;
      
      const isAtBottom =
        chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 10;

      if (!isAtBottom) {
        // User scrolled up
        setAutoScrollEnabled(false);
        setShowScrollButton(true);
      } else if (!autoScrollEnabled) {
        // User scrolled back to bottom
        setAutoScrollEnabled(true);
        setShowScrollButton(false);
      }
    };

    chatMessages.addEventListener('scroll', handleScroll);
    return () => {
      chatMessages.removeEventListener('scroll', handleScroll);
    };
  }, [autoScrollEnabled]);

  // Handle scroll to bottom button click
  const handleScrollToBottom = () => {
    scrollToBottom();
    setAutoScrollEnabled(true);
    setShowScrollButton(false);
  };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input') as HTMLInputElement;
    if (input.value.trim()) {
      onSendMessage(input.value.trim());
      input.value = '';
    }
  };

  return (
    <div className={`game-chat-section ${connectionState !== 'open' ? 'disconnected' : ''}`}>
      {connectionState !== 'open' && (
        <div className="connection-overlay">
          <div className="connection-overlay-content">
            <span className="status-icon">💬</span>
            <span className="status-text">
              {connectionState === 'connecting' && 'Connecting to chat...'}
              {connectionState === 'reconnecting' && 'Reconnecting chat...'}
              {connectionState === 'closed' && 'Chat connection closed'}
              {connectionState === 'closing' && 'Chat connection closing...'}
            </span>
            {(connectionState === 'reconnecting' || connectionState === 'closed') && onReconnect && (
              <button onClick={onReconnect} className="reconnect-button">
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      <div className="chat-messages" ref={chatMessagesRef}>
        {messages.map((msg, idx) => {
          // Handle different message types
          if (msg.messageType === 'user_join_or_leave') {
            // Check if message contains HTML (for system messages like score and unicorn)
            const containsHTML = /<[^>]+>/.test(msg.message);
            
            return (
              <div key={idx} className="chat-message chat-system-message">
                {containsHTML ? (
                  <span dangerouslySetInnerHTML={{ __html: msg.message }} />
                ) : (
                  <em style={{ color: '#A9A9A9', fontStyle: 'italic' }}>
                    {msg.message}
                  </em>
                )}
              </div>
            );
          }

          // Regular chat message
          const isGuest = !msg.profileUrl;
          const userStyle = isGuest
            ? { color: '#808080', fontStyle: 'italic' }
            : msg.chatColor
            ? { color: msg.chatColor }
            : {};

          // Check if message contains HTML (for system messages like unicorn)
          const containsHTML = /<[^>]+>/.test(msg.message);
          
          // Filter profanity if enabled (only for non-HTML messages)
          const displayMessage = containsHTML 
            ? msg.message 
            : filterProfanity(msg.message, profanityFilterEnabled);

          return (
            <div key={idx} className="chat-message">
              <span className="chat-user" style={userStyle}>
                {msg.user}:
              </span>
              {containsHTML ? (
                <span 
                  className="chat-text"
                  style={isGuest ? { color: '#808080', fontStyle: 'italic' } : {}}
                  dangerouslySetInnerHTML={{ __html: displayMessage }}
                />
              ) : (
                <span 
                  className="chat-text"
                  style={isGuest ? { color: '#808080', fontStyle: 'italic' } : {}}
                >
                  {displayMessage}
                </span>
              )}
              <span className="chat-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          );
        })}
      </div>
      {showScrollButton && (
        <button 
          className="scroll-to-bottom-btn" 
          onClick={handleScrollToBottom}
          title="Scroll to bottom"
        >
          Scroll to Bottom
        </button>
      )}
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          id="chat-message-input"
          type="text"
          placeholder="Type a message..."
          disabled={connectionState !== 'open'}
        />
        <button type="submit" disabled={connectionState !== 'open'}>
          Send
        </button>
      </form>
    </div>
  );
}

