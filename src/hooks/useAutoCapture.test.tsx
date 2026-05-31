import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoCapture } from './useAutoCapture';

describe('useAutoCapture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires after four continuous ready seconds and re-arms when the reset key changes', () => {
    const onCapture = vi.fn();
    const { rerender } = renderHook(
      ({ ready, resetKey }) => useAutoCapture(ready, true, onCapture, resetKey),
      { initialProps: { ready: true, resetKey: 'U' } },
    );

    act(() => vi.advanceTimersByTime(3900));
    expect(onCapture).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(200)); // cross 4000ms
    expect(onCapture).toHaveBeenCalledTimes(1);

    // Re-arm for the next face: the hold timer restarts from zero.
    act(() => rerender({ ready: true, resetKey: 'R' }));
    act(() => vi.advanceTimersByTime(3900));
    expect(onCapture).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(200));
    expect(onCapture).toHaveBeenCalledTimes(2);
  });

  it('resets the hold when the frame stops being ready', () => {
    const onCapture = vi.fn();
    const { rerender } = renderHook(({ ready }) => useAutoCapture(ready, true, onCapture, 'U'), {
      initialProps: { ready: true },
    });

    act(() => vi.advanceTimersByTime(3000));
    act(() => rerender({ ready: false })); // lost readiness — discard accumulated hold
    act(() => vi.advanceTimersByTime(5000));
    expect(onCapture).not.toHaveBeenCalled();

    act(() => rerender({ ready: true })); // a fresh 4s starts here
    act(() => vi.advanceTimersByTime(3900));
    expect(onCapture).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disarmed', () => {
    const onCapture = vi.fn();
    renderHook(() => useAutoCapture(true, false, onCapture, 'U'));
    act(() => vi.advanceTimersByTime(10000));
    expect(onCapture).not.toHaveBeenCalled();
  });
});
