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

  it('uses stable zone themes and distinct merchandising shapes, not fixture-ID random accents', () => {
    const themed = (zoneId: string, fixtureId = 'F024') => buildFixtureDetail(fixture({ zoneId, fixtureId }));
    const count = (zoneId: string, prefix: string) => themed(zoneId).filter((p) => p.id.startsWith(prefix)).length;
    expect(count('zone-beverages', 'pack-bottle-')).toBeGreaterThan(count('zone-beverages', 'pack-box-'));
    expect(count('zone-packaged', 'pack-box-')).toBeGreaterThan(count('zone-packaged', 'pack-bottle-'));
    expect(count('zone-household', 'pack-bottle-')).toBeGreaterThan(count('zone-household', 'pack-box-'));
    expect(count('zone-bulk', 'pack-sack-')).toBeGreaterThan(0);
    const plinth = (zoneId: string, fixtureId = 'F024') => themed(zoneId, fixtureId).find((p) => p.id === 'plinth');
    expect(plinth('zone-bulk')?.material).toBe('wood');
    expect(plinth('zone-household')?.color).not.toBe(plinth('zone-packaged')?.color);
    expect(plinth('zone-household', 'F001')?.color).toBe(plinth('zone-household', 'F099')?.color);
    expect(themed('zone-packaged').filter((p) => p.id.startsWith('end-panel-'))).toHaveLength(2);
    const bottleHeight = (zoneId: string) => Math.max(...themed(zoneId).filter((p) => p.id.startsWith('pack-bottle-')).map((p) => p.size[1]));
    expect(bottleHeight('zone-household')).toBeGreaterThan(bottleHeight('zone-beverages'));
  });

  it('makes the existing beverage-zone FREEZER stock recognizable as bottles', () => {
    const parts = buildFixtureDetail(fixture({ zoneId: 'zone-beverages', fixtureType: 'FREEZER' }));
    expect(parts.some((p) => p.id.startsWith('chilled-bottle-') && p.primitive === 'sphere')).toBe(true);
  });

  it('keeps themed wide gondolas bounded and within the per-fixture detail budget', () => {
    for (const zoneId of ['zone-beverages', 'zone-household', 'zone-packaged', 'zone-bulk']) {
      const f = fixture({ zoneId, widthM: 12, depthM: 4, heightM: 3.5 });
      const parts = buildFixtureDetail(f);
      expect(parts.length).toBeLessThan(300);
      for (const part of parts) {
        expect(Math.abs(part.position[0]) + part.size[0] / 2).toBeLessThanOrEqual(f.widthM / 2 + 1e-9);
        expect(Math.abs(part.position[2]) + part.size[2] / 2).toBeLessThanOrEqual(f.depthM / 2 + 1e-9);
        expect(part.position[1] - part.size[1] / 2).toBeGreaterThanOrEqual(-1e-9);
        expect(part.position[1] + part.size[1] / 2).toBeLessThanOrEqual(f.heightM + 1e-9);
      }
    }
  });

  it('rejects invalid dimensions before producing render transforms', () => {
    for (const widthM of [0, -1, Infinity, NaN]) {
      expect(() => buildFixtureDetail(fixture({ widthM }))).toThrow(RangeError);
    }
  });
});

it('caps produce item scale instead of enlarging fruit with a wide reference island', () => {
  const parts = buildFixtureDetail(fixture({ fixtureType: 'PRODUCE_ISLAND', widthM: 7, depthM: 3 }));
  const fruit = parts.filter((p)=>p.id.includes('-fruit-'));
  expect(fruit).toHaveLength(144);
  expect(fruit.every((p)=>p.size[0] <= .18 && p.size[1] <= .15 && p.size[2] <= .18)).toBe(true);
  expect(parts.some((p)=>p.id.endsWith('produce-bed'))).toBe(true);
});

describe('checkout long-axis construction', () => {
  it.each([[1.5,5.5],[.12,.5],[1.3,2.6]])('runs belt, scanner and bagging down a %s × %s lane', (widthM, depthM) => {
    const f = fixture({ fixtureType: 'CHECKOUT', widthM, depthM });
    const parts = buildFixtureDetail(f);
    const find = (id: string) => parts.find((p) => p.id === id)!;
    expect(find('belt').size[2]).toBeGreaterThan(find('belt').size[0]);
    expect(find('belt').position[2]).toBeLessThan(find('scanner').position[2]);
    expect(find('scanner').position[2]).toBeLessThan(find('bagging-tray').position[2]);
    expect(find('pos-screen-frame').size[2]).toBeLessThanOrEqual(.42);
    for (const p of parts) {
      expect(Math.abs(p.position[0])+p.size[0]/2).toBeLessThanOrEqual(widthM/2+1e-9);
      expect(Math.abs(p.position[2])+p.size[2]/2).toBeLessThanOrEqual(depthM/2+1e-9);
      expect(p.position[1]-p.size[1]/2).toBeGreaterThanOrEqual(-1e-9);
      expect(p.position[1]+p.size[1]/2).toBeLessThanOrEqual(f.heightM+1e-9);
    }
  });
  it('preserves wide-counter geometry, semantic part IDs and input coordinates', () => {
    const wide = fixture({ fixtureType:'CHECKOUT',widthM:2.6,depthM:1.2 });
    const before = structuredClone(wide);
    const parts = buildFixtureDetail(wide);
    expect(parts.find((p) => p.id === 'belt')?.position).toEqual([-.18*2.6,.699*wide.heightM,0]);
    expect(parts.find((p) => p.id === 'belt')?.size).toEqual([.55*2.6,.013*wide.heightM,.72*1.2]);
    expect(parts.map((p) => p.id)).toEqual(buildFixtureDetail({...wide,widthM:1.5,depthM:5.5}).map((p) => p.id));
    expect(wide).toEqual(before);
  });
});

describe('candidate beverage presentation', () => {
  it('uses bounded open double-sided bottle shelves only for long narrow beverage candidates', () => {
    const f = fixture({ zoneId:'zone-beverages',fixtureType:'FREEZER',widthM:2,depthM:10 });
    const before = structuredClone(f);
    const parts = buildFixtureDetail(f);
    expect(parts.some((p) => p.id.startsWith('glass-door-'))).toBe(false);
    expect(parts.some((p) => p.id.startsWith('pack-bottle-'))).toBe(true);
    expect(parts.filter((p) => p.id.startsWith('pack-bottle-')).some((p) => p.position[0] < 0)).toBe(true);
    expect(parts.filter((p) => p.id.startsWith('pack-bottle-')).some((p) => p.position[0] > 0)).toBe(true);
    expect(parts.length).toBeLessThan(300);
    for (const p of parts) {
      expect(Math.abs(p.position[0])+p.size[0]/2).toBeLessThanOrEqual(f.widthM/2+1e-9);
      expect(Math.abs(p.position[2])+p.size[2]/2).toBeLessThanOrEqual(f.depthM/2+1e-9);
    }
    expect(f).toEqual(before);
    for (const baseline of [{...f,widthM:4,depthM:1.5},{...f,zoneId:'zone-frozen'}]) {
      expect(buildFixtureDetail(baseline).some((p) => p.id.startsWith('glass-door-'))).toBe(true);
    }
  });
});

describe('fresh counter merchandising', () => {
  it.each(['zone-seafood', 'zone-meat', 'zone-bakery', 'zone-deli'])('differentiates %s with bounded repeated food details', (zoneId) => {
    for (const [widthM, depthM, heightM] of [[12, 2, 1.4], [.12,.08,.2]] as const) {
      const f = fixture({fixtureType:'DELI_COUNTER', zoneId, widthM, depthM, heightM});
      const before = structuredClone(f);
      const parts = buildFixtureDetail(f);
      const food = parts.filter(p => p.id.startsWith('fresh-item-'));
      expect(food.length).toBeGreaterThan(8);
      expect(parts.length).toBeLessThan(300);
      for (const p of parts) {
        expect(Math.abs(p.position[0])+p.size[0]/2).toBeLessThanOrEqual(widthM/2+1e-9);
        expect(Math.abs(p.position[2])+p.size[2]/2).toBeLessThanOrEqual(depthM/2+1e-9);
        expect(p.position[1]+p.size[1]/2).toBeLessThanOrEqual(heightM+1e-9);
      }
      expect(food.every(p=>p.size[0]<=.45 && p.size[2]<=.65)).toBe(true);
      expect(f).toEqual(before);
    }
  });
  it('uses distinct seafood ice, meat trays and bakery bread colours', () => {
    const parts = (zoneId:string) => buildFixtureDetail(fixture({fixtureType:'DELI_COUNTER',zoneId}));
    const bed = (zoneId:string) => parts(zoneId).find(p=>p.id==='tray-food-0')!.color;
    expect(new Set(['zone-seafood','zone-meat','zone-bakery','zone-deli'].map(bed)).size).toBe(4);
    expect(parts('zone-seafood').some(p=>p.id.startsWith('fish-tail-'))).toBe(true);
    expect(parts('zone-bakery').some(p=>p.id.startsWith('bread-score-'))).toBe(true);
  });
});

describe('produce and packaged shelf sample refinement', () => {
  it('adds wooden crate slats and distinct bounded produce silhouettes without changing count', () => {
    const p = buildFixtureDetail(fixture({fixtureType:'PRODUCE_ISLAND',widthM:7,depthM:3}));
    expect(p.filter(x=>x.id.includes('-fruit-'))).toHaveLength(144);
    expect(p.filter(x=>x.id.includes('-slat-'))).toHaveLength(24);
    expect(new Set(p.filter(x=>x.id.includes('-fruit-')).map(x=>x.size.join(','))).size).toBeGreaterThan(3);
    expect(p.length).toBeLessThan(300);
  });
  it('adds restrained top-shelf package stripes to food shelves, not all fixtures', () => {
    const p = buildFixtureDetail(fixture({zoneId:'zone-packaged'}));
    expect(p.filter(x=>x.id.startsWith('package-stripe-'))).toHaveLength(10);
    expect(p.length).toBeLessThan(300);
    expect(buildFixtureDetail(fixture({zoneId:'zone-household'})).some(x=>x.id.startsWith('package-stripe-'))).toBe(false);
  });
});
