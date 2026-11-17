import { describe, expect, it } from 'vitest';
import { buildSceneCamera } from './sceneCamera';

describe('scene camera presets', () => {
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
