import './Loading.css';

interface LoadingProps {
  minHeight?: string;
}

export function Loading({ minHeight = '400px' }: LoadingProps) {
  return (
    <div className="page-loading" style={{ minHeight }}>
      <img src="/images/loading.gif" alt="Loading..." className="loading-gif" />
    </div>
  );
}

