import { describe, expect, it } from 'vitest';
import { parseStoreLayout } from '@yh/contracts';
import { layout as baseline } from '../data';
import { generatePlanningLayout, validatePlanningLayout } from './planningLayout';

describe('image-reference planning candidate', () => {
  it('is deterministic, schema-valid, and never edits the baseline', () => {
    const before = JSON.stringify(baseline);
    const result = generatePlanningLayout(baseline);
    expect(result).toEqual(generatePlanningLayout(baseline));
    expect(JSON.stringify(baseline)).toBe(before);
    expect(parseStoreLayout(result.layout)).toEqual(result.layout);
    expect([result.layout.widthM, result.layout.depthM]).toEqual([130, 100]);
  });

  it('preserves all fixture IDs, zone IDs and business metadata while disclosing inferred dimensions', () => {
    const { layout, report } = generatePlanningLayout(baseline);
    expect(layout.fixtures).toHaveLength(150);
    expect(layout.zones.map((z) => z.zoneId)).toEqual(baseline.zones.map((z) => z.zoneId));
    layout.fixtures.forEach((f, i) => {
      const original = baseline.fixtures[i]!;
      expect({ ...f, x: original.x, z: original.z, rotationY: original.rotationY, widthM: original.widthM, depthM: original.depthM, heightM: original.heightM }).toEqual(original);
    });
    expect(report.referenceRegions.map((r) => r.code)).toEqual(['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','BACK']);
    expect(report.dimensionChangedFixtureCount).toBeGreaterThan(0);
    expect(report.changes.every((c) => c.from.widthM > 0 && c.to.depthM > 0)).toBe(true);
    expect(report.notes.join('')).toContain('非实测');
    expect(report).not.toHaveProperty('crossAisle');
    expect(report).not.toHaveProperty('centralAisleWidthM');
  });

  it('keeps footprints in bounds, without overlap and at least 1m apart', () => {
    const { layout } = generatePlanningLayout(baseline);
    expect(validatePlanningLayout(layout).issues).toEqual([]);
    expect(validatePlanningLayout(layout).minimumGapM).toBeGreaterThanOrEqual(1);
  });

  it('places 24 north-south checkouts in one southern row, two groups of 12', () => {
    const { layout } = generatePlanningLayout(baseline);
    const checkouts = layout.fixtures.filter((f) => f.fixtureType === 'CHECKOUT').sort((a,b) => a.x-b.x);
    expect(checkouts).toHaveLength(24);
    expect(new Set(checkouts.map((f) => f.z)).size).toBe(1);
    checkouts.forEach((f) => { expect(f.z).toBeGreaterThan(34); expect(f.depthM).toBeGreaterThan(f.widthM * 3); expect(f.rotationY).toBe(0); });
    expect(checkouts[12]!.x - checkouts[11]!.x - checkouts[11]!.widthM).toBe(4);
    expect(checkouts[0]!.x - checkouts[0]!.widthM / 2).toBe(-2);
    expect(checkouts[23]!.x + checkouts[23]!.widthM / 2).toBe(60);
  });

  it('maps all fixtures to their image-reference region and enclosed candidate zone polygon', () => {
    const { layout, report } = generatePlanningLayout(baseline);
    for (const zone of layout.zones) {
      const region = report.referenceRegions.find((r) => r.zoneIds.includes(zone.zoneId));
      expect(region).toBeDefined();
      const xs = zone.polygonM!.map((p) => p[0]), zs = zone.polygonM!.map((p) => p[1]);
      for (const f of layout.fixtures.filter((f) => f.zoneId === zone.zoneId)) {
        expect(f.x - f.widthM / 2).toBeGreaterThanOrEqual(Math.max(region!.bounds.x0, Math.min(...xs)) - 1e-8);
        expect(f.x + f.widthM / 2).toBeLessThanOrEqual(Math.min(region!.bounds.x1, Math.max(...xs)) + 1e-8);
        expect(f.z - f.depthM / 2).toBeGreaterThanOrEqual(Math.max(region!.bounds.z0, Math.min(...zs)) - 1e-8);
        expect(f.z + f.depthM / 2).toBeLessThanOrEqual(Math.min(region!.bounds.z1, Math.max(...zs)) + 1e-8);
      }
    }
  });

  it('reserves the coordinated rear storage footprint and keeps entry approach clear', () => {
    const { layout } = generatePlanningLayout(baseline);
    for (const f of layout.fixtures.filter((f) => f.zoneId === 'zone-backroom')) {
      expect(f.x - f.widthM / 2).toBeGreaterThanOrEqual(-14);
      expect(f.x + f.widthM / 2).toBeLessThanOrEqual(12);
      expect(f.z - f.depthM / 2).toBeGreaterThanOrEqual(-43);
      expect(f.z + f.depthM / 2).toBeLessThanOrEqual(-37);
    }
    for (const f of layout.fixtures) {
      const entersApproach = f.x + f.widthM / 2 > -34 && f.x - f.widthM / 2 < -11 && f.z + f.depthM / 2 > 43;
      expect(entersApproach).toBe(false);
    }
  });

  it('does not enforce the superseded central aisle and detects invalid pairs', () => {
    const { layout } = generatePlanningLayout(baseline);
    expect(layout.fixtures.some((f) => f.x - f.widthM / 2 < 2 && f.x + f.widthM / 2 > -2)).toBe(true);
    const bad = structuredClone(layout);
    bad.fixtures[1]!.x = bad.fixtures[0]!.x; bad.fixtures[1]!.z = bad.fixtures[0]!.z;
    expect(validatePlanningLayout(bad).issues.some((i) => i.includes('间距'))).toBe(true);
  });
});
