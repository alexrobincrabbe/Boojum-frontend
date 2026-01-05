import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lobbyAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import './SavedBoardCommentModal.css';

interface SavedBoard {
  id: number;
  room_type: string;
}

interface Comment {
  id: number;
  user: {
    id: number;
    username: string;
    display_name?: string;
    profile_url?: string;
    chat_color?: string;
  };
  comment_text: string;
  parent_comment: number | null;
  created_at: string;
  replies?: Comment[];
}

interface SavedBoardCommentModalProps {
  board: SavedBoard;
  boardOwnerId: number;
  onClose: () => void;
}

const SavedBoardCommentModal = ({ board, boardOwnerId, onClose }: SavedBoardCommentModalProps) => {
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
    if (currentUser) {
      setIsOwner(currentUser.id === boardOwnerId);
    }
  }, [board.id, currentUser, boardOwnerId]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  // Focus comment input when modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      if (commentInputRef.current && currentUser) {
        commentInputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentUser, board.id]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await lobbyAPI.getSavedBoardComments(board.id);
      // Organize comments with replies
      const topLevelComments = data.comments.filter((c: Comment) => !c.parent_comment);
      const replies = data.comments.filter((c: Comment) => c.parent_comment);
      
      const organized = topLevelComments.map((comment: Comment) => ({
        ...comment,
        replies: replies.filter((r: Comment) => r.parent_comment === comment.id)
      }));
      
      setComments(organized);
    } catch (err: any) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || commentText.length > 200) return;
    if (!currentUser) {
      toast.error('Please log in to comment');
      return;
    }

    setSubmitting(true);
    try {
      const result = await lobbyAPI.createSavedBoardComment(board.id, commentText);
      if (result.success) {
        setCommentText('');
        await loadComments();
        toast.success('Comment added');
      } else {
        toast.error(result.message || 'Failed to add comment');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentCommentId: number) => {
    if (!replyText.trim() || replyText.length > 200) return;
    if (!currentUser) {
      toast.error('Please log in to reply');
      return;
    }

    setSubmitting(true);
    try {
      const result = await lobbyAPI.replyToSavedBoardComment(parentCommentId, replyText);
      if (result.success) {
        setReplyText('');
        setReplyingTo(null);
        await loadComments();
        toast.success('Reply added');
      } else if (result.error === 'already_replied') {
        toast.error('You can only reply once to each comment');
      } else {
        toast.error(result.message || 'Failed to add reply');
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData?.error === 'already_replied') {
        toast.error('You can only reply once to each comment');
      } else {
        toast.error(errorData?.error || errorData?.message || 'Failed to add reply');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canReply = () => {
    // Only the board owner can reply to comments
    if (!currentUser) return false;
    return isOwner;
  };

  const modalContent = (
    <div className="saved-board-comment-overlay" onClick={onClose}>
      <div className="saved-board-comment-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <button className="saved-board-comment-close" onClick={onClose}>
          <X size={24} />
        </button>
        
        <div className="saved-board-comment-content">
          <div className="saved-board-comment-header-section">
            <h2 className="saved-board-comment-title" style={{ color: '#71bbe9' }}>
              {board.room_type}
            </h2>
          </div>

          <div className="saved-board-comment-comments">
            {currentUser && (
              <div className="saved-board-comment-form">
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment (max 200 characters)..."
                  maxLength={200}
                  rows={3}
                  className="saved-board-comment-input"
                />
                <div className="saved-board-comment-actions">
                  <span className="saved-board-comment-char-count">
                    {commentText.length}/200
                  </span>
                  <button
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || submitting || commentText.length > 200}
                    className="saved-board-comment-submit"
                  >
                    {submitting ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="saved-board-comments-loading">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="saved-board-comments-empty">No comments yet. Be the first to comment!</div>
            ) : (
              <div className="saved-board-comments-list">
                {comments.map((comment) => (
                  <div key={comment.id} className="saved-board-comment-item">
                    <div className="saved-board-comment-header">
                      {comment.user.profile_url ? (
                        <a 
                          href={`/profile/${comment.user.profile_url}`}
                          className="saved-board-comment-author"
                          style={{ color: comment.user.chat_color || '#71bbe9' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                          }}
                        >
                          {comment.user.display_name || comment.user.username}
                        </a>
                      ) : (
                        <span 
                          className="saved-board-comment-author"
                          style={{ color: comment.user.chat_color || '#71bbe9' }}
                        >
                          {comment.user.display_name || comment.user.username}
                        </span>
                      )}
                      <span className="saved-board-comment-date">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="saved-board-comment-text">{comment.comment_text}</div>
                    
                    {currentUser && canReply() && (
                      <div className="saved-board-comment-reply-section">
                        {replyingTo === comment.id ? (
                          <div className="saved-board-reply-form">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply (max 200 characters)..."
                              maxLength={200}
                              rows={2}
                              className="saved-board-reply-input"
                            />
                            <div className="saved-board-reply-actions">
                              <span className="saved-board-comment-char-count">
                                {replyText.length}/200
                              </span>
                              <div>
                                <button
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText('');
                                  }}
                                  className="saved-board-reply-cancel"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSubmitReply(comment.id)}
                                  disabled={!replyText.trim() || submitting || replyText.length > 200}
                                  className="saved-board-reply-submit"
                                >
                                  {submitting ? 'Posting...' : 'Post Reply'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          comment.replies && comment.replies.length === 0 && (
                            <button
                              onClick={() => setReplyingTo(comment.id)}
                              className="saved-board-reply-button"
                            >
                              Reply
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {comment.replies && comment.replies.length > 0 && (
                      <div className="saved-board-comment-replies">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="saved-board-comment-reply">
                            <div className="saved-board-comment-header">
                              {reply.user.profile_url ? (
                                <a 
                                  href={`/profile/${reply.user.profile_url}`}
                                  className="saved-board-comment-author"
                                  style={{ color: reply.user.chat_color || '#f5ce45' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                  }}
                                >
                                  {reply.user.display_name || reply.user.username}
                                </a>
                              ) : (
                                <span 
                                  className="saved-board-comment-author"
                                  style={{ color: reply.user.chat_color || '#f5ce45' }}
                                >
                                  {reply.user.display_name || reply.user.username}
                                </span>
                              )}
                              <span className="saved-board-comment-date">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="saved-board-comment-text">{reply.comment_text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SavedBoardCommentModal;

