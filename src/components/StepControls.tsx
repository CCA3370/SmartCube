interface Props {
  index: number;
  total: number;
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onToStart: () => void;
  onToEnd: () => void;
}

export function StepControls({
  index,
  total,
  playing,
  onPrev,
  onNext,
  onPlayPause,
  onToStart,
  onToEnd,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <div style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)', fontWeight: 600 }}>
        Step {Math.min(index + 1, total)} / {total}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn btn-ghost"
          onClick={onToStart}
          title="Jump to start"
          aria-label="Jump to start"
          disabled={index <= 0}
        >
          ⏮
        </button>
        <button className="btn" onClick={onPrev} disabled={index <= 0} title="Previous move">
          ◀ Prev
        </button>
        <button className="btn btn-primary" onClick={onPlayPause} style={{ minWidth: 92 }}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button className="btn" onClick={onNext} disabled={index >= total} title="Next move">
          Next ▶
        </button>
        <button
          className="btn btn-ghost"
          onClick={onToEnd}
          title="Jump to end"
          aria-label="Jump to end"
          disabled={index >= total}
        >
          ⏭
        </button>
      </div>
    </div>
  );
}
