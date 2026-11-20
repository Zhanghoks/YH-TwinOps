import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildRetailFixture } from './retailFixture';
import { disposeRetailFixture, makeRetailFixture } from './retailFixtureThree';

const AXES=[0,1,2] as const;
const EPS=1e-8;
const cases=[
  {kind:'produce',x:1.220,y:.940,z:1.450,count:8},
  {kind:'service',x:1.955,y:1.290,z:1.086,count:4},
  {kind:'checkout',x:2.5,y:1.150,z:1.120,count:2},
] as const;

describe('empty dimensioned retail fixtures',()=>{
  it.each(cases)('makes $kind with exact geometry bounds and consistent LOD mounting metadata',({kind,x,y,z,count})=>{
    const data=buildRetailFixture(kind),low=buildRetailFixture(kind,{},'low');
    expect(data.mounts).toHaveLength(count);
    expect(low.mounts).toEqual(data.mounts);
    expect(low.parts.length).toBeLessThan(data.parts.length);
    for(const d of [data,low]){
      const g=makeRetailFixture(d);
      const box=new THREE.Box3().setFromObject(g);
      const size=box.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(x,6);
      expect(size.y).toBeCloseTo(y,6);
      expect(size.z).toBeCloseTo(z,6);
      expect(box.min.y).toBeCloseTo(0,6);
      expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0,6);
      expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0,6);
      expect(new Set(d.parts.map(p=>p.id)).size).toBe(d.parts.length);
      expect(d.parts.every(p=>AXES.every(i=>p.max[i]>p.min[i]))).toBe(true);
      disposeRetailFixture(g);
    }
  });

  it.each(cases)('supports every $kind mount on its real surface without intersections from other parts', ({kind})=>{
    for(const overrides of [{},{width:1100,depth:700,height:920}]){
      const d=buildRetailFixture(kind,overrides);
      const group=makeRetailFixture(d);
      group.updateMatrixWorld(true);
      for(const m of d.mounts){
        const support=group.getObjectByName(m.supportId);
        if(!support)throw new Error('Missing mount support '+m.id);
        const [x,y,z]=m.anchor;
        const ray=new THREE.Raycaster(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(support)[0];
        expect(hit?.point.y).toBeCloseTo(y,6);
        expect(m.size.every(n=>n>0)).toBe(true);
        const points:THREE.Vector3[]=[];
        const axis=new THREE.Vector3(1,0,0);
        const origin=new THREE.Vector3(...m.anchor);
        for(const px of [-m.size[0]/2,m.size[0]/2]) for(const py of [0,m.size[1]]) for(const pz of [-m.size[2]/2,m.size[2]/2]){
          points.push(new THREE.Vector3(px,py,pz).applyAxisAngle(axis,m.pitchRad).add(origin));
        }
        const region=new THREE.Box3().setFromPoints(points);
        // Sloped mount's AABB can include its host slope, so exclude that one
        // part; all other geometry is conservatively tested against the AABB.
        expect(d.parts.filter(p=>p.id!==m.supportId&&p.min[0]<region.max.x-EPS&&p.max[0]>region.min.x+EPS&&
          p.min[1]<region.max.y-EPS&&p.max[1]>region.min.y+EPS&&p.min[2]<region.max.z-EPS&&p.max[2]>region.min.z+EPS)).toEqual([]);
      }
      disposeRetailFixture(group);
    }
  });

  it('gives the produce island mirrored ten-degree trays and independent bin mounts',()=>{
    const d=buildRetailFixture('produce');
    expect(d.mounts.filter(m=>m.side==='front')).toHaveLength(4);
    expect(d.mounts.filter(m=>m.side==='back')).toHaveLength(4);
    expect(d.parts.filter(p=>p.id.startsWith('front-retainer-'))).toHaveLength(2);
    for(const m of d.mounts)expect(Math.abs(m.pitchRad)).toBeCloseTo(Math.PI/18,8);
    expect(d.mounts.filter(m=>m.side==='front').every(m=>m.pitchRad>0)).toBe(true);
  });

  it('shows through a real glass front, leaves a rear opening and has a separate operation deck',()=>{
    const d=buildRetailFixture('service'),g=makeRetailFixture(d);
    g.updateMatrixWorld(true);
    const glass=g.getObjectByName('curved-front-glass');
    if(!(glass instanceof THREE.Mesh)||!(glass.material instanceof THREE.MeshStandardMaterial))throw new Error('Missing glass');
    expect(glass.material.transparent).toBe(true);
    expect(glass.material.depthWrite).toBe(false);
    const ray=(z:number)=>new THREE.Raycaster(new THREE.Vector3(0,1.05,z),new THREE.Vector3(0,0,z>0?-1:1));
    expect(ray(2).intersectObject(g,true)[0]?.object).toBe(glass);
    // From the staff rear, the first hit is the far glass, not a hidden rear wall.
    expect(ray(-2).intersectObject(g,true)[0]?.object).toBe(glass);
    expect(d.parts.some(p=>p.id==='rear-operation-deck')).toBe(true);
    expect(d.parts.find(p=>p.id==='curved-front-glass')?.profile).toHaveLength(14);
    disposeRetailFixture(g);
  });

  it('keeps belt and bagging plane at 860 mm while separating the screen sides',()=>{
    const d=buildRetailFixture('checkout');
    expect(d.mounts.map(m=>m.anchor[1])).toEqual([.86,.86]);
    expect(d.mounts.map(m=>m.role)).toEqual(['conveyor','bagging']);
    const operator=d.parts.find(p=>p.id==='operator-terminal-display');
    const customer=d.parts.find(p=>p.id==='customer-payment-screen');
    expect(operator?.max[2]).toBeLessThan(0);
    expect(customer?.min[2]).toBeGreaterThan(0);
    expect(d.parts.some(p=>p.id==='scanner-window')).toBe(true);
  });

  it('keeps display fascia unoccluded and staff-side equipment pods recessed',()=>{
    const service=buildRetailFixture('service');
    const fascia=service.parts.find(p=>p.id==='front-brand-free-fascia');
    const base=service.parts.find(p=>p.id==='insulated-base');
    expect(fascia?.min[2]).toBe(base?.max[2]);
    expect(fascia?.max[2]).toBeGreaterThan(base?.max[2] ?? 0);
    const checkout=buildRetailFixture('checkout');
    const pods=checkout.parts.filter(p=>p.id.endsWith('-pod')||p.id==='operator-console-support');
    expect(pods).toHaveLength(3);
    expect(pods.every(p=>p.min[2]>-.46)).toBe(true);
    expect(checkout.parts.filter(p=>p.id.startsWith('conveyor-edge-rail-'))).toHaveLength(2);
  });

  it('rejects unsupported envelope dimensions',()=>{
    expect(()=>buildRetailFixture('checkout',{height:480})).toThrow(RangeError);
    expect(()=>buildRetailFixture('service',{depth:500})).toThrow(RangeError);
    expect(()=>buildRetailFixture('produce',{width:Number.NaN})).toThrow(RangeError);
  });
});
