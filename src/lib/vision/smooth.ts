/**
 * Temporal smoothing for the live tracking overlay. Detection runs per-frame and
 * jitters by a pixel or two; an exponential moving average on the quad/cells gives
 * a calm box. `meanPointDelta` measures how far the (raw) box moved between frames,
 * which drives the "hold steady" stability gate before auto-capture.
 */
import type { DetectionResult } from './detectFace';
import type { Pt } from './coords';

/** Mean Euclidean distance between corresponding points. Infinity if mismatched. */
export function meanPointDelta(a: Pt[], b: Pt[]): number {
  if (a.length === 0 || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const dx = a[i].x - b[i].x;
    const dy = a[i].y - b[i].y;
    sum += Math.hypot(dx, dy);
  }
  return sum / a.length;
}

function lerpPt(p: Pt, n: Pt, alpha: number): Pt {
  return { x: p.x + (n.x - p.x) * alpha, y: p.y + (n.y - p.y) * alpha };
}

/**
 * EMA-blend the previous smoothed detection toward `next` (alpha = weight of the
 * new sample, 0..1). Returns `next` unchanged when it isn't found (so the box
 * disappears immediately on loss) or when there's no compatible previous box to
 * blend from.
 */
export function smoothDetection(
  prev: DetectionResult | null,
  next: DetectionResult,
  alpha: number,
): DetectionResult {
  if (!next.found || !next.quad) return next;
  if (!prev || !prev.found || !prev.quad || prev.cells.length !== next.cells.length) return next;

  const a = Math.max(0, Math.min(1, alpha));
  const cells = next.cells.map((n, i) => lerpPt(prev.cells[i], n, a));
  const quad = next.quad.map((n, i) => lerpPt(prev.quad![i], n, a)) as [Pt, Pt, Pt, Pt];
  return {
    found: true,
    quad,
    cells,
    cell: prev.cell + (next.cell - prev.cell) * a,
    angle: prev.angle + (next.angle - prev.angle) * a,
    confidence: next.confidence,
    synthesized: next.synthesized,
  };
}
