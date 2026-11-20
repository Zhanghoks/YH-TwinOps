import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildDimensionedShelf, type DimensionedShelfKind, type ShelfPart } from './dimensionedShelf';
import { makeDimensionedShelf, disposeDimensionedShelf } from './dimensionedShelfThree';

const AXES = [0,1,2] as const;
const EPS = 1e-8;

describe('dimensioned empty supermarket shelving', () => {
  it.each([
    {kind:'wall', width:2.4,depth:.47,height:2.2,mountCount:5,levels:[.15,.53,.91,1.29,1.67]},
    {kind:'gondola', width:2.4,depth:1,height:1.6,mountCount:20,levels:[.2,.5,.8,1.1,1.4]},
  ] as const)('delivers exact $kind outer bounds and five mount elevations in both LODs', ({kind,width,depth,height,mountCount,levels})=>{
    const high = buildDimensionedShelf(kind);
    const low = buildDimensionedShelf(kind,{},'low');
    expect(low.mounts).toEqual(high.mounts);
    expect(high.mounts).toHaveLength(mountCount);
    expect([...new Set(high.mounts.map(m=>m.anchor[1]))]).toEqual(levels);
    expect(new Set(high.parts.map(p=>p.id)).size).toBe(high.parts.length);
    for (const model of [high,low]) {
      const group=makeDimensionedShelf(model);
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(width,6);
      expect(size.z).toBeCloseTo(depth,6);
      expect(size.y).toBeCloseTo(height,6);
      expect(box.min.y).toBeCloseTo(0,6);
      expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0,6);
      expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0,6);
      disposeDimensionedShelf(group);
    }
  });

  it('gives the gondola two parallel 450mm shelves around a 100mm center spine', ()=>{
    const model=buildDimensionedShelf('gondola');
    const decks=model.parts.filter(p=>p.id.startsWith('deck-'));
    expect(decks).toHaveLength(20);
    for (const deck of decks) {
      expect(deck.max[2]-deck.min[2]).toBeCloseTo(.45,9);
      expect(Math.min(Math.abs(deck.max[2]),Math.abs(deck.min[2]))).toBeCloseTo(.05,9);
      expect(decks.some(mirror=>deck.min[0]===mirror.min[0] && deck.max[0]===mirror.max[0] &&
        deck.min[1]===mirror.min[1] && deck.min[2]===-mirror.max[2] && deck.max[2]===-mirror.min[2])).toBe(true);
    }
    expect(model.mounts.filter(m=>m.side===1)).toHaveLength(10);
    expect(model.mounts.filter(m=>m.side===-1)).toHaveLength(10);
  });

  it.each(['wall','gondola'] as const)('mount points are bed-anchored and their clearance volume avoids all solids in $kind', (kind)=>{
    const model=buildDimensionedShelf(kind);
    for (const m of model.mounts) {
      const deck=model.parts.find(p=>p.id===`deck-${m.side}-${m.bay}-${m.level}`);
      if (!deck) throw new Error('Missing host deck for '+m.id);
      expect(m.anchor[1]).toBe(deck.max[1]);
      expect(m.size[1]).toBeGreaterThanOrEqual(kind==='wall'?.35:.19);
      for (const axis of [0,2] as const) {
        expect(m.anchor[axis]-m.size[axis]/2).toBeGreaterThan(deck.min[axis]);
        expect(m.anchor[axis]+m.size[axis]/2).toBeLessThan(deck.max[axis]);
      }
      const min=(axis:0|1|2)=>m.anchor[axis]-(axis===1?0:m.size[axis]/2);
      const max=(axis:0|1|2)=>m.anchor[axis]+(axis===1?m.size[axis]:m.size[axis]/2);
      expect(model.parts.filter(part=>AXES.every(axis=>min(axis)<part.max[axis]-EPS && max(axis)>part.min[axis]+EPS))).toEqual([]);
    }
  });

  it.each([{kind:'wall',id:'pegboard',profile:'round'},{kind:'gondola',id:'post-1-front-mounting-slots',profile:'slot'}] as const)(
    'cuts transparent apertures through $id while retaining surrounding sheet; low omits geometry deliberately',
    ({kind,id,profile})=>{
      const high = buildDimensionedShelf(kind);
      const low = buildDimensionedShelf(kind,{},'low');
      const sheet=high.parts.find((p):p is Extract<ShelfPart,{type:'sheet'}>=>p.id===id&&p.type==='sheet');
      if (!sheet) throw new Error('Missing aperture-bearing sheet');
      expect(sheet.cutout.profile).toBe(profile);
      const h=makeDimensionedShelf(high), l=makeDimensionedShelf(low);
      h.updateMatrixWorld(true);
      l.updateMatrixWorld(true);
      const metal=h.getObjectByName(id);
      const solid=l.getObjectByName(id);
      if (!metal || !solid) throw new Error('Missing exported sheet');
      const n=(axis:0|1)=>Math.max(1,Math.floor((sheet.max[axis]-sheet.min[axis])/sheet.cutout.pitch[axis]));
      const step=(axis:0|1)=>(sheet.max[axis]-sheet.min[axis])/n(axis);
      const cast=(x:number,y:number)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));
      const x=sheet.min[0]+step(0)*.5, y=sheet.min[1]+step(1)*.5;
      expect(cast(x,y).intersectObject(metal)).toHaveLength(0);
      expect(cast(x,y).intersectObject(solid).length).toBeGreaterThan(0);
      expect(cast(x+step(0)*.25,y).intersectObject(metal).length).toBeGreaterThan(0);
      disposeDimensionedShelf(h);
      disposeDimensionedShelf(l);
    },
  );

  it('permits a documented dimension override but rejects invalid, over-height and unordered levels', ()=>{
    const custom=buildDimensionedShelf('wall',{width:1800,depth:500,levels:[150,500,850,1200,1550]});
    expect(custom.dimensionsMm.width).toBe(1800);
    expect(custom.mounts[4]?.anchor[1]).toBe(1.55);
    for (const kind of ['wall','gondola'] satisfies DimensionedShelfKind[]) {
      expect(()=>buildDimensionedShelf(kind,{width:NaN})).toThrow(RangeError);
      expect(()=>buildDimensionedShelf(kind,{depth:100})).toThrow(RangeError);
      expect(()=>buildDimensionedShelf(kind,{levels:[150,300,750,700,1800]})).toThrow(RangeError);
    }
    expect(()=>buildDimensionedShelf('gondola',{levels:[200,550,900,1250,1600]})).toThrow(RangeError);
  });
});
