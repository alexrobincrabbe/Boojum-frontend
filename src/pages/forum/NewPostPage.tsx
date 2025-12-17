import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { forumAPI } from '../../services/api';
import { toast } from 'react-toastify';
import './NewPostPage.css';

// Dynamic import for Quill to handle missing dependency gracefully
let Quill: any = null;
let quillStylesLoaded = false;

const loadQuill = async () => {
  if (Quill) return Quill;
  try {
    // Import Quill dynamically
    const quillModule = await import('quill');
    Quill = quillModule.default;
    
    // Load styles if not already loaded
    if (!quillStylesLoaded) {
      await import('quill/dist/quill.snow.css');
      quillStylesLoaded = true;
    }
    
    return Quill;
  } catch (err) {
    console.error('Failed to load Quill:', err);
    return null;
  }
};

const NewPostPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const quillRef = useRef<Quill | null>(null);
  const quillContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('NewPostPage useEffect - loading:', loading, 'isAuthenticated:', isAuthenticated);
    
    // Wait for auth to finish loading before checking
    if (loading) {
      return;
    }

    // Only redirect if we're sure the user is not authenticated
    if (!isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      navigate('/login');
      return;
    }
    
    console.log('User authenticated, initializing editor');

    // Initialize Quill editor
    const initQuill = async () => {
      if (!quillContainerRef.current || quillRef.current) {
        return;
      }

      const QuillClass = await loadQuill();
      if (!QuillClass) {
        toast.error('Rich text editor failed to load. Please refresh the page.');
        return;
      }

      try {
        quillRef.current = new QuillClass(quillContainerRef.current, {
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

        // Handle image uploads
        const toolbar = quillRef.current.getModule('toolbar');
        toolbar.addHandler('image', () => {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();
          
          input.onchange = async () => {
            const file = input.files?.[0];
            if (file && quillRef.current) {
              try {
                const result = await forumAPI.uploadImage(file);
                const range = quillRef.current.getSelection();
                quillRef.current.insertEmbed(range?.index || 0, 'image', result.image_url);
      } catch (err) {
        console.error('Failed to upload image:', err);
        toast.error('Failed to upload image');
      }
            }
          };
        });
      } catch (err) {
        console.error('Failed to initialize Quill editor:', err);
        toast.error('Failed to initialize editor. Please refresh the page.');
      }
    };

    initQuill();

    return () => {
      // Cleanup
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!quillRef.current) {
      alert('Editor is not ready. Please wait a moment and try again.');
      return;
    }
    
    const content = quillRef.current.root.innerHTML;
    
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    if (!content || content === '<p><br></p>') {
      toast.error('Post content is required');
      return;
    }
    
    setSubmitting(true);
    try {
      const result = await forumAPI.createPost(title.trim(), content);
      toast.success('Post created successfully!');
      navigate(`/forum/${result.slug}`);
    } catch (err: any) {
      console.error('Failed to create post:', err);
      const errorMessage = err.response?.data?.error || 'Failed to create post';
      toast.error(errorMessage);
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/forum');
  };

  // Show loading state while checking authentication
  if (loading || !isAuthenticated) {
    return (
      <div className="new-post-page">
        <div className="container">
          <div style={{ textAlign: 'center', padding: '20px', color: 'white' }}>
            {loading ? 'Loading...' : 'Redirecting to login...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="new-post-page">
      <div className="container">
        <form id="new-post-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="form-group">
            <input
              type="text"
              className="form-control"
              placeholder="Post Title*"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            
            <span style={{ marginBottom: '15px', display: 'inline-block', color: 'white' }}>
              Body*
            </span>
            <div ref={quillContainerRef} id="quill-editor"></div>
          </fieldset>
          
          <div style={{ display: 'flex' }}>
            <button
              type="button"
              className="yellow-button"
              id="cancel-post-btn"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <div className="form-group">
              <button
                id="submit-post-btn"
                className="yellow-button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewPostPage;

