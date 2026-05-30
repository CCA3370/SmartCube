import type { SolverProgress as Progress } from '../lib/solver/types';

interface Props {
  progress: Progress | null;
  error: string | null;
  onRetry?: () => void;
}

/**
 * Solver initialization progress bar. Reuses the `.hold-bar` styling idiom from
 * the auto-capture feedback (a slim rounded bar that fills left-to-right). The
 * progress ratio is weighted by table-build cost, so it tracks wall-clock time
 * honestly rather than zipping then stalling. When `cached` is true (tables
 * rehydrated from IndexedDB), the bar is full instantly and the label says
 * "Ready" instead of showing a long build sequence.
 */
export function SolverProgress({ progress, error, onRetry }: Props) {
  if (error) {
    return (
      <div className="card" style={{ borderColor: 'var(--bad)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--bad)', fontSize: '0.9rem' }}>⚠️ Solver init failed</span>
          {onRetry && (
            <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-dim)' }}>{error}</p>
      </div>
    );
  }

  if (!progress) return null;

  const ratio = progress.total > 0 ? progress.done / progress.total : 0;
  const pct = Math.round(ratio * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{progress.label}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 5,
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 'inherit',
            transformOrigin: 'left',
            transform: `scaleX(${ratio})`,
            background: 'var(--accent)',
            boxShadow: '0 0 10px rgba(76, 154, 255, 0.7)',
            transition: 'transform 0.3s ease-out',
          }}
        />
      </div>
    </div>
  );
}
