import { describe,expect,it } from 'vitest';
import * as THREE from 'three';
import { layout } from '../data';
import { generatePlanningLayout } from './planningLayout';
import { buildF032Replacement, isDenseF032Fixture } from './f032Replacement';
import { disposeF032Replacement, makeF032Replacement } from './f032ReplacementThree';
import { buildShelfPlanogram, buildMerchandise } from './shelfDisplay';
import type { DetailPart } from './detailGeometry';

const dense=generatePlanningLayout(layout).layout.fixtures.find(f=>f.fixtureId==='F032');
if(!dense)throw new Error('Missing dense F032 fixture');
const EPS=1e-8;
const axes=[0,1,2] as const;
const min=(p:DetailPart,i:0|1|2)=>p.position[i]-p.size[i]/2;
const max=(p:DetailPart,i:0|1|2)=>p.position[i]+p.size[i]/2;

describe('reversible F032-only showcase',()=>{
  it('rejects the baseline same ID, other fixtures and any materially different origin or yaw',()=>{
    expect(isDenseF032Fixture(dense)).toBe(true);
    const baseline=layout.fixtures.find(f=>f.fixtureId==='F032');
    if(!baseline)throw new Error('Missing baseline F032 fixture');
    for(const f of [baseline,{...dense,fixtureId:'F031'},{...dense,z:dense.z+1},{...dense,rotationY:.1},{...dense,zoneId:'zone-packaged'}]){
      expect(isDenseF032Fixture(f)).toBe(false);
      expect(buildF032Replacement(f)).toBeNull();
    }
  });
  it('keeps every item ID, model, material, color and native part geometry with an audited fit scale',()=>{
    const before=structuredClone(dense);
    const original=buildShelfPlanogram(dense);
    const replacement=buildF032Replacement(dense);
    if(!replacement)throw new Error('Missing replacement');
    expect(dense).toEqual(before);
    expect(replacement.sourceItemCount).toBe(256);
    expect(replacement.placements).toHaveLength(original.length);
    expect(new Set(replacement.placements.map(p=>p.sourceId))).toEqual(new Set(original.map(p=>p.id)));
    expect(replacement.placements.filter(p=>p.scale<1)).toHaveLength(42);
    expect(replacement.placements.filter(p=>p.slot.level===4)).toHaveLength(40);
    for(const p of replacement.placements){
      const old=original.find(i=>i.id===p.sourceId);
      if(!old)throw new Error('Missing original product');
      expect(p.sourceSlot).toEqual(old);
      expect(p.scale).toBeGreaterThan(.944);
      expect(p.scale).toBeLessThanOrEqual(1);
      const parts=buildMerchandise(old);
      expect(parts.length).toBe(p.merchandise.length);
      for(const [index,part] of p.merchandise.entries()){
        const q=parts[index];
        if(!q)throw new Error('Top graphics changed original article');
        expect([part.id,part.primitive,part.color,part.material]).toEqual([q.id,q.primitive,q.color,q.material]);
        for(const i of axes){
          expect(part.size[i]).toBeCloseTo(q.size[i]*p.scale,9);
          expect(part.position[i]-p.slot.anchor[i]).toBeCloseTo((q.position[i]-old.anchor[i])*p.scale,9);
        }
      }
    }
  });

  it('supports all merchandise across five decks and two sides without penetrating structure or neighbors',()=>{
    const model=buildF032Replacement(dense);
    if(!model)throw new Error('Missing replacement');
    const byMount=new Map<string,typeof model.placements[number][]>();
    for(const p of model.placements){
      const off=model.rackOffsetsM[p.rackIndex];
      if(off===undefined)throw new Error('Missing rack offset');
      const mountId=p.rackIndex+'-'+p.mount.id;
      let others=byMount.get(mountId);
      if(!others){others=[];byMount.set(mountId,others);}
      others.push(p);
      const [x,y,z]=p.mount.anchor;
      const [w,h,d]=p.mount.size;
      expect(Math.min(...p.merchandise.map(a=>min(a,1)))).toBeCloseTo(y,9);
      for(const a of p.merchandise){
        expect(min(a,0)).toBeGreaterThanOrEqual(x+off-w/2-EPS);
        expect(max(a,0)).toBeLessThanOrEqual(x+off+w/2+EPS);
        expect(min(a,1)).toBeGreaterThanOrEqual(y-EPS);
        expect(max(a,1)).toBeLessThanOrEqual(y+h+EPS);
        expect(min(a,2)).toBeGreaterThanOrEqual(z-d/2-EPS);
        expect(max(a,2)).toBeLessThanOrEqual(z+d/2+EPS);
        for(const structure of model.frame.parts){
          expect(axes.some(i=>max(a,i)<=structure.min[i]+(i===0?off:0)+EPS
            ||min(a,i)>=structure.max[i]+(i===0?off:0)-EPS)).toBe(true);
        }
      }
    }
    expect(byMount.size).toBe(60);
    for(const others of byMount.values())for(const [i,p] of others.entries())for(const q of others.slice(i+1)){
      expect(Math.min(...q.merchandise.map(a=>min(a,0)))-Math.max(...p.merchandise.map(a=>max(a,0)))).toBeGreaterThan(.005);
    }
  });

  it.each(['near','far'] as const)('renders exact empty and filled envelopes in %s with bounded batching',lod=>{
    for(const stocked of [false,true]){
      const data=buildF032Replacement(dense,{stocked,lod});
      if(!data)throw new Error('Missing replacement');
      expect(data.sourceItemCount).toBe(256);
      expect(data.placements).toHaveLength(stocked?256:0);
      expect(data.frame.parts.some(a=>a.type==='sheet')).toBe(lod==='near');
      const batch=makeF032Replacement(data);
      expect(batch.children.length).toBeLessThanOrEqual(7);
      const bounds=new THREE.Box3().setFromObject(batch);
      const size=bounds.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(7.2,6);
      expect(size.y).toBeCloseTo(1.6,6);
      expect(size.z).toBeCloseTo(1,6);
      expect(bounds.min.y).toBeCloseTo(0,6);
      expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(0,6);
      const named=makeF032Replacement(data,{batch:false});
      const triangleCount=(object:THREE.Object3D)=>{
        let triangles=0;
        object.traverse(n=>{
          if(n instanceof THREE.Mesh)triangles+=(n.geometry.index?.count ?? n.geometry.getAttribute('position').count)/3;
        });
        return triangles;
      };
      expect(triangleCount(batch)).toBe(triangleCount(named));
      expect(named.getObjectByName('F032 original products')?.children.length??0).toBe(stocked?256:0);
      for(const p of data.placements){
        const item=named.getObjectByName('F032-item-'+p.sourceId);
        expect(item?.children.length).toBeGreaterThan(0);
      }
      disposeF032Replacement(batch);
      disposeF032Replacement(named);
    }
  });
});
