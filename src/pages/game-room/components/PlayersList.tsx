import type { Player } from '../../../ws/protocol';
import './PlayersList.css';

interface PlayersListProps {
  players: (Player & {
    profilePictureUrl?: string;
    chatColor?: string;
    profileUrl?: string;
  })[];
  variant?: 'mobile' | 'desktop';
}

export function PlayersList({ players, variant = 'desktop' }: PlayersListProps) {
  if (variant === 'mobile') {
    return (
      <div className="players-section-mobile">
        <div className="user-list-mobile">
          {players.map((player) => {
            const chatColor = player.chatColor || '#71bbe9';
            const profileUrl = player.profileUrl || '';
            const isGuest = !profileUrl || !player.userId;
            return (
              <span
                key={player.id}
                className="user-list-name-mobile"
                style={{ color: isGuest ? '#808080' : chatColor }}
              >
                {player.username}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop version
  const getProfileImageUrl = (profilePictureUrl: string, isGuest: boolean) => {
    // For guests, always use default.png
    if (isGuest) {
      return '/images/default.png';
    }
    if (!profilePictureUrl || profilePictureUrl.includes('placeholder')) {
      return 'https://res.cloudinary.com/df8lhl810/image/upload/v1/placeholder';
    }
    const publicId = profilePictureUrl.split('/').pop()?.split('.')[0] || '';
    return `https://res.cloudinary.com/df8lhl810/image/upload/q_auto,w_30,h_30,c_fill,g_face/r_100/${publicId}`;
  };

  return (
    <div className="players-section-desktop">
      <div className="user-list">
        {players.map((player) => {
          const profilePictureUrl = player.profilePictureUrl || '';
          const chatColor = player.chatColor || '#71bbe9';
          const profileUrl = player.profileUrl || '';
          const isGuest = !profileUrl || !player.userId;

          return (
            <div key={player.id} className="chat-user-container">
              {profileUrl ? (
                <a
                  href={`/profile/${profileUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <img
                    src={getProfileImageUrl(profilePictureUrl, isGuest)}
                    alt={player.username}
                    className="rounded-circle high-score-img"
                    width={30}
                    height={30}
                    style={{ borderColor: chatColor }}
                  />
                </a>
              ) : (
                <img
                  src={getProfileImageUrl(profilePictureUrl, isGuest)}
                  alt={player.username}
                  className="rounded-circle high-score-img guest-user"
                  width={30}
                  height={30}
                  style={{ borderColor: '#808080' }}
                />
              )}
              <span
                className="user-list-username"
                style={{ color: profileUrl ? chatColor : '#808080' }}
              >
                {player.username}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

