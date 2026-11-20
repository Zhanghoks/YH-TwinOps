import { describe,expect,it } from 'vitest';
import * as THREE from 'three';
import { layout } from '../data';
import { generatePlanningLayout } from './planningLayout';
import { buildCheckoutReplacement,isDenseCheckoutReplacement } from './checkoutReplacement';
import { disposeCheckoutReplacement,makeCheckoutReplacement } from './checkoutReplacementThree';
import { buildFixtureDetail, type DetailPart } from './detailGeometry';

const dense=generatePlanningLayout(layout).layout;
const fixture=dense.fixtures.find(f=>f.fixtureId==='F120');
if(!fixture)throw new Error('Missing F120');
const EPS=1e-8;
const axes=[0,1,2] as const;
const min=(p:DetailPart,i:0|1|2)=>p.position[i]-p.size[i]/2;
const max=(p:DetailPart,i:0|1|2)=>p.position[i]+p.size[i]/2;

describe('F120 long narrow checkout trial',()=>{
  it('rejects non-identical footprint, zone, handed position and yaw, including the baseline site',()=>{
    const baseline=layout.fixtures.find(f=>f.fixtureId==='F120');
    if(!baseline)throw new Error('Missing baseline fixture');
    expect(isDenseCheckoutReplacement(fixture)).toBe(true);
    for(const f of [baseline,{...fixture,x:0},{...fixture,z:0},{...fixture,widthM:2.5},{...fixture,depthM:1.12},
      {...fixture,rotationY:Math.PI/2},{...fixture,zoneId:'zone-checkout_s'},{...fixture,fixtureId:'F121'}]){
      expect(buildCheckoutReplacement(f)).toBeNull();
    }
  });
  it.each(['near','far'] as const)('keeps exact footprint and original products in %s',lod=>{
    const before=structuredClone(fixture);
    const old=buildFixtureDetail(fixture).filter(p=>p.material==='product');
    for(const stocked of [true,false]){
      const model=buildCheckoutReplacement(fixture,{stocked,lod});
      if(!model)throw new Error('Missing F120 model');
      expect(model.replacementEnvelopeM).toEqual([fixture.widthM,fixture.heightM,fixture.depthM]);
      expect(model.sourceItemCount).toBe(2);
      const g=makeCheckoutReplacement(model);
      const bounds=new THREE.Box3().setFromObject(g);
      const size=bounds.getSize(new THREE.Vector3());
      expect(bounds.min.y).toBeCloseTo(0,6);
      expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(0,6);
      expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(0,6);
      expect(size.x).toBeCloseTo(1.5,6); expect(size.y).toBeCloseTo(1.05,6); expect(size.z).toBeCloseTo(5.5,6);
      expect(g.children.length).toBeLessThan(40);
      const goods=model.parts.filter(p=>p.material==='product');
      expect(goods.length).toBe(stocked?2:0);
      const belt=model.parts.find(p=>p.id==='belt');
      if(!belt)throw new Error('Missing belt');
      for(const p of goods){
        const source=old.find(s=>s.id===p.id);
        if(!source)throw new Error('Missing source package');
        expect([p.size,p.primitive,p.color,p.material]).toEqual([source.size,source.primitive,source.color,source.material]);
        expect(p.position[0]).toBe(source.position[0]);
        expect(p.position[2]).toBe(source.position[2]);
        expect(min(p,1)).toBeCloseTo(max(belt,1),8);
        expect(axes.every(i=>i===1||(min(p,i)>min(belt,i)&&max(p,i)<max(belt,i)))).toBe(true);
        const interferes=model.parts.some(q=>q.id!==p.id&&axes.every(i=>min(p,i)<max(q,i)-EPS&&max(p,i)>min(q,i)+EPS));
        expect(interferes).toBe(false);
      }
      disposeCheckoutReplacement(g);
    }
    expect(fixture).toEqual(before);
  });

  it('preserves handling orientation, with each work action anchored and body-space clear',()=>{
    const model=buildCheckoutReplacement(fixture);
    if(!model)throw new Error('Missing F120 model');
    expect(model.customerSide).toBe('+X'); expect(model.staffSide).toBe('-X');
    expect(model.itemFlow).toEqual(['-Z','+Z']);
    expect(model.actions.map(a=>a.contact[2])).toEqual([...model.actions.map(a=>a.contact[2])].sort((a,b)=>a-b));
    const pos=model.parts.find(p=>p.id==='pos-screen'),posFrame=model.parts.find(p=>p.id==='pos-screen-frame');
    if(!pos||!posFrame)throw new Error('Missing staff-facing POS');
    expect(max(pos,0)).toBeCloseTo(min(posFrame,0),8);
    for(const action of model.actions){
      const [sx,sz]=action.stand;
      expect(Math.sign(sx)).toBe(action.role==='staff'?-1:1);
      expect(Math.abs(sx)-fixture.widthM/2).toBeGreaterThanOrEqual(.4);
      expect(action.reachM).toBeCloseTo(Math.hypot(sx-action.contact[0],sz-action.contact[2]),8);
      expect(action.reachM).toBeLessThanOrEqual(.69); // design assumption; not ergonomic certification
      const work=model.parts.find(p=>p.id===action.workPartId);
      if(!work)throw new Error('Missing work surface '+action.workPartId);
      expect(action.contact[1]).toBeCloseTo(max(work,1),8);
      const lo=(i:0|1|2)=>action.contact[i]-(i===1?0:action.handSpaceM[i]/2);
      const hi=(i:0|1|2)=>action.contact[i]+(i===1?action.handSpaceM[i]:action.handSpaceM[i]/2);
      for(const i of [0,2] as const){
        expect(lo(i)).toBeGreaterThanOrEqual(min(work,i)-EPS);
        expect(hi(i)).toBeLessThanOrEqual(max(work,i)+EPS);
      }
      expect(model.parts.filter(p=>axes.every(i=>lo(i)<max(p,i)-EPS&&hi(i)>min(p,i)+EPS))).toEqual([]);
    }
  });

  it('allows a standalone mirror but does not reverse merchandise ordering or change the footprint',()=>{
    const base=buildCheckoutReplacement(fixture),mirror=buildCheckoutReplacement(fixture,{mirror:true});
    if(!base||!mirror)throw new Error('Missing model');
    expect(mirror.customerSide).toBe('-X');expect(mirror.staffSide).toBe('+X');
    expect(mirror.itemFlow).toEqual(base.itemFlow);
    expect(mirror.envelopeM).toEqual(base.envelopeM);
    for(const p of mirror.parts){
      const original=base.parts.find(s=>s.id===p.id);
      if(!original)throw new Error('Missing unmirrored part');
      expect(p.position).toEqual([-original.position[0],original.position[1],original.position[2]]);
    }
    expect(mirror.actions.map(a=>a.stand[0])).toEqual(base.actions.map(a=>-a.stand[0]));
  });
});
