import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

/**
 * Hook to track user's current route and update their activity status
 * This sends the current route to the backend so users can see what page others are on
 */
export function useRouteActivityTracking() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const lastLocationRef = useRef<string>('');
  const updateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Only track if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    const currentPath = location.pathname;

    // Skip if location hasn't changed
    if (currentPath === lastLocationRef.current) {
      return;
    }

    // Clear any pending updates
    if (updateTimeoutRef.current !== null) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Update immediately on route change (no debounce for initial load)
    // For subsequent changes, we can debounce, but for the first load we want immediate feedback
    const isInitialLoad = lastLocationRef.current === '';
    const delay = isInitialLoad ? 0 : 500;

    updateTimeoutRef.current = window.setTimeout(async () => {
      try {
        await authAPI.updateUserActivity(currentPath);
        lastLocationRef.current = currentPath;
      } catch (error) {
        // Log error for debugging (always log errors)
        console.error('[RouteTracking] Failed to update user activity:', error);
      }
    }, delay);

    // Cleanup on unmount or location change
    return () => {
      if (updateTimeoutRef.current !== null) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [location.pathname, isAuthenticated, user?.username]);
}

