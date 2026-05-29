import {
  faceCells,
  sampleFace,
  rgb2lab,
  nearestCenter,
  classifyRelativeToCenters,
  structuralCleanup,
  type RGB,
  type Square,
  type CenterPalette,
} from '../lib/color';
import {
  applyRotation,
  type CaptureStep,
  type FaceLetter,
  type FaceCapture,
  type FaceLabels,
  FACE_ORDER,
} from '../lib/cube';

/** Display RGB for each face label (UI swatches). */
export const DISPLAY_COLOR: Record<FaceLetter, string> = {
  U: '#f8f8f8', // white
  R: '#c41e3a', // red
  F: '#1c9c4b', // green
  D: '#ffd500', // yellow
  L: '#ff7a1a', // orange
  B: '#1d5cc8', // blue
};

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

const STANDARD_PALETTE: CenterPalette = FACE_ORDER.reduce((palette, face) => {
  palette[face] = rgb2lab(hexToRgb(DISPLAY_COLOR[face]));
  return palette;
}, {} as CenterPalette);

/**
 * Recognize one face from a captured full-res frame:
 *  1. sample the 9 stickers in screen order (ring-median, logo-safe),
 *  2. de-rotate into net order per the capture step,
 *  3. provisionally label each sticker by the standard color scheme.
 *
 * The provisional label is just for instant on-screen feedback during scanning;
 * the definitive lighting-aware labeling happens in `recognizeCube` once all 6
 * live centers are known.
 */
export function recognizeFace(
  frame: ImageData,
  square: Square,
  step: CaptureStep,
): { capture: FaceCapture; labels: FaceLabels } {
  const cells = faceCells(square);
  const screenRgb = sampleFace(frame, cells);
  const netRgb = applyRotation(screenRgb, step.rotation);
  const capture: FaceCapture = { face: step.face, rgb: netRgb };

  // Provisional single-face palette: assume the center is this face's color, and
  // also seed with the standard scheme so the first face still shows something.
  const labels = provisionalLabels(netRgb, step.face);
  return { capture, labels };
}

function provisionalLabels(netRgb: RGB[], face: FaceLetter): FaceLabels {
  const classified = classifyRelativeToCenters(netRgb.map((rgb) => rgb2lab(rgb)), STANDARD_PALETTE);
  classified.labels[4] = face;
  return { face, labels: classified.labels, confidence: classified.confidence };
}

/**
 * Definitive whole-cube classification: build the 6-center palette from the
 * captured center stickers (index 4 of each face), then classify all 54 stickers
 * relative to those live centers with the 9-of-each structural constraint.
 * Returns labels per face in net order.
 */
export function recognizeCube(
  captures: Record<FaceLetter, FaceCapture>,
): Record<FaceLetter, FaceLabels> {
  // Palette from live centers.
  const palette = {} as CenterPalette;
  for (const f of FACE_ORDER) palette[f] = rgb2lab(captures[f].rgb[4]);

  // Flatten 54 stickers in FACE_ORDER, classify together.
  const allLabs = FACE_ORDER.flatMap((f) => captures[f].rgb.map((c) => rgb2lab(c)));
  const { labels, confidence } = structuralCleanup(allLabs, palette);

  const out = {} as Record<FaceLetter, FaceLabels>;
  FACE_ORDER.forEach((f, fi) => {
    const start = fi * 9;
    out[f] = {
      face: f,
      labels: labels.slice(start, start + 9),
      confidence: confidence.slice(start, start + 9),
    };
  });
  // Force centers to their own face (they define the palette).
  for (const f of FACE_ORDER) out[f].labels[4] = f;
  return out;
}

/** Re-classify a single face's already-captured RGB against a known palette. */
export function classifyFaceWithPalette(
  capture: FaceCapture,
  palette: CenterPalette,
): FaceLabels {
  const labels = capture.rgb.map((c) => nearestCenter(rgb2lab(c), palette).face);
  labels[4] = capture.face;
  return { face: capture.face, labels };
}
