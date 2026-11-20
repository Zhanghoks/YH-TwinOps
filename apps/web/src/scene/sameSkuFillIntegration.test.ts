import {expect,it} from 'vitest';
import * as THREE from 'three';
import {layout} from '../data';
import {generatePlanningLayout} from './planningLayout';
import {buildShelfGroupReplacement} from './shelfGroupReplacement';
import {makeShelfGroupReplacement,disposeShelfGroupReplacement} from './shelfGroupReplacementThree';
import {buildSameSkuFill,sameSkuMountKey,type SameSkuFillRequest} from './sameSkuFill';
const f=generatePlanningLayout(layout).layout.fixtures.find(f=>f.fixtureId==='F077')!;
const request:SameSkuFillRequest={sku:'YH-DEMO-004',scope:'cell',side:1,level:0,moduleIndex:0,bay:0,gapMm:10};
function instanceBounds(g:THREE.Object3D){g.updateWorldMatrix(true,true);const boxes:THREE.Box3[]=[];g.traverse(o=>{if(!(o instanceof THREE.InstancedMesh))return;const a=o.geometry.getAttribute('position'),im=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,im);const matrix=new THREE.Matrix4().multiplyMatrices(o.matrixWorld,im),b=boxes[i]??new THREE.Box3();for(let j=0;j<a.count;j++)b.expandByPoint(new THREE.Vector3().fromBufferAttribute(a,j).applyMatrix4(matrix));boxes[i]=b;}});return boxes;}
function overlap(a:THREE.Box3,b:THREE.Box3){return ['x','y','z'].every(k=>{const axis=k as 'x'|'y'|'z';return Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>2e-6;});}
for(const [scope,count,mountCount,skip] of [['cell',32,1,0],['level',128,4,0],['fixture',1024,32,8]] as const){
 it(`${scope}: fixed SKU004 quantities, actual instance matrices clear structures and unselected goods survive`,()=>{
  const fill=buildSameSkuFill(f,{...request,scope});expect(fill.ok).toBe(true);expect(fill.placements.length).toBe(count);expect(fill.replacedMountKeys.length).toBe(mountCount);expect(fill.skipped.length).toBe(skip);
  expect(new Set(fill.placements.map(p=>p.id)).size).toBe(count);expect(fill.placements.every(p=>p.sizeM.join(',')==='0.125,0.22,0.085'&&p.sku==='YH-DEMO-004')).toBe(true);
  const seenIds:string[][]=[];
  for(const lod of ['near','far'] as const){const model=buildShelfGroupReplacement(f,{lod})!,snapshot=JSON.stringify(model),removed=new Set(fill.replacedMountKeys),retained=model.placements.filter(p=>!removed.has(sameSkuMountKey(p.rackIndex,p.mount))),g=makeShelfGroupReplacement(model,{fillPlan:fill,batch:false});
   try{const instances=g.getObjectByName('F077 same-SKU original-size fill')!;expect(instances).toBeDefined();seenIds.push(instances.userData.placementIds);
    expect(g.userData.retainedCount).toBe(retained.length);expect(g.userData.productCount).toBe(retained.length+count);
    for(const p of model.placements)expect(!!g.getObjectByName(`F077-item-${p.sourceId}`)).toBe(!removed.has(sameSkuMountKey(p.rackIndex,p.mount)));
    const boxes=instanceBounds(instances);expect(boxes.length).toBe(count);
    const retainedBounds=retained.map(p=>({id:p.sourceId,b:new THREE.Box3().setFromObject(g.getObjectByName(`F077-item-${p.sourceId}`)!,true)}));
    for(const b of boxes)for(const r of retainedBounds)if(overlap(b,r.b))throw new Error(`fill overlaps retained ${r.id}`);
    const solids=model.rackOffsetsM.flatMap(x=>model.frame.parts.map(part=>({id:part.id,b:new THREE.Box3(new THREE.Vector3(part.min[0]+x,part.min[1],part.min[2]),new THREE.Vector3(part.max[0]+x,part.max[1],part.max[2]))})));
    boxes.forEach((b,i)=>{const p=fill.placements[i]!,min=new THREE.Vector3(p.position[0]-p.sizeM[0]/2,p.position[1],p.position[2]-p.sizeM[2]/2),max=new THREE.Vector3(p.position[0]+p.sizeM[0]/2,p.position[1]+p.sizeM[1],p.position[2]+p.sizeM[2]/2),allowed=new THREE.Box3(min,max).expandByScalar(2e-6);expect(allowed.containsBox(b),p.id).toBe(true);for(const solid of solids)expect(overlap(b,solid.b),`${p.id}/${solid.id}`).toBe(false);});
    // Full all-instance pair check uses real transformed mesh bounds, not Box3's
    // default template-only geometry path for an InstancedMesh.
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlap(boxes[i]!,boxes[j]!))throw new Error(`fill overlap ${i}/${j}`);
    expect(JSON.stringify(model)).toBe(snapshot);
   }finally{disposeShelfGroupReplacement(g);}
   const batched=makeShelfGroupReplacement(model,{fillPlan:fill});try{let ordinary=0,instanced=0;batched.traverse(o=>{if(o instanceof THREE.InstancedMesh){instanced++;expect(o.count).toBe(count);}else if(o instanceof THREE.Mesh)ordinary++;});expect(instanced).toBeGreaterThan(0);expect(instanced).toBeLessThan(12);expect(ordinary).toBeLessThan(10);expect(batched.userData.productCount).toBe(retained.length+count);}finally{disposeShelfGroupReplacement(batched);}
  }expect(seenIds[0]).toEqual(seenIds[1]);
 });
}
it('top shelf skip and strict baseline rejection preserve original geometry',()=>{
 const top=buildSameSkuFill(f,{...request,level:4});expect(top.ok).toBe(false);expect(top.placements).toEqual([]);expect(top.replacedMountKeys).toEqual([]);
 const baseline=layout.fixtures.find(f=>f.fixtureId==='F077')!;expect(buildSameSkuFill(baseline,request).ok).toBe(false);expect(buildShelfGroupReplacement(baseline)).toBeNull();
 for(const wrong of [{...f,x:f.x+.01},{...f,rotationY:.01},{...f,fixtureId:'F107'}])expect(buildSameSkuFill(wrong,request).ok).toBe(false);
 const model=buildShelfGroupReplacement(f)!,g=makeShelfGroupReplacement(model,{fillPlan:top,batch:false});try{expect(g.getObjectByName('F077 same-SKU original-size fill')).toBeUndefined();for(const p of model.placements)expect(g.getObjectByName(`F077-item-${p.sourceId}`)).toBeDefined();}finally{disposeShelfGroupReplacement(g);}
});
it('stocked false ignores otherwise valid fill plan at near and far',()=>{const fill=buildSameSkuFill(f,{...request,scope:'fixture'});for(const lod of ['near','far'] as const){const model=buildShelfGroupReplacement(f,{lod,stocked:false})!,g=makeShelfGroupReplacement(model,{fillPlan:fill});try{expect(g.userData.productCount).toBe(0);expect(g.getObjectByName('F077 same-SKU original-size fill')).toBeUndefined();g.traverse(o=>expect(o instanceof THREE.InstancedMesh).toBe(false));}finally{disposeShelfGroupReplacement(g);}}});
