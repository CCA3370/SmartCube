import { describe, expect, it } from 'vitest';
import { localAlgorithmToGlobal, localMoveToGlobal, WHITE_DOWN_ORIENTATION } from './orientation';

describe('learning orientation mapping', () => {
  it('maps local face turns through the white-down teaching orientation', () => {
    expect(localMoveToGlobal('U', WHITE_DOWN_ORIENTATION)).toBe('D');
    expect(localMoveToGlobal("U'", WHITE_DOWN_ORIENTATION)).toBe("D'");
    expect(localMoveToGlobal('R2', WHITE_DOWN_ORIENTATION)).toBe('R2');
  });

  it('maps a local algorithm without changing turn suffixes', () => {
    expect(localAlgorithmToGlobal("U R U' R'", WHITE_DOWN_ORIENTATION)).toEqual(['D', 'R', "D'", "R'"]);
  });
});
