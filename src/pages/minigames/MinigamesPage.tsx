import { useState, useEffect } from 'react';
import { minigamesAPI } from '../../services/api';
import Boojumble from './components/Boojumble';
import Cluejum from './components/Cluejum';
import Poll from './components/Poll';
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

  useEffect(() => {
    const loadMinigamesData = async () => {
      try {
        const data = await minigamesAPI.getMinigamesData();
        setBoojumbles(data.boojumbles || []);
        setWordClue(data.word_clue || null);
        setDefinition(data.definition || null);
        setSynonym(data.synonym || null);
        setPoll(data.poll || null);
      } catch (error) {
        console.error('Failed to load minigames data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMinigamesData();
  }, []);


  if (loading) {
    return (
      <div className="minigames-page">
        <div className="container-fluid">
          <div style={{ textAlign: 'center', padding: '20px', color: 'white' }}>
            Loading minigames...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="minigames-page">
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-6 order-2">
            <div id="mini-games">
              {/* Tabs */}
              <div className="minigames-tabs">
                <button
                  className={`minigame-tab ${activeTab === 'boojumble' ? 'active' : ''} boojumble-tab`}
                  onClick={() => setActiveTab('boojumble')}
                >
                  Boojumble
                </button>
                <button
                  className={`minigame-tab ${activeTab === 'cluejum' ? 'active' : ''} cluejum-tab`}
                  onClick={() => setActiveTab('cluejum')}
                >
                  Cluejum
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
      </div>
    </div>
  );
};

export default MinigamesPage;

