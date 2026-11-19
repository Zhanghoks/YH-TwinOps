import { describe, expect, it } from 'vitest';
import { layout } from '../data';
import { buildComponentSample } from './componentCatalog';
import { buildFixtureDetail, buildMerchandise, buildShelfPlanogram, buildShelfStructure, supportsShelfPlanogram, type DetailPart } from './detailGeometry';
import { detailPartsAtLod } from './detailLod';
import { buildReferenceDisplayFixtures, generatePlanningLayout } from './planningLayout';
import type { ShelfSlot } from './shelfDisplay';

const EPS = 1e-8;
const min = (p: DetailPart, axis: 0 | 1 | 2) => p.position[axis] - p.size[axis] / 2;
const max = (p: DetailPart, axis: 0 | 1 | 2) => p.position[axis] + p.size[axis] / 2;

describe('shelf structure and independent merchandise models', () => {
  it('merges only the independent layers, and removes every SKU part at both LODs', () => {
    const cases = [
      buildComponentSample('grocery'), buildComponentSample('beverage'), buildComponentSample('household'),
      { ...buildComponentSample('beverage'), fixtureType: 'FREEZER' as const, depthM: 8 },
    ];
    for (const f of cases) {
      expect(supportsShelfPlanogram(f)).toBe(true);
      const bare = buildShelfStructure(f);
      const merchandise = buildShelfPlanogram(f).flatMap(buildMerchandise);
      expect(bare.length).toBeGreaterThan(10);
      expect(merchandise.length).toBeGreaterThan(48);
      expect(buildFixtureDetail(f, { stocked: false })).toEqual(bare);
      expect(buildFixtureDetail(f)).toEqual([...bare, ...merchandise]);
      for (const lod of ['near', 'far'] as const) {
        expect(buildFixtureDetail(f, {stocked:false,lod})).toEqual(bare);
        const empty = detailPartsAtLod(bare, lod);
        expect(empty.every(p => p.primitive === 'box' && ['metal','wood'].includes(p.material))).toBe(true);
        expect(empty.filter(p => p.id.startsWith('shelf-'))).toHaveLength(4);
        expect(empty.some(p => p.id.startsWith('price-rail-'))).toBe(true);
        expect(detailPartsAtLod(merchandise, lod).length).toBeGreaterThan(0);
      }
    }
    expect(buildShelfPlanogram(buildComponentSample('vegetable'))).toEqual([]);
    expect(buildFixtureDetail(buildComponentSample('vegetable'), {stocked:false})).toEqual(buildFixtureDetail(buildComponentSample('vegetable')));
  });

  it('gives food and household different reusable geometry families, not merely palettes', () => {
    const models = (id: 'grocery' | 'household' | 'beverage') => new Set(buildShelfPlanogram(buildComponentSample(id)).map(x=>x.model));
    expect(models('grocery')).toEqual(new Set(['carton','pouch','jar']));
    expect(models('household')).toEqual(new Set(['detergent','bottle','tissue']));
    expect(models('beverage')).toEqual(new Set(['bottle','carton','jar']));
    const detergent = buildShelfPlanogram(buildComponentSample('household')).find(p=>p.model==='detergent')!;
    const parts = buildMerchandise(detergent);
    const left = parts.find(p=>p.id.startsWith('bottle-neck-handle-left'))!;
    const right = parts.find(p=>p.id.startsWith('bottle-neck-handle-right'))!;
    const top = parts.find(p=>p.id.startsWith('bottle-neck-handle-top'))!;
    const body = parts.find(p=>p.id.startsWith('pack-bottle-detergent'))!;
    expect(min(right,0)-max(left,0)).toBeGreaterThan(.02);
    expect(min(top,1)-max(body,1)).toBeGreaterThan(.02);
  });

  it('populates long racks with actual-size repeated facings and aggregates only for far LOD', () => {
    for (const id of ['grocery','household'] as const) {
      const f = {...buildComponentSample(id), widthM:9, depthM:1.4};
      const slots = buildShelfPlanogram(f);
      const row = slots.filter(s=>s.level===1&&s.side===1);
      expect(row.length).toBeGreaterThan(25);
      expect(row.every(s=>s.modelSize[0]<=.30)).toBe(true);
      expect(row.reduce((s,p)=>s+p.modelSize[0],0)).toBeGreaterThan(f.widthM*.55);
      const near = buildFixtureDetail(f);
      const far = buildFixtureDetail(f,{lod:'far'});
      const bare = buildFixtureDetail(f,{stocked:false,lod:'far'});
      const blocks = far.filter(p=>p.id.startsWith('stock-block-'));
      expect(near.some(p=>p.id.startsWith('stock-block-'))).toBe(false);
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.length).toBeLessThanOrEqual(64);
      expect(far).toEqual([...bare, ...blocks]);
      expect(near.length).toBeGreaterThan(far.length*4);
      for (const p of blocks) {
        const fixtureBounds = [f.widthM, f.heightM, f.depthM] as const;
        expect(([0,1,2] as const).every(axis=>max(p,axis)<=(axis===1?fixtureBounds[axis]:fixtureBounds[axis]/2)+EPS &&
          min(p,axis)>=(axis===1?0:-fixtureBounds[axis]/2)-EPS)).toBe(true);
        expect(bare.every(b=>([0,1,2] as const).some(axis=>max(p,axis)<=min(b,axis)+EPS||min(p,axis)>=max(b,axis)-EPS))).toBe(true);
      }
    }
  });

  it('anchors items onto shelf tops with no slot, shelf, spine or fixture penetrations', () => {
    const dense = generatePlanningLayout(layout).layout;
    const fixtures = [...layout.fixtures, ...dense.fixtures, ...buildReferenceDisplayFixtures(dense),
      buildComponentSample('grocery'), buildComponentSample('household'),
      { ...buildComponentSample('beverage'), fixtureType: 'FREEZER' as const, widthM: 1, depthM: 8 },
    ].filter(supportsShelfPlanogram);
    expect(fixtures.length).toBeGreaterThan(80);
    for (const f of fixtures) {
      const bare = buildShelfStructure(f);
      const slots = buildShelfPlanogram(f);
      let problem: string | undefined;
      const check = (ok: boolean, slot: ShelfSlot, note: string): void => {
        if (!ok && !problem) problem = `${f.fixtureId} / ${slot.id}: ${note}`;
      };
      for (const slot of slots) {
        const pieces = buildMerchandise(slot);
        const slab = bare.find(p=>p.id===`shelf-${slot.level}`)!;
        check(Math.abs(slot.anchor[1]-max(slab,1))<=EPS, slot, 'anchor on shelf top');
        check(Math.abs(Math.min(...pieces.map(p=>min(p,1)))-slot.anchor[1])<=EPS, slot, 'product contacts shelf');
        for (const p of pieces) {
          for (const i of [0,2] as const) {
            check(min(p,i)>=slot.anchor[i]-slot.cellSize[i]/2-EPS && max(p,i)<=slot.anchor[i]+slot.cellSize[i]/2+EPS, slot, p.id+' horizontal fit');
            check(min(p,i)>=min(slab,i)-EPS && max(p,i)<=max(slab,i)+EPS, slot, p.id+' shelf footprint');
          }
          check(min(p,1)>=slot.anchor[1]-EPS && max(p,1)<=slot.anchor[1]+slot.cellSize[1]+EPS, slot, p.id+' vertical fit');
          for (const b of bare) {
            check(([0,1,2] as const).some(axis=>max(p,axis)<=min(b,axis)+EPS||min(p,axis)>=max(b,axis)-EPS),slot,p.id+' intersects '+b.id);
          }
        }
      }
      for (const [i,a] of slots.entries()) for (const b of slots.slice(i+1)) {
        if (a.level!==b.level) continue;
        // Adjacent slot cells may meet; every SKU envelope has strict clearance inside its cell.
        check(([0,2] as const).some(axis=>Math.abs(a.anchor[axis]-b.anchor[axis])+EPS>=(a.cellSize[axis]+b.cellSize[axis])/2),a,'slots overlap '+b.id);
      }
      expect(problem).toBeUndefined();
      const parts=buildFixtureDetail(f);
      expect(new Set(parts.map(p=>p.id)).size).toBe(parts.length);
    }
  });
});
