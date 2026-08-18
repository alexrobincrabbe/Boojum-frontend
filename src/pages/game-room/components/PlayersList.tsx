import type { SyntheticEvent } from 'react';
import type { Player } from '../../../ws/protocol';
import {
  FALLBACK_PROFILE_IMAGE,
  resolveProfilePictureUrl,
} from '../../../utils/profilePictureUrl';
import { PointsStarBadge } from '../../../components/PointsStarBadge';
import './PlayersList.css';

interface PlayersListProps {
  players: (Player & {
    profilePictureUrl?: string;
    chatColor?: string;
    profileUrl?: string;
  })[];
  variant?: 'mobile' | 'desktop';
  roomId?: string;
  roomColor?: string;
}

export function PlayersList({ players, variant = 'desktop', roomId, roomColor }: PlayersListProps) {
  if (variant === 'mobile') {
    return (
      <div className="players-section-mobile">
        {roomId && (
          <div className="game-header">
            <h1 style={{ color: roomColor }}>{roomId}</h1>
          </div>
        )}
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

  const profileImgProps = (profilePictureUrl: string, isGuest: boolean) => ({
    src: resolveProfilePictureUrl(isGuest ? null : profilePictureUrl, 30),
    onError: (e: SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.src !== FALLBACK_PROFILE_IMAGE) {
        img.src = FALLBACK_PROFILE_IMAGE;
      }
    },
  });

  return (
    <div className="players-section-desktop">
      {roomId && (
        <div className="game-header">
          <h1 style={{ color: roomColor }}>{roomId}</h1>
        </div>
      )}
      <div className="user-list">
        {players.map((player) => {
          const profilePictureUrl = player.profilePictureUrl || '';
          const chatColor = player.chatColor || '#71bbe9';
          const profileUrl = player.profileUrl || '';
          const isGuest = !profileUrl || !player.userId;
          const avatar = (
            <PointsStarBadge tier={isGuest ? undefined : player.pointsTier} size={30}>
              <img
                {...profileImgProps(profilePictureUrl, isGuest)}
                alt={player.username}
                className="rounded-circle high-score-img"
                width={30}
                height={30}
                style={{ borderColor: isGuest ? '#808080' : chatColor }}
              />
            </PointsStarBadge>
          );

          return (
            <div key={player.id} className="chat-user-container">
              {profileUrl ? (
                <a
                  href={`/profile/${profileUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  {avatar}
                </a>
              ) : (
                avatar
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

