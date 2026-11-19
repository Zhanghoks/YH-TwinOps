import { describe, expect, it } from 'vitest';
import { buildSceneCamera, fitTopViewHeight } from './sceneCamera';

describe('scene camera presets', () => {
  it('scales overview and top framing for the reference 130 by 100 metre candidate', () => {
    const base = buildSceneCamera('top', [0, 0], 50, 80);
    const reference = buildSceneCamera('top', [0, 0], 100, 130);
    expect(base.position[1]).toBe(115);
    expect(reference.position[1]).toBeCloseTo(166.25);
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

describe('responsive top framing', () => {
  it('fits both axes and uses extra width without changing physical store dimensions', () => {
    const narrow = fitTopViewHeight(130,100,930,964);
    const focused = fitTopViewHeight(130,100,1364,964);
    expect(focused).toBeLessThan(narrow);
    for (const [w,h] of [[810,700],[930,964],[1364,964]]) {
      const distance = fitTopViewHeight(130,100,w!,h!);
      const visibleH = 2 * distance * Math.tan(42 * Math.PI / 360);
      expect(visibleH).toBeGreaterThan(100);
      expect(visibleH * w! / h!).toBeGreaterThan(130);
    }
  });
});
