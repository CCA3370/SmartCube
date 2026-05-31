/** Shared frame-readiness types + the pure classify function (worker + tests). */

export interface FrameMetrics {
  /** Variance of the Laplacian — higher = sharper / more in-focus. */
  sharpness: number;
  /** Mean luma 0..255 — exposure. */
  exposure: number;
  /** Mean absolute frame-to-frame luma difference — lower = more stable. */
  stability: number;
}

export interface Readiness extends FrameMetrics {
  sharp: boolean;
  exposed: boolean;
  stable: boolean;
  ready: boolean;
}

export interface ReadinessThresholds {
  sharpnessMin: number;
  exposureLo: number;
  exposureHi: number;
  stabilityMax: number;
}

// Tuned for a ~192px downscaled analysis frame. These are starting points to be
// refined against real cube footage; sharpness especially is scene-dependent.
export const DEFAULT_THRESHOLDS: ReadinessThresholds = {
  sharpnessMin: 60,
  exposureLo: 45,
  exposureHi: 220,
  stabilityMax: 4.5,
};

/** Decide readiness from metrics + thresholds. Pure — shared by worker and UI. */
export function classifyReadiness(m: FrameMetrics, t: ReadinessThresholds): Readiness {
  const sharp = m.sharpness >= t.sharpnessMin;
  const exposed = m.exposure >= t.exposureLo && m.exposure <= t.exposureHi;
  const stable = m.stability <= t.stabilityMax;
  return { ...m, sharp, exposed, stable, ready: sharp && exposed && stable };
}

/** A rectangular region of interest (frame px) to scope exposure/sharpness to. */
export interface MetricsRoi {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Compute frame metrics from RGBA pixels. `prevGray` is the previous frame's
 * grayscale buffer (or null for the first frame); returns the new gray buffer so
 * the caller can thread it to the next call.
 *
 * When `roi` is given, exposure + sharpness are measured only inside that region
 * (so a sharp background can't mask a blurry cube). Stability is always whole-frame
 * — it gates "hold still", and the cube can drift within the frame between frames.
 */
export function computeMetrics(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  prevGray: Float32Array | null,
  roi?: MetricsRoi,
): { metrics: FrameMetrics; gray: Float32Array } {
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    gray[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }

  const region = clampRegion(roi, w, h);

  // Exposure: mean luma over the region.
  let lumaSum = 0;
  let lumaN = 0;
  for (let y = region.y0; y < region.y1; y++) {
    const row = y * w;
    for (let x = region.x0; x < region.x1; x++) {
      lumaSum += gray[row + x];
      lumaN++;
    }
  }
  const exposure = lumaN ? lumaSum / lumaN : 0;

  // Variance of the Laplacian (4-neighbour kernel) over the region's interior.
  const ix0 = Math.max(1, region.x0);
  const iy0 = Math.max(1, region.y0);
  const ix1 = Math.min(w - 1, region.x1);
  const iy1 = Math.min(h - 1, region.y1);
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = iy0; y < iy1; y++) {
    for (let x = ix0; x < ix1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const lapMean = n ? lapSum / n : 0;
  const sharpness = n ? lapSq / n - lapMean * lapMean : 0;

  // Mean absolute difference vs previous frame (whole frame).
  let stability: number;
  if (prevGray && prevGray.length === gray.length) {
    let diff = 0;
    for (let k = 0; k < gray.length; k++) diff += Math.abs(gray[k] - prevGray[k]);
    stability = diff / gray.length;
  } else {
    stability = Number.POSITIVE_INFINITY; // first frame: never "stable" yet
  }

  return { metrics: { sharpness, exposure, stability }, gray };
}

/**
 * Clamp a ROI to a valid half-open region [x0,x1) x [y0,y1). Falls back to the
 * full frame when no ROI is given or the clamped region is too small to measure.
 */
function clampRegion(
  roi: MetricsRoi | undefined,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } {
  if (!roi) return { x0: 0, y0: 0, x1: w, y1: h };
  const x0 = Math.max(0, Math.min(w - 1, Math.round(roi.x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.round(roi.y)));
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(roi.x + roi.w)));
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round(roi.y + roi.h)));
  if (x1 - x0 < 3 || y1 - y0 < 3) return { x0: 0, y0: 0, x1: w, y1: h };
  return { x0, y0, x1, y1 };
}
