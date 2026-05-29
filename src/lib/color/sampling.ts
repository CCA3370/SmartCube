import type { RGB } from './colorspace';
import { median } from '../util/math';

/** A square region of the captured frame (the aligned cube face), in px. */
export interface Square {
  x: number; // top-left
  y: number;
  size: number; // side length
}

/** The pixel center + cell size of one of the 9 stickers, in px. */
export interface CellRect {
  cx: number;
  cy: number;
  cell: number;
}

/**
 * The 9 sticker cells of a face square, in SCREEN row-major order
 * (index 0 = top-left ... 8 = bottom-right). This is the single source of truth
 * shared by the alignment overlay (what the user aligns) and the sampler (what
 * we read) — so they can never drift apart.
 */
export function faceCells(sq: Square): CellRect[] {
  const cell = sq.size / 3;
  const cells: CellRect[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push({ cx: sq.x + cell * (col + 0.5), cy: sq.y + cell * (row + 0.5), cell });
    }
  }
  return cells;
}

function pixelAt(data: ImageData, x: number, y: number): RGB | null {
  if (x < 0 || y < 0 || x >= data.width || y >= data.height) return null;
  const i = (y * data.width + x) * 4;
  return { r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] };
}

// Sample on concentric rings between these fractions of the cell size:
//  - inner bound skips the central logo disc printed on center stickers,
//  - outer bound stays off the black inter-sticker gaps / plastic body.
const RING_RADII = [0.14, 0.22, 0.3];
const RING_ANGLE_STEP = 30; // degrees

/**
 * Read one sticker's color by sampling a ring of points around its center and
 * taking the per-channel MEDIAN. The ring avoids the center logo, and the median
 * rejects the minority of logo-edge / glare / gap pixels.
 */
export function sampleSticker(data: ImageData, rect: CellRect): RGB {
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  for (let a = 0; a < 360; a += RING_ANGLE_STEP) {
    const rad = a * (Math.PI / 180);
    const ca = Math.cos(rad);
    const sa = Math.sin(rad);
    for (const frac of RING_RADII) {
      const r = rect.cell * frac;
      const p = pixelAt(data, Math.round(rect.cx + r * ca), Math.round(rect.cy + r * sa));
      if (!p) continue;
      reds.push(p.r);
      greens.push(p.g);
      blues.push(p.b);
    }
  }
  // Also include the exact center point only as a last resort (ring covers it).
  return { r: median(reds), g: median(greens), b: median(blues) };
}

/** Sample all 9 stickers of a face; returns RGBs in the SAME order as `cells`. */
export function sampleFace(data: ImageData, cells: CellRect[]): RGB[] {
  return cells.map((c) => sampleSticker(data, c));
}
