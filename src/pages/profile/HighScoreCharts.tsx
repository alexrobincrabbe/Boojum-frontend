import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { authAPI } from '../../services/api';
import { Maximize2, X, RotateCw } from 'lucide-react';
import './HighScoreCharts.css';

interface HistoricalScore {
  date: string;
  normal_score: number | null;
  bonus_score: number | null;
  long_game_score: number | null;
  unicorn_score: number | null;
  normal_words: number | null;
  bonus_words: number | null;
  long_game_words: number | null;
  unicorn_words: number | null;
  normal_best_word_score: number | null;
  bonus_best_word_score: number | null;
  long_game_best_word_score: number | null;
  unicorn_best_word_score: number | null;
  unicorn_normal_best_word_score: number | null;
  unicorn_bonus_best_word_score: number | null;
  // Leaderboard positions
  normal_score_position?: number | null;
  bonus_score_position?: number | null;
  long_game_score_position?: number | null;
  normal_words_position?: number | null;
  bonus_words_position?: number | null;
  long_game_words_position?: number | null;
  normal_best_word_position?: number | null;
  bonus_best_word_position?: number | null;
  long_game_best_word_position?: number | null;
  unicorn_normal_best_word_position?: number | null;
  unicorn_bonus_best_word_position?: number | null;
}

interface HighScoreChartsProps {
  profileUrl: string;
}

type Period = 'weekly' | 'monthly' | 'yearly';
type ViewMode = 'points' | 'position';

interface ChartProps {
  title: string;
  data: any[];
  colors: Record<string, string>;
  viewMode: ViewMode;
  visibleLines: Record<string, boolean>;
  onToggleLine: (line: string) => void;
  onFullscreen: () => void;
  onToggleView: () => void;
  onCloseFullscreen?: () => void;
  isLoading?: boolean;
  isFullscreen?: boolean;
}

// Helper function to get display name for game types
const getDisplayName = (key: string, isUnicorn: boolean = false): string => {
  if (isUnicorn) {
    // Keep Normal and Bonus as-is for unicorn
    return key;
  }
  // Translate for regular charts
  const displayNames: Record<string, string> = {
    'Normal': 'Looking Glass',
    'Bonus': 'Boojum',
    'Long Game': 'Forevermore',
  };
  return displayNames[key] || key;
};

const ChartComponent = ({ title, data, colors, viewMode, visibleLines, onToggleLine, onFullscreen, onToggleView, onCloseFullscreen, isLoading = false, isFullscreen = false }: ChartProps) => {
  const lines = Object.keys(colors);
  const isUnicorn = title.toLowerCase().includes('unicorn');
  const yAxisLabel = viewMode === 'points' ? 'Points' : 'Position';
  const reversed = viewMode === 'position'; // Lower position is better, so reverse Y axis
  const isPositionMode = viewMode === 'position';
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | string>("100%");

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 767;
      setIsMobile(mobile);
      
      // On mobile, use actual container width for ResponsiveContainer
      // On desktop, always use "100%"
      if (mobile && containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) {
          setContainerWidth(width);
        }
      } else {
        setContainerWidth("100%");
      }
    };
    
    // Initial check
    checkMobile();
    
    // Check on window resize
    window.addEventListener('resize', checkMobile);
    
    // Also check on container resize (with a small delay to ensure container is rendered)
    let resizeObserver: ResizeObserver | null = null;
    const timeoutId = setTimeout(() => {
      if (containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          checkMobile();
        });
        resizeObserver.observe(containerRef.current);
      }
    }, 100);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(timeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Reduce margins on mobile to maximize chart width - minimize all margins
  // On mobile, use minimal margins to maximize plot area
  const chartMargins = isMobile && !isFullscreen
    ? { top: 5, right: -80, left: -80, bottom: 5 }
    : { top: 5, right: 20, left: 0, bottom: 5 };

  return (
    <div className="chart-container" ref={containerRef}>
      <div className="chart-header">
        <h3>{title}</h3>
        <div className="line-filters">
          {lines.map(line => {
            const displayName = getDisplayName(line, isUnicorn);
            return (
              <button
                key={line}
                className={`line-filter-button ${visibleLines[line] ? 'active' : 'inactive'}`}
                onClick={() => onToggleLine(line)}
                disabled={isLoading}
                style={{ 
                  borderColor: colors[line],
                  color: visibleLines[line] ? colors[line] : '#888',
                  backgroundColor: visibleLines[line] ? `${colors[line]}20` : 'transparent'
                }}
                title={`${visibleLines[line] ? 'Hide' : 'Show'} ${displayName}`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
        {!isFullscreen && (
          <button 
            className="view-toggle-slider"
            onClick={onToggleView}
            disabled={isLoading}
            title={`Switch to ${viewMode === 'points' ? 'Position' : 'Points'}`}
          >
            <span className={viewMode === 'points' ? 'active' : ''}>Points</span>
            <span className={`slider-toggle ${viewMode === 'position' ? 'slider-right' : 'slider-left'}`}>
              <span className="slider-thumb"></span>
            </span>
            <span className={viewMode === 'position' ? 'active' : ''}>Position</span>
          </button>
        )}
        {isFullscreen && onCloseFullscreen && (
          <>
            <button 
              className="view-toggle-slider"
              onClick={onToggleView}
              disabled={isLoading}
              title={`Switch to ${viewMode === 'points' ? 'Position' : 'Points'}`}
            >
              <span className={viewMode === 'points' ? 'active' : ''}>Points</span>
              <span className={`slider-toggle ${viewMode === 'position' ? 'slider-right' : 'slider-left'}`}>
                <span className="slider-thumb"></span>
              </span>
              <span className={viewMode === 'position' ? 'active' : ''}>Position</span>
            </button>
            <button 
              className="close-fullscreen-button-inline"
              onClick={onCloseFullscreen}
              disabled={isLoading}
              title="Close fullscreen"
            >
              <X size={18} />
            </button>
          </>
        )}
        {!isFullscreen && (
          <button 
            className="fullscreen-button"
            onClick={onFullscreen}
            disabled={isLoading}
            title="View fullscreen"
          >
            <Maximize2 size={18} />
          </button>
        )}
      </div>
      <ResponsiveContainer 
        width={typeof containerWidth === 'number' && containerWidth > 0 ? containerWidth : "100%"} 
        height={isFullscreen ? "100%" : 300}
      >
        <LineChart data={data} margin={chartMargins}>
          <CartesianGrid strokeDasharray="3 3" stroke="#71bbe9" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="#71bbe9"
            style={{ fontSize: isMobile ? '10px' : '12px' }}
            {...(isMobile ? { height: 30 } : {})}
          />
          <YAxis 
            stroke="#71bbe9"
            style={{ fontSize: isMobile ? '10px' : '12px' }}
            reversed={reversed}
            domain={isPositionMode ? [1, 10] : undefined}
            ticks={isPositionMode ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : undefined}
            allowDecimals={!isPositionMode}
            {...(isMobile ? { width: 30 } : {})}
            label={isMobile ? undefined : { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#71bbe9' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(19, 19, 42, 0.95)',
              border: '1px solid #71bbe9',
              borderRadius: '5px',
              color: '#fff'
            }}
          />
          {lines.filter(line => visibleLines[line]).map(line => (
            <Line 
              key={line}
              type="monotone" 
              dataKey={line} 
              stroke={colors[line]} 
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const HighScoreCharts = ({ profileUrl }: HighScoreChartsProps) => {
  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<HistoricalScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenChart, setFullscreenChart] = useState<{ title: string; data: any[]; colors: Record<string, string>; period: Period; viewMode: ViewMode } | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [viewModes, setViewModes] = useState<Record<string, ViewMode>>({
    score: 'points',
    words: 'points',
    bestWord: 'points',
    unicorn: 'points',
  });

  const [visibleLines, setVisibleLines] = useState<Record<string, Record<string, boolean>>>({
    score: { Normal: true, Bonus: true, 'Long Game': true },
    words: { Normal: true, Bonus: true, 'Long Game': true },
    bestWord: { Normal: true, Bonus: true, 'Long Game': true },
    unicorn: { Normal: true, Bonus: true },
  });

  const [hasPositions, setHasPositions] = useState(false);

  // Check orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const toggleLine = (chartKey: string, lineKey: string) => {
    setVisibleLines(prev => ({
      ...prev,
      [chartKey]: {
        ...prev[chartKey],
        [lineKey]: !prev[chartKey][lineKey]
      }
    }));
  };

  // Fetch data when period changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setHasPositions(false);
        // Start without positions for faster initial load
        const response = await authAPI.getHistoricalHighScores(profileUrl, period, false);
        setData(response.scores || []);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load historical scores');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profileUrl, period]);

  // Fetch positions when user switches to position mode
  useEffect(() => {
    const needsPositions = Object.values(viewModes).some(mode => mode === 'position');
    if (needsPositions && !hasPositions && data.length > 0) {
      // Fetch with positions
      const fetchWithPositions = async () => {
        try {
          setLoading(true);
          const response = await authAPI.getHistoricalHighScores(profileUrl, period, true);
          setData(response.scores || []);
          setHasPositions(true);
        } catch (err: any) {
          console.error('Failed to load positions:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchWithPositions();
    }
  }, [viewModes, profileUrl, period, hasPositions, data.length]);

  const toggleViewMode = (chartKey: string) => {
    setViewModes(prev => ({
      ...prev,
      [chartKey]: prev[chartKey] === 'points' ? 'position' : 'points'
    }));
  };

  const openFullscreen = (title: string, chartData: any[], chartColors: Record<string, string>, chartPeriod: Period, chartViewMode: ViewMode) => {
    setFullscreenChart({ title, data: chartData, colors: chartColors, period: chartPeriod, viewMode: chartViewMode });
  };

  const closeFullscreen = () => {
    setFullscreenChart(null);
  };

  if (error && data.length === 0) {
    return <div className="charts-error">{error}</div>;
  }

  if (data.length === 0 && !loading) {
    return <div className="charts-no-data">No historical data available</div>;
  }

  // Show initial loading state only when there's no data
  if (loading && data.length === 0) {
    return <div className="charts-loading">Loading charts...</div>;
  }

  const colors = {
    Normal: '#f5ce45', // yellow
    Bonus: '#eb5497', // pink
    'Long Game': '#764ba2', // purple
  };

  const unicornColors = {
    'Normal': '#33c15b', // green
    'Bonus': '#eb5497', // pink
  };

  // Format data for charts - remove Unicorn from first 3 charts
  const getChartData = (type: 'score' | 'words' | 'bestWord' | 'unicorn', viewMode: ViewMode) => {
    return data.map(item => {
      const base: any = { date: formatDate(item.date, period) };
      
      if (type === 'score') {
        if (viewMode === 'points') {
          base.Normal = item.normal_score ?? null;
          base.Bonus = item.bonus_score ?? null;
          base['Long Game'] = item.long_game_score ?? null;
        } else {
          base.Normal = item.normal_score_position ?? null;
          base.Bonus = item.bonus_score_position ?? null;
          base['Long Game'] = item.long_game_score_position ?? null;
        }
      } else if (type === 'words') {
        if (viewMode === 'points') {
          base.Normal = item.normal_words ?? null;
          base.Bonus = item.bonus_words ?? null;
          base['Long Game'] = item.long_game_words ?? null;
        } else {
          base.Normal = item.normal_words_position ?? null;
          base.Bonus = item.bonus_words_position ?? null;
          base['Long Game'] = item.long_game_words_position ?? null;
        }
      } else if (type === 'bestWord') {
        if (viewMode === 'points') {
          base.Normal = item.normal_best_word_score ?? null;
          base.Bonus = item.bonus_best_word_score ?? null;
          base['Long Game'] = item.long_game_best_word_score ?? null;
        } else {
          base.Normal = item.normal_best_word_position ?? null;
          base.Bonus = item.bonus_best_word_position ?? null;
          base['Long Game'] = item.long_game_best_word_position ?? null;
        }
      } else if (type === 'unicorn') {
        if (viewMode === 'points') {
          base.Normal = item.unicorn_normal_best_word_score ?? null;
          base.Bonus = item.unicorn_bonus_best_word_score ?? null;
        } else {
          base.Normal = item.unicorn_normal_best_word_position ?? null;
          base.Bonus = item.unicorn_bonus_best_word_position ?? null;
        }
      }
      
      return base;
    });
  };

  const scoreData = getChartData('score', viewModes.score);
  const wordsData = getChartData('words', viewModes.words);
  const bestWordData = getChartData('bestWord', viewModes.bestWord);
  const unicornData = getChartData('unicorn', viewModes.unicorn);

  return (
    <>
      <div className={`high-score-charts-container ${loading ? 'loading' : ''}`}>
        {loading && (
          <div className="charts-loading-overlay">
            <img src="/images/loading.gif" alt="Loading..." className="loading-spinner" />
          </div>
        )}
        <div className="charts-header">
          <h2>High Score History</h2>
          <div className="period-toggle">
            <button
              className={period === 'weekly' ? 'active' : ''}
              onClick={() => setPeriod('weekly')}
              disabled={loading}
            >
              Week
            </button>
            <button
              className={period === 'monthly' ? 'active' : ''}
              onClick={() => setPeriod('monthly')}
              disabled={loading}
            >
              Month
            </button>
            <button
              className={period === 'yearly' ? 'active' : ''}
              onClick={() => setPeriod('yearly')}
              disabled={loading}
            >
              Year
            </button>
          </div>
        </div>
        <div className="charts-grid">
          <ChartComponent
            title="Score"
            data={scoreData}
            colors={colors}
            viewMode={viewModes.score}
            visibleLines={visibleLines.score}
            onToggleLine={(line) => toggleLine('score', line)}
            onFullscreen={() => openFullscreen('Score', scoreData, colors, period, viewModes.score)}
            onToggleView={() => toggleViewMode('score')}
            isLoading={loading}
          />
          <ChartComponent
            title="No. of Words"
            data={wordsData}
            colors={colors}
            viewMode={viewModes.words}
            visibleLines={visibleLines.words}
            onToggleLine={(line) => toggleLine('words', line)}
            onFullscreen={() => openFullscreen('No. of Words', wordsData, colors, period, viewModes.words)}
            onToggleView={() => toggleViewMode('words')}
            isLoading={loading}
          />
          <ChartComponent
            title="Best Word"
            data={bestWordData}
            colors={colors}
            viewMode={viewModes.bestWord}
            visibleLines={visibleLines.bestWord}
            onToggleLine={(line) => toggleLine('bestWord', line)}
            onFullscreen={() => openFullscreen('Best Word', bestWordData, colors, period, viewModes.bestWord)}
            onToggleView={() => toggleViewMode('bestWord')}
            isLoading={loading}
          />
          <ChartComponent
            title="Unicorn Score"
            data={unicornData}
            colors={unicornColors}
            viewMode={viewModes.unicorn}
            visibleLines={visibleLines.unicorn}
            onToggleLine={(line) => toggleLine('unicorn', line)}
            onFullscreen={() => openFullscreen('Unicorn Score', unicornData, unicornColors, period, viewModes.unicorn)}
            onToggleView={() => toggleViewMode('unicorn')}
            isLoading={loading}
          />
        </div>
      </div>

      {fullscreenChart && createPortal(
        <div className="fullscreen-chart-overlay" onClick={closeFullscreen}>
          {isPortrait && (
            <div className="rotate-prompt-overlay">
              <div className="rotate-prompt-content">
                <RotateCw size={64} className="rotate-icon" />
                <h3>Please rotate your device</h3>
                <p>This chart is best viewed in landscape mode</p>
              </div>
            </div>
          )}
          <div className={`fullscreen-chart-container ${isPortrait ? 'portrait-hidden' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-chart-wrapper">
              <ChartComponent
                title={fullscreenChart.title}
                data={fullscreenChart.data}
                colors={fullscreenChart.colors}
                viewMode={fullscreenChart.viewMode}
                visibleLines={(() => {
                  const chartKey = fullscreenChart.title.toLowerCase().includes('score') && !fullscreenChart.title.includes('Unicorn') 
                    ? 'score' 
                    : fullscreenChart.title.toLowerCase().includes('words') && !fullscreenChart.title.includes('Best')
                    ? 'words'
                    : fullscreenChart.title.includes('Unicorn')
                    ? 'unicorn'
                    : 'bestWord';
                  return visibleLines[chartKey];
                })()}
                onToggleLine={(line) => {
                  const chartKey = fullscreenChart.title.toLowerCase().includes('score') && !fullscreenChart.title.includes('Unicorn') 
                    ? 'score' 
                    : fullscreenChart.title.toLowerCase().includes('words') && !fullscreenChart.title.includes('Best')
                    ? 'words'
                    : fullscreenChart.title.includes('Unicorn')
                    ? 'unicorn'
                    : 'bestWord';
                  toggleLine(chartKey, line);
                }}
                onFullscreen={() => {}}
                onCloseFullscreen={closeFullscreen}
                onToggleView={() => {
                  const chartKey = fullscreenChart.title.toLowerCase().includes('score') && !fullscreenChart.title.includes('Unicorn') 
                    ? 'score' 
                    : fullscreenChart.title.toLowerCase().includes('words') && !fullscreenChart.title.includes('Best')
                    ? 'words'
                    : fullscreenChart.title.includes('Unicorn')
                    ? 'unicorn'
                    : 'bestWord';
                  // Calculate the new view mode first (before state update)
                  const newViewMode = viewModes[chartKey] === 'points' ? 'position' : 'points';
                  // Recalculate data with the new view mode
                  const newData = getChartData(chartKey as 'score' | 'words' | 'bestWord' | 'unicorn', newViewMode);
                  // Update both states
                  toggleViewMode(chartKey);
                  setFullscreenChart({
                    ...fullscreenChart,
                    viewMode: newViewMode,
                    data: newData
                  });
                }}
                isFullscreen={true}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

function formatDate(dateString: string, period: Period): string {
  const date = new Date(dateString);
  
  if (period === 'weekly') {
    // Show as "MM/DD"
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } else if (period === 'monthly') {
    // Show as "MM/YYYY"
    return `${date.getMonth() + 1}/${date.getFullYear()}`;
  } else {
    // Show as "YYYY"
    return date.getFullYear().toString();
  }
}

export default HighScoreCharts;
