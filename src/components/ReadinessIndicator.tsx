import type { Readiness } from '../lib/vision/readiness';

interface Props {
  readiness: Readiness;
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: '0.8rem',
        fontWeight: 600,
        background: ok ? 'rgba(52,199,89,0.16)' : 'rgba(255,255,255,0.06)',
        color: ok ? 'var(--good)' : 'var(--text-dim)',
        border: `1px solid ${ok ? 'rgba(52,199,89,0.4)' : 'var(--border)'}`,
      }}
    >
      <span style={{ fontSize: '0.9em' }}>{ok ? '●' : '○'}</span>
      {label}
    </span>
  );
}

export function ReadinessIndicator({ readiness }: Props) {
  return (
    <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      <Badge ok={readiness.sharp} label="Sharp" />
      <Badge ok={readiness.exposed} label="Bright" />
      <Badge ok={readiness.stable} label="Steady" />
    </div>
  );
}
