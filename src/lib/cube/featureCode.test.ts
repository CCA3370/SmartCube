import { describe, expect, it } from 'vitest';
import { SOLVED } from './facelets';
import { decodeFeatureCode, encodeFeatureCode } from './featureCode';

describe('cube feature codes', () => {
  it('round-trips a facelet string through a versioned code', () => {
    const code = encodeFeatureCode(SOLVED);

    expect(code).toMatch(/^SC1-[A-Z2-7-]+$/);
    expect(decodeFeatureCode(code)).toBe(SOLVED);
  });

  it('accepts pasted codes with spaces, lowercase prefix, and missing group separators', () => {
    const code = encodeFeatureCode(SOLVED);
    const pasted = code.replace('SC1-', 'sc1 ').replaceAll('-', '').toLowerCase();

    expect(decodeFeatureCode(pasted)).toBe(SOLVED);
  });

  it('rejects a code with a mismatched checksum', () => {
    const code = encodeFeatureCode(SOLVED);
    const changed = `${code.slice(0, -1)}${code.endsWith('A') ? 'B' : 'A'}`;

    expect(() => decodeFeatureCode(changed)).toThrow(/checksum/i);
  });
});
