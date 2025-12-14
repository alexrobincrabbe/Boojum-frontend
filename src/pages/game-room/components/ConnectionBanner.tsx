import './ConnectionBanner.css';

interface ConnectionBannerProps {
  gameConnectionState: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'closing';
  chatConnectionState: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'closing';
  onGameReconnect: () => void;
  onChatReconnect?: () => void;
}

export function ConnectionBanner({ 
  gameConnectionState, 
  chatConnectionState, 
  onGameReconnect,
  onChatReconnect 
}: ConnectionBannerProps) {
  // Show banner if either socket is not open
  const showBanner = gameConnectionState !== 'open' || chatConnectionState !== 'open';
  if (!showBanner) return null;

  const getStatusText = (state: string, type: 'game' | 'chat') => {
    const typeName = type === 'game' ? 'Game' : 'Chat';
    switch (state) {
      case 'connecting':
        return `Connecting to ${typeName.toLowerCase()}...`;
      case 'reconnecting':
        return `Reconnecting ${typeName.toLowerCase()}...`;
      case 'closed':
        return `${typeName} connection closed`;
      case 'closing':
        return `${typeName} connection closing...`;
      default:
        return null;
    }
  };

  const getStatusClass = (state: string) => {
    if (state === 'open') return 'connected';
    if (state === 'connecting' || state === 'reconnecting') return 'connecting';
    return 'disconnected';
  };

  return (
    <div className="connection-status-container">
      {/* Game Socket Status */}
      {gameConnectionState !== 'open' && (
        <div className={`connection-banner connection-status ${getStatusClass(gameConnectionState)}`}>
          <span className="status-icon">🎮</span>
          <span className="status-text">{getStatusText(gameConnectionState, 'game')}</span>
          {(gameConnectionState === 'reconnecting' || gameConnectionState === 'closed') && (
            <button onClick={onGameReconnect} className="reconnect-button">
              Retry
            </button>
          )}
        </div>
      )}

      {/* Chat Socket Status */}
      {chatConnectionState !== 'open' && (
        <div className={`connection-banner connection-status ${getStatusClass(chatConnectionState)}`}>
          <span className="status-icon">💬</span>
          <span className="status-text">{getStatusText(chatConnectionState, 'chat')}</span>
          {(chatConnectionState === 'reconnecting' || chatConnectionState === 'closed') && onChatReconnect && (
            <button onClick={onChatReconnect} className="reconnect-button">
              Retry
            </button>
          )}
        </div>
      )}

      {/* Connected Status (when both are open) */}
      {gameConnectionState === 'open' && chatConnectionState === 'open' && (
        <div className="connection-banner connection-status connected">
          <span className="status-icon">✓</span>
          <span className="status-text">Connected (Game & Chat)</span>
        </div>
      )}
    </div>
  );
}

