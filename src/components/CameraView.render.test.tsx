import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Readiness } from '../lib/vision/readiness';
import { CameraView } from './CameraView';

const readiness: Readiness = {
  sharpness: 100,
  exposure: 120,
  stability: 1,
  sharp: true,
  exposed: true,
  stable: true,
  ready: true,
};

describe('CameraView center color hint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('breathes the requested center color for two seconds when the step key changes', () => {
    const videoRef = { current: null };
    const { rerender } = render(
      <CameraView
        videoRef={videoRef}
        readiness={readiness}
        autoProgress={0}
        centerHintColor="#1c9c4b"
        centerHintKey="F"
      />,
    );

    expect(screen.getByTestId('center-color-hint')).toHaveStyle({ backgroundColor: '#1c9c4b' });

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByTestId('center-color-hint')).not.toBeInTheDocument();

    rerender(
      <CameraView
        videoRef={videoRef}
        readiness={readiness}
        autoProgress={0}
        centerHintColor="#c41e3a"
        centerHintKey="R"
      />,
    );

    expect(screen.getByTestId('center-color-hint')).toHaveStyle({ backgroundColor: '#c41e3a' });
  });
});
