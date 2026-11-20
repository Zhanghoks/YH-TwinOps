import {expect,it} from 'vitest';
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {layout} from '../data';
import {generatePlanningLayout} from './planningLayout';
import {buildFixtureDetail} from './detailGeometry';
import {buildServiceGroupReplacement} from './serviceGroupReplacement';
import {makeServiceGroupReplacement,disposeServiceGroupReplacement} from './serviceGroupReplacementThree';
const dense=generatePlanningLayout(layout).layout;
for(const id of ['F074','F007']){
 const f=dense.fixtures.find(f=>f.fixtureId===id)!;
 it(`${id} strictly guards dense fixture and preserves source merchandise/lining identities`,()=>{
  const before=JSON.stringify(f),m=buildServiceGroupReplacement(f)!;expect(m).not.toBeNull();
  const old=buildFixtureDetail(f),goods=old.filter(p=>id==='F074'?/^chilled-pack-/.test(p.id):/^fresh-item-/.test(p.id));
  expect(m.placements.filter(p=>p.role==='product').map(p=>p.sourceId).sort()).toEqual(goods.map(p=>p.id).sort());
  expect(m.audit.productCount).toBe(id==='F074'?30:24);expect(m.audit.liningCount).toBe(id==='F074'?0:4);
  for(const p of m.placements){expect(p.sourcePart).toEqual(old.find(x=>x.id===p.sourceId));expect(p.renderPart.color).toBe(p.sourcePart.color);expect(p.renderPart.primitive).toBe(p.sourcePart.primitive);if(p.role==='product')expect(p.renderPart).toEqual(p.sourcePart);expect(p.scale).toBeGreaterThan(0);expect(p.scale).toBeLessThanOrEqual(1);}
  for(const changed of [layout.fixtures.find(x=>x.fixtureId===id)!,{...f,x:f.x+.001},{...f,zoneId:'bad'},{...f,fixtureType:'GONDOLA' as const},{...f,rotationY:.01},{...f,heightM:f.heightM+.01}])expect(buildServiceGroupReplacement(changed)).toBeNull();expect(JSON.stringify(f)).toBe(before);
 });
 it(`${id} near/far and empty/stocked fit original footprint and preserve counts in batched output`,()=>{
  for(const lod of ['near','far'] as const)for(const stocked of [true,false])for(const batch of [true,false]){
   const m=buildServiceGroupReplacement(f,{lod,stocked})!,g=makeServiceGroupReplacement(m,{batch}),b=new THREE.Box3().setFromObject(g);
   expect(b.min.x).toBeGreaterThanOrEqual(-f.widthM/2-1e-6);expect(b.max.x).toBeLessThanOrEqual(f.widthM/2+1e-6);expect(b.min.z).toBeGreaterThanOrEqual(-f.depthM/2-1e-6);expect(b.max.z).toBeLessThanOrEqual(f.depthM/2+1e-6);expect(b.max.y).toBeLessThanOrEqual(m.replacementEnvelopeM[1]+1e-6);expect(g.userData.productCount).toBe(stocked?(id==='F074'?30:24):0);if(batch)expect(g.children.length).toBeLessThan(15);disposeServiceGroupReplacement(g);
  }
 });
 it(`${id} actual world product and lining OBBs do not overlap; bottoms contact tray or lining`,()=>{
  for(const lod of ['near','far'] as const){const m=buildServiceGroupReplacement(f,{lod})!,g=makeServiceGroupReplacement(m,{batch:false,products:'legacy'});g.position.set(f.x,f.y,f.z);g.rotation.y=f.rotationY;g.updateMatrixWorld(true);
   // This unit-primitive OBB proof intentionally checks the legacy envelope.
   // Detailed actual vertices/structural and pair safety are covered independently
   // by merchandiseReplacementSafety.test.ts, without assuming child[0] is a mesh.
   const boxes=m.placements.map(p=>{const mesh=g.children.find(o=>o.name===p.sourceId)!.children[0] as THREE.Mesh;const box=new OBB(new THREE.Vector3(),new THREE.Vector3(.5,.5,.5)).applyMatrix4(mesh.matrixWorld);box.halfSize.addScalar(-1e-7);return box;});
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)expect(boxes[i]!.intersectsOBB(boxes[j]!),`${m.placements[i]!.sourceId}/${m.placements[j]!.sourceId}`).toBe(false);
   for(const p of m.placements){const mount=m.frame.mounts.find(x=>x.id===p.mountId)!;expect(m.frame.parts.some(s=>s.id===mount.supportId)).toBe(true);const lining=m.placements.find(x=>x.role==='tray-lining'&&x.moduleIndex===p.moduleIndex&&x.mountId===p.mountId);const floor=p.role==='product'&&lining?lining.renderPart.size[1]:0;expect(p.localCenter[1]-p.renderPart.size[1]*p.scale/2).toBeCloseTo(floor,10);for(const axis of [0,2] as const)expect(Math.abs(p.localCenter[axis])+p.renderPart.size[axis]*p.scale/2).toBeLessThanOrEqual(mount.size[axis]/2+1e-8);}
   disposeServiceGroupReplacement(g);
  }
 });
 it(`${id} conservative solid boxes keep all merchandise clear of glass, lips, supports and air paths`,()=>{
  for(const lod of ['near','far'] as const){const m=buildServiceGroupReplacement(f,{lod})!;
   for(const p of m.placements)for(const offset of m.offsets)for(const solid of m.frame.parts){
    // All goods are axis-aligned. Full AABBs of even curved glass are conservative.
    const collision=([0,1,2] as const).every(k=>Math.min(p.anchor[k]+p.localCenter[k]+p.renderPart.size[k]*p.scale/2,offset[k]+solid.max[k])-Math.max(p.anchor[k]+p.localCenter[k]-p.renderPart.size[k]*p.scale/2,offset[k]+solid.min[k])>1e-7);
    expect(collision,`${id} ${p.sourceId} against ${solid.id}`).toBe(false);
   }
  }
 });
}
