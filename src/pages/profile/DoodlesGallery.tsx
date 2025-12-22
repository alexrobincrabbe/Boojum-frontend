import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { authAPI } from '../../services/api';
import DoodleFullscreenModal from './DoodleFullscreenModal';
import './DoodlesGallery.css';

interface Doodle {
  id: number;
  word: string;
  image_url: string | null;
  public: boolean;
  created_at: string | null;
}

interface DoodlesGalleryProps {
  profileUrl: string;
  isEditMode?: boolean;
  initialDoodleId?: number;
}

const DoodlesGallery = ({ profileUrl, isEditMode = false, initialDoodleId }: DoodlesGalleryProps) => {
  const [doodles, setDoodles] = useState<Doodle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAlbum, setShowAlbum] = useState(false);
  const [selectedDoodle, setSelectedDoodle] = useState<Doodle | null>(null);

  const canManageDoodles = isEditMode; // Only show manage button in edit mode

  useEffect(() => {
    const fetchDoodles = async () => {
      try {
        setLoading(true);
        const data = await authAPI.getProfileDoodles(profileUrl);
        // Only show public doodles on the profile
        const publicDoodles = (data.doodles || []).filter((d: Doodle) => d.public);
        setDoodles(publicDoodles);
        
        // If initialDoodleId is provided, open that doodle
        if (initialDoodleId && publicDoodles.length > 0) {
          const doodleToOpen = publicDoodles.find((d: Doodle) => d.id === initialDoodleId);
          if (doodleToOpen) {
            setSelectedDoodle(doodleToOpen);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load doodles');
      } finally {
        setLoading(false);
      }
    };

    fetchDoodles();
  }, [profileUrl, initialDoodleId]);

  if (loading) {
    return (
      <div className="doodles-gallery-container">
        <div className="doodles-loading">Loading doodles...</div>
      </div>
    );
  }

  if (error) {
    return null; // Don't show error, just don't render
  }

  // Show gallery if there are doodles OR if user can manage (so they can add doodles)
  const shouldShowGallery = doodles.length > 0 || canManageDoodles;

  if (!shouldShowGallery) {
    return null; // Don't show gallery if no doodles and can't manage
  }

  return (
    <>
      <div className="doodles-gallery-container">
        <h2 className="doodles-gallery-title">
          <span className="blue-glow">Doodles Album</span>
        </h2>
        {canManageDoodles && (
          <button 
            className="doodles-manage-button"
            onClick={() => setShowAlbum(true)}
          >
            Manage Doodles
          </button>
        )}
        {doodles.length > 0 ? (
          <div className="doodles-grid">
            {doodles.map((doodle) => (
              <div key={doodle.id} className="doodle-item">
                {doodle.image_url && (
                  <img 
                    src={doodle.image_url} 
                    alt={doodle.word}
                    className="doodle-image"
                    onClick={() => setSelectedDoodle(doodle)}
                    style={{ cursor: 'pointer' }}
                  />
                )}
                <div className="doodle-word blue-glow">{doodle.word}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="doodles-empty-message">
            You haven't made any doodles public yet. Click "Manage Doodles" to select up to 10 doodles to display on your profile.
          </p>
        )}
      </div>
      {showAlbum && canManageDoodles && (
        <DoodleAlbum 
          profileUrl={profileUrl}
          onClose={() => setShowAlbum(false)}
          onDoodleUpdated={() => {
            // Refresh doodles when updated - only show public ones
            authAPI.getProfileDoodles(profileUrl).then(data => {
              const publicDoodles = (data.doodles || []).filter((d: Doodle) => d.public);
              setDoodles(publicDoodles);
            });
          }}
        />
      )}
      {selectedDoodle && createPortal(
        <DoodleFullscreenModal
          doodle={selectedDoodle}
          onClose={() => setSelectedDoodle(null)}
        />,
        document.body
      )}
    </>
  );
};

// DoodleAlbum component for managing doodles
interface DoodleAlbumProps {
  profileUrl: string;
  onClose: () => void;
  onDoodleUpdated: () => void;
}

const DoodleAlbum = ({ profileUrl, onClose, onDoodleUpdated }: DoodleAlbumProps) => {
  const [doodles, setDoodles] = useState<Doodle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadDoodles = useCallback(async (page: number) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const data = await authAPI.getDoodleAlbum(profileUrl, page, 3);
      if (page === 1) {
        setDoodles(data.doodles || []);
      } else {
        setDoodles(prev => [...prev, ...(data.doodles || [])]);
      }
      setHasNext(data.has_next || false);
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load doodles');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profileUrl]);

  useEffect(() => {
    loadDoodles(1);
  }, [loadDoodles]);

  // Infinite scroll setup
  useEffect(() => {
    if (!sentinelRef.current || !hasNext || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !loadingMore) {
          loadDoodles(currentPage + 1);
        }
      },
      { rootMargin: '600px 0px' }
    );

    const currentSentinel = sentinelRef.current;
    observer.observe(currentSentinel);
    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
      observer.disconnect();
    };
  }, [hasNext, loadingMore, currentPage, loadDoodles]);

  const handleTogglePublic = async (doodleId: number, currentPublic: boolean) => {
    setUpdating(doodleId);
    try {
      const result = await authAPI.setDoodlePublic(doodleId, !currentPublic);
      if (result.ok) {
        // Update local state
        setDoodles(prev => prev.map(d => 
          d.id === doodleId ? { ...d, public: result.public } : d
        ));
        onDoodleUpdated();
        
        // Show toast notification
        if (result.public) {
          toast.success('Doodle set to public');
        } else {
          toast.success('Doodle set to private');
        }
      } else if (result.error === 'cap_reached') {
        toast.error(result.message || `You can only have ${result.cap} public doodles. Make one private first.`);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update doodle';
      toast.error(errorMsg);
    } finally {
      setUpdating(null);
    }
  };


  return (
    <div className="doodle-album-overlay" onClick={onClose}>
      <div className="doodle-album-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doodle-album-header">
          <h2 className="doodle-album-title">Manage Your Doodles</h2>
          <button className="doodle-album-close" onClick={onClose}>×</button>
        </div>
        <div className="doodle-album-content">
          <p className="doodle-album-info">
            Select up to 10 doodles to display on your profile. Public doodles will be visible to everyone.
          </p>
          {loading && doodles.length === 0 ? (
            <div className="doodle-album-loading">Loading doodles...</div>
          ) : error ? (
            <div className="doodle-album-error">{error}</div>
          ) : doodles.length === 0 ? (
            <div className="doodle-album-empty">No doodles yet.</div>
          ) : (
            <>
              <div className="doodle-album-list">
                {doodles.map((doodle) => (
                  <div 
                    key={doodle.id} 
                    className={`doodle-album-card ${!doodle.public ? 'is-private' : ''}`}
                  >
                    <div className={`doodle-album-word ${doodle.public ? 'blue-glow' : ''}`}>
                      {doodle.word}
                      <label className={`doodle-public-toggle-label ${doodle.public ? 'green' : 'yellow'}`}>
                        <span>Public</span>
                        <input
                          type="checkbox"
                          className="doodle-public-toggle"
                          checked={doodle.public}
                          onChange={() => handleTogglePublic(doodle.id, doodle.public)}
                          disabled={updating === doodle.id}
                        />
                      </label>
                    </div>
                    {doodle.image_url && (
                      <img 
                        src={doodle.image_url}
                        alt={doodle.word}
                        className={`doodle-album-image blue-border ${!doodle.public ? 'doodle-private' : ''}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              {loadingMore && (
                <div className="doodle-album-loading-more">
                  <div className="doodle-album-spinner">Loading more doodles...</div>
                </div>
              )}
              <div ref={sentinelRef} className="doodle-album-sentinel" aria-hidden="true" />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoodlesGallery;

