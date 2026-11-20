import * as THREE from 'three';
import {makeDetailedProduct} from './detailedProductThree';
import type {DetailedProductKind} from './detailedProduct';
import {selectPlacementProductKind} from '../catalog/placementProductKind';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeRetailFixture} from './retailFixtureThree';
import {makeRefrigerationFixture} from './refrigerationFixtureThree';
import type {ServiceGroupReplacementModel} from './serviceGroupReplacement';
export function disposeServiceGroupReplacement(group:THREE.Group):void {
 const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();
 group.traverse(o=>{if(o instanceof THREE.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());
}
/** Local transform only: caller keeps original fixture origin, yaw and ID. */
export function makeServiceGroupReplacement(model:ServiceGroupReplacementModel,{batch=true,products='detailed'}:{batch?:boolean;products?:'legacy'|'detailed'}={}):THREE.Group {
 const group=new THREE.Group();group.name=`${model.fixtureId} reversible fresh trial`;group.userData={fixtureId:model.fixtureId,lod:model.lod,stocked:model.stocked,sourceItemCount:model.sourceItemCount,productCount:model.audit.productCount,sourceEnvelopeM:model.sourceEnvelopeM,replacementEnvelopeM:model.replacementEnvelopeM,audit:model.audit,products,productSources:[] as {sourceId:string;mountId:string;moduleIndex:number;detailedKind?:DetailedProductKind}[]};
 for(const [i,offset] of model.offsets.entries()){
  const rack=model.frame.kind==='service'?makeRetailFixture(model.frame):model.frame.kind==='open'?makeRefrigerationFixture(model.frame):null;
  if(!rack)throw new Error('Unsupported fresh frame');rack.position.set(...offset);rack.name=`module-${i}`;group.add(rack);
 }
 const sphere=model.lod==='near'?new THREE.SphereGeometry(.5,8,6):new THREE.OctahedronGeometry(.5,0),box=new THREE.BoxGeometry(1,1,1);
 const materials=new Map<string,THREE.MeshStandardMaterial>();
 for(const p of model.placements){
  const mountIndex=model.frame.mounts.findIndex(m=>m.id===p.mountId);
  const detailedKind=products==='detailed'?selectPlacementProductKind({fixtureId:model.fixtureId,moduleIndex:p.moduleIndex,mountIndex,role:p.role}):undefined;
  const mount=new THREE.Group();mount.position.set(...p.anchor);mount.rotation.x=p.pitchRad;mount.name=p.sourceId;mount.userData={sourceId:p.sourceId,primitive:p.renderPart.primitive,mountId:p.mountId,moduleIndex:p.moduleIndex,scale:p.scale,detailedKind};
  const size:[number,number,number]=[p.renderPart.size[0]*p.scale,p.renderPart.size[1]*p.scale,p.renderPart.size[2]*p.scale];
  if(detailedKind){
   // Contain-fit the silhouette instead of stretching a tall carton into the legacy wide pack.
   const ratio:readonly[number,number,number]=detailedKind==='milk-carton'?[.34,1,.34]:[1,.9,1];
   const fit=Math.min(size[0]/ratio[0],size[1]/ratio[1],size[2]/ratio[2]);
   const fittedSize:[number,number,number]=[ratio[0]*fit,ratio[1]*fit,ratio[2]*fit];
   const product=makeDetailedProduct({kind:detailedKind,size:fittedSize,color:p.renderPart.color,lod:model.lod});
   // Keep the ORIGINAL envelope bottom, not its centre, when the contained asset is shorter.
   product.position.set(p.localCenter[0],p.localCenter[1]-size[1]/2,p.localCenter[2]);product.name=p.sourceId;
   product.userData={...product.userData,sourceId:p.sourceId,mountId:p.mountId,moduleIndex:p.moduleIndex};mount.add(product);
  }else{
   let mat=materials.get(p.renderPart.color);if(!mat){mat=new THREE.MeshStandardMaterial({color:p.renderPart.color,roughness:.66});materials.set(p.renderPart.color,mat);}
   const mesh=new THREE.Mesh(p.renderPart.primitive==='sphere'?sphere:box,mat);mesh.position.set(...p.localCenter);mesh.scale.set(...size);mesh.name=p.sourceId;mesh.castShadow=true;mount.add(mesh);
  }
  group.userData.productSources.push({sourceId:p.sourceId,mountId:p.mountId,moduleIndex:p.moduleIndex,detailedKind});group.add(mount);
 }
 // Dispose unused shared templates (used ones are owned by returned group).
 let usedSphere=false,usedBox=false;group.traverse(o=>{if(o instanceof THREE.Mesh){usedSphere ||= o.geometry===sphere;usedBox ||= o.geometry===box;}});if(!usedSphere)sphere.dispose();if(!usedBox)box.dispose();
 if(!batch)return group;
 group.updateMatrixWorld(true);
 const buckets=new Map<string,{parts:THREE.BufferGeometry[];material:THREE.MeshStandardMaterial;shadow:boolean}>();
 group.traverse(o=>{if(!(o instanceof THREE.Mesh)||!(o.material instanceof THREE.MeshStandardMaterial))return;const m=o.material;
 const key=JSON.stringify([m.metalness,m.roughness,m.transparent,m.opacity,m.depthWrite,m.side,o.castShadow]);
 let bucket=buckets.get(key);if(!bucket){bucket={parts:[],material:new THREE.MeshStandardMaterial({metalness:m.metalness,roughness:m.roughness,transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite,side:m.side,vertexColors:true}),shadow:o.castShadow};buckets.set(key,bucket);}
 const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);for(const name of Object.keys(g.attributes))if(name!=='position'&&name!=='normal')g.deleteAttribute(name);
 const n=g.getAttribute('position').count,colors=new Float32Array(n*3);for(let i=0;i<n;i++){colors[i*3]=m.color.r;colors[i*3+1]=m.color.g;colors[i*3+2]=m.color.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.clearGroups();bucket.parts.push(g);
 });
 const output=new THREE.Group();output.name=group.name;output.userData=group.userData;
 for(const b of buckets.values()){const g=mergeGeometries(b.parts);b.parts.forEach(p=>p.dispose());if(!g){b.material.dispose();continue;}const mesh=new THREE.Mesh(g,b.material);mesh.castShadow=b.shadow;mesh.receiveShadow=true;output.add(mesh);}
 disposeServiceGroupReplacement(group);return output;
}
