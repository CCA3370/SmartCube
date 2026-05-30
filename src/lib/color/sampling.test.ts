import { describe, it, expect } from 'vitest';
import { faceCells, sampleFace, sampleSticker } from './sampling';

function solidImage(width: number, height: number, rgb: [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width, height } as ImageData;
}

describe('faceCells', () => {
  it('produces 9 cells centered on a 3x3 grid', () => {
    const cells = faceCells({ x: 0, y: 0, size: 30 });
    expect(cells).toHaveLength(9);
    expect(cells[0]).toMatchObject({ cx: 5, cy: 5, cell: 10 });
    expect(cells[4]).toMatchObject({ cx: 15, cy: 15 });
    expect(cells[8]).toMatchObject({ cx: 25, cy: 25 });
  });

  it('offsets the cells by the square origin', () => {
    const cells = faceCells({ x: 100, y: 40, size: 30 });
    expect(cells[0]).toMatchObject({ cx: 105, cy: 45 });
  });
});

describe('sampleSticker / sampleFace', () => {
  it('reads the constant color of a solid region', () => {
    const img = solidImage(30, 30, [123, 45, 200]);
    const rgb = sampleSticker(img, { cx: 15, cy: 15, cell: 10 });
    expect(rgb).toEqual({ r: 123, g: 45, b: 200 });
  });

  it('samples all nine stickers in cell order', () => {
    const img = solidImage(30, 30, [10, 20, 30]);
    const cells = faceCells({ x: 0, y: 0, size: 30 });
    const out = sampleFace(img, cells);
    expect(out).toHaveLength(9);
    for (const rgb of out) expect(rgb).toEqual({ r: 10, g: 20, b: 30 });
  });
});
