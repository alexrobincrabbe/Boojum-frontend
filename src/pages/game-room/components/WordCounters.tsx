import './WordCounters.css';

interface WordCountersProps {
  wordCounts: Record<string, number>;
  wordCountMax: Record<string, number>;
  gameStatus: 'waiting' | 'playing' | 'finished' | undefined;
}

export function WordCounters({
  wordCounts,
  wordCountMax,
  gameStatus,
}: WordCountersProps) {
  const isPlaying = gameStatus === 'playing';

  return (
    <div id="word-counters-container">
      <div 
        id="word-counters"
        style={{
          opacity: isPlaying ? 1 : 0.3,
          transition: 'opacity 0.3s ease',
        }}
      >
        {['3', '4', '5', '6', '7', '8', '9'].map((length) => {
          const title =
            length === '9'
              ? 'Nine+'
              : length === '3'
              ? 'Three'
              : length === '4'
              ? 'Four'
              : length === '5'
              ? 'Five'
              : length === '6'
              ? 'Six'
              : length === '7'
              ? 'Seven'
              : 'Eight';
          const count = wordCounts[length] || 0;
          const max = wordCountMax[length] || 0;

          // Hide counter if max is 0
          if (max === 0) return null;

          const percentage = max > 0 ? count / max : 0;
          const color =
            percentage >= 1
              ? '#33c15b'
              : percentage >= 0.5
              ? 'yellow'
              : 'white';

          return (
            <div key={length} className={`wordCount-${length} wordCount-element`}>
              <div style={{ color: 'grey' }} className="word-counter-title">
                {title}
              </div>
              <div>
                <span
                  className="word-counter"
                  data-wordlength={length}
                  style={{ color }}
                >
                  {count}
                </span>
                /{max}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

