import { describe, expect, it } from 'vitest';
import { projectCenteredSampleSquare } from './CameraView';

describe('projectCenteredSampleSquare', () => {
  it('projects the raw sampled square through an object-fit cover crop', () => {
    const rect = projectCenteredSampleSquare(
      { width: 1920, height: 1080 },
      { width: 360, height: 640 },
      0.7,
    );

    expect(rect).not.toBeNull();
    expect(rect!.size).toBeCloseTo(448);
    expect(rect!.left).toBeCloseTo(-44);
    expect(rect!.top).toBeCloseTo(96);
  });

  it('uses the visible video scale when no crop is needed', () => {
    const rect = projectCenteredSampleSquare(
      { width: 1280, height: 720 },
      { width: 1280, height: 720 },
      0.7,
    );

    expect(rect).not.toBeNull();
    expect(rect!.left).toBeCloseTo(388);
    expect(rect!.top).toBeCloseTo(108);
    expect(rect!.size).toBeCloseTo(504);
  });
});
