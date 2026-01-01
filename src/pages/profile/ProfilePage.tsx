import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { authAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loading } from '../../components/Loading';
import HighScoreCharts from './HighScoreCharts';
import TournamentBadges from './TournamentBadges';
import DoodlesGallery from './DoodlesGallery';
import { SortableSection } from './SortableSection';
import ImageCropModal from './ImageCropModal';
import { usePageOnboarding, type Step } from '../../hooks/usePageOnboarding';
import './ProfilePage.css';

interface GameScore {
  high_score: number;
  best_word: string;
  best_word_score: number;
  most_words: number;
  time?: number;
}

interface GameStats {
  normal_games_played: number;
  bonus_games_played: number;
  long_games_played: number;
  one_shot_games_played: number;
}

interface Profile {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
  };
  profile_picture_url: string | null;
  about_me: string | null;
  join_date_formatted: string | null;
  display_name: string;
  chat_color: string;
  name: string | null;
  age: string | null;
  country: string | null;
  other_games: string | null;
  fave_quote: string | null;
  weird_facts: string | null;
  method_of_play: string;
  game_stats: GameStats | null;
  normal_game_scores: GameScore | null;
  bonus_game_scores: GameScore | null;
  long_game_scores: GameScore | null;
  oneshot_normal_game_scores: GameScore | null;
  oneshot_bonus_game_scores: GameScore | null;
  tournament_wins?: Array<{
    id: number;
    name: string;
    position: number;
    start_date: string | null;
    type: string;
    one_shot: boolean;
    pool: number;
  }>;
  profile_section_order?: string[];
}

const ProfilePage = () => {
  const { profileUrl } = useParams<{ profileUrl: string }>();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>(['medals', 'content', 'charts', 'doodles']);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    about_me: '',
    name: '',
    age: '',
    country: '',
    method_of_play: 'type',
    other_games: '',
    fave_quote: '',
    weird_facts: '',
    profile_picture: null as File | null,
  });

  // Drag and drop sensors - must be called before any conditional returns
  // Configure PointerSensor with delay for touch devices to prevent conflicts with scrolling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250, // 250ms delay before activating drag on touch devices
        tolerance: 5, // Allow 5px of movement during delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const fetchProfile = async () => {
      if (!profileUrl) return;
      
      try {
        setLoading(true);
        const data = await authAPI.getProfile(profileUrl);
        setProfile(data);
        // Initialize form data
        setFormData({
          about_me: data.about_me || '',
          name: data.name || '',
          age: data.age || '',
          country: data.country || '',
          method_of_play: data.method_of_play || 'type',
          other_games: data.other_games || '',
          fave_quote: data.fave_quote || '',
          weird_facts: data.weird_facts || '',
          profile_picture: null,
        });
        // Set section order from profile or use default
        const order = data.profile_section_order && Array.isArray(data.profile_section_order) && data.profile_section_order.length === 4
          ? data.profile_section_order
          : ['medals', 'content', 'charts', 'doodles'];
        setSectionOrder(order);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [profileUrl]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Create a preview URL for the crop modal
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedImageBlob: Blob) => {
    // Convert blob to File
    const file = new File([croppedImageBlob], 'profile-picture.jpg', { type: 'image/jpeg' });
    setFormData(prev => ({ ...prev, profile_picture: file }));
    
    // Create preview URL from the cropped blob
    const previewUrl = URL.createObjectURL(croppedImageBlob);
    setPreviewImageUrl(previewUrl);
    
    setShowCropModal(false);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    // Reset the file input
    const fileInput = document.getElementById('profile-picture-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Clean up preview URL when component unmounts or when saving
  useEffect(() => {
    return () => {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

  const handleSave = async () => {
    if (!profile) return;
    
    setSaving(true);
    setSaveError(null);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('about_me', formData.about_me);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('age', formData.age);
      formDataToSend.append('country', formData.country);
      formDataToSend.append('method_of_play', formData.method_of_play);
      formDataToSend.append('other_games', formData.other_games);
      formDataToSend.append('fave_quote', formData.fave_quote);
      formDataToSend.append('weird_facts', formData.weird_facts);
      
      if (formData.profile_picture) {
        formDataToSend.append('profile_picture', formData.profile_picture);
      }
      
      const updatedProfile = await authAPI.updateProfile(formDataToSend);
      setProfile(updatedProfile);
      setIsEditMode(false);
      setFormData(prev => ({ ...prev, profile_picture: null }));
      
      // Clean up preview URL after saving
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
        setPreviewImageUrl(null);
      }
      
      // Dispatch custom event to notify Layout to update profile picture
      window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
        detail: { profilePictureUrl: updatedProfile.profile_picture_url }
      }));
      toast.success('Profile updated successfully');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || 'Failed to save profile';
      setSaveError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!profile) return;
    // Reset form data to original profile values
    setFormData({
      about_me: profile.about_me || '',
      name: profile.name || '',
      age: profile.age || '',
      country: profile.country || '',
      method_of_play: profile.method_of_play || 'type',
      other_games: profile.other_games || '',
      fave_quote: profile.fave_quote || '',
      weird_facts: profile.weird_facts || '',
      profile_picture: null,
    });
    setIsEditMode(false);
    setSaveError(null);
    
    // Clean up preview URL when canceling
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
      setPreviewImageUrl(null);
    }
  };

  // Calculate isOwnProfile safely (before conditional returns)
  const isOwnProfile = profile ? currentUser?.id === profile.user.id : false;

  // Onboarding steps for Profile page (must be before conditional returns)
  const profileSteps = useMemo(() => {
    // Return empty array if profile is not loaded yet
    if (!profile) {
      return [];
    }

    const steps: Step[] = [
      {
        target: '#profile-name',
        content: (
          <div>
            <h3>Welcome to Your Profile</h3>
            <p>Your profile page displays your game statistics, achievements, and personal information. You can customize everything here to make it your own!</p>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#profile-pic',
        content: (
          <div>
            <h3>Profile Picture</h3>
            <p>Your profile picture appears here. In edit mode, you can click on it to change your photo.</p>
          </div>
        ),
        placement: 'right',
      },
    ];

    // Add Edit Profile button step only if it's the user's own profile
    if (isOwnProfile) {
      steps.push({
        target: '[data-onboarding="edit-profile-button"]',
        content: (
          <div>
            <h3>Edit Profile</h3>
            <p>Click this button to enter edit mode. In edit mode, you can customize your profile picture, personal details, and rearrange sections by dragging them.</p>
          </div>
        ),
        placement: 'left',
      });
    }

    // Add section steps based on section order
    const order = (sectionOrder && Array.isArray(sectionOrder) && sectionOrder.length === 4) 
      ? sectionOrder 
      : ['medals', 'content', 'charts', 'doodles'];

    order.forEach((sectionId) => {
      let title = '';
      let description = '';
      
      switch (sectionId) {
        case 'medals':
          title = 'Tournament Medals';
          description = 'This section displays your tournament achievements and medals. Compete in tournaments to earn medals!';
          break;
        case 'content':
          title = 'About Me & Game Stats';
          description = 'This section contains your personal details, game statistics, and "About Me" information. In edit mode, you can update all of these fields.';
          break;
        case 'charts':
          title = 'High Score Charts';
          description = 'View your high scores across different game modes. Track your progress and see how you rank!';
          break;
        case 'doodles':
          title = 'Doodles Album';
          description = 'Your collection of doodles from games. Save your favorite doodles to showcase your creativity!';
          break;
      }

      if (title && description) {
        steps.push({
          target: `[data-onboarding="profile-section-${sectionId}"]`,
          content: (
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
              {isOwnProfile && (
                <p><strong>In edit mode:</strong> You can drag the grip handle to reorder this section.</p>
              )}
            </div>
          ),
          placement: 'top',
        });
      }
    });

    // Add edit mode customization step if it's the user's own profile and in edit mode
    if (isOwnProfile && isEditMode) {
      steps.push({
        target: '[data-onboarding="profile-edit-mode-info"]',
        content: (
          <div>
            <h3>Customizing Your Profile</h3>
            <p>In edit mode, you can:</p>
            <ul style={{ textAlign: 'left', marginTop: '10px' }}>
              <li>Change your profile picture by clicking on it</li>
              <li>Edit personal details (name, age, country, etc.)</li>
              <li>Update your "About Me" section</li>
              <li>Drag sections using the grip handle to reorder them</li>
            </ul>
            <p style={{ marginTop: '10px' }}>Click "Save" when you're done, or "Cancel" to discard changes.</p>
          </div>
        ),
        placement: 'top',
      });
    }

    return steps;
  }, [profile, sectionOrder, isOwnProfile, isEditMode]);

  // Auto-start onboarding when profile is loaded
  const autoStart = !loading && profile !== null && profileSteps.length > 0;

  const { JoyrideComponent } = usePageOnboarding({
    steps: profileSteps,
    pageKey: 'profile',
    autoStart,
  });

  if (loading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error || 'Profile not found'}</div>
      </div>
    );
  }

  // Drag and drop handler
  const handleDragEnd = async (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(active.id as string);
      const newIndex = sectionOrder.indexOf(over.id as string);
      const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);
      
      setSectionOrder(newOrder);
      
      // Save the new order
      try {
        await authAPI.updateProfileSectionOrder(newOrder);
        toast.success('Section order updated');
      } catch (err: any) {
        const errorMsg = err.response?.data?.error || 'Failed to update section order';
        toast.error(errorMsg);
        // Revert on error
        setSectionOrder(profile?.profile_section_order || ['medals', 'content', 'charts', 'doodles']);
      }
    }
  };

  // Render sections based on order
  const renderSection = (sectionId: string) => {
    if (!profile) return null;
    
    switch (sectionId) {
      case 'content':
        return (
          <div key="content" className="row profile-content-row">
            {/* Left Column - Personal Details */}
            <div className="col-12 col-md-4 personal-details-col">
              <PersonalDetailsSection 
                profile={profile}
                formData={formData}
                isEditMode={isEditMode}
                onChange={handleInputChange}
              />
            </div>

            {/* Center Column - Game Stats */}
            <div className="col-12 col-md-4 game-details-col">
              <div id="game-details-container">
                <h2>Game Stats</h2>
                <div id="game-details">
                  <NormalGameStats 
                    gameStats={profile.game_stats}
                    gameScores={profile.normal_game_scores}
                  />
                  <BonusGameStats 
                    gameStats={profile.game_stats}
                    gameScores={profile.bonus_game_scores}
                  />
                  <LongGameStats 
                    gameStats={profile.game_stats}
                    gameScores={profile.long_game_scores}
                  />
                  <UnicornGameStats 
                    gameStats={profile.game_stats}
                    normalScores={profile.oneshot_normal_game_scores}
                    bonusScores={profile.oneshot_bonus_game_scores}
                  />
                </div>
              </div>
            </div>

            {/* Right Column - About Me */}
            <div id="about-me-col" className="col-12 col-md-4 about-me-col">
              <AboutMeSection 
                aboutMe={isEditMode ? formData.about_me : profile.about_me}
                isEditMode={isEditMode}
                onChange={handleInputChange}
              />
            </div>
          </div>
        );
      case 'doodles':
        return (
          <div key="doodles" className="row">
            <div className="col-12">
              <DoodlesGallery 
                profileUrl={profileUrl || ''} 
                isEditMode={isEditMode}
                initialDoodleId={searchParams.get('doodle') ? parseInt(searchParams.get('doodle') || '0') : undefined}
              />
            </div>
          </div>
        );
      case 'charts':
        return (
          <div key="charts" className="row">
            <div className="col-12">
              <HighScoreCharts profileUrl={profileUrl || ''} />
            </div>
          </div>
        );
      case 'medals':
        return (
          <div key="medals" className="row">
            <div className="col-12">
              {profile.tournament_wins && profile.tournament_wins.length > 0 ? (
                <TournamentBadges tournamentWins={profile.tournament_wins} />
              ) : (
                <div className="empty-section-message">
                  <p>No tournament medals yet.</p>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container-fluid profile-container">
      {/* Edit/Save/Cancel Buttons - Top Right */}
      {isOwnProfile && (
        <div className="profile-actions-top-right">
          {!isEditMode ? (
            <button 
              onClick={() => setIsEditMode(true)}
              className="edit-profile-top-button"
              data-onboarding="edit-profile-button"
            >
              Edit Profile
            </button>
          ) : (
            <div className="edit-mode-actions" data-onboarding="profile-edit-mode-info">
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="save-button"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button 
                onClick={handleCancel} 
                disabled={saving}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          )}
          {saveError && (
            <div className="save-error">{saveError}</div>
          )}
        </div>
      )}

      {/* Profile Name Row */}
      <div className="row">
        <div className="col">
          <div id="profile-name-container">
            <h1 
              id="profile-name"
              style={{ 
                color: profile.chat_color || '#f5ce45',
                textShadow: profile.chat_color === '#71bbe9' || profile.chat_color === 'rgb(113, 187, 233)'
                  ? '2px 2px 6px rgb(38, 76, 146), -2px -2px 6px rgb(38, 76, 146), 2px -2px 6px rgb(38, 76, 146), -2px 2px 6px rgb(38, 76, 146)'
                  : 'none'
              }}
            >
              {profile.display_name}
            </h1>
          </div>
        </div>
      </div>

      {/* Profile Picture Row */}
      <div className="row">
        <div className="col-12 profile-pic-row">
          <div id="profile-pic-container-top">
            <ProfilePicture 
              profilePictureUrl={previewImageUrl || profile.profile_picture_url}
              isOwnProfile={isOwnProfile}
              isEditMode={isEditMode}
              onFileChange={handleFileChange}
              chatColor={profile.chat_color}
            />
            {showCropModal && imageToCrop && (
              <ImageCropModal
                imageSrc={imageToCrop}
                onClose={handleCropCancel}
                onCropComplete={handleCropComplete}
              />
            )}
          </div>
        </div>
      </div>

      {/* Draggable Sections */}
      {(() => {
        // Ensure we have a valid order
        const order = (sectionOrder && Array.isArray(sectionOrder) && sectionOrder.length === 4) 
          ? sectionOrder 
          : ['medals', 'content', 'charts', 'doodles'];
        
        if (isEditMode) {
          return (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={order}
                strategy={verticalListSortingStrategy}
              >
                {order.map((sectionId) => {
                  const sectionContent = renderSection(sectionId);
                  if (!sectionContent) return null;
                  const title = sectionId === 'content' 
                    ? 'About Me, Game Stats & Personal Details'
                    : sectionId === 'doodles'
                    ? 'Doodles Album'
                    : sectionId === 'charts'
                    ? 'High Score Charts'
                    : 'Tournament Medals';
                  return (
                    <div key={sectionId} data-onboarding={`profile-section-${sectionId}`}>
                      <SortableSection id={sectionId} isEditMode={isEditMode} title={title}>
                        {sectionContent}
                      </SortableSection>
                    </div>
                  );
                })}
              </SortableContext>
            </DndContext>
          );
        } else {
          return (
            <>
              {order.map((sectionId) => {
                const sectionContent = renderSection(sectionId);
                if (!sectionContent) return null;
                return (
                  <div key={sectionId} data-onboarding={`profile-section-${sectionId}`}>
                    {sectionContent}
                  </div>
                );
              })}
            </>
          );
        }
      })()}
      {JoyrideComponent}
    </div>
  );
};

// About Me Component
const AboutMeSection = ({ 
  aboutMe, 
  isEditMode, 
  onChange 
}: { 
  aboutMe: string | null;
  isEditMode: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) => {
  return (
    <div id="who-are-you-container-outer">
      <h2 id="who-are-you-header">Tell us more</h2>
      <div id="who-are-you-container">
        <div id="who-are-you">
          {isEditMode ? (
            <textarea
              id="who-are-you-text"
              name="about_me"
              value={aboutMe || ''}
              onChange={onChange}
              maxLength={500}
              className="edit-textarea"
            />
          ) : (
            <p id="who-are-you-text">
              {aboutMe ? aboutMe.split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              )) : 'No about me section yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Profile Picture Component
const ProfilePicture = ({ 
  profilePictureUrl, 
  isOwnProfile,
  isEditMode,
  onFileChange,
  chatColor
}: { 
  profilePictureUrl: string | null;
  isOwnProfile: boolean;
  isEditMode: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  chatColor?: string;
}) => {
  const hasPlaceholder = !profilePictureUrl || profilePictureUrl.includes('placeholder');
  const borderColor = chatColor || '#71bbe9';
  const boxShadow = `0 0 20px ${borderColor}`;
  
  return (
    <div 
      id="profile-pic"
      style={{
        border: `5px solid ${borderColor}`,
        boxShadow: boxShadow
      }}
    >
      {hasPlaceholder ? (
        <img 
          src="/images/default.png" 
          alt="Profile" 
          className="profile-pic-image"
        />
      ) : (
        <img 
          src={profilePictureUrl} 
          alt="Profile" 
          className="profile-pic-image"
        />
      )}
      {isOwnProfile && isEditMode && (
        <label htmlFor="profile-picture-upload" className="edit-profile-picture-label">
          <input
            id="profile-picture-upload"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
          Change Photo
        </label>
      )}
    </div>
  );
};

// Game Stats Components (unchanged)
const NormalGameStats = ({ 
  gameStats, 
  gameScores 
}: { 
  gameStats: GameStats | null;
  gameScores: GameScore | null;
}) => {
  if (!gameScores && !gameStats?.normal_games_played) return null;
  
  return (
    <div className="game-scores-container">
      <h5 className="yellow">LookingGlass</h5>
      <br />
      <div className="game-scores">
        <div>
          <span className="label">Games Played:</span> {gameStats?.normal_games_played || 0}
        </div>
        <div>
          <span className="label">High Score:</span> {gameScores?.high_score || 0}
        </div>
        <div>
          <span className="label">Most Words:</span> {gameScores?.most_words || 0}
        </div>
        <div>
          <span className="label">Best Word:</span> {gameScores?.best_word || 'N/A'} 
          {gameScores?.best_word && gameScores?.best_word_score && (
            <> (<strong className="yellow">{gameScores.best_word_score}</strong>pts)</>
          )}
        </div>
      </div>
    </div>
  );
};

const BonusGameStats = ({ 
  gameStats, 
  gameScores 
}: { 
  gameStats: GameStats | null;
  gameScores: GameScore | null;
}) => {
  if (!gameScores && !gameStats?.bonus_games_played) return null;
  
  return (
    <div className="game-scores-container">
      <h5 className="pink">Boojum</h5>
      <br />
      <div className="game-scores">
        <div>
          <span className="label">Games Played:</span> {gameStats?.bonus_games_played || 0}
        </div>
        <div>
          <span className="label">High Score:</span> {gameScores?.high_score || 0}
        </div>
        <div>
          <span className="label">Most Words:</span> {gameScores?.most_words || 0}
        </div>
        <div>
          <span className="label">Best Word:</span> {gameScores?.best_word || 'N/A'} 
          {gameScores?.best_word && gameScores?.best_word_score && (
            <> (<strong className="yellow">{gameScores.best_word_score}</strong>pts)</>
          )}
        </div>
      </div>
    </div>
  );
};

const LongGameStats = ({ 
  gameStats, 
  gameScores 
}: { 
  gameStats: GameStats | null;
  gameScores: GameScore | null;
}) => {
  if (!gameScores && !gameStats?.long_games_played) return null;
  
  return (
    <div className="game-scores-container">
      <h5 className="purple">Forevermore</h5>
      <br />
      <div className="game-scores">
        <div>
          <span className="label">Games Played:</span> {gameStats?.long_games_played || 0}
        </div>
        <div>
          <span className="label">High Score:</span> {gameScores?.high_score || 0}
        </div>
        <div>
          <span className="label">Most Words:</span> {gameScores?.most_words || 0}
        </div>
        <div>
          <span className="label">Best Word:</span> {gameScores?.best_word || 'N/A'} 
          {gameScores?.best_word && gameScores?.best_word_score && (
            <> (<strong className="yellow">{gameScores.best_word_score}</strong>pts)</>
          )}
        </div>
      </div>
    </div>
  );
};

const UnicornGameStats = ({ 
  gameStats, 
  normalScores, 
  bonusScores 
}: { 
  gameStats: GameStats | null;
  normalScores: GameScore | null;
  bonusScores: GameScore | null;
}) => {
  if (!normalScores && !bonusScores && !gameStats?.one_shot_games_played) return null;
  
  return (
    <div className="game-scores-container">
      <h5 className="green">Unicorn</h5>
      <br />
      <div className="game-scores">
        <div>
          <span className="label">Games Played:</span> {gameStats?.one_shot_games_played || 0}
        </div>
        {normalScores && (
          <div>
            <span className="label green">Normal:</span> {normalScores.best_word} 
            (<strong className="yellow">{normalScores.best_word_score}</strong>pts) 
            in <strong className="blue"> {normalScores.time}s</strong>
          </div>
        )}
        {bonusScores && (
          <div>
            <span className="label">Bonus:</span> {bonusScores.best_word} 
            (<strong className="yellow">{bonusScores.best_word_score}</strong>pts) 
            in <strong className="blue"> {bonusScores.time}s</strong>
          </div>
        )}
      </div>
    </div>
  );
};

// Personal Details Component
const PersonalDetailsSection = ({ 
  profile, 
  formData, 
  isEditMode, 
  onChange 
}: { 
  profile: Profile;
  formData: {
    name: string;
    age: string;
    country: string;
    method_of_play: string;
    other_games: string;
    fave_quote: string;
    weird_facts: string;
  };
  isEditMode: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}) => {
  return (
    <div id="tell-us-more-container">
      <h2 id="tell-us-more-header">Who are you?</h2>
      <div id="date-joined">
        <span className="label">Joined: </span>
        {profile.join_date_formatted || 'N/A'}
      </div>
      <div id="tell-us-more">
        <div id="pt-1">
          <div className="personal-details">
            <span className="blue">Name:</span> 
            {isEditMode ? (
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={onChange}
                className="detail-input"
                maxLength={30}
              />
            ) : (
              <span className="detail-text">{profile.name || 'N/A'}</span>
            )}
          </div>
          <div className="personal-details">
            <span className="blue">Age/Birthday:</span> 
            {isEditMode ? (
              <input
                type="text"
                name="age"
                value={formData.age}
                onChange={onChange}
                className="detail-input"
                maxLength={30}
              />
            ) : (
              <span className="detail-text">{profile.age || 'N/A'}</span>
            )}
          </div>
          <div className="personal-details">
            <span className="blue">Country:</span> 
            {isEditMode ? (
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={onChange}
                className="detail-input"
                maxLength={30}
              />
            ) : (
              <span className="detail-text">{profile.country || 'N/A'}</span>
            )}
          </div>
          <div className="personal-details">
            <span className="blue">Method of play:</span> 
            {isEditMode ? (
              <select
                name="method_of_play"
                value={formData.method_of_play}
                onChange={onChange}
                className="detail-select"
                id="cap"
              >
                <option value="type">Type</option>
                <option value="swipe">Swipe</option>
                <option value="mouse">Mouse</option>
              </select>
            ) : (
              <span id="cap" className="detail-text">{profile.method_of_play || 'N/A'}</span>
            )}
          </div>
        </div>
        <div id="pt-2">
          <div className="personal-details">
            <span className="blue">Other games:</span> 
            {isEditMode ? (
              <input
                type="text"
                name="other_games"
                value={formData.other_games}
                onChange={onChange}
                className="detail-input yellow"
                maxLength={100}
              />
            ) : (
              <span className="detail-text yellow">{profile.other_games || 'N/A'}</span>
            )}
          </div>
          <div className="personal-details">
            <span className="blue">Favourite quote:</span> 
            {isEditMode ? (
              <input
                type="text"
                name="fave_quote"
                value={formData.fave_quote}
                onChange={onChange}
                className="detail-input pink"
                maxLength={150}
              />
            ) : (
              <span className="detail-text pink">{profile.fave_quote || 'N/A'}</span>
            )}
          </div>
          <div className="personal-details">
            <span className="blue">Weird facts about you:</span> 
            {isEditMode ? (
              <textarea
                name="weird_facts"
                value={formData.weird_facts}
                onChange={onChange}
                className="detail-textarea green"
                rows={3}
                maxLength={250}
              />
            ) : (
              <span className="detail-text green">{profile.weird_facts || 'N/A'}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

