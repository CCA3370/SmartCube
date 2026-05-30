import { describe, it, expect } from 'vitest';
import { median } from './math';

describe('median', () => {
  it('returns the middle value for odd-length input', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values for even-length input', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('handles a single element', () => {
    expect(median([5])).toBe(5);
  });

  it('returns 0 for an empty array', () => {
    expect(median([])).toBe(0);
  });

  it('does not mutate its input', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});
