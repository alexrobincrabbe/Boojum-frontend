import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { authAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import './DoodleFullscreenModal.css';

interface Doodle {
  id: number;
  word: string;
  image_url: string | null;
  public: boolean;
  created_at: string | null;
  user?: {
    id: number;
    username: string;
  };
}

interface Comment {
  id: number;
  user: {
    id: number;
    username: string;
    profile_url?: string;
    chat_color?: string;
  };
  comment_text: string;
  parent_comment: number | null;
  created_at: string;
  replies?: Comment[];
}

interface DoodleFullscreenModalProps {
  doodle: Doodle;
  onClose: () => void;
}

const DoodleFullscreenModal = ({ doodle, onClose }: DoodleFullscreenModalProps) => {
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
    if (doodle.user && currentUser) {
      setIsOwner(doodle.user.id === currentUser.id);
    }
  }, [doodle.id, currentUser]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await authAPI.getDoodleComments(doodle.id);
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
      const result = await authAPI.createDoodleComment(doodle.id, commentText);
      if (result.success) {
        setCommentText('');
        await loadComments();
        toast.success('Comment added');
      } else if (result.error === 'rate_limit') {
        toast.error(result.message || 'You can only comment once every 30 minutes on this doodle');
      } else {
        toast.error(result.message || 'Failed to add comment');
      }
    } catch (err: any) {
      // Handle 429 rate limit errors from the API
      if (err.response?.status === 429) {
        const errorData = err.response?.data;
        if (errorData?.error === 'rate_limit') {
          toast.error(errorData.message || 'You can only comment once every 30 minutes on this doodle');
        } else {
          toast.error(errorData?.error || errorData?.message || 'You can only comment once every 30 minutes on this doodle');
        }
      } else {
        toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to add comment');
      }
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
      const result = await authAPI.replyToDoodleComment(parentCommentId, replyText);
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
      toast.error(err.response?.data?.error || 'Failed to add reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!isOwner && !currentUser) return;
    
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const result = await authAPI.deleteDoodleComment(commentId);
      if (result.success) {
        await loadComments();
        toast.success('Comment deleted');
      } else {
        toast.error(result.message || 'Failed to delete comment');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete comment');
    }
  };

  const canDeleteComment = (comment: Comment) => {
    if (!currentUser) return false;
    return isOwner || comment.user.id === currentUser.id;
  };

  const canReply = () => {
    // Only the doodle owner can reply to comments
    if (!currentUser) return false;
    return isOwner;
  };

  return (
    <div className="doodle-fullscreen-overlay" onClick={onClose}>
      <div className="doodle-fullscreen-modal" onClick={(e) => e.stopPropagation()}>
        <button className="doodle-fullscreen-close" onClick={onClose}>
          <X size={24} />
        </button>
        
        <div className="doodle-fullscreen-content">
          <div className="doodle-fullscreen-image-container">
            {doodle.image_url && (
              <img 
                src={doodle.image_url} 
                alt={doodle.word}
                className="doodle-fullscreen-image"
              />
            )}
            <div className="doodle-fullscreen-word blue-glow">{doodle.word}</div>
          </div>

          <div className="doodle-fullscreen-comments">
            {currentUser && (
              <div className="doodle-comment-form">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment (max 200 characters)..."
                  maxLength={200}
                  rows={3}
                  className="doodle-comment-input"
                />
                <div className="doodle-comment-actions">
                  <span className="doodle-comment-char-count">
                    {commentText.length}/200
                  </span>
                  <button
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || submitting || commentText.length > 200}
                    className="doodle-comment-submit"
                  >
                    {submitting ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="doodle-comments-loading">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="doodle-comments-empty">No comments yet. Be the first to comment!</div>
            ) : (
              <div className="doodle-comments-list">
                {comments.map((comment) => (
                  <div key={comment.id} className="doodle-comment-item">
                    <div className="doodle-comment-header">
                      {comment.user.profile_url ? (
                        <a 
                          href={`/profile/${comment.user.profile_url}`}
                          className="doodle-comment-author"
                          style={{ color: comment.user.chat_color || '#71bbe9' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                          }}
                        >
                          {comment.user.username}
                        </a>
                      ) : (
                        <span 
                          className="doodle-comment-author"
                          style={{ color: comment.user.chat_color || '#71bbe9' }}
                        >
                          {comment.user.username}
                        </span>
                      )}
                      <span className="doodle-comment-date">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                      {canDeleteComment(comment) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="doodle-comment-delete"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div className="doodle-comment-text">{comment.comment_text}</div>
                    
                    {currentUser && canReply() && (
                      <div className="doodle-comment-reply-section">
                        {replyingTo === comment.id ? (
                          <div className="doodle-reply-form">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a reply (max 200 characters)..."
                              maxLength={200}
                              rows={2}
                              className="doodle-reply-input"
                            />
                            <div className="doodle-reply-actions">
                              <span className="doodle-comment-char-count">
                                {replyText.length}/200
                              </span>
                              <div>
                                <button
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText('');
                                  }}
                                  className="doodle-reply-cancel"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSubmitReply(comment.id)}
                                  disabled={!replyText.trim() || submitting || replyText.length > 200}
                                  className="doodle-reply-submit"
                                >
                                  {submitting ? 'Posting...' : 'Post Reply'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyingTo(comment.id)}
                            className="doodle-reply-button"
                          >
                            Reply
                          </button>
                        )}
                      </div>
                    )}

                    {comment.replies && comment.replies.length > 0 && (
                      <div className="doodle-comment-replies">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="doodle-comment-reply">
                            <div className="doodle-comment-header">
                              {reply.user.profile_url ? (
                                <a 
                                  href={`/profile/${reply.user.profile_url}`}
                                  className="doodle-comment-author"
                                  style={{ color: reply.user.chat_color || '#f5ce45' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                  }}
                                >
                                  {reply.user.username}
                                </a>
                              ) : (
                                <span 
                                  className="doodle-comment-author"
                                  style={{ color: reply.user.chat_color || '#f5ce45' }}
                                >
                                  {reply.user.username}
                                </span>
                              )}
                              <span className="doodle-comment-date">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </span>
                              {canDeleteComment(reply) && (
                                <button
                                  onClick={() => handleDeleteComment(reply.id)}
                                  className="doodle-comment-delete"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                            <div className="doodle-comment-text">{reply.comment_text}</div>
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
};

export default DoodleFullscreenModal;

