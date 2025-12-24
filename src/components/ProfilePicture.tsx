import { Link } from 'react-router-dom';

interface ProfilePictureProps {
  profilePictureUrl: string | null;
  profileUrl?: string;
  chatColor?: string;
  size?: number;
  className?: string;
  showBorder?: boolean;
}

export function ProfilePicture({
  profilePictureUrl,
  profileUrl,
  chatColor = '#71bbe9',
  size = 30,
  className = '',
  showBorder = true,
}: ProfilePictureProps) {
  const getProfileImageUrl = (url: string | null): string => {
    if (!url || url.includes('placeholder') || url.includes('default.png')) {
      return '/images/default.png';
    }
    
    // If it's already a Cloudinary URL with transformations, use it as-is
    if (url.includes('cloudinary.com') && url.includes('upload/')) {
      // Check if it already has transformations (look for transformation parameters)
      if (url.includes('q_auto') || url.includes('w_') || url.includes('c_') || url.includes('g_') || url.includes('r_')) {
        // Already has transformations, but we might want to override size
        // Extract public_id and rebuild with our size
        const parts = url.split('/');
        const uploadIndex = parts.findIndex(part => part === 'upload');
        if (uploadIndex !== -1) {
          // Find the public_id (last part after transformations)
          let publicId = parts[parts.length - 1];
          // Remove file extension if present
          publicId = publicId.split('.')[0];
          
          // Rebuild with our specific size
          return `https://res.cloudinary.com/df8lhl810/image/upload/q_auto,w_${size},h_${size},c_fill,g_face/r_100/${publicId}`;
        }
      }
      
      // No transformations, extract public_id and add them
      const parts = url.split('/');
      const uploadIndex = parts.findIndex(part => part === 'upload');
      if (uploadIndex !== -1 && uploadIndex < parts.length - 1) {
        // Get the part after 'upload' (skip version if present)
        let publicId = parts[uploadIndex + 1];
        // If it's a version number (starts with 'v'), skip it
        if (publicId.startsWith('v') && uploadIndex + 2 < parts.length) {
          publicId = parts[uploadIndex + 2];
        } else {
          // If no version, the next part is the public_id
          publicId = parts[uploadIndex + 1];
        }
        // Remove file extension
        publicId = publicId.split('.')[0];
        
        // Build optimized Cloudinary URL
        return `https://res.cloudinary.com/df8lhl810/image/upload/q_auto,w_${size},h_${size},c_fill,g_face/r_100/${publicId}`;
      }
    }
    
    // Fallback: return original URL
    return url;
  };

  const imageUrl = getProfileImageUrl(profilePictureUrl);
  // Always show border if chatColor is provided and showBorder is true (default)
  const borderStyle = showBorder ? { border: `2px solid ${chatColor}`, borderRadius: '50%' } : {};

  const imageElement = (
    <img
      src={imageUrl}
      alt="Profile"
      className={`rounded-circle ${className}`}
      width={size}
      height={size}
      style={borderStyle}
    />
  );

  if (profileUrl) {
    return (
      <div className="profile-pic-standard" style={borderStyle}>
        <Link to={`/profile/${profileUrl}`} style={{ textDecoration: 'none' }}>
          {imageElement}
        </Link>
      </div>
    );
  }

  return (
    <div className="profile-pic-standard" style={borderStyle}>
      {imageElement}
    </div>
  );
}

