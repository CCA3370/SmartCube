import type { LAB } from './colorspace';
import { ciede2000 } from './ciede2000';
import { type FaceLetter, FACES } from '../cube/types';

/**
 * The 6 live center colors of the current scan, in CIELAB. These ARE the
 * reference palette for the current lighting — classifying relative to them
 * makes recognition illuminant-tolerant and needs no calibration screen.
 */
export type CenterPalette = Record<FaceLetter, LAB>;

export interface Classified {
  labels: FaceLetter[]; // length N (54)
  /** Per-sticker margin = ΔE to 2nd-nearest center − ΔE to nearest. Bigger = more certain. */
  confidence: number[];
}

/** Nearest center face for a single LAB sample, with the runner-up distance. */
export function nearestCenter(
  lab: LAB,
  palette: CenterPalette,
): { face: FaceLetter; best: number; second: number } {
  let face: FaceLetter = FACES[0];
  let best = Infinity;
  let second = Infinity;
  for (const f of FACES) {
    const d = ciede2000(lab, palette[f]);
    if (d < best) {
      second = best;
      best = d;
      face = f;
    } else if (d < second) {
      second = d;
    }
  }
  return { face, best, second };
}

/** Plain nearest-center classification (no structural constraint). */
export function classifyRelativeToCenters(stickerLabs: LAB[], palette: CenterPalette): Classified {
  const labels: FaceLetter[] = [];
  const confidence: number[] = [];
  for (const lab of stickerLabs) {
    const { face, best, second } = nearestCenter(lab, palette);
    labels.push(face);
    confidence.push(second - best);
  }
  return { labels, confidence };
}

/**
 * Classify with the cube's structural constraint that each of the 6 colors must
 * appear exactly N/6 times (9 on a full 54-sticker scan). Starting from the
 * argmin labeling, repeatedly move the least-regret sticker off any
 * over-capacity color to its best under-capacity alternative. This corrects the
 * common orange↔red / white↔yellow border misclassifications that violate the
 * count constraint, while the manual-correction grid remains the final safety net.
 */
export function structuralCleanup(stickerLabs: LAB[], palette: CenterPalette): Classified {
  const n = stickerLabs.length;
  const cap = Math.floor(n / 6);

  // Distance from every sticker to every center.
  const dist: number[][] = stickerLabs.map((lab) => FACES.map((f) => ciede2000(lab, palette[f])));

  // Initial assignment: nearest center.
  const assign: number[] = dist.map((row) => {
    let bi = 0;
    let bv = Infinity;
    for (let i = 0; i < 6; i++) {
      if (row[i] < bv) {
        bv = row[i];
        bi = i;
      }
    }
    return bi;
  });

  const counts = () => {
    const c = [0, 0, 0, 0, 0, 0];
    for (const a of assign) c[a]++;
    return c;
  };

  // Only rebalance when N is an exact multiple of 6 (a full cube). For partial
  // inputs (e.g. a single face) we keep the raw argmin labeling.
  if (n % 6 === 0) {
    let guard = 0;
    for (;;) {
      if (guard++ > n * 6) break;
      const c = counts();
      const over = c.findIndex((x) => x > cap);
      if (over === -1) break;

      let bestSticker = -1;
      let bestTarget = -1;
      let bestRegret = Infinity;
      for (let s = 0; s < n; s++) {
        if (assign[s] !== over) continue;
        let target = -1;
        let targetD = Infinity;
        for (let f = 0; f < 6; f++) {
          if (f === over || c[f] >= cap) continue;
          if (dist[s][f] < targetD) {
            targetD = dist[s][f];
            target = f;
          }
        }
        if (target === -1) continue;
        const regret = targetD - dist[s][over];
        if (regret < bestRegret) {
          bestRegret = regret;
          bestSticker = s;
          bestTarget = target;
        }
      }
      if (bestSticker === -1) break;
      assign[bestSticker] = bestTarget;
    }
  }

  const labels = assign.map((i) => FACES[i]);
  // Confidence = margin of the ASSIGNED label over its nearest competitor:
  // positive when the assignment is also the nearest center, ~0 when ambiguous,
  // and negative when structural rebalancing moved the sticker off its nearest
  // center — so the FaceGrid low-confidence dots flag exactly those risky stickers.
  const confidence = dist.map((row, s) => {
    const a = assign[s];
    let nearestOther = Infinity;
    for (let f = 0; f < 6; f++) {
      if (f !== a && row[f] < nearestOther) nearestOther = row[f];
    }
    return nearestOther - row[a];
  });
  return { labels, confidence };
}
