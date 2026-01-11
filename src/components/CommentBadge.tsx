import './CommentBadge.css';

interface CommentBadgeProps {
  doodleId: number;
  commentCount: number;
  onOpenComments?: () => void; // Callback to open the doodle/comments modal
}

const CommentBadge = ({ commentCount, onOpenComments }: CommentBadgeProps) => {
  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If we have a callback to open comments, use it
    if (onOpenComments) {
      onOpenComments();
    }
  };

  // Always show the badge, even if commentCount is 0
  return (
    <div className="comment-badge" onClick={handleBadgeClick}>
      💬 {commentCount}
    </div>
  );
};

export default CommentBadge;

