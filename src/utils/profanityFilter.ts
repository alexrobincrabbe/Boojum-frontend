// Profanity filter - replaces profane words with asterisks
// Based on the original chat-filter.js implementation

const PROFANITY_WORDS = [
  "nigger", "nigga", "chink", "gook", "spic", "kike", "paki", "dothead",
  "sandnigger", "sandnigga", "coon", "bastard", "slut", "slag", "slapper",
  "whore", "faggot", "fag", "faggy", "dyke", "tranny", "lesbo", "lez",
  "fudgepacker", "anal", "bender", "assbandit", "arsebandit", "bumboy", "sod",
  "flamer", "pussy", "cunt", "cock", "poof", "poofy", "poofter", "prick",
  "motherfucker", "motherfucka", "muthafucker", "muthafucka", "bollocks",
  "bugger", "bullshit", "shit", "fuck", "bitch", "asshole", "arsehole", "dick",
  "dipshit", "dumbfuck", "damn", "dammit", "darn", "hell", "piss", "pisser",
  "pissy", "asshat", "sissy", "bitchass", "biatch", "douche", "douchebag",
  "douchenozzle", "cocksucker", "dicksucker", "twat", "tosser", "wanker",
  "wank", "wanky", "hoe", "hoebag", "tramp", "trollop", "hooker", "prostitute",
  "prozzie", "blowjob", "retard", "cripple", "mongoloid", "spastic", "spaz",
  "mong", "rape", "stfu", "gfy", "fu", "horseshit", "bullshit", "dickhead", "crap",
];

/**
 * Filters profanity from a message
 * @param message - The message to filter
 * @param enabled - Whether the filter is enabled
 * @returns The filtered message
 */
export function filterProfanity(message: string, enabled: boolean): string {
  if (!enabled) {
    return message;
  }

  let filtered = message;
  
  // Create a regex pattern that matches profanity words (case-insensitive, word boundaries)
  // Replace with "****" to match original implementation
  PROFANITY_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '****');
  });

  return filtered;
}

/**
 * Gets the profanity filter setting from localStorage
 * For authenticated users, the value is synced from backend to localStorage in GameSettingsTab
 * For guests, the value is stored directly in localStorage
 * @returns boolean indicating if filter is enabled
 */
export function getProfanityFilterSetting(): boolean {
  const stored = localStorage.getItem('profanityFilter');
  // If explicitly set, use that value; otherwise default to true
  if (stored !== null) {
    return stored === 'true';
  }
  // Default to true if not set
  return true;
}

