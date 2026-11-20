import {it,expect} from 'vitest';
import * as THREE from 'three';
import {layout} from '../data';
import {detailPartsAtLod} from './detailLod';
import {generatePlanningLayout} from './planningLayout';
import {buildFreshGroupReplacement} from './freshGroupReplacement';
import {makeFreshGroupReplacement,disposeFreshGroupReplacement} from './freshGroupReplacementThree';
import {buildServiceGroupReplacement} from './serviceGroupReplacement';
import {makeServiceGroupReplacement,disposeServiceGroupReplacement} from './serviceGroupReplacementThree';
import {buildShelfGroupReplacement} from './shelfGroupReplacement';
import {makeShelfGroupReplacement,disposeShelfGroupReplacement} from './shelfGroupReplacementThree';
const dense=generatePlanningLayout(layout).layout;
const ids=['F029','F050','F074','F077','F107'] as const;
const counts={F029:144,F050:30,F074:30,F077:160,F107:232};
type V=readonly[number,number,number];
function points(o:THREE.Object3D,inverse=new THREE.Matrix4()):THREE.Vector3[]{const result:THREE.Vector3[]=[];o.updateWorldMatrix(true,true);o.traverse(n=>{if(!(n instanceof THREE.Mesh))return;const a=n.geometry.getAttribute('position');for(let i=0;i<a.count;i++)result.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld).applyMatrix4(inverse));});return result;}
function contained(vertices:THREE.Vector3[],box:THREE.Box3,label:string){expect(vertices.length,label).toBeGreaterThan(0);const inflated=box.clone().expandByScalar(2e-6);expect(vertices.every(v=>inflated.containsPoint(v)),label).toBe(true);}
function partsBox(parts:readonly {position:V;size:V}[]){const b=new THREE.Box3();for(const p of parts){const c=new THREE.Vector3(...p.position),h=new THREE.Vector3(...p.size).multiplyScalar(.5);b.expandByPoint(c.clone().sub(h));b.expandByPoint(c.clone().add(h));}return b;}
function meshes(g:THREE.Group){let n=0;g.traverse(o=>{if(o instanceof THREE.Mesh)n++;});return n;}
function setup(id:typeof ids[number],lod:'near'|'far',stocked=true){const f=dense.fixtures.find(f=>f.fixtureId===id)!;
 if(id==='F077'||id==='F107'){const m=buildShelfGroupReplacement(f,{lod,stocked})!;return{f,model:m,make:(batch:boolean,products:'legacy'|'detailed')=>makeShelfGroupReplacement(m,{batch,products}),dispose:disposeShelfGroupReplacement};}
 if(id==='F074'){const m=buildServiceGroupReplacement(f,{lod,stocked})!;return{f,model:m,make:(batch:boolean,products:'legacy'|'detailed')=>makeServiceGroupReplacement(m,{batch,products}),dispose:disposeServiceGroupReplacement};}
 const m=buildFreshGroupReplacement(f,{lod,stocked})!;return{f,model:m,make:(batch:boolean,products:'legacy'|'detailed')=>makeFreshGroupReplacement(m,{batch,products}),dispose:disposeFreshGroupReplacement};
}
for(const id of ids)for(const lod of ['near','far'] as const){
 it(`${id}/${lod} actual detailed vertices stay inside each former product placement OBB with unchanged identity/pitch`,()=>{
  const s=setup(id,lod),snapshot=JSON.stringify(s.model),g=s.make(false,'detailed');
  try{expect(s.model.placements.length).toBe(counts[id]);g.position.set(s.f.x,s.f.y,s.f.z);g.rotation.y=s.f.rotationY;g.updateMatrixWorld(true);
   for(const p of s.model.placements){
    if('merchandise' in p){const item=g.getObjectByName(`${id}-item-${p.sourceId}`)!;expect(item).toBeDefined();contained(points(item,g.matrixWorld.clone().invert()),partsBox(p.merchandise),p.sourceId);}
    else{const mount=g.children.find(o=>o.name===p.sourceId)!;expect(mount).toBeDefined();expect(mount.position.toArray()).toEqual(p.anchor);expect(mount.rotation.x).toBe(p.pitchRad);
     const part='renderPart'in p?p.renderPart:p.sourcePart,c=new THREE.Vector3(...p.localCenter),h=new THREE.Vector3(...part.size).multiplyScalar(p.scale/2);
     // Sphere sources promise old local AABB containment, NOT old sphere-shell containment.
     contained(points(mount,mount.matrixWorld.clone().invert()),new THREE.Box3(c.clone().sub(h),c.clone().add(h)),p.sourceId);
    }
   }expect(JSON.stringify(s.model)).toBe(snapshot);
  }finally{s.dispose(g);}
 });
 it(`${id}/${lod} legacy rollback keeps original item parts and detailed batching remains bounded`,()=>{
  const s=setup(id,lod),legacy=s.make(false,'legacy'),detailed=s.make(false,'detailed'),batch=s.make(true,'detailed');
  try{expect(batch.userData.productCount).toBe(counts[id]);expect(meshes(batch)).toBeLessThan(16);expect(meshes(batch)).toBeLessThan(meshes(detailed));
   const a=new THREE.Box3().setFromObject(detailed,true),b=new THREE.Box3().setFromObject(batch,true);expect(a.min.distanceTo(b.min)).toBeLessThan(2e-5);expect(a.max.distanceTo(b.max)).toBeLessThan(2e-5);
   for(const p of s.model.placements){if('merchandise'in p){const old=legacy.getObjectByName(`${id}-item-${p.sourceId}`)!;expect(old).toBeDefined();expect(old.children.every(x=>x instanceof THREE.Mesh)).toBe(true);const parts=detailPartsAtLod([...p.merchandise],lod);expect(old.children.map(x=>x.name)).toEqual(parts.map(x=>x.id));parts.forEach((part,i)=>{expect(old.children[i]!.position.toArray()).toEqual(part.position);expect(old.children[i]!.scale.toArray()).toEqual(part.size);});}
    else{const old=legacy.children.find(o=>o.name===p.sourceId)!;expect(old.children.length).toBe(1);expect(old.children[0]).toBeInstanceOf(THREE.Mesh);const part='renderPart'in p?p.renderPart:p.sourcePart;expect(old.children[0]!.position.toArray()).toEqual(p.localCenter);expect(old.children[0]!.scale.toArray()).toEqual(part.size.map(v=>v*p.scale));}
   }
   console.log(JSON.stringify({id,lod,legacyMeshes:meshes(legacy),detailedMeshes:meshes(detailed),batchedDraws:meshes(batch)}));
  }finally{s.dispose(legacy);s.dispose(detailed);s.dispose(batch);}
 });
 it(`${id}/${lod} empty racks remain geometry-identical regardless of product style`,()=>{
  const s=setup(id,lod,false),a=s.make(false,'legacy'),b=s.make(false,'detailed');
  try{expect(s.model.placements.length).toBe(0);expect(a.userData.productCount).toBe(0);expect(b.userData.productCount).toBe(0);expect(points(a).map(v=>v.toArray())).toEqual(points(b).map(v=>v.toArray()));}finally{s.dispose(a);s.dispose(b);}
 });
}
// Containment above plus this conservative envelope-vs-structure SAT implies the
// new actual vertices cannot penetrate a frame even when old fruit was spherical.
type Section=readonly (readonly[number,number])[];
function overlap(a:Section,b:Section){for(const poly of [a,b])for(let i=0;i<poly.length;i++){const p=poly[i]!,q=poly[(i+1)%poly.length]!,ny=-(q[1]-p[1]),nz=q[0]-p[0],l=Math.hypot(ny,nz);if(l<1e-10)continue;const project=(s:Section)=>s.map(v=>(v[0]*ny+v[1]*nz)/l),aa=project(a),bb=project(b);if(Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb))<=2e-6)return false;}return true;}
for(const id of ids)it(`${id} approved product envelopes remain outside all structural solids at both LODs`,()=>{
 for(const lod of ['near','far'] as const){const {model:m}=setup(id,lod);
  for(const p of m.placements){let minX:number,maxX:number,section:Section;
   if('merchandise'in p){const b=partsBox(p.merchandise);minX=b.min.x;maxX=b.max.x;section=[[b.min.y,b.min.z],[b.min.y,b.max.z],[b.max.y,b.max.z],[b.max.y,b.min.z]];}
   else{const part='renderPart'in p?p.renderPart:p.sourcePart,[hx,hy,hz]=part.size.map(v=>v*p.scale/2) as [number,number,number];minX=p.anchor[0]+p.localCenter[0]-hx;maxX=minX+2*hx;const c=Math.cos(p.pitchRad),s=Math.sin(p.pitchRad);section=[[-hy,-hz],[-hy,hz],[hy,hz],[hy,-hz]].map(([dy,dz])=>{const y=p.localCenter[1]+dy!,z=p.localCenter[2]+dz!;return[p.anchor[1]+y*c-z*s,p.anchor[2]+y*s+z*c] as const;});}
   const offsets:readonly V[]='offsets'in m?m.offsets:m.rackOffsetsM.map(x=>[x,0,0] as const);
   for(const offset of offsets)for(const solid of m.frame.parts){if(Math.min(maxX,solid.max[0]+offset[0])-Math.max(minX,solid.min[0]+offset[0])<=2e-6)continue;
    const profile:Section='profile'in solid&&solid.profile?solid.profile:[[solid.min[1],solid.min[2]],[solid.min[1],solid.max[2]],[solid.max[1],solid.max[2]],[solid.max[1],solid.min[2]]];
    expect(overlap(section,profile.map(([y,z])=>[y+offset[1],z+offset[2]] as const)),`${id}/${lod} ${p.sourceId} vs ${solid.id}`).toBe(false);
   }
  }
 }
});
for(const id of ids)it(`${id} enclosing placement OBB pairs remain disjoint independent of new child mesh hierarchy`,async()=>{
 const {OBB}=await import('three/addons/math/OBB.js');
 for(const lod of ['near','far'] as const){const {model:m}=setup(id,lod);const boxes=m.placements.map(p=>{
  if('merchandise'in p){const b=partsBox(p.merchandise);return new OBB(b.getCenter(new THREE.Vector3()),b.getSize(new THREE.Vector3()).multiplyScalar(.5).addScalar(-2e-6));}
  const part='renderPart'in p?p.renderPart:p.sourcePart;const transform=new THREE.Matrix4().compose(new THREE.Vector3(...p.anchor),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),p.pitchRad),new THREE.Vector3(1,1,1));
  return new OBB(new THREE.Vector3(...p.localCenter),new THREE.Vector3(...part.size).multiplyScalar(p.scale/2).addScalar(-2e-6)).applyMatrix4(transform);
 });for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)expect(boxes[i]!.intersectsOBB(boxes[j]!),`${id} ${m.placements[i]!.sourceId}/${m.placements[j]!.sourceId}`).toBe(false);
 }
});
