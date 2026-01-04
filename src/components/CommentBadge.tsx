import { useState } from 'react';
import { createPortal } from 'react-dom';
import { authAPI } from '../services/api';
import { X } from 'lucide-react';
import './CommentBadge.css';

interface Commenter {
  id: number;
  username: string;
  display_name?: string;
  profile_url?: string;
  chat_color?: string;
}

interface CommentBadgeProps {
  doodleId: number;
  commentCount: number;
}

const CommentBadge = ({ doodleId, commentCount }: CommentBadgeProps) => {
  const [showCommenters, setShowCommenters] = useState(false);
  const [commenters, setCommenters] = useState<Commenter[]>([]);
  const [loading, setLoading] = useState(false);

  const handleBadgeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (commentCount === 0) return;
    
    setShowCommenters(true);
    setLoading(true);
    try {
      const data = await authAPI.getDoodleCommenters(doodleId);
      setCommenters(data.commenters || []);
    } catch (err) {
      console.error('Failed to load commenters:', err);
    } finally {
      setLoading(false);
    }
  };

  if (commentCount === 0) {
    return null;
  }

  const modalContent = showCommenters ? (
    <div className="comment-badge-overlay" onClick={() => setShowCommenters(false)}>
      <div className="comment-badge-modal" onClick={(e) => e.stopPropagation()}>
        <button className="comment-badge-close" onClick={() => setShowCommenters(false)}>
          <X size={20} />
        </button>
        <h3 className="comment-badge-title">Commenters ({commentCount} comment{commentCount !== 1 ? 's' : ''})</h3>
        {loading ? (
          <div className="comment-badge-loading">Loading...</div>
        ) : commenters.length === 0 ? (
          <div className="comment-badge-empty">No commenters found</div>
        ) : (
          <div className="comment-badge-list">
            {commenters.map((commenter) => (
              <div key={commenter.id} className="comment-badge-item">
                {commenter.profile_url ? (
                  <a
                    href={`/profile/${commenter.profile_url}`}
                    className="comment-badge-name"
                    style={{ color: commenter.chat_color || '#71bbe9' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCommenters(false);
                    }}
                  >
                    {commenter.display_name || commenter.username}
                  </a>
                ) : (
                  <span
                    className="comment-badge-name"
                    style={{ color: commenter.chat_color || '#71bbe9' }}
                  >
                    {commenter.display_name || commenter.username}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="comment-badge" onClick={handleBadgeClick}>
        💬 {commentCount}
      </div>
      {showCommenters && createPortal(modalContent, document.body)}
    </>
  );
};

export default CommentBadge;

