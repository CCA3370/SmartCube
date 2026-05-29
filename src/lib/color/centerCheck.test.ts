import { describe, expect, it } from 'vitest';
import { classifyCenterColor } from './centerCheck';

describe('classifyCenterColor', () => {
  it('accepts the expected center color', () => {
    const reading = classifyCenterColor({ r: 28, g: 156, b: 75 }, 'F');

    expect(reading.detected).toBe('F');
    expect(reading.ok).toBe(true);
  });

  it('rejects a different center color', () => {
    const reading = classifyCenterColor({ r: 196, g: 30, b: 58 }, 'F');

    expect(reading.detected).toBe('R');
    expect(reading.ok).toBe(false);
  });
});
