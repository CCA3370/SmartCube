/**
 * Pure geometry helpers for mapping points between the three coordinate spaces
 * the scanner works in:
 *   1. full-res video frame  (videoWidth x videoHeight) — where stickers are sampled
 *   2. downscaled analysis   (detect space, longest side ~DETECT_SIZE) — where detection runs
 *   3. on-screen viewport    (container CSS px, object-fit: cover) — where the overlay is drawn
 *
 * Detect->video is a uniform scale; video->viewport is the object-fit:cover map
 * (scale-to-fill + center-crop). These are the single source of truth shared by
 * the sampler and the tracking overlay so they can never drift apart.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Map a point in video-pixel space to on-screen viewport space, accounting for
 * `object-fit: cover` (the video is scaled to fill the viewport, overflow is
 * center-cropped). This generalizes the overlay projection CameraView uses.
 */
export function videoPointToViewport(pt: Pt, video: Size, viewport: Size): Pt {
  const scale = coverScale(video, viewport);
  const left = (viewport.width - video.width * scale) / 2;
  const top = (viewport.height - video.height * scale) / 2;
  return { x: left + pt.x * scale, y: top + pt.y * scale };
}

/** The object-fit:cover scale factor (max so the video fills the viewport). */
export function coverScale(video: Size, viewport: Size): number {
  return Math.max(viewport.width / video.width, viewport.height / video.height);
}

/** Scale a point by independent x/y factors (e.g. detect-space -> video-space). */
export function scalePoint(pt: Pt, sx: number, sy: number): Pt {
  return { x: pt.x * sx, y: pt.y * sy };
}
