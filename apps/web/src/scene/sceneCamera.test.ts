import { describe, expect, it } from 'vitest';
import { buildSceneCamera } from './sceneCamera';

describe('scene camera presets', () => {
  it('scales overview and top framing for the reference 130 by 100 metre candidate', () => {
    const base = buildSceneCamera('top', [0, 0], 50, 80);
    const reference = buildSceneCamera('top', [0, 0], 100, 130);
    expect(reference.position[1]).toBe(base.position[1] * 1.625);
    expect(buildSceneCamera('overview', [0, 0], 100, 130).position).toEqual([96, 128, 156]);
  });

  it('keeps entrance inspection outside the store and looks past the fascia', () => {
    const view = buildSceneCamera('entrance', [10, 20], 50);
    expect(view.position[2]).toBeGreaterThan(45);
    expect(view.target[2]).toBeLessThan(45);
    expect(view.position[1]).toBeGreaterThan(8);
  });
  it('preserves centre-relative overview and top-down resets', () => {
    const a = buildSceneCamera('overview', [0, 0], 50);
    const b = buildSceneCamera('overview', [10, 20], 50);
    expect(b.position[0] - a.position[0]).toBe(10);
    expect(b.position[2] - a.position[2]).toBe(20);
    expect(buildSceneCamera('top', [10, 20], 50).target).toEqual([10, 0, 20]);
  });
});
