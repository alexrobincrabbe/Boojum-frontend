import './ErrorBanner.css';

interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="error-banner">
      <span>{error}</span>
      <button onClick={onDismiss}>×</button>
    </div>
  );
}

