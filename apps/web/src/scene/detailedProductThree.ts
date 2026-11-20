import * as THREE from 'three'
import { buildDetailedProduct, type DetailedProductOptions, type ProductPart } from './detailedProduct'
function outlineGeometry(shape: 'roof'|'pouch') {
  const s=new THREE.Shape()
  if(shape==='roof'){s.moveTo(-.5,-.5);s.lineTo(.5,-.5);s.lineTo(0,.5)}
  else {s.moveTo(-.4,-.5);s.lineTo(.4,-.5);s.lineTo(.5,-.28);s.lineTo(.46,.27);s.lineTo(.37,.5);s.lineTo(-.37,.5);s.lineTo(-.46,.27);s.lineTo(-.5,-.28)}
  s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:1,bevelEnabled:false,steps:1});g.translate(0,0,-.5);return g
}
function geometry(p:ProductPart,near:boolean):THREE.BufferGeometry{
  switch(p.shape){
    case 'box':return new THREE.BoxGeometry(1,1,1)
    case 'ellipsoid':return new THREE.SphereGeometry(.5,near?10:6,near?8:4)
    case 'cylinder': {const ratio=p.topRatio??1; return new THREE.CylinderGeometry(.5*Math.min(1,ratio),.5/Math.max(1,ratio),1,near?10:6)}
    case 'roof':return outlineGeometry('roof')
    case 'pouch':return outlineGeometry('pouch')
  }
}
/** Every mesh is local to its supplied envelope; callers may batch by shared roughness/material flags. */
export function makeDetailedProduct(options:DetailedProductOptions):THREE.Group{
  const model=buildDetailedProduct(options),group=new THREE.Group(), materials=new Map<string|number,THREE.MeshStandardMaterial>()
  group.name=`product:${model.kind}`;group.userData={productKind:model.kind,productLod:model.lod,productEnvelope:[...model.size],syntheticUnbranded:true}
  for(const p of model.parts){let material=materials.get(p.color);if(!material){material=new THREE.MeshStandardMaterial({color:p.color,roughness:.66,metalness:0});materials.set(p.color,material)}const mesh=new THREE.Mesh(geometry(p,model.lod==='near'),material);mesh.name=p.id;mesh.position.set(...p.position);mesh.scale.set(...p.size);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}
  return group
}
export function disposeDetailedProduct(group:THREE.Group){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}
