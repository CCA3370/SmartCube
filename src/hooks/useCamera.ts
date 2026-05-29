import { useCallback, useEffect, useRef, useState } from 'react';
import { captureVideoFrame } from '../lib/util/canvas';

export interface CameraCapabilities {
  torch: boolean;
  continuousFocus: boolean;
  continuousExposure: boolean;
  continuousWhiteBalance: boolean;
  canSwitch: boolean;
}

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'error';

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  capabilities: CameraCapabilities;
  torchOn: boolean;
  facing: 'environment' | 'user';
  start: () => Promise<void>;
  stop: () => void;
  setTorch: (on: boolean) => Promise<void>;
  switchFacing: () => Promise<void>;
  captureFrame: () => HTMLCanvasElement | null;
}

const NO_CAPS: CameraCapabilities = {
  torch: false,
  continuousFocus: false,
  continuousExposure: false,
  continuousWhiteBalance: false,
  canSwitch: false,
};

/**
 * Acquire a camera stream and progressively enhance it. All advanced controls
 * (torch, continuous focus/exposure/white-balance) are gated on getCapabilities
 * — they're Chromium-on-Android only and must never be required.
 */
export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<CameraCapabilities>(NO_CAPS);
  const [torchOn, setTorchOn] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');

  const track = () => streamRef.current?.getVideoTracks()[0] ?? null;

  const applyEnhancements = useCallback(async () => {
    const t = track();
    if (!t || !t.getCapabilities) {
      setCapabilities(NO_CAPS);
      return;
    }
    const caps = t.getCapabilities();
    const detected: CameraCapabilities = {
      torch: caps.torch === true,
      continuousFocus: caps.focusMode?.includes('continuous') ?? false,
      continuousExposure: caps.exposureMode?.includes('continuous') ?? false,
      continuousWhiteBalance: caps.whiteBalanceMode?.includes('continuous') ?? false,
      canSwitch: true,
    };
    setCapabilities(detected);

    const advanced: MediaTrackConstraintSet[] = [];
    if (detected.continuousFocus) advanced.push({ focusMode: 'continuous' });
    if (detected.continuousExposure) advanced.push({ exposureMode: 'continuous' });
    if (detected.continuousWhiteBalance) advanced.push({ whiteBalanceMode: 'continuous' });
    if (advanced.length) {
      try {
        await t.applyConstraints({ advanced });
      } catch {
        // OverconstrainedError etc — ignore, enhancement is best-effort.
      }
    }
  }, []);

  const startWith = useCallback(
    async (facingMode: 'environment' | 'user') => {
      setStatus('requesting');
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        setTorchOn(false);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.setAttribute('playsinline', 'true');
          await video.play().catch(() => undefined);
        }
        await applyEnhancements();
        setStatus('live');
      } catch (e) {
        const err = e as DOMException;
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          setStatus('denied');
          setError('Camera permission was denied. Please allow camera access and retry.');
        } else {
          setStatus('error');
          setError(err?.message ?? 'Could not start the camera.');
        }
      }
    },
    [applyEnhancements],
  );

  const start = useCallback(() => startWith(facing), [startWith, facing]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  const setTorch = useCallback(async (on: boolean) => {
    const t = track();
    if (!t || !t.getCapabilities?.().torch) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: on }] });
      setTorchOn(on);
    } catch {
      // ignore
    }
  }, []);

  const switchFacing = useCallback(async () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await startWith(next);
  }, [facing, startWith]);

  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    return captureVideoFrame(video);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    videoRef,
    status,
    error,
    capabilities,
    torchOn,
    facing,
    start,
    stop,
    setTorch,
    switchFacing,
    captureFrame,
  };
}
