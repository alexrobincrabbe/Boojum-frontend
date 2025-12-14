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
async function fetchCustomDictionaryDefinition(word: string): Promise<string | null> {
  try {
    // Get Django base URL - use the same pattern as api.ts
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    const djangoBaseUrl = apiBaseUrl.replace('/api', '');
    
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
    
    const url = `${djangoBaseUrl}/api/get-definition/`;
    console.log('Fetching definition from:', url, 'for word:', word);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ word }),
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
    
    console.log('Dictionary API response:', data);
    
    // Return definition if available (matching original: data.definition || data.error)
    if (data.definition) {
      return data.definition;
    }
    
    // If there's an error, log it and return null
    if (data.error) {
      console.log('Dictionary API error:', data.error);
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
export async function fetchDefinition(word: string): Promise<string> {
  const definition = await fetchCustomDictionaryDefinition(word);
  return definition || 'Definition not found.';
}

