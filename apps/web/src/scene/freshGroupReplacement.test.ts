import {expect,it} from 'vitest';
import * as THREE from 'three';
import {layout} from '../data';
import {generatePlanningLayout} from './planningLayout';
import {buildFixtureDetail} from './detailGeometry';
import {buildFreshGroupReplacement} from './freshGroupReplacement';
import {makeFreshGroupReplacement,disposeFreshGroupReplacement} from './freshGroupReplacementThree';
const dense=generatePlanningLayout(layout).layout;
for(const id of ['F029','F050']){
 const f=dense.fixtures.find(f=>f.fixtureId===id)!;
 it(`${id} guards source, preserves independent merchandise, mounts bottom on support`,()=>{
  const before=JSON.stringify(f),m=buildFreshGroupReplacement(f)!;expect(m).not.toBeNull();
  const old=buildFixtureDetail(f).filter(p=>id==='F029'?/^crate-\d-\d-fruit-\d+$/.test(p.id):/^chilled-pack-/.test(p.id));
  expect(m.placements.map(p=>p.sourceId).sort()).toEqual(old.map(p=>p.id).sort());expect(m.sourceItemCount).toBe(id==='F029'?144:30);
  for(const p of m.placements){expect(p.sourcePart).toEqual(old.find(o=>o.id===p.sourceId));expect(p.localCenter[1]-p.sourcePart.size[1]*p.scale/2).toBeCloseTo(0);expect(p.scale).toBeGreaterThan(.25);expect(p.scale).toBeLessThanOrEqual(1);
   const mount=m.frame.mounts.find(x=>x.id===p.mountId)!;expect(Math.abs(p.localCenter[0])+p.sourcePart.size[0]*p.scale/2).toBeLessThanOrEqual(mount.size[0]/2+1e-8);expect(Math.abs(p.localCenter[2])+p.sourcePart.size[2]*p.scale/2).toBeLessThanOrEqual(mount.size[2]/2+1e-8);expect(p.sourcePart.size[1]*p.scale).toBeLessThanOrEqual(mount.size[1]+1e-8);
  }
  for(const wrong of [layout.fixtures.find(x=>x.fixtureId===id)!,{...f,x:f.x+.001},{...f,zoneId:'bad'},{...f,rotationY:f.rotationY+.01},{...f,heightM:f.heightM+.01}])expect(buildFreshGroupReplacement(wrong)).toBeNull();expect(JSON.stringify(f)).toBe(before);
 });
 it(`${id} near/far counts stable, empty valid, local bounds and batching preserve products`,()=>{
  for(const lod of ['near','far'] as const)for(const stocked of [true,false]){
   const m=buildFreshGroupReplacement(f,{stocked,lod})!;expect(m.placements.length).toBe(stocked?m.sourceItemCount:0);
   for(const batch of [true,false]){const g=makeFreshGroupReplacement(m,{batch}),box=new THREE.Box3().setFromObject(g);expect(box.min.x).toBeGreaterThanOrEqual(-f.widthM/2-1e-6);expect(box.max.x).toBeLessThanOrEqual(f.widthM/2+1e-6);expect(box.min.z).toBeGreaterThanOrEqual(-f.depthM/2-1e-6);expect(box.max.z).toBeLessThanOrEqual(f.depthM/2+1e-6);expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);expect(g.userData.productCount).toBe(stocked?m.sourceItemCount:0);if(batch)expect(g.children.length).toBeLessThan(15);disposeFreshGroupReplacement(g);}
  }
 });
}

// Frame solids are X-extruded convex Y/Z sections. Work in fixture coordinates:
// applying the same source yaw/origin to both objects cannot change intersection.
type Section=readonly (readonly [number,number])[];
function sectionsOverlap(a:Section,b:Section):boolean {
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i]!,q=poly[(i+1)%poly.length]!,ny=-(q[1]-p[1]),nz=q[0]-p[0],length=Math.hypot(ny,nz);
  if(length<1e-10)continue;
  const project=(s:Section)=>s.map(v=>(v[0]*ny+v[1]*nz)/length);
  const aa=project(a),bb=project(b);
  if(Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb))<=1e-7)return false;
 }
 return true;
}

for(const id of ['F029','F050']) {
 const f=dense.fixtures.find(f=>f.fixtureId===id)!;
 it(`${id} checks same-mount product pairs and actual world OBB pairs across every mount/module`,async()=>{
  const {OBB}=await import('three/addons/math/OBB.js');
  for(const lod of ['near','far'] as const){
   const m=buildFreshGroupReplacement(f,{lod})!,group=makeFreshGroupReplacement(m,{batch:false,products:'legacy'});
   group.position.set(f.x,f.y,f.z);group.rotation.y=f.rotationY;group.updateMatrixWorld(true);
   // Legacy unit-primitive OBB proof; detailed actual-vertex containment and
   // independent envelope-pair/structure SAT are in merchandiseReplacementSafety.test.ts.
   const world=m.placements.map(p=>{
    const parent=group.children.find(o=>o.name===p.sourceId)!;const mesh=parent.children[0] as THREE.Mesh;
    // Full unit primitive box bounds enclose both near sphere and far octahedron.
    // Using the actual rendered matrix also verifies fixture yaw + mount pitch composition.
    const box=new OBB(new THREE.Vector3(),new THREE.Vector3(.5,.5,.5)).applyMatrix4(mesh.matrixWorld);
    box.halfSize.addScalar(-1e-7);return box;
   });
   for(let i=0;i<m.placements.length;i++)for(let j=i+1;j<m.placements.length;j++){
    const a=m.placements[i]!,b=m.placements[j]!;
    if(a.moduleIndex===b.moduleIndex&&a.mountId===b.mountId){
     const intersects=([0,1,2] as const).every(k=>Math.abs(a.localCenter[k]-b.localCenter[k])<(a.sourcePart.size[k]*a.scale+b.sourcePart.size[k]*b.scale)/2-1e-7);
     expect(intersects,`${id} same mount ${a.sourceId}/${b.sourceId}`).toBe(false);
    }
    expect(world[i]!.intersectsOBB(world[j]!),`${id} world OBB ${a.sourceId}/${b.sourceId}`).toBe(false);
   }
   disposeFreshGroupReplacement(group);
  }
 });
 it(`${id} products touch support but do not enter any module solid, divider, rim or glass`,()=>{
  for(const lod of ['near','far'] as const){
   const m=buildFreshGroupReplacement(f,{lod})!;
   for(const p of m.placements){
    const [sx,sy,sz]=p.sourcePart.size.map(v=>v*p.scale/2) as [number,number,number];
    const x=p.anchor[0]+p.localCenter[0],c=Math.cos(p.pitchRad),s=Math.sin(p.pitchRad);
    const section:Section=[[-sy,-sz],[-sy,sz],[sy,sz],[sy,-sz]].map(([dy,dz])=>{
     const y=p.localCenter[1]+dy!,z=p.localCenter[2]+dz!;return [p.anchor[1]+y*c-z*s,p.anchor[2]+y*s+z*c] as const;
    });
    const support=m.frame.parts.find(part=>part.id===m.frame.mounts.find(mt=>mt.id===p.mountId)!.supportId);
    expect(support,`${p.sourceId} support exists`).toBeDefined();
    expect(p.localCenter[1]-sy,`${p.sourceId} support contact`).toBeCloseTo(0,10);
    for(const offset of m.offsets)for(const part of m.frame.parts){
     const dx=Math.min(x+sx,offset[0]+part.max[0])-Math.max(x-sx,offset[0]+part.min[0]);
     if(dx<=1e-7)continue;
     const profile:Section='profile' in part&&part.profile?part.profile:[[part.min[1],part.min[2]],[part.min[1],part.max[2]],[part.max[1],part.max[2]],[part.max[1],part.min[2]]];
     const solid=profile.map(([y,z])=>[y+offset[1],z+offset[2]] as const);
     expect(sectionsOverlap(section,solid),`${id}/${lod} ${p.sourceId} vs ${part.id} module ${offset}`).toBe(false);
    }
   }
  }
 });
}
