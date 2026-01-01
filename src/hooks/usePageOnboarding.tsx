import { useState, useEffect, useRef, useCallback } from 'react';
import Joyride from 'react-joyride';

// Define Step type locally (same as in Layout.tsx)
export interface Step {
  target: string | HTMLElement;
  content: React.ReactNode;
  title?: React.ReactNode;
  placement?: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end' | 'center' | 'auto';
  disableBeacon?: boolean;
  disableScrolling?: boolean;
  offset?: number;
  [key: string]: unknown;
}

interface CallBackProps {
  action: string;
  controlled: boolean;
  index: number;
  lifecycle: string;
  origin: string | null;
  size: number;
  status: string;
  step: Step;
  type: string;
}

interface UsePageOnboardingOptions {
  steps: Step[];
  pageKey: string; // Unique key for this page (e.g., 'lobby', 'dashboard')
  autoStart?: boolean; // Whether to auto-start on first visit
}

export const usePageOnboarding = ({ steps, pageKey, autoStart = false }: UsePageOnboardingOptions) => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourKey, setTourKey] = useState(0); // Key to force remount on reset
  const hasAttemptedStartRef = useRef(false);
  const prevAutoStartRef = useRef(autoStart);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStepIndexRef = useRef(-1); // Track last step to avoid duplicate video loads
  const currentStepIndexRef = useRef(0); // Track current step index to avoid stale closures

  // Check if user has completed this page's onboarding
  useEffect(() => {
    const completed = localStorage.getItem(`onboarding_${pageKey}_completed`) === 'true';
    
    // Track when autoStart changes from false to true (not just when it's true)
    const autoStartChanged = autoStart && !prevAutoStartRef.current;
    prevAutoStartRef.current = autoStart;
    
    console.log(`[Onboarding ${pageKey}] useEffect:`, {
      autoStart,
      completed,
      stepsLength: steps.length,
      run,
      hasAttemptedStart: hasAttemptedStartRef.current,
      autoStartChanged
    });
    
    // Reset hasAttemptedStart only when autoStart changes from false to true
    if (autoStartChanged && hasAttemptedStartRef.current) {
      console.log(`[Onboarding ${pageKey}] Resetting hasAttemptedStart`);
      hasAttemptedStartRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return; // Let the next render handle starting
    }
    
    // Only attempt to start when conditions are met
    if (autoStart && !completed && steps.length > 0 && !run && !hasAttemptedStartRef.current) {
      console.log(`[Onboarding ${pageKey}] Attempting to start tour`);
      hasAttemptedStartRef.current = true;
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Small delay to ensure DOM is ready
      timeoutRef.current = setTimeout(() => {
        // Double-check that elements exist before starting
        const firstStepTarget = typeof steps[0].target === 'string' 
          ? document.querySelector(steps[0].target)
          : steps[0].target;
        
        console.log(`[Onboarding ${pageKey}] First step target:`, steps[0].target, 'Found:', !!firstStepTarget);
        
        if (firstStepTarget) {
          console.log(`[Onboarding ${pageKey}] Starting tour!`);
          currentStepIndexRef.current = 0;
          setStepIndex(0);
          setRun(true);
        } else {
          // If element not found, try again after a short delay
          console.log(`[Onboarding ${pageKey}] Target not found, retrying...`);
          timeoutRef.current = setTimeout(() => {
            const retryTarget = typeof steps[0].target === 'string' 
              ? document.querySelector(steps[0].target)
              : steps[0].target;
            if (retryTarget) {
              console.log(`[Onboarding ${pageKey}] Starting tour on retry!`);
              currentStepIndexRef.current = 0;
              setStepIndex(0);
              setRun(true);
            } else {
              // If still not found, don't mark as completed
              console.warn(`[Onboarding ${pageKey}] Target not found after retry: ${steps[0].target}`);
              hasAttemptedStartRef.current = false; // Allow retry later
            }
            timeoutRef.current = null;
          }, 500);
        }
      }, 1000);
    }
    
    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
        videoLoadTimeoutRef.current = null;
      }
    };
  }, [autoStart, pageKey, steps.length, run, steps]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;
    
    // When tour starts, ensure we're at step 0
    if (type === 'tour:start') {
      currentStepIndexRef.current = 0;
      setStepIndex(0);
      lastStepIndexRef.current = -1;
      return;
    }
    
    // Handle step navigation in controlled mode
    // Only update on step:after to avoid multiple updates per click
    if (type === 'step:after') {
      let newIndex: number;
      
      if (action === 'next') {
        // For next, go to index + 1
        newIndex = index + 1;
      } else if (action === 'prev') {
        // For prev, go to current step - 1 (not index - 1, because index might be wrong)
        newIndex = Math.max(0, currentStepIndexRef.current - 1);
      } else {
        newIndex = index;
      }
      
      // Log navigation actions for debugging
      if (action === 'prev' || action === 'next') {
        console.log(`[Onboarding ${pageKey}] step:after ${action} - index: ${index}, newIndex: ${newIndex}, currentRef: ${currentStepIndexRef.current}`);
      }
      
      // Only update if index actually changed (use ref to avoid stale closure)
      if (newIndex !== currentStepIndexRef.current) {
        currentStepIndexRef.current = newIndex;
        setStepIndex(newIndex);
        
        // Only load videos if we're on a new step (avoid duplicate loads)
        if (newIndex !== lastStepIndexRef.current) {
          lastStepIndexRef.current = newIndex;
          
          // Defer video loading to next event loop to avoid blocking click handler
          if (videoLoadTimeoutRef.current) {
            clearTimeout(videoLoadTimeoutRef.current);
          }
          videoLoadTimeoutRef.current = setTimeout(() => {
            requestAnimationFrame(() => {
              const tooltip = document.querySelector('.react-joyride__tooltip');
              if (tooltip) {
                const videos = tooltip.querySelectorAll('video');
                videos.forEach((video) => {
                  if (video instanceof HTMLVideoElement) {
                    // Force video to load
                    video.load();
                    // Also try to play/pause to trigger loading
                    video.play().catch(() => {
                      // Ignore autoplay errors, just trying to trigger load
                    });
                    video.pause();
                  }
                });
              }
            });
            videoLoadTimeoutRef.current = null;
          }, 100);
        }
      }
      return; // Early return to avoid processing other types
    }
    
    // Handle errors - don't mark as completed if there's an error
    if (type === 'error:target_not_found') {
      console.warn(`[Onboarding ${pageKey}] Target not found for step ${index}:`, data.step?.target);
      setRun(false);
      setStepIndex(0);
      hasAttemptedStartRef.current = false;
      return;
    }
    
    // Handle tour completion
    if (status === 'finished' || status === 'skipped') {
      setRun(false);
      setStepIndex(0);
      // Defer localStorage write to avoid blocking
      setTimeout(() => {
        if (status === 'finished' || status === 'skipped') {
          localStorage.setItem(`onboarding_${pageKey}_completed`, 'true');
        }
      }, 0);
    }
  }, [pageKey]);

  const startTour = () => {
    currentStepIndexRef.current = 0;
    setStepIndex(0);
    setRun(true);
  };

  const resetTour = () => {
    localStorage.removeItem(`onboarding_${pageKey}_completed`);
    hasAttemptedStartRef.current = false;
    lastStepIndexRef.current = -1;
    currentStepIndexRef.current = 0;
    // Clear any pending video load
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = null;
    }
    // Reset to first step and restart
    setStepIndex(0);
    setRun(false);
    // Force remount by changing key
    setTourKey(prev => prev + 1);
    // Start the tour after a brief delay to ensure state is reset
    setTimeout(() => {
      currentStepIndexRef.current = 0;
      setStepIndex(0);
      setRun(true);
    }, 150);
  };

  // Always render Joyride when we have steps (it won't show overlay when run=false)
  // This ensures the component is ready when run becomes true
  // Use controlled mode with stepIndex for proper navigation control
  // Use key prop to force remount on reset
  const JoyrideComponent = steps.length > 0 ? (
    <Joyride
      key={tourKey}
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      callback={handleCallback}
      scrollDuration={600}
      scrollOffset={20}
      scrollToFirstStep={false}
      styles={{
        options: {
          primaryColor: '#fbbf24', // yellow-400
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          backgroundColor: '#1b1835', // Dark background matching the app theme
          border: '2px solid #fbbf24', // Yellow border
          color: '#fbbf24', // Yellow text
        },
        buttonNext: {
          backgroundColor: 'transparent',
          color: '#71bbe9', // Blue text
          border: '2px solid #71bbe9', // Blue border
          fontSize: '14px',
          padding: '8px 16px',
        },
        buttonBack: {
          color: '#71bbe9', // Blue back button text
          marginRight: '10px',
        },
        buttonSkip: {
          color: '#9ca3af',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  ) : null;

  return {
    startTour,
    resetTour,
    JoyrideComponent,
  };
};

// Utility function to reset all onboarding for all pages
export const resetAllOnboarding = () => {
  // Reset global onboarding
  localStorage.removeItem('onboarding_completed');
  
  // Reset page-specific onboarding
  const pageKeys = ['lobby', 'timeless-board', 'boojumble', 'profile', 'tournament'];
  pageKeys.forEach((key) => {
    localStorage.removeItem(`onboarding_${key}_completed`);
  });
  
  // Dispatch custom event to notify OnboardingContext to re-check
  window.dispatchEvent(new Event('onboardingReset'));
  
  // Note: Onboarding will restart automatically when navigating to each page
};

