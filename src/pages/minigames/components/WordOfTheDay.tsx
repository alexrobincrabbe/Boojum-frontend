import React from 'react';

interface WordOfTheDayProps {
  wordOfTheDay: {
    word: string;
    definition: string;
    day: string;
  };
}

const WordOfTheDay: React.FC<WordOfTheDayProps> = ({ wordOfTheDay }) => {
  return (
    <div id="wotd-header">
      <h3 id="word-of-the-day">{wordOfTheDay.word}:</h3>
      <p className="lobby-desktop" id="word-of-the-day-defintion">
        {wordOfTheDay.definition}
      </p>
    </div>
  );
};

export default WordOfTheDay;

