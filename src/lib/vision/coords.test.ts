import { describe, it, expect } from 'vitest';
import { videoPointToViewport, coverScale, scalePoint } from './coords';

describe('videoPointToViewport', () => {
  it('maps through an object-fit cover crop (portrait viewport, landscape video)', () => {
    const video = { width: 1920, height: 1080 };
    const viewport = { width: 360, height: 640 };
    // Mirror the projectCenteredSampleSquare test: the centered 0.7 square's
    // top-left in video space is ((1920-756)/2, (1080-756)/2) = (582, 162).
    const tl = videoPointToViewport({ x: 582, y: 162 }, video, viewport);
    expect(tl.x).toBeCloseTo(-44);
    expect(tl.y).toBeCloseTo(96);
  });

  it('centers a point when no crop is needed (matching aspect)', () => {
    const video = { width: 1280, height: 720 };
    const viewport = { width: 1280, height: 720 };
    const p = videoPointToViewport({ x: 388, y: 108 }, video, viewport);
    expect(p.x).toBeCloseTo(388);
    expect(p.y).toBeCloseTo(108);
  });

  it('maps the video center to the viewport center', () => {
    const video = { width: 640, height: 480 };
    const viewport = { width: 200, height: 400 };
    const c = videoPointToViewport({ x: 320, y: 240 }, video, viewport);
    expect(c.x).toBeCloseTo(100);
    expect(c.y).toBeCloseTo(200);
  });
});

describe('coverScale', () => {
  it('picks the larger ratio so the video fills the viewport', () => {
    expect(coverScale({ width: 1920, height: 1080 }, { width: 360, height: 640 })).toBeCloseTo(
      640 / 1080,
    );
  });
});

describe('scalePoint', () => {
  it('scales by independent x/y factors', () => {
    expect(scalePoint({ x: 10, y: 20 }, 2, 3)).toEqual({ x: 20, y: 60 });
  });
});
