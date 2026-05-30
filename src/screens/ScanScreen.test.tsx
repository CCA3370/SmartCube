import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppEvent, type AppState } from '../app/machine';
import type { UseCameraResult } from '../hooks/useCamera';
import type { Readiness } from '../lib/vision/readiness';
import { ScanScreen } from './ScanScreen';

interface MockAppContext {
  state: AppState;
  dispatch: ReturnType<typeof vi.fn<(event: AppEvent) => void>>;
}

const mocks = vi.hoisted(() => ({
  app: null as unknown as MockAppContext,
  readyFrame: {
    sharpness: 100,
    exposure: 120,
    stability: 1,
    sharp: true,
    exposed: true,
    stable: true,
    ready: true,
  } satisfies Readiness,
  useAutoCapture: vi.fn<() => number>(),
}));

vi.mock('../app/AppContext', () => ({
  useApp: () => mocks.app,
}));

vi.mock('../hooks/useCamera', () => ({
  useCamera: (): UseCameraResult => ({
    videoRef: { current: null },
    status: 'live',
    error: null,
    capabilities: {
      torch: false,
      continuousFocus: false,
      continuousExposure: false,
      continuousWhiteBalance: false,
      canSwitch: false,
    },
    torchOn: false,
    facing: 'environment',
    start: vi.fn(),
    stop: vi.fn(),
    setTorch: vi.fn(),
    switchFacing: vi.fn(),
    captureFrame: vi.fn(() => null),
  }),
}));

vi.mock('../hooks/useFrameAnalyzer', () => ({
  useFrameAnalyzer: () => mocks.readyFrame,
}));

vi.mock('../hooks/useAutoCapture', () => ({
  useAutoCapture: mocks.useAutoCapture,
}));

vi.mock('../components/CameraView', () => ({
  CameraView: () => <div>Camera preview</div>,
}));

describe('ScanScreen', () => {
  beforeEach(() => {
    mocks.app = {
      state: { ...initialState, screen: 'scan' },
      dispatch: vi.fn(),
    };
    mocks.useAutoCapture.mockReset();
    mocks.useAutoCapture.mockReturnValue(0);
  });

  it('does not gate capture on center color matching the standard palette', () => {
    render(<ScanScreen />);

    expect(screen.getByRole('button', { name: /capture/i })).toBeEnabled();
    expect(screen.queryByText(/Center:/i)).not.toBeInTheDocument();
    expect(mocks.useAutoCapture).toHaveBeenCalledWith(
      expect.objectContaining({ ready: true }),
      true,
      expect.any(Function),
      0,
    );
  });
});
