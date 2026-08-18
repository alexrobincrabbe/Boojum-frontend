import { Link } from 'react-router-dom';
import {
  FALLBACK_PROFILE_IMAGE,
  resolveProfilePictureUrl,
} from '../utils/profilePictureUrl';
import { PointsStarBadge } from './PointsStarBadge';

interface ProfilePictureProps {
  profilePictureUrl: string | null;
  profileUrl?: string;
  chatColor?: string;
  size?: number;
  className?: string;
  showBorder?: boolean;
  pointsTier?: string | null;
}

export function ProfilePicture({
  profilePictureUrl,
  profileUrl,
  chatColor = '#71bbe9',
  size = 30,
  className = '',
  showBorder = true,
  pointsTier,
}: ProfilePictureProps) {
  const imageUrl = resolveProfilePictureUrl(profilePictureUrl, size);

  const imageElement = (
    <img
      src={imageUrl}
      alt="Profile"
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src !== FALLBACK_PROFILE_IMAGE) {
          img.src = FALLBACK_PROFILE_IMAGE;
        }
      }}
      className={`rounded-circle ${className}`}
      width={size}
      height={size}
      style={{ borderRadius: '50%', display: 'block' }}
    />
  );

  const wrapperStyle = showBorder ? { 
    border: `2px solid ${chatColor}`, 
    borderRadius: '50%' as const, 
    display: 'inline-block' as const,
    width: `${size}px`,
    height: `${size}px`,
    overflow: 'hidden' as const,
    boxSizing: 'border-box' as const,
    transition: 'transform 0.3s ease'
  } : { 
    display: 'inline-block' as const,
    width: `${size}px`,
    height: `${size}px`,
    overflow: 'hidden' as const,
    transition: 'transform 0.3s ease'
  };

  const picture = profileUrl ? (
    <div className="profile-pic-standard" style={wrapperStyle}>
      <Link to={`/profile/${profileUrl}`} style={{ textDecoration: 'none', display: 'block' }}>
        {imageElement}
      </Link>
    </div>
  ) : (
    <div className="profile-pic-standard" style={wrapperStyle}>
      {imageElement}
    </div>
  );

  return (
    <PointsStarBadge tier={pointsTier} size={size}>
      {picture}
    </PointsStarBadge>
  );
}

