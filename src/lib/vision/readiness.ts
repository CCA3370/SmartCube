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

/**
 * Compute frame metrics from RGBA pixels. `prevGray` is the previous frame's
 * grayscale buffer (or null for the first frame); returns the new gray buffer so
 * the caller can thread it to the next call.
 */
export function computeMetrics(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  prevGray: Float32Array | null,
): { metrics: FrameMetrics; gray: Float32Array } {
  const gray = new Float32Array(w * h);
  let lumaSum = 0;
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    gray[j] = y;
    lumaSum += y;
  }
  const exposure = lumaSum / (w * h);

  // Variance of the Laplacian (4-neighbour kernel) over the interior.
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += lap;
      lapSq += lap * lap;
      n++;
    }
  }
  const lapMean = n ? lapSum / n : 0;
  const sharpness = n ? lapSq / n - lapMean * lapMean : 0;

  // Mean absolute difference vs previous frame.
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
