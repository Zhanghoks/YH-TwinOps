import { describe, expect, it } from 'vitest';
import { parseStoreLayout } from '@yh/contracts';
import { layout as baseline } from '../data';
import { generatePlanningLayout, validatePlanningLayout } from './planningLayout';

describe('independent planning layout candidate', () => {
  it('is deterministic, schema-valid, and leaves the approved input unchanged', () => {
    const before = JSON.stringify(baseline);
    const result = generatePlanningLayout(baseline);
    expect(result).toEqual(generatePlanningLayout(baseline));
    expect(JSON.stringify(baseline)).toBe(before);
    expect(parseStoreLayout(result.layout)).toEqual(result.layout);
    expect(result.report.valid).toBe(true);
    expect(result.report.movedFixtureCount).toBeGreaterThan(0);
  });

  it('preserves all 150 fixture identities, dimensions and operational metadata', () => {
    const result = generatePlanningLayout(baseline);
    expect(result.layout.fixtures).toHaveLength(150);
    expect(result.layout.zones.map((z) => z.zoneId)).toEqual(baseline.zones.map((z) => z.zoneId));
    for (const [i, f] of result.layout.fixtures.entries()) {
      const original = baseline.fixtures[i];
      expect(original).toBeDefined();
      expect({ ...f, x: original?.x, z: original?.z, rotationY: original?.rotationY }).toEqual(original);
    }
  });

  it('keeps every footprint in the store, separated, and outside the central entry/aisle', () => {
    const { layout, report } = generatePlanningLayout(baseline);
    const validation = validatePlanningLayout(layout);
    expect(validation.issues).toEqual([]);
    expect(validation.minimumGapM).toBeGreaterThanOrEqual(.3 - 1e-9);
    expect(report.centralAisleWidthM).toBe(4);
    for (const f of layout.fixtures) {
      expect(Math.abs(f.x) - f.widthM / 2).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(Math.abs(f.x) + f.widthM / 2).toBeLessThanOrEqual(40);
      expect(Math.abs(f.z) + f.depthM / 2).toBeLessThanOrEqual(25);
    }
  });

  it('moves zone polygons to enclose their own fixtures', () => {
    const { layout } = generatePlanningLayout(baseline);
    for (const z of layout.zones) {
      const xs = (z.polygonM ?? []).map((p) => p[0]);
      const zs = (z.polygonM ?? []).map((p) => p[1]);
      for (const f of layout.fixtures.filter((f) => f.zoneId === z.zoneId)) {
        expect(f.x - f.widthM / 2).toBeGreaterThanOrEqual(Math.min(...xs));
        expect(f.x + f.widthM / 2).toBeLessThanOrEqual(Math.max(...xs));
        expect(f.z - f.depthM / 2).toBeGreaterThanOrEqual(Math.min(...zs));
        expect(f.z + f.depthM / 2).toBeLessThanOrEqual(Math.max(...zs));
      }
    }
  });

  it('rejects an impossible footprint rather than publishing an invalid candidate', () => {
    expect(() => generatePlanningLayout({ ...baseline, widthM: 10, depthM: 10 })).toThrow();
  });

  it('reports invalid geometry instead of treating overlap as success', () => {
    const bad = structuredClone(baseline);
    const first = bad.fixtures[0];
    const second = bad.fixtures[1];
    if (first === undefined || second === undefined) throw new Error('fixture missing');
    second.x = first.x; second.z = first.z;
    expect(validatePlanningLayout(bad).issues.some((i) => i.includes('间距'))).toBe(true);
  });
});
