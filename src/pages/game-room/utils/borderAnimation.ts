// Utility function to trigger border animation on elements
// Matches the original borderAnimation function from game-utility-functions.js

export function borderAnimation(element: HTMLElement | null, animation: string = 'animation') {
  if (!element) return;
  
  element.classList.add(`border-${animation}`);
  // Remove the effect after the animation is complete (500ms)
  setTimeout(() => {
    element.classList.remove(`border-${animation}`);
  }, 500);
}

// Trigger border animation on board (for 8+ letter words)
export function triggerBoardAnimation() {
  // Try to find board by ID, supporting all board types
  const board = document.getElementById('board') || 
                document.getElementById('daily-board') || 
                document.getElementById('timeless-board');
  borderAnimation(board);
}

// Trigger border animation on word counter (for 50%+ or 100% completion)
export function triggerWordCounterAnimation(wordLength: string, isComplete: boolean = false) {
  // Find the word counter element for this length
  const wordCounter = document.querySelector(
    `.word-counter[data-wordlength="${wordLength}"]`
  ) as HTMLElement;
  
  if (!wordCounter) return;
  
  // According to original: 
  // - 50%: borderAnimation(wordCounter.parentElement.parentElement, "animation")
  // - 100%: borderAnimation(wordCounter.parentElement, "animation")
  if (isComplete) {
    // 100% completion - animate the parent element
    const parent = wordCounter.parentElement;
    borderAnimation(parent);
  } else {
    // 50%+ completion - animate the parent's parent element
    const parent = wordCounter.parentElement;
    const grandParent = parent?.parentElement;
    borderAnimation(grandParent || null);
  }
}

