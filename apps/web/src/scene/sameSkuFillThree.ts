import * as THREE from 'three'
import {makeDetailedProduct,disposeDetailedProduct} from './detailedProductThree'
import type {SameSkuFillResult} from './sameSkuFill'
/** Append AFTER ordinary mesh batching. Each part is instanced with explicit placement transforms. */
export function makeSameSkuFillProducts(fill:SameSkuFillResult,lod:'near'|'far'='near'):THREE.Group {
 const group=new THREE.Group();group.name='F077 same-SKU original-size fill';group.userData={synthetic:true,productCount:fill.ok?fill.placements.length:0,placementIds:fill.placements.map(p=>p.id)}
 const first=fill.placements[0];if(!fill.ok||!first)return group
 const template=makeDetailedProduct({kind:first.modelKey,size:first.sizeM,color:first.color,lod});template.updateMatrixWorld(true)
 const pose=new THREE.Object3D(),matrix=new THREE.Matrix4()
 template.traverse(o=>{if(!(o instanceof THREE.Mesh))return
  const material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone()
  const mesh=new THREE.InstancedMesh(o.geometry.clone(),material,fill.placements.length);mesh.name=`same-SKU:${o.name}`;mesh.castShadow=true;mesh.receiveShadow=true
  for(const [i,p] of fill.placements.entries()){pose.position.set(...p.position);pose.rotation.set(0,p.yaw,0);pose.updateMatrix();matrix.multiplyMatrices(pose.matrix,o.matrixWorld);mesh.setMatrixAt(i,matrix)}
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh)
 });disposeDetailedProduct(template);return group
}
export function disposeSameSkuFillProducts(group:THREE.Group):void {group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose()});disposeDetailedProduct(group)}
