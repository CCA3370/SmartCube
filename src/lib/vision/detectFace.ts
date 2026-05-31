/**
 * Pure cube-face detection: find the 3x3 grid of stickers of a roughly
 * fronto-parallel cube anywhere in a frame, with no external CV dependency.
 *
 * Pipeline (all O(pixels), runs each frame in the analyzer worker on a
 * downscaled full frame):
 *   1. grayscale (luma)
 *   2. Sobel gradient magnitude
 *   3. adaptive threshold -> "edge" mask, dilated so the dark inter-sticker gaps
 *      and the cube border become solid barriers
 *   4. the complement ("flat" mask) is connected-component labeled (union-find):
 *      each flat colored sticker becomes one blob, the background one big blob
 *   5. blobs are filtered to square-ish, sticker-sized candidates
 *   6. a 3x3 lattice is fit to the candidate centroids (pitch + in-plane angle
 *      recovered robustly), missing cells (glare/occlusion) are synthesized, and
 *      a confidence score gates acceptance.
 *
 * Output cells are emitted in SCREEN row-major order (TL..BR) — the same order
 * the fixed-grid sampler produced — so the downstream `applyRotation(rgb, 0)`
 * net-order mapping is unchanged. Large in-plane rotation is reported via
 * `angle` and gated by the caller (see ANGLE_GATE).
 */
import { median } from '../util/math';
import type { Pt } from './coords';

export interface DetectionResult {
  found: boolean;
  /** Quad corners in DETECT space, ordered TL, TR, BR, BL. null when not found. */
  quad: [Pt, Pt, Pt, Pt] | null;
  /** 9 cell centers in DETECT space, SCREEN row-major (index 0=TL .. 8=BR). */
  cells: Pt[];
  /** Estimated sticker side length in DETECT px (for ring-sampling radius). */
  cell: number;
  /** Dominant in-plane rotation in degrees, signed, in [-45,45). */
  angle: number;
  /** Detection confidence, 0..1. */
  confidence: number;
  /** Indices (0..8) of cells that were synthesized rather than observed. */
  synthesized: number[];
}

export interface DetectOptions {
  /** Edge threshold = clamp(edgeK * meanGradient, edgeMin, edgeMax). */
  edgeK: number;
  edgeMin: number;
  edgeMax: number;
  /** Sticker side bounds as a fraction of min(width,height). */
  stickerMinFrac: number;
  stickerMaxFrac: number;
  /** Blob acceptance. */
  minFill: number;
  minAspect: number;
  /** Snap tolerance for matching a lattice position to a candidate (x pitch). */
  snapFrac: number;
  /** Minimum observed cells (of 9) to accept. */
  minCells: number;
  /** Minimum confidence to accept. */
  minConfidence: number;
}

/** Downscale target (longest side) the worker feeds detectFace. */
export const DETECT_SIZE = 320;

/** Max |in-plane angle| (deg) at which capture is allowed (preserves net order). */
export const ANGLE_GATE = 12;

export const DEFAULT_DETECT_OPTIONS: DetectOptions = {
  edgeK: 1.1,
  edgeMin: 14,
  edgeMax: 64,
  stickerMinFrac: 0.045,
  stickerMaxFrac: 0.34,
  minFill: 0.5,
  minAspect: 0.5,
  snapFrac: 0.45,
  minCells: 7,
  minConfidence: 0.5,
};

const NOT_FOUND: DetectionResult = {
  found: false,
  quad: null,
  cells: [],
  cell: 0,
  angle: 0,
  confidence: 0,
  synthesized: [],
};

const MAX_CANDIDATES = 120; // bound the lattice search on busy frames

/** A connected component with the geometry the blob filter needs. */
interface RawBlob {
  cx: number;
  cy: number;
  area: number;
  bw: number;
  bh: number;
}

/** A sticker candidate: centroid + sticker-size estimate. */
interface Blob {
  cx: number;
  cy: number;
  /** Mean bbox side, our sticker-size estimate. */
  size: number;
}

export function detectFace(frame: ImageData, options?: Partial<DetectOptions>): DetectionResult {
  const opt = { ...DEFAULT_DETECT_OPTIONS, ...options };
  const { width: w, height: h } = frame;
  if (w < 12 || h < 12) return NOT_FOUND;

  const gray = toGray(frame);
  const mag = sobelMagnitude(gray, w, h);
  const flat = flatMask(mag, w, h, opt);
  const blobs = labelComponents(flat, w, h);
  const candidates = filterBlobs(blobs, w, h, opt);
  if (candidates.length < opt.minCells) return NOT_FOUND;

  return fitLattice(candidates, opt) ?? NOT_FOUND;
}

/** Axis-aligned bounding box (DETECT space) of a found detection, for ROI metrics. */
export function detectionBBox(d: DetectionResult): { x: number; y: number; w: number; h: number } | null {
  if (!d.found || !d.quad) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of d.quad) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

function toGray(frame: ImageData): Float32Array {
  const { data, width, height } = frame;
  const gray = new Float32Array(width * height);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

function sobelMagnitude(gray: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h); // borders left at 0 (treated as flat)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = gray[i - w - 1];
      const tc = gray[i - w];
      const tr = gray[i - w + 1];
      const ml = gray[i - 1];
      const mr = gray[i + 1];
      const bl = gray[i + w - 1];
      const bc = gray[i + w];
      const br = gray[i + w + 1];
      const gx = tr + 2 * mr + br - tl - 2 * ml - bl;
      const gy = bl + 2 * bc + br - tl - 2 * tc - tr;
      mag[i] = Math.abs(gx) + Math.abs(gy);
    }
  }
  return mag;
}

/** Threshold the gradient, then dilate the edges 1px (separable) so gaps seal. */
function flatMask(mag: Float32Array, w: number, h: number, opt: DetectOptions): Uint8Array {
  const n = w * h;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += mag[i];
  const meanMag = sum / n;
  const edgeT = Math.max(opt.edgeMin, Math.min(opt.edgeMax, opt.edgeK * meanMag));

  const edge = new Uint8Array(n);
  for (let i = 0; i < n; i++) edge[i] = mag[i] >= edgeT ? 1 : 0;

  // Separable binary dilation by 1 (horizontal then vertical).
  const eh = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      eh[i] = edge[i] || (x > 0 && edge[i - 1]) || (x < w - 1 && edge[i + 1]) ? 1 : 0;
    }
  }
  const flat = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const dilated = eh[i] || (y > 0 && eh[i - w]) || (y < h - 1 && eh[i + w]);
      flat[i] = dilated ? 0 : 1;
    }
  }
  return flat;
}

/** Two-pass union-find connected components on the flat mask (4-connectivity). */
function labelComponents(flat: Uint8Array, w: number, h: number): RawBlob[] {
  const n = w * h;
  const labels = new Int32Array(n); // 0 = not flat / unlabeled
  const parent: number[] = [0];
  let next = 1;

  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const nx = parent[x];
      parent[x] = r;
      x = nx;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      if (!flat[i]) continue;
      const west = x > 0 && flat[i - 1] ? labels[i - 1] : 0;
      const north = y > 0 && flat[i - w] ? labels[i - w] : 0;
      if (west && north) {
        const m = Math.min(west, north);
        labels[i] = m;
        if (west !== north) union(west, north);
      } else if (west) {
        labels[i] = west;
      } else if (north) {
        labels[i] = north;
      } else {
        parent[next] = next;
        labels[i] = next;
        next++;
      }
    }
  }

  // Accumulate stats per root label.
  const stat = new Map<number, { area: number; sx: number; sy: number; minX: number; maxX: number; minY: number; maxY: number }>();
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const l = labels[row + x];
      if (!l) continue;
      const r = find(l);
      let s = stat.get(r);
      if (!s) {
        s = { area: 0, sx: 0, sy: 0, minX: x, maxX: x, minY: y, maxY: y };
        stat.set(r, s);
      }
      s.area++;
      s.sx += x;
      s.sy += y;
      if (x < s.minX) s.minX = x;
      if (x > s.maxX) s.maxX = x;
      if (y < s.minY) s.minY = y;
      if (y > s.maxY) s.maxY = y;
    }
  }

  const blobs: RawBlob[] = [];
  for (const s of stat.values()) {
    const bw = s.maxX - s.minX + 1;
    const bh = s.maxY - s.minY + 1;
    blobs.push({ cx: s.sx / s.area, cy: s.sy / s.area, area: s.area, bw, bh });
  }
  return blobs;
}

function filterBlobs(blobs: RawBlob[], w: number, h: number, opt: DetectOptions): Blob[] {
  const minDim = Math.min(w, h);
  const minSide = opt.stickerMinFrac * minDim;
  const maxSide = opt.stickerMaxFrac * minDim;
  const out: Blob[] = [];
  for (const b of blobs) {
    const { bw, bh, area } = b;
    if (bw < minSide || bh < minSide || bw > maxSide || bh > maxSide) continue;
    const aspect = Math.min(bw, bh) / Math.max(bw, bh);
    if (aspect < opt.minAspect) continue;
    const fill = area / (bw * bh);
    if (fill < opt.minFill) continue;
    out.push({ cx: b.cx, cy: b.cy, size: (bw + bh) / 2 });
  }
  if (out.length > MAX_CANDIDATES) {
    out.sort((p, q) => q.size - p.size);
    out.length = MAX_CANDIDATES;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lattice fitting
// ---------------------------------------------------------------------------

function fitLattice(cands: Blob[], opt: DetectOptions): DetectionResult | null {
  const N = cands.length;

  // Robust pitch + in-plane angle from nearest-neighbour vectors.
  const nnDist: number[] = [];
  const nnAngle: number[] = [];
  for (let i = 0; i < N; i++) {
    let best = Infinity;
    let bdx = 0;
    let bdy = 0;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = cands[j].cx - cands[i].cx;
      const dy = cands[j].cy - cands[i].cy;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        bdx = dx;
        bdy = dy;
      }
    }
    if (!isFinite(best)) continue;
    nnDist.push(Math.sqrt(best));
    nnAngle.push(normalizeGridAngle((Math.atan2(bdy, bdx) * 180) / Math.PI));
  }
  const pitch = median(nnDist);
  if (!(pitch > 0)) return null;
  const theta = (median(nnAngle) * Math.PI) / 180;

  // Basis vectors: u = right, v = down (image y grows downward).
  const Ux = Math.cos(theta) * pitch;
  const Uy = Math.sin(theta) * pitch;
  const Vx = -Math.sin(theta) * pitch;
  const Vy = Math.cos(theta) * pitch;
  const snapTol = opt.snapFrac * pitch;
  const snapTolSq = snapTol * snapTol;

  // Try each candidate as the center cell; snap the 8 neighbours.
  let best: {
    matchIdx: number[]; // length 9, candidate index per cell or -1
    residual: number; // mean snap distance over matched
    m: number;
    centerCx: number;
    centerCy: number;
  } | null = null;

  for (let c = 0; c < N; c++) {
    const cx0 = cands[c].cx;
    const cy0 = cands[c].cy;
    const matchIdx = new Array<number>(9).fill(-1);
    let m = 0;
    let resSum = 0;
    for (let row = -1; row <= 1; row++) {
      for (let col = -1; col <= 1; col++) {
        const px = cx0 + col * Ux + row * Vx;
        const py = cy0 + col * Uy + row * Vy;
        let bj = -1;
        let bd = snapTolSq;
        for (let j = 0; j < N; j++) {
          const dx = cands[j].cx - px;
          const dy = cands[j].cy - py;
          const d = dx * dx + dy * dy;
          if (d <= bd) {
            bd = d;
            bj = j;
          }
        }
        const idx = (row + 1) * 3 + (col + 1);
        if (bj >= 0) {
          matchIdx[idx] = bj;
          m++;
          resSum += Math.sqrt(bd);
        }
      }
    }
    if (m < opt.minCells) continue;
    const residual = resSum / m;
    if (!best || m > best.m || (m === best.m && residual < best.residual)) {
      best = { matchIdx, residual, m, centerCx: cx0, centerCy: cy0 };
    }
  }

  if (!best) return null;

  // Re-center using all matched cells (more robust than the single seed).
  let offX = 0;
  let offY = 0;
  const matchedSizes: number[] = [];
  for (let idx = 0; idx < 9; idx++) {
    const j = best.matchIdx[idx];
    if (j < 0) continue;
    const col = (idx % 3) - 1;
    const row = Math.floor(idx / 3) - 1;
    offX += cands[j].cx - (col * Ux + row * Vx);
    offY += cands[j].cy - (col * Uy + row * Vy);
    matchedSizes.push(cands[j].size);
  }
  const centerX = offX / best.m;
  const centerY = offY / best.m;

  // Build the 9 ordered cell centers; synthesize the missing ones from the lattice.
  const cells: Pt[] = new Array(9);
  const synthesized: number[] = [];
  for (let idx = 0; idx < 9; idx++) {
    const col = (idx % 3) - 1;
    const row = Math.floor(idx / 3) - 1;
    const lx = centerX + col * Ux + row * Vx;
    const ly = centerY + col * Uy + row * Vy;
    const j = best.matchIdx[idx];
    if (j >= 0) {
      cells[idx] = { x: cands[j].cx, y: cands[j].cy };
    } else {
      cells[idx] = { x: lx, y: ly };
      synthesized.push(idx);
    }
  }

  // Quad corners: half a pitch beyond the outer cell centers.
  const corner = (cx: number, cy: number): Pt => ({ x: cx, y: cy });
  const quad: [Pt, Pt, Pt, Pt] = [
    corner(centerX - 1.5 * Ux - 1.5 * Vx, centerY - 1.5 * Uy - 1.5 * Vy), // TL
    corner(centerX + 1.5 * Ux - 1.5 * Vx, centerY + 1.5 * Uy - 1.5 * Vy), // TR
    corner(centerX + 1.5 * Ux + 1.5 * Vx, centerY + 1.5 * Uy + 1.5 * Vy), // BR
    corner(centerX - 1.5 * Ux + 1.5 * Vx, centerY - 1.5 * Uy + 1.5 * Vy), // BL
  ];

  const sizeMean = matchedSizes.reduce((s, v) => s + v, 0) / matchedSizes.length;
  const sizeVar =
    matchedSizes.reduce((s, v) => s + (v - sizeMean) * (v - sizeMean), 0) / matchedSizes.length;
  const sizeStd = Math.sqrt(sizeVar);

  const confidence =
    0.5 * (best.m / 9) +
    0.3 * (1 - clamp01(best.residual / pitch)) +
    0.2 * (1 - clamp01(sizeStd / (sizeMean || 1)));

  const found = best.m >= opt.minCells && confidence >= opt.minConfidence;
  if (!found) return null;

  return {
    found: true,
    quad,
    cells,
    cell: Math.max(2, sizeMean),
    angle: (theta * 180) / Math.PI,
    confidence,
    synthesized,
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Fold an angle (deg) into [-45,45) using the grid's 90° rotational symmetry. */
function normalizeGridAngle(a: number): number {
  let r = a % 90;
  if (r < -45) r += 90;
  else if (r >= 45) r -= 90;
  return r;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
