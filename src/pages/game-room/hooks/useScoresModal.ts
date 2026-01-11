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
    // Open modal when final scores are received, regardless of status
    // (status might be 'finished' or 'waiting' depending on timing)
    if (gameState?.finalScores && (gameState.gameStatus === 'finished' || gameState.gameStatus === 'waiting')) {
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
              // Normalize the word before lookup (trim whitespace only - API handles case)
              const normalizedWord = unicorn.trim();
              console.log(`[Unicorn] Looking up definition for word: "${unicorn}" (normalized: "${normalizedWord}", length: ${normalizedWord.length})`);
              
              // Check for any non-printable characters
              const hasNonPrintable = /[\x00-\x1F\x7F-\x9F]/.test(normalizedWord);
              if (hasNonPrintable) {
                console.warn(`[Unicorn] Word contains non-printable characters: "${normalizedWord}"`);
              }
              
              const definition = await fetchDefinition(normalizedWord);
              
              console.log(`[Unicorn] Definition result for "${unicorn}":`, definition);
              
              // Only show definition if it's found (not the "not found" message)
              const definitionNotFound = definition === 'Definition not found.' || definition.toLowerCase().includes('definition not found');
              let messageContent = `<span class="pink">Unicorn:</span> &nbsp;<span class="green">${unicorn}</span>&nbsp;<span class="yellow">(${score}pts)</span>`;
              
              if (!definitionNotFound) {
                messageContent += `<br><span class="blue">Definition:</span><br><span class="blue">${definition}</span>`;
              } else {
                console.warn(`[Unicorn] Definition not found for word: "${unicorn}" (normalized: "${normalizedWord}")`);
              }
              
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

