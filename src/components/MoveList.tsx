interface Props {
  moves: string[];
  currentIndex: number;
  onJump: (index: number) => void;
  maskFromIndex?: number;
  revealCurrent?: boolean;
}

/** Renders the solution moves with the current one highlighted; click to jump. */
export function MoveList({ moves, currentIndex, onJump, maskFromIndex, revealCurrent = true }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'center',
        maxHeight: 96,
        overflow: 'auto',
      }}
    >
      {moves.map((m, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const masked = maskFromIndex !== undefined && i >= maskFromIndex && !(revealCurrent && current);
        const label = masked ? '???' : m;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            style={{
              minWidth: 38,
              padding: '6px 8px',
              borderRadius: 8,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              background: current ? 'var(--accent-strong)' : done ? 'rgba(52,199,89,0.14)' : 'var(--bg-elev-2)',
              color: current ? 'white' : done ? 'var(--good)' : 'var(--text)',
              border: `1px solid ${current ? 'var(--accent-strong)' : 'var(--border)'}`,
            }}
            title={`Move ${i + 1}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
