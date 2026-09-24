import { useEffect, useState } from 'react';

const NODES = 5;

interface FlowLoaderProps {
  /** What is being loaded, e.g. "Loading enquiry". Also the live-region text. */
  label?: string;
  /** Fill the viewport rather than the content area — used before the shell exists. */
  fullScreen?: boolean;
  /**
   * Waits this long before appearing, so a near-instant load never flashes a
   * loader. The space is still reserved, so nothing jumps when it does appear.
   */
  delayMs?: number;
}

/**
 * The application's loader: five stage nodes on a rail, with a pulse travelling
 * along it and each node filling as it passes — an enquiry moving through its
 * stages. It says "work is moving" in the product's own terms rather than a
 * generic spinner's.
 */
export const FlowLoader = ({ label = 'Loading', fullScreen = false, delayMs = 150 }: FlowLoaderProps) => {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return undefined;
    const id = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex justify-center items-center ${fullScreen ? 'min-h-screen bg-canvas' : 'min-h-[320px]'}`}
    >
      <div className={`flex flex-col items-center gap-4 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="relative flex items-center" aria-hidden="true">
          <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[2px] rounded-full bg-line-strong flow-loader-track text-primary">
            <span className="flow-loader-pulse" />
          </div>
          <div className="relative flex items-center gap-6">
            {Array.from({ length: NODES }).map((_, i) => (
              <span
                key={i}
                className="flow-loader-node block h-3.5 w-3.5 rounded-full border-2 border-line-strong bg-surface"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        </div>
        <span className="text-body font-medium text-ink-muted">{label}…</span>
      </div>
    </div>
  );
};

/** Page-level loader. Kept under its old name so every screen picks up the new one. */
const LoadingSpinner = ({ label }: { label?: string }) => <FlowLoader label={label} />;

export default LoadingSpinner;
