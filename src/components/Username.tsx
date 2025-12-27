import { Link } from 'react-router-dom';

interface UsernameProps {
  username: string;
  profileUrl?: string;
  chatColor?: string;
  className?: string;
  onClick?: () => void;
}

export function Username({
  username,
  profileUrl,
  chatColor = '#71bbe9',
  className = '',
  onClick,
}: UsernameProps) {
  const style = { color: chatColor, width:'120px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' };
  
  if (profileUrl) {
    return (
      <Link
        to={`/profile/${profileUrl}`}
        className={className}
        style={style}
        onClick={onClick}
      >
        {username}
      </Link>
    );
  }
  
  return (
    <span className={className} style={style}>
      {username}
    </span>
  );
}

