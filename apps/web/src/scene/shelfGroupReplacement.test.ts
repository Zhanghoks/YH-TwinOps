import { describe,expect,it } from 'vitest';
import * as THREE from 'three';
import { layout } from '../data';
import { generatePlanningLayout } from './planningLayout';
import { buildShelfGroupReplacement, isShelfGroupReplacementFixture } from './shelfGroupReplacement';
import { disposeShelfGroupReplacement, makeShelfGroupReplacement } from './shelfGroupReplacementThree';
import { buildMerchandise, buildShelfPlanogram } from './shelfDisplay';
import type { DetailPart } from './detailGeometry';

const dense=generatePlanningLayout(layout).layout;
const EPS=1e-8;
const axes=[0,1,2] as const;
const low=(p:DetailPart,i:0|1|2)=>p.position[i]-p.size[i]/2;
const high=(p:DetailPart,i:0|1|2)=>p.position[i]+p.size[i]/2;

const checks=[{id:'F077',modules:2,itemCount:160,bounds:[4.8,1.6,1],resized:14},
  {id:'F107',modules:3,itemCount:232,bounds:[6.9,1.6,1],resized:19}] as const;

describe('food and household trial shelves',()=>{
  it.each(checks)('strictly scopes $id; preserves old SKU identity, type, color and texture-role at every LOD',({id,modules,itemCount,resized})=>{
    const fixture=dense.fixtures.find(f=>f.fixtureId===id);
    if(!fixture)throw new Error('missing dense '+id);
    expect(isShelfGroupReplacementFixture(fixture)).toBe(true);
    expect(dense.fixtures.filter(isShelfGroupReplacementFixture).map(p=>p.fixtureId).sort()).toEqual(checks.map(p=>p.id).sort());
    expect(layout.fixtures.some(isShelfGroupReplacementFixture)).toBe(false);
    for(const altered of [{...fixture,x:fixture.x+.1},{...fixture,rotationY:.1},{...fixture,widthM:1},{...fixture,zoneId:'zone-featured'}]){
      expect(buildShelfGroupReplacement(altered)).toBeNull();
    }
    const original=buildShelfPlanogram(fixture);
    for(const lod of ['near','far'] as const) {
      const trial=buildShelfGroupReplacement(fixture,{lod});
      if(!trial)throw new Error('missing trial '+id);
      expect(trial.rackOffsetsM).toHaveLength(modules);
      expect(trial.sourceItemCount).toBe(itemCount);
      expect(trial.placements).toHaveLength(original.length);
      expect(new Set(trial.placements.map(p=>p.sourceId))).toEqual(new Set(original.map(p=>p.id)));
      expect(trial.placements.filter(p=>p.scale<1)).toHaveLength(resized);
      for(const p of trial.placements){
        const old=original.find(q=>q.id===p.sourceId);
        if(!old)throw new Error('missing old slot '+p.sourceId);
        expect(p.sourceSlot).toEqual(old);
        expect(p.scale).toBeGreaterThanOrEqual(.94);
        expect(p.scale).toBeLessThanOrEqual(1);
        const originals=buildMerchandise(old);
        expect(p.merchandise.length).toBe(originals.length);
        for(const [i,item] of p.merchandise.entries()){
          const originalPart=originals[i];
          if(!originalPart)throw new Error('missing product part');
          expect([item.id,item.primitive,item.material,item.color]).toEqual([originalPart.id,originalPart.primitive,originalPart.material,originalPart.color]);
          for(const axis of axes)expect(item.size[axis]).toBeCloseTo(p.scale*originalPart.size[axis],8);
        }
      }
    }
  });

  it.each(checks)('mounts $id stock on all five decks and both sides within clear spans',({id,modules})=>{
    const fixture=dense.fixtures.find(f=>f.fixtureId===id);
    if(!fixture)throw new Error('missing dense '+id);
    const model=buildShelfGroupReplacement(fixture);
    if(!model)throw new Error('missing trial '+id);
    const byMount=new Map<string,typeof model.placements[number][]>();
    for(const p of model.placements){
      const off=model.rackOffsetsM[p.rackIndex];
      if(off===undefined)throw new Error('missing module offset');
      const key=p.rackIndex+'-'+p.mount.id,group=byMount.get(key) ?? [];
      group.push(p); byMount.set(key,group);
      const [x,y,z]=p.mount.anchor,[w,h,d]=p.mount.size;
      expect(Math.min(...p.merchandise.map(a=>low(a,1)))).toBeCloseTo(y,8);
      let intersects=false;
      for(const a of p.merchandise){
        expect(low(a,0)).toBeGreaterThanOrEqual(x+off-w/2-EPS);
        expect(high(a,0)).toBeLessThanOrEqual(x+off+w/2+EPS);
        expect(low(a,1)).toBeGreaterThanOrEqual(y-EPS);
        expect(high(a,1)).toBeLessThanOrEqual(y+h+EPS);
        expect(low(a,2)).toBeGreaterThanOrEqual(z-d/2-EPS);
        expect(high(a,2)).toBeLessThanOrEqual(z+d/2+EPS);
        intersects ||= model.frame.parts.some(s=>axes.every(i=>low(a,i)<s.max[i]+(i===0?off:0)-EPS&&high(a,i)>s.min[i]+(i===0?off:0)+EPS));
      }
      expect(intersects).toBe(false);
    }
    expect(byMount.size).toBe(modules*20);
    for(const items of byMount.values())for(const [i,p] of items.entries())for(const q of items.slice(i+1))
      expect(Math.min(...q.merchandise.map(a=>low(a,0)))-Math.max(...p.merchandise.map(a=>high(a,0)))).toBeGreaterThan(.005);
  });

  it.each(checks)('keeps bounds centered, width/depth inside old envelope and exact near/far empty/stocked batches for $id',({id,bounds,itemCount})=>{
    const fixture=dense.fixtures.find(f=>f.fixtureId===id);
    if(!fixture)throw new Error('missing dense '+id);
    for(const stocked of [true,false])for(const lod of ['near','far'] as const){
      const trial=buildShelfGroupReplacement(fixture,{stocked,lod});
      if(!trial)throw new Error('missing trial '+id);
      expect(trial.sourceItemCount).toBe(itemCount);
      expect(trial.placements).toHaveLength(stocked?itemCount:0);
      const group=makeShelfGroupReplacement(trial);
      const box=new THREE.Box3().setFromObject(group);
      expect(group.children).toHaveLength(stocked?6:5);
      expect(box.min.y).toBeCloseTo(0,6);
      expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0,6);
      expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0,6);
      for(const axis of axes)expect(box.getSize(new THREE.Vector3()).getComponent(axis)).toBeCloseTo(bounds[axis],6);
      expect(bounds[0]).toBeLessThanOrEqual(fixture.widthM);
      expect(bounds[2]).toBeLessThanOrEqual(fixture.depthM);
      expect(bounds[1]-fixture.heightM).toBeCloseTo(.06,8);
      disposeShelfGroupReplacement(group);
    }
  });
});
