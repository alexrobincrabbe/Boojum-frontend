import { useState, useEffect, useRef } from 'react';
import Joyride from 'react-joyride';

// Define Step type locally (same as in Layout.tsx)
interface Step {
  target: string | HTMLElement;
  content: React.ReactNode;
  title?: React.ReactNode;
  placement?: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end' | 'center' | 'auto';
  disableBeacon?: boolean;
  disableScrolling?: boolean;
  offset?: number;
  [key: string]: any;
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
  const hasAttemptedStartRef = useRef(false);
  const prevAutoStartRef = useRef(autoStart);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if user has completed this page's onboarding
  useEffect(() => {
    const completed = localStorage.getItem(`onboarding_${pageKey}_completed`) === 'true';
    
    // Track when autoStart changes from false to true (not just when it's true)
    const autoStartChanged = autoStart && !prevAutoStartRef.current;
    prevAutoStartRef.current = autoStart;
    
    // Debug logging
    console.log(`[Onboarding ${pageKey}]`, {
      autoStart,
      completed,
      stepsLength: steps.length,
      run,
      hasAttemptedStart: hasAttemptedStartRef.current,
      autoStartChanged,
    });
    
    // Reset hasAttemptedStart only when autoStart changes from false to true
    if (autoStartChanged && hasAttemptedStartRef.current) {
      console.log(`[Onboarding ${pageKey}] Resetting hasAttemptedStart because autoStart changed to true`);
      hasAttemptedStartRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return; // Let the next render handle starting
    }
    
    // Only attempt to start when conditions are met
    if (autoStart && !completed && steps.length > 0 && !run && !hasAttemptedStartRef.current) {
      console.log(`[Onboarding ${pageKey}] Attempting to start tour...`);
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
          setRun(true);
        } else {
          // If element not found, try again after a short delay
          timeoutRef.current = setTimeout(() => {
            const retryTarget = typeof steps[0].target === 'string' 
              ? document.querySelector(steps[0].target)
              : steps[0].target;
            if (retryTarget) {
              console.log(`[Onboarding ${pageKey}] Starting tour on retry!`);
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
    };
  }, [autoStart, pageKey, steps.length, run, steps]);

  const handleCallback = (data: CallBackProps) => {
    const { status, type, index, action } = data;
    
    // Debug logging for important callback events only
    if (type === 'tour:start' || type === 'tour:end' || type === 'error:target_not_found' || status === 'finished' || status === 'skipped') {
      console.log(`[Onboarding ${pageKey}] Callback:`, { status, type, index, action });
    }
    
    // Force video loading when step is shown
    if (type === 'step:after' || type === 'tooltip') {
      // Small delay to ensure tooltip is rendered
      setTimeout(() => {
        const tooltip = document.querySelector('.react-joyride__tooltip');
        if (tooltip) {
          const videos = tooltip.querySelectorAll('video');
          videos.forEach((video) => {
            if (video instanceof HTMLVideoElement) {
              // Force video to load
              video.load();
            }
          });
        }
      }, 100);
    }
    
    // Handle errors - don't mark as completed if there's an error
    if (type === 'error:target_not_found') {
      console.warn(`[Onboarding ${pageKey}] Target not found for step ${index}:`, data.step?.target);
      // Don't mark as completed, allow retry
      setRun(false);
      hasAttemptedStartRef.current = false; // Allow retry
      return;
    }
    
    if (status === 'finished' || status === 'skipped') {
      console.log(`[Onboarding ${pageKey}] Tour ${status}`);
      setRun(false);
      // Only mark as completed if we actually finished the tour
      if (status === 'finished') {
        localStorage.setItem(`onboarding_${pageKey}_completed`, 'true');
      } else if (status === 'skipped') {
        // Also mark as completed when skipped (user chose to skip)
        localStorage.setItem(`onboarding_${pageKey}_completed`, 'true');
      }
    }
    // In uncontrolled mode, we don't need to manage stepIndex - Joyride handles it
  };

  const startTour = () => {
    setRun(true);
  };

  const resetTour = () => {
    localStorage.removeItem(`onboarding_${pageKey}_completed`);
    hasAttemptedStartRef.current = false;
    setRun(true);
  };

  // Always render Joyride when we have steps (it won't show overlay when run=false)
  // This ensures the component is ready when run becomes true
  // Use uncontrolled mode (no stepIndex) so Joyride manages step progression automatically
  const JoyrideComponent = steps.length > 0 ? (
    <Joyride
      steps={steps}
      run={run}
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

