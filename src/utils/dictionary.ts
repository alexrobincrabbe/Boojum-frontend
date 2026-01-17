/**
 * Dictionary utility functions for fetching word definitions
 * Uses custom dictionary API only
 */

// Get CSRF token from cookies (for Django)
function getCSRFToken(): string | null {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}

// Fetch from custom dictionary API
async function fetchCustomDictionaryDefinition(word: string, language: string = 'en'): Promise<string | null> {
  try {
    // Normalize the word: trim whitespace
    const normalizedWord = word.trim();
    
    if (!normalizedWord) {
      console.warn('Empty word provided to fetchCustomDictionaryDefinition');
      return null;
    }
    
    // Get Django base URL - construct it properly from VITE_API_BASE_URL
    // VITE_API_BASE_URL should be like: https://api.boojumgames.com/api
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    // Remove trailing /api if present to get the base domain
    // Use regex to match /api only at the end of the string
    const djangoBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '') || 'http://localhost:8000';
    
    const csrfToken = getCSRFToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Always include CSRF token (matching original behavior - it's required for Django)
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    } else {
      console.warn('CSRF token not found - definition request may fail');
    }
    
    const url = `${djangoBaseUrl}/get-definition/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ word: normalizedWord, language }),
      credentials: 'include', // Include cookies for CSRF token
    });

    // Parse response even if status is not ok (matching original behavior)
    // The original code always parses JSON regardless of status
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      console.error('Response status:', response.status, response.statusText);
      return null;
    }
    
    // Return definition if available (matching original: data.definition || data.error)
    if (data.definition) {
      return data.definition;
    }
    
    // If there's an error, return null
    if (data.error) {
      // Error logged in response parsing above
    }
    return null;
  } catch (error) {
    console.error('Custom dictionary API error:', error);
    return null;
  }
}

/**
 * Fetch word definition from custom dictionary only
 */
export async function fetchDefinition(word: string, language: string = 'en'): Promise<string> {
  const definition = await fetchCustomDictionaryDefinition(word, language);
  return definition || 'Definition not found.';
}

