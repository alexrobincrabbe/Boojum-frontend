import { useEffect } from 'react';
import { fetchDefinition } from '../../../utils/dictionary';
import type { WordData } from '../../../ws/protocol';

interface GameState {
  finalScores?: any;
  gameStatus?: string;
  oneShot?: boolean;
  wordsByLength?: Record<string, Record<string, WordData>> | Record<string, string[]>;
}

export function useScoresModal(
  gameState: GameState | null,
  setIsScoresModalOpen: (open: boolean) => void,
  addChatSystemMessage: (message: string) => void
): void {
  useEffect(() => {
    if (gameState?.finalScores && gameState.gameStatus === 'finished') {
      setIsScoresModalOpen(true);
      
      // Show unicorn message in chat for one-shot games
      if (gameState.oneShot && gameState.wordsByLength) {
        const findHighestScoringWord = (wordsByLength: Record<string, Record<string, WordData>> | Record<string, string[]>) => {
          let highestScore = 0;
          let highestWord = '';
          
          for (const length in wordsByLength) {
            const words = wordsByLength[length];
            if (typeof words === 'object' && !Array.isArray(words)) {
              // Final format with WordData
              for (const word in words) {
                const wordData = words[word] as WordData;
                if (wordData.score && wordData.score > highestScore) {
                  highestScore = wordData.score;
                  highestWord = word;
                }
              }
            }
          }
          
          return [highestWord, highestScore] as [string, number];
        };
        
        const showUnicornInChat = async () => {
          try {
            const [unicorn, score] = findHighestScoringWord(gameState.wordsByLength!);
            if (unicorn) {
              const definition = await fetchDefinition(unicorn);
              const messageContent = `<span class="pink">Unicorn:</span> &nbsp;<span class="green">${unicorn}</span>&nbsp;<span class="yellow">(${score}pts)</span><br><span class="blue">Definition:</span><br><span class="blue">${definition}</span>`;
              // Send as system message (no username prefix)
              addChatSystemMessage(messageContent);
            }
          } catch (err) {
            console.error('Failed to fetch unicorn definition:', err);
          }
        };
        
        showUnicornInChat();
      }
    }
  }, [gameState?.finalScores, gameState?.gameStatus, gameState?.oneShot, gameState?.wordsByLength, setIsScoresModalOpen, addChatSystemMessage]);
}

