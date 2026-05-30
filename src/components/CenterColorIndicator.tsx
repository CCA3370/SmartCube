import { DISPLAY_COLOR } from '../lib/color';
import { FACE_COLOR_NAME } from '../lib/cube';
import type { CenterColorReading } from '../lib/color/centerCheck';

interface Props {
  reading: CenterColorReading;
}

export function CenterColorIndicator({ reading }: Props) {
  const detected = reading.detected;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${reading.ok ? 'rgba(52,199,89,0.42)' : 'rgba(255,176,32,0.48)'}`,
        background: reading.ok ? 'rgba(52,199,89,0.13)' : 'rgba(255,176,32,0.12)',
        color: reading.ok ? 'var(--good)' : 'var(--warn)',
        fontSize: '0.78rem',
        fontWeight: 700,
        minHeight: 34,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: detected ? DISPLAY_COLOR[detected] : 'transparent',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: detected ? 'inset 0 0 0 1px rgba(0,0,0,0.25)' : 'none',
        }}
      />
      <span>
        Center:{' '}
        {detected
          ? `${FACE_COLOR_NAME[detected]}${reading.ok ? '' : `, need ${FACE_COLOR_NAME[reading.expected]}`}`
          : `need ${FACE_COLOR_NAME[reading.expected]}`}
      </span>
    </div>
  );
}
