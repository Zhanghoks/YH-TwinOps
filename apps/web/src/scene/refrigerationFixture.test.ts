import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildRefrigerationFixture, type RefrigerationFixtureKind } from './refrigerationFixture';
import { disposeRefrigerationFixture, makeRefrigerationFixture } from './refrigerationFixtureThree';

const axes=[0,1,2] as const;
const EPS=1e-8;
const specs=[
  {kind:'island',dimensions:[2502,833,853],mounts:2,levels:1,panes:2},
  {kind:'upright',dimensions:[1350,2035,908],mounts:10,levels:5,panes:2},
  {kind:'open',dimensions:[2580,2090,915],mounts:10,levels:5,panes:0},
] as const;

function mesh(group:THREE.Group,id:string):THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>{
  const m=group.getObjectByName(id);
  if (!(m instanceof THREE.Mesh) || !(m.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing mesh: '+id);
  return m;
}

describe('empty dimensioned refrigeration fixtures',()=>{
  it.each(specs)('matches exact $kind exterior and shelf count in both LODs',({kind,dimensions,mounts,levels,panes})=>{
    const model=buildRefrigerationFixture(kind);
    const low=buildRefrigerationFixture(kind,{},'low');
    expect(low.mounts).toEqual(model.mounts);
    expect(low.parts.length).toBeLessThan(model.parts.length);
    for(const d of [model,low]){
      const group=makeRefrigerationFixture(d), bbox=new THREE.Box3().setFromObject(group);
      expect(bbox.min.y).toBeCloseTo(0,6);
      for(const i of axes)expect(bbox.getSize(new THREE.Vector3()).getComponent(i)).toBeCloseTo(dimensions[i]/1000,6);
      expect(bbox.getCenter(new THREE.Vector3()).x).toBeCloseTo(0,6);
      expect(bbox.getCenter(new THREE.Vector3()).z).toBeCloseTo(0,6);
      expect(d.mounts).toHaveLength(mounts);
      expect(new Set(d.mounts.map(a=>a.level)).size).toBe(levels);
      expect(new Set(d.parts.map(a=>a.id)).size).toBe(d.parts.length);
      expect(d.parts.filter(p=>p.finish==='glass')).toHaveLength(panes);
      expect(d.parts.every(p=>axes.every(i=>p.max[i]>p.min[i]))).toBe(true);
      expect(group.children.length).toBeLessThan(65);
      disposeRefrigerationFixture(group);
    }
  });

  it.each(specs)('keeps $kind load mounts anchored to the cavity floor or real shelf with no solid intersections',({kind})=>{
    for(const dims of [{},{width:950,depth:590,height:kind==='island'?660:1700}]){
      const model=buildRefrigerationFixture(kind,dims);
      for(const m of model.mounts){
        const deck=model.parts.find(p=>p.id===m.supportId);
        if (!deck) throw new Error('Missing support for '+m.id);
        expect(m.anchor[1]).toBe(deck.max[1]);
        expect(m.size.every(n=>n>0)).toBe(true);
        const low=(axis:0|1|2)=>m.anchor[axis]-(axis===1?0:m.size[axis]/2);
        const high=(axis:0|1|2)=>m.anchor[axis]+(axis===1?m.size[axis]:m.size[axis]/2);
        for(const i of [0,2] as const){
          expect(low(i)).toBeGreaterThanOrEqual(deck.min[i]-EPS);
          expect(high(i)).toBeLessThanOrEqual(deck.max[i]+EPS);
        }
        expect(model.parts.filter(p=>axes.every(i=>low(i)<p.max[i]-EPS&&high(i)>p.min[i]+EPS))).toEqual([]);
      }
    }
  });

  it('uses independent transparent glass; slide panes overlap laterally but are vertically separated',()=>{
    for (const kind of ['island','upright'] as const){
      const model=buildRefrigerationFixture(kind),group=makeRefrigerationFixture(model);
      const [a,b]=model.parts.filter(p=>p.finish==='glass');
      if (!a || !b) throw new Error('Missing independent panes');
      expect(mesh(group,a.id)).not.toBe(mesh(group,b.id));
      for(const p of [a,b]){
        const m=mesh(group,p.id);
        expect(m.material.transparent).toBe(true);
        expect(m.material.opacity).toBeGreaterThan(0);
        expect(m.material.opacity).toBeLessThan(.35);
        expect(m.material.depthWrite).toBe(false);
        expect(m.castShadow).toBe(false);
      }
      if(kind==='island'){
        expect(a.max[0]).toBeGreaterThan(b.min[0]);
        expect(a.max[1]).toBeLessThan(b.min[1]);
        expect(model.parts.filter(p=>p.id.startsWith('lid-track-lower-'))).toHaveLength(2);
        expect(model.parts.filter(p=>p.id.startsWith('lid-track-upper-'))).toHaveLength(2);
      } else {
        expect(model.parts.filter(p=>p.id.startsWith('door-hinge-'))).toHaveLength(4);
        expect(model.parts.filter(p=>/^door-pull-\d$/.test(p.id))).toHaveLength(2);
      }
      disposeRefrigerationFixture(group);
    }
  });

  it('leaves a visible real cavity from each customer view',()=>{
    const ray=(group:THREE.Group, from:THREE.Vector3,dir:THREE.Vector3)=>{
      group.updateMatrixWorld(true);
      return [...new Set(new THREE.Raycaster(from,dir).intersectObject(group,true).map(r=>r.object.name))];
    };
    const groups=Object.fromEntries(specs.map(({kind})=>[kind,makeRefrigerationFixture(buildRefrigerationFixture(kind))]));
    const island=groups.island;
    const upright=groups.upright;
    const open=groups.open;
    if(!island||!upright||!open)throw new Error('Missing cabinet');
    const overhead=ray(island,new THREE.Vector3(-.35,2,0),new THREE.Vector3(0,-1,0));
    expect(overhead.slice(0,2)).toEqual(['sliding-pane-0','cavity-floor']);
    const door=ray(upright,new THREE.Vector3(-.29,1,2),new THREE.Vector3(0,0,-1));
    expect(door.slice(0,2)).toEqual(['door-glass-0','rear-cavity-liner']);
    const air=ray(open,new THREE.Vector3(.2,1,2),new THREE.Vector3(0,0,-1));
    expect(air[0]).toBe('rear-cavity-liner');
    for(const group of Object.values(groups))disposeRefrigerationFixture(group);
  });

  it('keeps an open face and four modeled 500 mm decks in the default air-curtain cabinet',()=>{
    const open=buildRefrigerationFixture('open');
    expect(open.parts.some(p=>p.finish==='glass')).toBe(false);
    expect(open.parts.some(p=>p.id==='floor-air-return')).toBe(true);
    expect(open.parts.some(p=>p.id==='top-discharge-nozzle')).toBe(true);
    expect(open.parts.some(p=>p.id==='canopy-cavity-led')).toBe(true);
    const upperDecks=open.parts.filter(p=>/^deck-[1-4]$/.test(p.id));
    expect(upperDecks).toHaveLength(4);
    for(const shelf of upperDecks)expect(shelf.max[2]-shelf.min[2]).toBeCloseTo(.5,9);
  });

  it('rejects envelopes outside the supported family',()=>{
    for (const kind of ['island','upright','open'] satisfies RefrigerationFixtureKind[]){
      expect(()=>buildRefrigerationFixture(kind,{width:NaN})).toThrow(RangeError);
      expect(()=>buildRefrigerationFixture(kind,{depth:280})).toThrow(RangeError);
      expect(()=>buildRefrigerationFixture(kind,{height:3200})).toThrow(RangeError);
    }
  });
});
