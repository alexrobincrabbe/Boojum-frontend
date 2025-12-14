// Sound utility for playing game sounds
let sounds: Record<string, AudioBuffer> = {};
let audioContext: AudioContext | null = null;
let soundsLoaded = false;

// Initialize audio context on first user interaction
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Resume the audio context if it has been suspended (e.g., on some mobile browsers)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(err => {
      console.warn('Failed to resume audio context:', err);
    });
  }

  return audioContext;
}

// Function to load and decode sound
async function loadSound(path: string): Promise<AudioBuffer> {
  if (!audioContext) {
    audioContext = initializeAudioContext();
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch sound: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error(`Empty audio data for ${path}`);
  }
  return await audioContext.decodeAudioData(arrayBuffer);
}

// Load all sounds
export async function loadSounds() {
  if (soundsLoaded) return;

  try {
    audioContext = initializeAudioContext();
    
    // Load sounds from public directory
    const soundPaths = {
      tick: '/sounds/tick.mp3',
      pop: '/sounds/twinkle.mp3',
      bloop3: '/sounds/bloop3.mp3',
      bloop4: '/sounds/bloop4.mp3',
      bloop5: '/sounds/bloop5.mp3',
      bloop6: '/sounds/bloop6.mp3',
      bloop7: '/sounds/bloop7.mp3',
      bloop8: '/sounds/bloop8.mp3',
      bloop9: '/sounds/bloop9.mp3',
      perfect: '/sounds/perfect.mp3',
    };

    const loadPromises = Object.entries(soundPaths).map(async ([name, path]) => {
      try {
        const buffer = await loadSound(path);
        sounds[name] = buffer;
      } catch (error) {
        console.warn(`Failed to load sound ${name}:`, error);
      }
    });

    await Promise.all(loadPromises);
    soundsLoaded = true;
  } catch (error) {
    console.error('Error loading sounds:', error);
  }
}

// Function to play a sound
export function playSound(soundName: string) {
  if (!audioContext) {
    audioContext = initializeAudioContext();
  }

  const soundBuffer = sounds[soundName];
  if (soundBuffer && audioContext) {
    try {
      const source = audioContext.createBufferSource();
      source.buffer = soundBuffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.warn(`Failed to play sound ${soundName}:`, error);
    }
  }
}

// Play bloop sound based on word length (matches original implementation)
export function playBloop(word: string) {
  const length = word.length;
  switch (true) {
    case length === 3:
      playSound('bloop3');
      break;
    case length === 4:
      playSound('bloop4');
      break;
    case length === 5:
      playSound('bloop5');
      break;
    case length === 6:
      playSound('bloop6');
      break;
    case length === 7:
      playSound('bloop7');
      break;
    case length === 8:
      playSound('bloop8');
      break;
    case length >= 9:
      playSound('bloop9');
      break;
  }
}

// Initialize audio context on first user interaction
if (typeof window !== 'undefined') {
  const initEvents = ['click', 'touchstart', 'keydown'];
  const initHandler = () => {
    initializeAudioContext();
    loadSounds();
    initEvents.forEach(event => {
      document.removeEventListener(event, initHandler);
    });
  };
  
  initEvents.forEach(event => {
    document.addEventListener(event, initHandler, { once: true });
  });
}

