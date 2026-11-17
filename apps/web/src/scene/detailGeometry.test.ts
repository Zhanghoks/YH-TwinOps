import { describe, expect, it } from 'vitest';
import { FIXTURE_TYPES, type Fixture } from '@yh/contracts';
import { buildFixtureDetail } from './detailGeometry';
import { layout } from '../data';

function fixture(overrides: Partial<Fixture> = {}): Fixture {
  return { fixtureId: 'F024', zoneId: 'zone-grocery', fixtureType: 'GONDOLA', assetId: 'example', x: 3, y: 0, z: -2, rotationY: 0, widthM: 3, depthM: 1.4, heightM: 1.8, fixed: true, categoryIds: [], ...overrides };
}

describe('procedural fixture detail', () => {
  it('is deterministic, does not mutate business geometry and uses local coordinates', () => {
    const input = fixture();
    const before = structuredClone(input);
    expect(buildFixtureDetail(input)).toEqual(buildFixtureDetail(input));
    expect(buildFixtureDetail(input)).toEqual(buildFixtureDetail({ ...input, x: 90, z: -12, rotationY: 1 }));
    expect(input).toEqual(before);
  });

  for (const fixtureType of FIXTURE_TYPES) {
    it(`${fixtureType} fits all components inside the declared footprint and height`, () => {
      for (const dimensions of [[3, 1.4, 1.8], [0.12, 0.08, 0.2], [12, 4, 3.5]]) {
        const [widthM = 3, depthM = 1, heightM = 2] = dimensions;
        const parts = buildFixtureDetail(fixture({ fixtureType, widthM, depthM, heightM }));
        expect(parts.length).toBeGreaterThan(3);
        expect(parts.length).toBeLessThan(300);
        expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
        for (const part of parts) {
          expect(part.color).toMatch(/^#[0-9a-f]{6}$/i);
          part.size.forEach((n) => { expect(Number.isFinite(n)).toBe(true); expect(n).toBeGreaterThan(0); });
          part.position.forEach((n) => expect(Number.isFinite(n)).toBe(true));
          expect(Math.abs(part.position[0]) + part.size[0] / 2).toBeLessThanOrEqual(widthM / 2 + 1e-9);
          expect(Math.abs(part.position[2]) + part.size[2] / 2).toBeLessThanOrEqual(depthM / 2 + 1e-9);
          expect(part.position[1] - part.size[1] / 2).toBeGreaterThanOrEqual(-1e-9);
          expect(part.position[1] + part.size[1] / 2).toBeLessThanOrEqual(heightM + 1e-9);
        }
      }
    });
  }

  it('adds distinct semantic detail instead of one universal box', () => {
    const ids = (fixtureType: Fixture['fixtureType']) => buildFixtureDetail(fixture({ fixtureType })).map((p) => p.id).join(' ');
    expect(ids('GONDOLA')).toContain('shelf');
    expect(ids('PRODUCE_ISLAND')).toContain('fruit');
    expect(ids('CHECKOUT')).toContain('belt');
    expect(ids('FREEZER')).toContain('handle');
    expect(ids('DELI_COUNTER')).toContain('tray');
    expect(ids('DOOR')).toContain('frame');
  });

  it('keeps the full-store detail budget bounded and does not alter the real demo layout', () => {
    const before = JSON.stringify(layout);
    const parts = layout.fixtures.flatMap(buildFixtureDetail);
    expect(parts.length).toBeGreaterThan(1000);
    expect(parts.length).toBeLessThan(25000);
    expect(new Set(parts.map((p) => `${p.primitive}-${p.material}`)).size).toBeLessThanOrEqual(12);
    expect(JSON.stringify(layout)).toBe(before);
  });

  it('leaves gondola merchandise visible from above instead of covering the entire shelf', () => {
    const f = fixture();
    const parts = buildFixtureDetail(f);
    const cap = parts.find((p) => p.id === 'top-cap');
    expect(cap).toBeDefined();
    expect(cap?.size[2]).toBeLessThan(f.depthM * 0.12);
    const products = parts.filter((p) => p.material === 'product');
    expect(new Set(products.map((p) => p.primitive)).size).toBe(2);
    expect(new Set(products.map((p) => p.size[1])).size).toBeGreaterThan(4);
    expect(parts.some((p) => p.id.includes('bottle-neck'))).toBe(true);
    expect(parts.some((p) => p.id.includes('jar-lid'))).toBe(true);
  });

  it('uses a narrow front freezer header rather than an opaque full-depth lid', () => {
    const f = fixture({ fixtureType: 'FREEZER' });
    const parts = buildFixtureDetail(f);
    const header = parts.find((p) => p.id === 'header');
    expect(header).toBeDefined();
    expect(header?.size[2]).toBeLessThan(f.depthM * 0.12);
    expect(header?.position[2]).toBeGreaterThan(f.depthM * 0.4);
    expect(parts.some((p) => p.material === 'glass')).toBe(true);
  });

  it('rejects invalid dimensions before producing render transforms', () => {
    for (const widthM of [0, -1, Infinity, NaN]) {
      expect(() => buildFixtureDetail(fixture({ widthM }))).toThrow(RangeError);
    }
  });
});
