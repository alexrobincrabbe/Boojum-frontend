import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { forumAPI } from '../../services/api';
import { toast } from 'react-toastify';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './ViewPostPage.css';

interface Reply {
  id: number;
  text: string;
  created_on_ago: string;
  created_on: string;
  author: {
    id: number;
    username: string;
    display_name: string;
    profile_url: string;
    chat_color: string;
  };
}

interface Post {
  id: number;
  title: string;
  slug: string;
  text: string;
  created_on_ago: string;
  created_on: string;
  author: {
    id: number;
    username: string;
    display_name: string;
    profile_url: string;
    chat_color: string;
  };
  is_author: boolean;
  is_superuser: boolean;
  replies: Reply[];
}

const ViewPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editPostTitle, setEditPostTitle] = useState('');
  
  const postQuillRef = useRef<Quill | null>(null);
  const replyQuillRef = useRef<Quill | null>(null);
  const editQuillRefs = useRef<{ [key: number]: Quill }>({});
  const postQuillContainerRef = useRef<HTMLDivElement>(null);
  const replyQuillContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) {
      loadPost();
    }
  }, [slug]);

  const loadPost = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await forumAPI.getPost(slug);
      setPost(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load post');
      console.error('Failed to load post:', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeQuill = (container: HTMLElement, content: string = ''): Quill => {
    const quill = new Quill(container, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          ['link', 'image'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ]
      }
    });
    
    if (content) {
      quill.root.innerHTML = content;
    }
    
    // Handle image uploads
    const toolbar: any = quill.getModule('toolbar');
    toolbar.addHandler('image', () => {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');
      input.click();
      
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          try {
            const result = await forumAPI.uploadImage(file);
            const range = quill.getSelection();
            quill.insertEmbed(range?.index || 0, 'image', result.image_url);
          } catch (err) {
            console.error('Failed to upload image:', err);
            toast.error('Failed to upload image');
          }
        }
      };
    });
    
    return quill;
  };

  useEffect(() => {
    // Initialize post edit quill when editing
    if (isEditingPost && postQuillContainerRef.current && !postQuillRef.current) {
      postQuillRef.current = initializeQuill(postQuillContainerRef.current, post?.text || '');
    }
    
    return () => {
      if (isEditingPost && postQuillRef.current) {
        // Cleanup handled by React
      }
    };
  }, [isEditingPost, post]);

  useEffect(() => {
    // Initialize reply quill when replying
    if (isReplying && replyQuillContainerRef.current && !replyQuillRef.current) {
      replyQuillRef.current = initializeQuill(replyQuillContainerRef.current);
    }
    
    return () => {
      if (isReplying && replyQuillRef.current) {
        // Cleanup handled by React
      }
    };
  }, [isReplying]);

  const handleEditPost = () => {
    if (!post) return;
    setEditPostTitle(post.title);
    setIsEditingPost(true);
  };

  const handleSavePost = async () => {
    if (!post || !postQuillRef.current) return;
    
    if (!editPostTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    
    const content = postQuillRef.current.root.innerHTML;
    if (!content || content === '<p><br></p>') {
      toast.error('Post content is required');
      return;
    }
    
    try {
      await forumAPI.updatePost(post.slug, editPostTitle.trim(), content);
      toast.success('Post updated successfully!');
      await loadPost();
      setIsEditingPost(false);
      setEditPostTitle('');
      postQuillRef.current = null;
    } catch (err: any) {
      console.error('Failed to update post:', err);
      const errorMessage = err.response?.data?.error || 'Failed to update post';
      toast.error(errorMessage);
    }
  };

  const handleCancelEditPost = () => {
    setIsEditingPost(false);
    setEditPostTitle('');
    postQuillRef.current = null;
  };

  const handleReply = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setIsReplying(true);
  };

  const handleSubmitReply = async () => {
    if (!post || !replyQuillRef.current) return;
    
    const content = replyQuillRef.current.root.innerHTML;
    if (!content || content === '<p><br></p>') {
      toast.error('Reply content is required');
      return;
    }
    
    try {
      await forumAPI.createReply(post.id, content);
      toast.success('Reply posted successfully!');
      setIsReplying(false);
      replyQuillRef.current = null;
      await loadPost();
    } catch (err: any) {
      console.error('Failed to create reply:', err);
      const errorMessage = err.response?.data?.error || 'Failed to create reply';
      toast.error(errorMessage);
    }
  };

  const handleCancelReply = () => {
    setIsReplying(false);
    replyQuillRef.current = null;
  };

  const handleEditReply = (replyId: number, currentText: string) => {
    setEditingReplyId(replyId);
    setTimeout(() => {
      const container = document.getElementById(`reply-editor-${replyId}`);
      if (container && !editQuillRefs.current[replyId]) {
        editQuillRefs.current[replyId] = initializeQuill(container, currentText);
      }
    }, 100);
  };

  const handleSaveReply = async (replyId: number) => {
    const quill = editQuillRefs.current[replyId];
    if (!quill) return;
    
    const content = quill.root.innerHTML;
    if (!content || content === '<p><br></p>') {
      toast.error('Reply content is required');
      return;
    }
    
    try {
      await forumAPI.updateReply(replyId, content);
      toast.success('Reply updated successfully!');
      setEditingReplyId(null);
      delete editQuillRefs.current[replyId];
      await loadPost();
    } catch (err: any) {
      console.error('Failed to update reply:', err);
      const errorMessage = err.response?.data?.error || 'Failed to update reply';
      toast.error(errorMessage);
    }
  };

  const handleCancelEditReply = (replyId: number) => {
    setEditingReplyId(null);
    delete editQuillRefs.current[replyId];
  };

  const handleDeleteReply = async (replyId: number) => {
    if (!window.confirm('Are you sure you want to delete this reply?')) return;
    
    try {
      await forumAPI.deleteReply(replyId);
      toast.success('Reply deleted successfully!');
      await loadPost();
    } catch (err: any) {
      console.error('Failed to delete reply:', err);
      const errorMessage = err.response?.data?.error || 'Failed to delete reply';
      toast.error(errorMessage);
    }
  };

  if (loading) {
    return <div className="loading-state">Loading post...</div>;
  }

  if (error || !post) {
    return <div className="error-message">{error || 'Post not found'}</div>;
  }

  return (
    <div className="view-post-page">
      <div className="container" style={{ paddingLeft: 0, paddingRight: 0, minHeight: 'calc(100vh - 220px)' }}>
        <Link to="/forum">
          <button id="back-button" className="yellow-button">
            ← Back to Forum
          </button>
        </Link>

        {/* Post View */}
        {!isEditingPost && (
          <div id="post-view">
            <h2 style={{ marginBottom: 0 }}>
              <span id="post-title" className="view-post-title blue">{post.title}</span>
            </h2>
            <div style={{ overflow: 'hidden', borderRadius: '20px', marginBottom: '20px' }}>
              <div className="view-post-text" style={{ position: 'relative', maxHeight: '450px', overflowY: 'auto' }}>
                <div id="post-content" dangerouslySetInnerHTML={{ __html: post.text }} />
                <div className="view-post-footer yellow" style={{ position: 'sticky', background: '#13132a', bottom: 0, paddingTop: '5px', paddingBottom: '10px', marginBottom: 0, zIndex: 1 }}>
                  {(post.is_author || post.is_superuser) && (
                    <button id="edit-post-btn" onClick={handleEditPost}>Edit Post</button>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    by{' '}
                    <Link to={`/profile/${post.author.profile_url}`} style={{ color: post.author.chat_color, textDecoration: 'none' }}>
                      {post.author.display_name}
                    </Link>{' '}
                    {post.created_on_ago}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Post Mode */}
        {isEditingPost && (
          <div id="post-edit" style={{ display: 'block', position: 'relative' }}>
            <input
              type="text"
              id="edit-post-title"
              className="form-control"
              value={editPostTitle}
              onChange={(e) => setEditPostTitle(e.target.value)}
            />
            <div ref={postQuillContainerRef} id="edit-post-quill"></div>
            <div style={{ position: 'absolute', right: '25px', bottom: '10px', display: 'flex', justifyContent: 'right' }}>
              <button style={{ marginRight: '20px' }} id="cancel-post-edit-btn" className="yellow-button" onClick={handleCancelEditPost}>
                Cancel
              </button>
              <button id="save-post-btn" className="yellow-button" onClick={handleSavePost}>
                Save
              </button>
            </div>
          </div>
        )}

        {/* Reply Button */}
        {isAuthenticated && !isReplying && (
          <div id="reply-btn-wrapper">
            <button id="reply-btn" className="reply-button" onClick={handleReply}>
              Reply
            </button>
          </div>
        )}

        {/* Reply Form */}
        {isReplying && (
          <div id="reply-form">
            <div ref={replyQuillContainerRef} id="reply-quill"></div>
            <div id="submit-reply-btn-wrapper">
              <button id="cancel-reply-btn" className="yellow-button" onClick={handleCancelReply}>
                Cancel
              </button>
              <button id="submit-reply-btn" className="yellow-button" onClick={handleSubmitReply}>
                Submit Reply
              </button>
            </div>
          </div>
        )}

        {/* Replies */}
        <div id="replies">
          {post.replies.map((reply) => (
            <div key={reply.id} className="reply-wrapper" data-reply-id={reply.id}>
              <hr />
              <p>
                <Link
                  to={`/profile/${reply.author.profile_url}`}
                  style={{ color: reply.author.chat_color, textDecoration: 'none', fontWeight: 'bold' }}
                >
                  {reply.author.display_name}
                </Link>
                <em> wrote:</em>
              </p>

              {editingReplyId === reply.id ? (
                <>
                  <div className="reply-editor" id={`reply-editor-${reply.id}`}></div>
                  <div className="reply-footer-container">
                    <div className="reply-date">
                      <em style={{ color: 'grey' }}>{reply.created_on_ago}</em>
                    </div>
                    <div className="reply-footer">
                      <button className="cancel-edit-button" onClick={() => handleCancelEditReply(reply.id)}>
                        Cancel
                      </button>
                      <button className="save-edit-button" onClick={() => handleSaveReply(reply.id)}>
                        Save
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="reply-content" id={`reply-content-${reply.id}`} dangerouslySetInnerHTML={{ __html: reply.text }} />
                  <div className="reply-footer-container">
                    <div className="reply-date">
                      <em style={{ color: 'grey' }}>{reply.created_on_ago}</em>
                    </div>
                    <div className="reply-footer">
                      {isAuthenticated && (reply.author.id === user?.id || user?.is_superuser) && (
                        <>
                          <button
                            id={`reply-delete-${reply.id}`}
                            className="delete-button reply-btn-delete"
                            onClick={() => handleDeleteReply(reply.id)}
                          >
                            Delete
                          </button>
                          <button
                            id={`reply-edit-${reply.id}`}
                            className="edit-button"
                            onClick={() => handleEditReply(reply.id, reply.text)}
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ViewPostPage;

