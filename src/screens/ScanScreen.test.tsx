import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type AppEvent, type AppState } from '../app/machine';
import type { UseCameraResult } from '../hooks/useCamera';
import type { Readiness } from '../lib/vision/readiness';
import { DISPLAY_COLOR } from '../lib/color';
import { CAPTURE_SEQUENCE } from '../lib/cube';
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
  cameraView: vi.fn(),
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
  CameraView: (props: unknown) => {
    mocks.cameraView(props);
    return <div>Camera preview</div>;
  },
}));

describe('ScanScreen', () => {
  beforeEach(() => {
    mocks.app = {
      state: { ...initialState, screen: 'scan' },
      dispatch: vi.fn(),
    };
    mocks.useAutoCapture.mockReset();
    mocks.useAutoCapture.mockReturnValue(0);
    mocks.cameraView.mockReset();
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

  it('passes the target face color as a transient center overlay hint', () => {
    render(<ScanScreen />);

    expect(mocks.cameraView).toHaveBeenCalledWith(
      expect.objectContaining({
        centerHintColor: DISPLAY_COLOR[CAPTURE_SEQUENCE[0].toCamera],
        centerHintKey: 0,
      }),
    );
  });

  it('does not show the captured face result while scanning', () => {
    const step = CAPTURE_SEQUENCE[0];
    mocks.app = {
      state: {
        ...initialState,
        screen: 'scan',
        labels: {
          [step.face]: {
            face: step.face,
            labels: Array(9).fill(step.face),
          },
        },
      },
      dispatch: vi.fn(),
    };

    render(<ScanScreen />);

    expect(mocks.cameraView).toHaveBeenCalledWith(
      expect.objectContaining({
        capturedFace: undefined,
      }),
    );
  });
});
