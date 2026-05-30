import { getMoveLesson } from '../lib/learning/moves';

interface Props {
  move: string | null;
  index: number;
  total: number;
  revealed: boolean;
  masteredFamilies: ReadonlySet<string>;
  onReveal: () => void;
  onMastered: (familyKey: string) => void;
}

export function LearningGuide({ move, index, total, revealed, masteredFamilies, onReveal, onMastered }: Props) {
  if (!move || index >= total) {
    return (
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'var(--good)', fontWeight: 700 }}>Review complete</div>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              You practiced {total} moves and marked {masteredFamilies.size} move families as known.
            </p>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              你已经完成 {total} 步练习，并标记了 {masteredFamilies.size} 类已掌握招法。
            </p>
          </div>
          <div style={{ color: 'var(--text-dim)', fontWeight: 700 }}>Learn mode</div>
        </div>
      </section>
    );
  }

  const lesson = getMoveLesson(move);
  const mastered = masteredFamilies.has(lesson.descriptor.familyKey);

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div style={{ color: 'var(--accent)', fontWeight: 700 }}>Learn mode</div>
          <div style={{ color: 'var(--text-dim)', fontWeight: 600, marginTop: 2 }}>
            Step {index + 1} / {total}
          </div>
        </div>
        <div style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
          Known move families: {masteredFamilies.size}
        </div>
      </div>

      {!revealed ? (
        <>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
              Hide the answer first. Decide which face turns and in which direction.
            </div>
            <p className="subtitle" style={{ margin: '5px 0 0' }}>
              先不要看答案。自己判断要转哪一面，以及顺时针、逆时针还是 180 度。
            </p>
          </div>
          <p className="subtitle" style={{ margin: 0 }}>
            Keep holding the cube with White up and Green facing you before you answer.
          </p>
          <button className="btn btn-primary" onClick={onReveal} style={{ alignSelf: 'flex-start' }}>
            Show answer
          </button>
        </>
      ) : (
        <>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{lesson.titleEn}</div>
            <div style={{ fontWeight: 700, color: 'var(--text-dim)', marginTop: 2 }}>{lesson.titleZh}</div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <p style={{ margin: 0, lineHeight: 1.45 }}>{lesson.instructionEn}</p>
            <p className="subtitle" style={{ margin: 0 }}>
              {lesson.instructionZh}
            </p>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elev-2)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontWeight: 700 }}>Self-check</div>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              {lesson.selfCheckEn}
            </p>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              {lesson.selfCheckZh}
            </p>
          </div>
          <button
            className={mastered ? 'btn btn-ghost' : 'btn'}
            onClick={() => onMastered(lesson.descriptor.familyKey)}
            disabled={mastered}
            style={{ alignSelf: 'flex-start' }}
          >
            {mastered ? 'Known' : 'I know this'}
          </button>
        </>
      )}
    </section>
  );
}
