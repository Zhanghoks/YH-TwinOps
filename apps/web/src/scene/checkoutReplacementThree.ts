import * as THREE from 'three';
import type { CheckoutReplacementModel } from './checkoutReplacement';

/** Named parts for evidence/export. The single showcased lane uses fewer than 40 meshes. */
export function makeCheckoutReplacement(model:CheckoutReplacementModel):THREE.Group{
  const group=new THREE.Group();
  group.name='F120 reversible long checkout lane';
  group.userData={fixtureId:model.fixtureId,envelopeM:model.envelopeM,sourceItemCount:model.sourceItemCount,stocked:model.stocked,
    customerSide:model.customerSide,staffSide:model.staffSide,itemFlow:model.itemFlow,actions:model.actions};
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  for(const p of model.parts){
    const key=p.material+':'+p.color;
    let mat=materials.get(key);
    if(!mat){
      mat=new THREE.MeshStandardMaterial({color:p.color,roughness:p.material==='rubber'?.85:.52,metalness:p.material==='metal'?.30:.04});
      materials.set(key,mat);
    }
    const geometry=p.primitive==='box'?new THREE.BoxGeometry(...p.size):new THREE.SphereGeometry(.5,8,6).scale(...p.size);
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.name=p.id;
    mesh.position.set(...p.position);
    mesh.castShadow=p.material!=='label';
    mesh.receiveShadow=true;
    group.add(mesh);
  }
  return group;
}
export function disposeCheckoutReplacement(group:THREE.Group):void{
  const mats=new Set<THREE.Material>();
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    object.geometry.dispose();
    for(const m of Array.isArray(object.material)?object.material:[object.material])mats.add(m);
  });
  mats.forEach(m=>m.dispose());
}
