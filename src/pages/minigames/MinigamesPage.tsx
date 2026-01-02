import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { minigamesAPI } from '../../services/api';
import Boojumble from './components/Boojumble';
import Cluejum from './components/Cluejum';
import Poll from './components/Poll';
import { Loading } from '../../components/Loading';
import { toast } from 'react-toastify';
import './MinigamesPage.css';

interface BoojumbleData {
  id: number;
  title: string;
  scrambled: string[][];
  rows: string[];
  cols: string[];
  N: number;
  date: string;
}

interface WordClueData {
  word: string;
  clue_1: string;
  clue_2: string;
  clue_3: string;
  date: string;
}

interface DefinitionData {
  word: string;
  definitions: string[];
  answer: number;
  date: string;
}

interface SynonymData {
  word: string;
  synonyms: string[];
  answer: number;
  date: string;
}

interface PollData {
  id: number;
  question: string;
  options: Array<{ value: string; percentage: number }>;
  total_votes: number;
  user_vote: number | null;
  discussion_link: string;
}


const MinigamesPage = () => {
  const [boojumbles, setBoojumbles] = useState<BoojumbleData[]>([]);
  const [wordClue, setWordClue] = useState<WordClueData | null>(null);
  const [definition, setDefinition] = useState<DefinitionData | null>(null);
  const [synonym, setSynonym] = useState<SynonymData | null>(null);
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'boojumble' | 'cluejum'>('boojumble');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const isArchiveMode = searchParams.get('archive') === 'true';
  const archiveDate = searchParams.get('date');
  const [currentDate, setCurrentDate] = useState<string | null>(archiveDate || null);
  const [prevDate, setPrevDate] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [playedDates, setPlayedDates] = useState<Set<string>>(new Set());
  const [showListView, setShowListView] = useState(false);

  useEffect(() => {
    // Load played dates from localStorage
    const stored = localStorage.getItem('minigames-played');
    if (stored) {
      try {
        const played = JSON.parse(stored);
        setPlayedDates(new Set(played));
      } catch (e) {
        console.error('Error loading played minigames:', e);
      }
    }
  }, []);

  useEffect(() => {
    const loadMinigamesData = async () => {
      try {
        setLoading(true);
        let data;
        
        if (isArchiveMode) {
          // Check premium access
          if (!isAuthenticated || !user?.is_premium) {
            toast.error('Premium subscription required to access archives');
            navigate('/dashboard');
            return;
          }
          
          // Load archive data for specific date
          data = await minigamesAPI.getMinigamesArchive(archiveDate || undefined);
          setCurrentDate(data.date);
          setPrevDate(data.prev_date || null);
          setNextDate(data.next_date || null);
          setAvailableDates(data.available_dates || []);
        } else {
          // Load current day's data
          data = await minigamesAPI.getMinigamesData();
        }
        
        setBoojumbles(data.boojumbles || []);
        setWordClue(data.word_clue || null);
        setDefinition(data.definition || null);
        setSynonym(data.synonym || null);
        if (!isArchiveMode) {
          setPoll(data.poll || null);
        }
      } catch (error: any) {
        console.error('Failed to load minigames data:', error);
        if (error.response?.status === 403) {
          toast.error('Premium subscription required to access archives');
          navigate('/dashboard');
        }
      } finally {
        setLoading(false);
      }
    };

    loadMinigamesData();
  }, [isArchiveMode, archiveDate, isAuthenticated, user, navigate]);

  const handleDateNavigation = (direction: 'prev' | 'next') => {
    const targetDate = direction === 'prev' ? prevDate : nextDate;
    if (targetDate) {
      setSearchParams({ archive: 'true', date: targetDate });
    }
  };

  const handlePlayedToggle = (date: string) => {
    setPlayedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      // Save to localStorage
      const playedArray = Array.from(newSet);
      localStorage.setItem('minigames-played', JSON.stringify(playedArray));
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleDateSelect = (date: string) => {
    // Switch to game view and navigate to selected date
    setShowListView(false);
    setSearchParams({ archive: 'true', date });
  };


  if (loading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

  return (
    <div className="minigames-page">
      <div className="container-fluid">
        {isArchiveMode && (
          <>
            {/* List View Toggle */}
            <div className="archive-controls">
              <button
                className={`archive-view-toggle ${!showListView ? 'active' : ''}`}
                onClick={() => setShowListView(false)}
              >
                Game View
              </button>
              <button
                className={`archive-view-toggle ${showListView ? 'active' : ''}`}
                onClick={() => setShowListView(true)}
              >
                List View
              </button>
            </div>

            {showListView ? (
              /* List View */
              <div className="archive-list-view">
                <h2 className="archive-list-title">Available Dates</h2>
                <p className="archive-list-subtitle">Click a date to view its games</p>
                <div className="archive-dates-list">
                  {availableDates.map((date) => (
                    <div
                      key={date}
                      className={`archive-date-item ${currentDate === date ? 'active' : ''}`}
                      onClick={() => handleDateSelect(date)}
                    >
                      <div className="archive-date-item-content">
                        <span className="archive-date-item-date">{formatDateShort(date)}</span>
                        <label
                          className="played-checkbox-label"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={playedDates.has(date)}
                            onChange={() => handlePlayedToggle(date)}
                            className="played-checkbox"
                          />
                          <span className={`played-status-small ${playedDates.has(date) ? 'played' : 'not-played'}`}>
                            {playedDates.has(date) ? '✓ Played' : 'Not Played'}
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Game View */
              currentDate && (
                <div className="archive-header">
                  <div className="archive-navigation">
                    <button
                      className="archive-nav-btn"
                      onClick={() => handleDateNavigation('prev')}
                      disabled={!prevDate || loading}
                    >
                      ← Previous
                    </button>
                    <div className="archive-date-info">
                      <h2 className="archive-date-title">{formatDate(currentDate)}</h2>
                      <label className="played-checkbox-label">
                        <input
                          type="checkbox"
                          checked={playedDates.has(currentDate)}
                          onChange={() => handlePlayedToggle(currentDate)}
                          className="played-checkbox"
                        />
                        <span className={`played-status ${playedDates.has(currentDate) ? 'played' : 'not-played'}`}>
                          {playedDates.has(currentDate) ? 'Played' : 'Not Played'}
                        </span>
                      </label>
                    </div>
                    <button
                      className="archive-nav-btn"
                      onClick={() => handleDateNavigation('next')}
                      disabled={!nextDate || loading}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )
            )}
          </>
        )}
        {/* Only show game content when not in list view */}
        {!showListView && (
          <div className="row">
            <div className="col-md-6 order-2">
              <div id="mini-games">
                {/* Tabs */}
                <div className="minigames-tabs">
                  <button
                    className={`minigame-tab ${activeTab === 'boojumble' ? 'active' : ''} boojumble-tab`}
                    onClick={() => setActiveTab('boojumble')}
                  >
                    Boojumbles
                  </button>
                  <button
                    className={`minigame-tab ${activeTab === 'cluejum' ? 'active' : ''} cluejum-tab`}
                    onClick={() => setActiveTab('cluejum')}
                  >
                    Cluejums
                  </button>
                </div>

                {/* Game Content */}
                <div className="minigame-content">
                  {activeTab === 'boojumble' && (
                    <Boojumble boojumbles={boojumbles} />
                  )}
                  {activeTab === 'cluejum' && (
                    <Cluejum
                      wordClue={wordClue}
                      definition={definition}
                      synonym={synonym}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Poll Section */}
            {poll && (
              <div className="col-md-6 order-1">
                <Poll poll={poll} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MinigamesPage;

