import { describe, expect, it } from 'vitest';
import type { Fixture } from '@yh/contracts';
import { buildReferenceArchitecture } from './referenceArchitecture';
import { buildReferenceDisplayFixtures, generatePlanningLayout } from './planningLayout';
import { layout as baseline } from '../data';
import { obbsOverlap } from '@storewright/overlap-audit';

describe('reference-led service architecture', () => {
  it('is deterministic and stays strictly in the north service band or southwest entrance', () => {
    const parts = buildReferenceArchitecture();
    expect(parts).toEqual(buildReferenceArchitecture());
    expect(parts.length).toBeGreaterThan(100);
    expect(parts.length).toBeLessThan(1000);
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
    for (const p of parts) {
      const [x,y,z] = p.position, [w,h,d] = p.size;
      expect([x,y,z,w,h,d].every(Number.isFinite)).toBe(true);
      expect(w > 0 && h > 0 && d > 0).toBe(true);
      expect(y-h/2).toBeGreaterThanOrEqual(-1e-8);
      const north = x-w/2>=-65 && x+w/2<=65 && z-d/2>=-50 && z+d/2<=-32;
      const entrance = x-w/2>=-62 && x+w/2<=-10 && z-d/2>=34 && z+d/2<=50;
      expect(north || entrance).toBe(true);
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.id).toMatch(/^reference-/);
    }
  });

  it('includes four generic loading trucks, low partitions, processing, cold rooms, service and carts', () => {
    const parts = buildReferenceArchitecture();
    expect(parts.filter((p) => p.id.includes('truck-') && p.id.endsWith('-cargo')).length).toBe(4);
    for (const name of ['processing','coldroom-chilled','coldroom-frozen','service-desk','cart-bay']) {
      expect(parts.some((p) => p.id.includes(name))).toBe(true);
    }
    const walls = parts.filter((p) => p.id.includes('partition'));
    expect(walls.length).toBeGreaterThan(3);
    expect(walls.every((p) => p.size[1]<=1.5)).toBe(true);
    expect(parts.some((p) => /person|crowd|human/.test(p.id))).toBe(false);
  });

  it('keeps the southern doorway approach clear while placing customer service as shown', () => {
    const parts = buildReferenceArchitecture();
    const desk = parts.find((p) => p.id === 'reference-service-desk-base')!;
    expect(desk.position[0] - desk.size[0] / 2).toBe(-32);
    expect(desk.position[0] + desk.size[0] / 2).toBe(-18);
    expect(parts.filter((p) => !p.id.includes('entry-paving')).some((p) => p.position[0] + p.size[0]/2 > -29 && p.position[0] - p.size[0]/2 < -16 && p.position[2] + p.size[2]/2 > 43)).toBe(false);
    expect(parts.filter((p) => p.id.includes('service-desk-return')).length).toBe(4);
    expect(parts.filter((p) => p.id.includes('entry-glass')).length).toBe(2);
  });

  it('retains service detail without footprint conflicts in the actual reference candidate', () => {
    const { layout } = generatePlanningLayout(baseline);
    const fixtures = [...layout.fixtures, ...buildReferenceDisplayFixtures(layout)];
    expect(layout.fixtures.length).toBe(150);
    expect(fixtures.length).toBe(203);
    const parts = buildReferenceArchitecture(fixtures);
    for (const name of ['truck-', 'processing', 'coldroom-chilled', 'coldroom-frozen', 'service-desk', 'cart-bay']) expect(parts.some((p) => p.id.includes(name))).toBe(true);
    expect(parts.filter((p) => p.id.includes('cart-bay-') && p.id.endsWith('-basket')).length).toBe(60);
    const shelves = parts.filter((p) => p.id.includes('warehouse-rack-') && p.id.endsWith('-shelf-0'));
    expect(shelves.length).toBe(14);
    expect(new Set(shelves.map((p) => p.position[2])).size).toBe(2);
    for (const p of parts) for (const f of fixtures) {
      expect(obbsOverlap({cx:p.position[0],cz:p.position[2],ux:1,uz:0,hl:p.size[0]/2,hw:p.size[2]/2}, {cx:f.x,cz:f.z,ux:Math.cos(f.rotationY),uz:-Math.sin(f.rotationY),hl:f.widthM/2,hw:f.depthM/2})).toBe(false);
    }
  });

  it('adds 24 static reference lane numbers without occupying the cross aisle', () => {
    const { layout } = generatePlanningLayout(baseline);
    const fixtures = [...layout.fixtures, ...buildReferenceDisplayFixtures(layout)];
    expect(layout.fixtures.length).toBe(150);
    expect(fixtures.length).toBe(203);
    const parts = buildReferenceArchitecture(fixtures);
    const signs = parts.filter((p) => p.id.endsWith('-number-board'));
    expect(signs.length).toBe(24);
    expect(new Set(signs.map((p) => p.position[0])).size).toBe(24);
    expect(parts.filter((p) => p.id.includes('checkout-accessory-')).every((p) => p.position[2] - p.size[2] / 2 >= 34)).toBe(true);
    expect(parts.length).toBe(667);
    expect(parts.filter((p) => p.id.includes('checkout-accessory-display-') && p.id.endsWith('-base')).length).toBe(6);
    expect(parts.filter((p) => p.id.includes('entry-planter-')).length).toBe(4);
  });

  it('omits whole decorative clusters that would conflict with actual fixture footprints', () => {
    const input: Fixture[] = [{fixtureId:'keep-id',zoneId:'keep-zone',fixtureType:'OTHER',assetId:'existing',x:-53,y:0,z:43,widthM:20,depthM:12,heightM:3,rotationY:0,fixed:true,categoryIds:[]}];
    const before=JSON.stringify(input);
    const parts=buildReferenceArchitecture(input);
    expect(parts.some((p)=>p.id.includes('cart-bay'))).toBe(false);
    expect(parts.some((p)=>p.id.includes('truck-'))).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
  });
});
