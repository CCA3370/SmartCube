/** Small numeric helpers used across the domain modules. */

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Median of a numeric array (robust to outliers like logo/glare pixels). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  let s = 0;
  for (const v of values) s += (v - m) * (v - m);
  return s / values.length;
}

/** Index of the smallest value. */
export function argmin(values: number[]): number {
  let bi = 0;
  let bv = Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < bv) {
      bv = values[i];
      bi = i;
    }
  }
  return bi;
}
