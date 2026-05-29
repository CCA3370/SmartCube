import { useEffect, useRef, useState } from 'react';
import { faceCells, sampleSticker } from '../lib/color';
import {
  classifyCenterColor,
  emptyCenterColorReading,
  type CenterColorReading,
} from '../lib/color/centerCheck';
import type { FaceLetter } from '../lib/cube';
import { centeredFaceSquare, get2d } from '../lib/util/canvas';

const SAMPLE_MS = 180;

export function useCenterColorCheck(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  expected: FaceLetter,
  overlayFraction: number,
): CenterColorReading {
  const [reading, setReading] = useState<CenterColorReading>(() => emptyCenterColorReading(expected));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setReading(emptyCenterColorReading(expected));
    if (!active) return undefined;

    let stopped = false;
    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvasRef.current = canvas;

    const sample = () => {
      const video = videoRef.current;
      if (stopped || !video || !video.videoWidth || !video.videoHeight) return;

      const square = centeredFaceSquare(video.videoWidth, video.videoHeight, overlayFraction);
      const centerCell = faceCells(square)[4];
      const cropSize = Math.max(8, Math.ceil(centerCell.cell));
      const sx = Math.max(0, Math.round(centerCell.cx - cropSize / 2));
      const sy = Math.max(0, Math.round(centerCell.cy - cropSize / 2));
      const sw = Math.min(cropSize, video.videoWidth - sx);
      const sh = Math.min(cropSize, video.videoHeight - sy);
      if (sw <= 0 || sh <= 0) return;

      canvas.width = sw;
      canvas.height = sh;
      const ctx = get2d(canvas);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      const image = ctx.getImageData(0, 0, sw, sh);
      const rgb = sampleSticker(image, { cx: sw / 2, cy: sh / 2, cell: Math.min(sw, sh) });
      setReading(classifyCenterColor(rgb, expected));
    };

    sample();
    const interval = window.setInterval(sample, SAMPLE_MS);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [active, expected, overlayFraction, videoRef]);

  return reading;
}
