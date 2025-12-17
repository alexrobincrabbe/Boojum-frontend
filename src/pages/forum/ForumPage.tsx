import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { forumAPI } from '../../services/api';
import './ForumPage.css';

interface ForumPost {
  id: number;
  title: string;
  slug: string;
  pinned: boolean;
  is_unread: boolean;
  number_of_replies: number;
  latest_reply_ago: string;
  author: {
    id: number;
    username: string;
    display_name: string;
    profile_url: string;
    chat_color: string;
  };
}

interface PaginationInfo {
  current_page: number;
  total_pages: number;
  has_previous: boolean;
  has_next: boolean;
  previous_page: number | null;
  next_page: number | null;
}

const ForumPage = () => {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    loadPosts();
  }, [currentPage]);

  const loadPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await forumAPI.getPosts(currentPage);
      setPosts(data.posts);
      setPagination(data.pagination);
      setSearchParams({ page: currentPage.toString() });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load forum posts');
      console.error('Failed to load forum posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!isAuthenticated) return;
    setMarkingRead(true);
    try {
      await forumAPI.markAllRead();
      // Reload posts to update unread status
      await loadPosts();
    } catch (err: any) {
      console.error('Failed to mark all posts as read:', err);
    } finally {
      setMarkingRead(false);
    }
  };

  const handlePageChange = (page: number) => {
    setSearchParams({ page: page.toString() });
  };

  return (
    <div className="forum-page">
      <div className="container">
        <div id="forum-container">
          <div id="forum-buttons-container">
            {isAuthenticated && (
              <>
                <div>
                  <Link to="/forum/new-post">
                    <button className="forum-button pink blue-border">
                      New Post
                    </button>
                  </Link>
                </div>
                <button
                  className="forum-button pink blue-border"
                  onClick={handleMarkAllRead}
                  disabled={markingRead}
                >
                  {markingRead ? 'Marking...' : 'Mark Read'}
                </button>
              </>
            )}
          </div>
          
          {loading && (
            <div className="loading-state">Loading forum posts...</div>
          )}
          
          {error && (
            <div className="error-message" style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
              {error}
            </div>
          )}
          
          {!loading && !error && (
            <>
              <div id="posts-list">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/forum/${post.slug}`}
                    style={{ display: 'block', width: '100%', textDecoration: 'none' }}
                  >
                    <div className="post-container">
                      <div className="post-title green">
                        <span className="post-title green">
                          {post.pinned && (
                            <span className="star pink-background purple">
                              pin
                            </span>
                          )}
                          {post.title}
                        </span>
                      </div>
                      <div className="post-details">
                        <span style={{ fontWeight: 'bold', fontSize: '110%' }}>
                          <span style={{ color: post.author.chat_color }}>
                            {post.author.display_name}
                          </span>
                        </span>
                        <span>
                          <span className="blue">replies:</span>&nbsp;
                          <span className="green">{post.number_of_replies}&nbsp;</span>
                        </span>
                        <span className="pink">
                          {post.latest_reply_ago}
                        </span>
                      </div>
                      {post.is_unread ? (
                        <span className="green-background unread"></span>
                      ) : (
                        <span className="read"></span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              
              {pagination && pagination.total_pages > 1 && (
                <nav aria-label="Page navigation" id="page-navigation">
                  <ul className="pagination message-board-navigation">
                    {pagination.has_previous ? (
                      <li>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(pagination.previous_page!)}
                        >
                          &laquo; PREV
                        </button>
                      </li>
                    ) : (
                      <li className="dummy-link">&laquo; NONE</li>
                    )}
                    <li className="page-item disabled">
                      <span className="page-number yellow">
                        Page {pagination.current_page} of {pagination.total_pages}
                      </span>
                    </li>
                    {pagination.has_next && (
                      <li>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(pagination.next_page!)}
                        >
                          NEXT &raquo;
                        </button>
                      </li>
                    )}
                  </ul>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForumPage;

