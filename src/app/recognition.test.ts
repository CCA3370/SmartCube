import { describe, expect, it } from 'vitest';
import { recognizeFace, DISPLAY_COLOR } from './recognition';
import type { CaptureStep, FaceLetter } from '../lib/cube';
import type { Square } from '../lib/color';

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

function paintCell(data: Uint8ClampedArray, width: number, cell: number, index: number, face: FaceLetter) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const rgba = hexToRgba(DISPLAY_COLOR[face]);
  for (let y = row * cell; y < (row + 1) * cell; y++) {
    for (let x = col * cell; x < (col + 1) * cell; x++) {
      const offset = (y * width + x) * 4;
      data.set(rgba, offset);
    }
  }
}

describe('recognizeFace', () => {
  it('returns provisional sticker labels and confidence instead of filling the face color', () => {
    const cell = 10;
    const width = cell * 3;
    const data = new Uint8ClampedArray(width * width * 4);
    const stickers: FaceLetter[] = ['U', 'R', 'F', 'D', 'F', 'L', 'B', 'U', 'D'];
    stickers.forEach((face, index) => paintCell(data, width, cell, index, face));
    const frame = { data, width, height: width } as ImageData;
    const square: Square = { x: 0, y: 0, size: width };
    const step: CaptureStep = {
      face: 'F',
      toCamera: 'F',
      up: 'U',
      rotation: 0,
      instruction: '',
    };

    const { labels } = recognizeFace(frame, square, step);

    expect(labels.labels).toEqual(stickers);
    expect(labels.confidence).toHaveLength(9);
    expect(labels.confidence?.every((value) => value > 0)).toBe(true);
  });
});
