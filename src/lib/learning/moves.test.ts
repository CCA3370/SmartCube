import { describe, expect, it } from 'vitest';
import { describeMove, getMoveLesson } from './moves';

describe('learning move descriptions', () => {
  it('describes a clockwise quarter turn', () => {
    expect(describeMove('R')).toEqual({
      notation: 'R',
      face: 'R',
      suffix: '',
      turns: 1,
      direction: 'clockwise',
      familyKey: 'R',
    });

    const lesson = getMoveLesson('R');
    expect(lesson.titleEn).toBe('R: Right face clockwise');
    expect(lesson.titleZh).toBe('R：右面顺时针');
    expect(lesson.instructionEn).toContain('right face');
    expect(lesson.instructionZh).toContain('右面');
  });

  it('describes a counterclockwise quarter turn', () => {
    expect(describeMove("U'")).toEqual({
      notation: "U'",
      face: 'U',
      suffix: "'",
      turns: 1,
      direction: 'counterclockwise',
      familyKey: 'U',
    });

    const lesson = getMoveLesson("U'");
    expect(lesson.titleEn).toBe("U': Up face counterclockwise");
    expect(lesson.titleZh).toBe("U'：上面逆时针");
    expect(lesson.selfCheckEn).toContain('counterclockwise');
    expect(lesson.selfCheckZh).toContain('逆时针');
  });

  it('describes a half turn', () => {
    expect(describeMove('F2')).toEqual({
      notation: 'F2',
      face: 'F',
      suffix: '2',
      turns: 2,
      direction: 'half-turn',
      familyKey: 'F',
    });

    const lesson = getMoveLesson('F2');
    expect(lesson.titleEn).toBe('F2: Front face half turn');
    expect(lesson.titleZh).toBe('F2：前面转 180 度');
    expect(lesson.instructionEn).toContain('180 degrees');
    expect(lesson.instructionZh).toContain('180 度');
  });

  it('falls back for an unknown token', () => {
    expect(describeMove('Rw')).toEqual({
      notation: 'Rw',
      face: 'unknown',
      suffix: 'unknown',
      turns: 0,
      direction: 'unknown',
      familyKey: 'unknown:Rw',
    });

    const lesson = getMoveLesson('Rw');
    expect(lesson.titleEn).toBe('Rw: Follow the preview');
    expect(lesson.titleZh).toBe('Rw：跟随预览');
    expect(lesson.instructionEn).toContain('3D preview');
    expect(lesson.instructionZh).toContain('3D 预览');
  });
});
