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
    expect(validation.minimumGapM).toBeGreaterThanOrEqual(1.2 - 1e-9);
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

describe('front-of-house and service placement', () => {
  it('anchors backroom at the rear and locates daily/household retail toward the right front', () => {
    const { layout } = generatePlanningLayout(baseline);
    const members = (id: string) => layout.fixtures.filter((f) => f.zoneId === id);
    for (const f of members('zone-backroom')) {
      expect(f.z - f.depthM / 2).toBe(-24);
      expect(f.x).toBeGreaterThan(20);
    }
    for (const id of ['zone-daily', 'zone-household']) {
      for (const f of members(id)) {
        expect(f.x).toBeGreaterThan(2);
        expect(f.z - f.depthM / 2).toBeGreaterThanOrEqual(3);
        expect(f.z + f.depthM / 2).toBeLessThanOrEqual(14);
      }
    }
  });

  it('keeps a continuous 3m transverse link in front of retail and balanced checkout rows', () => {
    const { layout, report } = generatePlanningLayout(baseline);
    expect(report.crossAisle).toEqual({ z0: 14, z1: 17, widthM: 3 });
    expect(report.minimumGapM).toBe(1.2);
    for (const f of layout.fixtures) {
      expect(f.rotationY).toBe(0); // Direct footprint proof is valid for every returned fixture.
      expect(f.z + f.depthM / 2 <= 14 + 1e-8 || f.z - f.depthM / 2 >= 17 - 1e-8).toBe(true);
    }
    for (const id of ['zone-checkout_n', 'zone-checkout_s', 'zone-checkout_e']) {
      const rows = new Map<number, number>();
      for (const f of layout.fixtures.filter((f) => f.zoneId === id)) rows.set(f.z, (rows.get(f.z) ?? 0) + 1);
      expect([...rows.values()]).toEqual([4, 4]);
    }
    const rest = layout.fixtures.filter((f) => f.zoneId === 'zone-rest');
    expect(Math.min(...rest.map((f) => f.z - f.depthM / 2))).toBeGreaterThanOrEqual(21);
    expect(Math.min(...rest.map((f) => f.x - f.widthM / 2))).toBeGreaterThan(25);
  });
});


describe('planning space report', () => {
  it('reports exact fixture extents rather than padded department polygons', () => {
    const { layout, report } = generatePlanningLayout(baseline);
    expect(report.departmentBounds).toHaveLength(17);
    for (const { zoneId, bounds } of report.departmentBounds) {
      const fixtures = layout.fixtures.filter((f) => f.zoneId === zoneId);
      expect(bounds).toEqual({
        x0: Math.min(...fixtures.map((f) => f.x - f.widthM / 2)),
        x1: Math.max(...fixtures.map((f) => f.x + f.widthM / 2)),
        z0: Math.min(...fixtures.map((f) => f.z - f.depthM / 2)),
        z1: Math.max(...fixtures.map((f) => f.z + f.depthM / 2)),
      });
    }
  });
});
