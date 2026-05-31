import {
  faceCells,
  faceCellsFromGrid,
  sampleFace,
  rgb2lab,
  classifyRelativeToCenters,
  structuralCleanup,
  STANDARD_PALETTE,
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

function buildProgressivePalette(captures: Partial<Record<FaceLetter, FaceCapture>>): CenterPalette {
  const palette = { ...STANDARD_PALETTE };
  for (const face of FACE_ORDER) {
    const capture = captures[face];
    if (capture) palette[face] = rgb2lab(capture.rgb[4]);
  }
  return palette;
}

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

  const labels = classifyFaceWithPalette(capture, STANDARD_PALETTE);
  return { capture, labels };
}

/**
 * Like `recognizeFace`, but samples 9 explicit cell centers found by the live
 * cube-face detector (in VIDEO-pixel coords, screen row-major) instead of a fixed
 * centered square. The result is byte-for-byte the same `FaceCapture` shape, so the
 * de-rotation (rotation 0) and everything downstream are unchanged.
 */
export function recognizeFaceFromGrid(
  frame: ImageData,
  centers: { x: number; y: number }[],
  cell: number,
  step: CaptureStep,
): { capture: FaceCapture; labels: FaceLabels } {
  const cells = faceCellsFromGrid(centers, cell);
  const screenRgb = sampleFace(frame, cells);
  const netRgb = applyRotation(screenRgb, step.rotation);
  const capture: FaceCapture = { face: step.face, rgb: netRgb };

  const labels = classifyFaceWithPalette(capture, STANDARD_PALETTE);
  return { capture, labels };
}

export function recognizeCapturedFaces(
  captures: Partial<Record<FaceLetter, FaceCapture>>,
): Partial<Record<FaceLetter, FaceLabels>> {
  const palette = buildProgressivePalette(captures);
  const out: Partial<Record<FaceLetter, FaceLabels>> = {};
  for (const face of FACE_ORDER) {
    const capture = captures[face];
    if (capture) out[face] = classifyFaceWithPalette(capture, palette);
  }
  return out;
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
  const classified = classifyRelativeToCenters(capture.rgb.map((rgb) => rgb2lab(rgb)), palette);
  classified.labels[4] = capture.face;
  return { face: capture.face, labels: classified.labels, confidence: classified.confidence };
}
