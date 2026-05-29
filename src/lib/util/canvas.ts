/** Canvas helpers. Always request a read-optimized 2D context for CV reads. */

export function get2d(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx as CanvasRenderingContext2D;
}

/** Draw the current video frame at full resolution into a fresh canvas. */
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  get2d(canvas).drawImage(video, 0, 0, w, h);
  return canvas;
}

/**
 * Compute the centered square (in video-pixel coordinates) that the on-screen
 * alignment overlay covers. The overlay is a square occupying `fraction` of the
 * smaller video dimension, centered — the same geometry the UI draws.
 */
export function centeredFaceSquare(
  videoWidth: number,
  videoHeight: number,
  fraction = 0.7,
): { x: number; y: number; size: number } {
  const size = Math.floor(Math.min(videoWidth, videoHeight) * fraction);
  return {
    x: Math.floor((videoWidth - size) / 2),
    y: Math.floor((videoHeight - size) / 2),
    size,
  };
}
