import { expect, it } from 'vitest';
import { COMPONENT_SAMPLES, buildComponentSample } from './componentCatalog';
import { buildShelfPlanogram, buildFixtureDetail } from './detailGeometry';
it('isolates eighteen reference design samples with bounded independent geometry', () => {
  expect(COMPONENT_SAMPLES).toHaveLength(18);
  for (const entry of COMPONENT_SAMPLES) {
    const f = buildComponentSample(entry.id);
    expect(f.fixtureId.startsWith('design-sample-')).toBe(true);
    const parts = buildFixtureDetail(f);
    expect(parts.length).toBeLessThan(300);
    for (const p of parts) {
      expect(Math.abs(p.position[0])+p.size[0]/2).toBeLessThanOrEqual(f.widthM/2+1e-9);
      expect(Math.abs(p.position[2])+p.size[2]/2).toBeLessThanOrEqual(f.depthM/2+1e-9);
      expect(p.position[1]+p.size[1]/2).toBeLessThanOrEqual(f.heightM+1e-9);
      expect(p.position[1]-p.size[1]/2).toBeGreaterThanOrEqual(-1e-9);
    }
  }
});
it('makes vegetable trays stepped and bakery a separate two-level display', () => {
  const vegetable = buildFixtureDetail(buildComponentSample('vegetable'));
  const trays = vegetable.filter(p=>p.id.startsWith('vegetable-tray-'));
  expect(trays).toHaveLength(3);
  expect(new Set(trays.map(p=>p.position[1])).size).toBe(3);
  expect(buildFixtureDetail(buildComponentSample('bakery')).some(p=>p.id==='bakery-upper-shelf')).toBe(true);
  expect(buildFixtureDetail(buildComponentSample('meat')).some(p=>p.id==='bakery-upper-shelf')).toBe(false);
});

it('gives each special design a unique functional silhouette', () => {
  const cases = { service:'service-flute-0', gate:'gate-wing--1', selfcheckout:'self-screen', cart:'cart-0-handle', coldDoor:'cold-door-seal', dock:'dock-platform' } as const;
  for (const [id, part] of Object.entries(cases)) {
    const sample = COMPONENT_SAMPLES.find(s=>s.id===id)!;
    expect(buildFixtureDetail(buildComponentSample(sample.id)).some(p=>p.id===part)).toBe(true);
  }
});
it('keeps the self-check screen in front of its supporting neck', () => {
  const p=buildFixtureDetail(buildComponentSample('selfcheckout'));
  const neck=p.find(p=>p.id==='self-neck')!;
  const screen=p.find(p=>p.id==='self-screen')!;
  expect(neck.position[2]+neck.size[2]/2).toBeLessThan(screen.position[2]-screen.size[2]/2);
  expect(screen.material).toBe('label');
});

it('stocks at least six facings per compact themed shelf and uses an opaque POS display', () => {
  for (const id of ['grocery','beverage','household'] as const) {
    const slots=buildShelfPlanogram(buildComponentSample(id));
    expect(slots.filter(p=>p.level===0&&p.side===1)).toHaveLength(6);
  }
  expect(buildFixtureDetail(buildComponentSample('checkout')).find(p=>p.id==='pos-screen')?.material).toBe('label');
});
