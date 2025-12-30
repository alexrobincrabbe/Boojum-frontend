import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface OnboardingContextType {
  run: boolean;
  setRun: (run: boolean) => void;
  stepIndex: number;
  setStepIndex: (index: number) => void;
  hasCompletedOnboarding: boolean;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Check if user has completed onboarding
  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed') === 'true';
    setHasCompletedOnboarding(completed);
  }, []);

  // Auto-start onboarding for new users (not completed and authenticated)
  useEffect(() => {
    if (!hasCompletedOnboarding && !run) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding, run]);

  const resetOnboarding = () => {
    localStorage.removeItem('onboarding_completed');
    setHasCompletedOnboarding(false);
    setStepIndex(0);
    setRun(true);
  };

  const handleSetRun = (value: boolean) => {
    setRun(value);
    if (!value) {
      // Mark as completed when tour ends
      localStorage.setItem('onboarding_completed', 'true');
      setHasCompletedOnboarding(true);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        run,
        setRun: handleSetRun,
        stepIndex,
        setStepIndex,
        hasCompletedOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

