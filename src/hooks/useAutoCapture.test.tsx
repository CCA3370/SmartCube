import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAutoCapture } from './useAutoCapture';
import type { Readiness } from '../lib/vision/readiness';

function ready(): Readiness {
  return {
    sharpness: 100,
    exposure: 120,
    stability: 1,
    sharp: true,
    exposed: true,
    stable: true,
    ready: true,
  };
}

describe('useAutoCapture', () => {
  it('fires after four continuous ready seconds and re-arms when the reset key changes', () => {
    const onCapture = vi.fn();
    let now = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { rerender } = renderHook(
      ({ readiness, resetKey }) => useAutoCapture(readiness, true, onCapture, resetKey),
      { initialProps: { readiness: ready(), resetKey: 'U' } },
    );

    now = 3999;
    act(() => rerender({ readiness: ready(), resetKey: 'U' }));
    expect(onCapture).not.toHaveBeenCalled();

    now = 4000;
    act(() => rerender({ readiness: ready(), resetKey: 'U' }));
    expect(onCapture).toHaveBeenCalledTimes(1);

    now = 5000;
    act(() => rerender({ readiness: ready(), resetKey: 'R' }));
    now = 8999;
    act(() => rerender({ readiness: ready(), resetKey: 'R' }));
    expect(onCapture).toHaveBeenCalledTimes(1);

    now = 9000;
    act(() => rerender({ readiness: ready(), resetKey: 'R' }));
    expect(onCapture).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });
});
