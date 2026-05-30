import { type CaptureStep, type FaceLetter, FACE_COLOR_NAME } from '../lib/cube';
import { DISPLAY_COLOR } from '../lib/color';

interface Props {
  step: CaptureStep;
}

/**
 * A cue showing which colors to point at the camera and keep up, rendered as two
 * labeled swatches plus the instruction text.
 */
export function HoldOrientationHint({ step }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        textAlign: 'center',
      }}
    >
      <div className="row" style={{ gap: 14 }}>
        <Swatch face={step.toCamera} caption="center faces you" />
        <Swatch face={step.up} caption="center up" />
      </div>
      <p className="subtitle" style={{ margin: 0, maxWidth: 360 }}>
        {step.instruction}
      </p>
    </div>
  );
}

function Swatch({ face, caption }: { face: FaceLetter; caption: string }) {
  // Render a mini 3x3 face with only the CENTER colored and the surrounding 8
  // stickers shown as "scrambled/unknown" grey — so it's visually clear the cue
  // refers to the center piece, not a fully-solved face.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.5,
          width: 36,
          height: 36,
          padding: 2,
          borderRadius: 8,
          background: '#0a0d12',
          border: '1px solid rgba(0,0,0,0.4)',
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 2,
              background: i === 4 ? DISPLAY_COLOR[face] : '#3a4452',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{FACE_COLOR_NAME[face]}</span>
      <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)' }}>{caption}</span>
    </div>
  );
}
