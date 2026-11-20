import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeDimensionedShelf } from './dimensionedShelfThree';
import type { F032ReplacementModel } from './f032Replacement';
import { detailPartsAtLod } from './detailLod';

function appendRack(group:THREE.Group,model:F032ReplacementModel):void{
  for(const [index,x] of model.rackOffsetsM.entries()){
    const rack=makeDimensionedShelf(model.frame);
    rack.position.x=x;
    rack.name=`gondola-unit-${index+1}`;
    group.add(rack);
  }
}

function appendItems(group:THREE.Group,model:F032ReplacementModel):void{
  if(!model.stocked)return;
  const goods=new THREE.Group();
  goods.name='F032 original products';
  const base={
    box:new THREE.BoxGeometry(1,1,1),
    sphere:model.lod==='near'?new THREE.SphereGeometry(.5,8,6):new THREE.OctahedronGeometry(.5,0),
  };
  const colors=new Map<string,THREE.MeshStandardMaterial>();
  for(const placement of model.placements){
    const item=new THREE.Group();
    item.name=`F032-item-${placement.sourceId}`;
    item.userData={model:placement.sourceSlot.model,mount:placement.mount.id,rack:placement.rackIndex+1,uniformScale:placement.scale};
    for(const part of detailPartsAtLod([...placement.merchandise],model.lod)){
      let material=colors.get(part.color);
      if(material===undefined){
        material=new THREE.MeshStandardMaterial({color:part.color,roughness:.66});
        colors.set(part.color,material);
      }
      const mesh=new THREE.Mesh(base[part.primitive],material);
      mesh.name=part.id;
      mesh.position.set(...part.position);
      mesh.scale.set(...part.size);
      item.add(mesh);
    }
    goods.add(item);
  }
  group.add(goods);
}

function batchScene(input:THREE.Group):THREE.Group{
  input.updateMatrixWorld(true);
  const buckets=new Map<string, {geometries:THREE.BufferGeometry[];material:THREE.MeshStandardMaterial;shadow:boolean}>();
  input.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||!(o.material instanceof THREE.MeshStandardMaterial)) return;
    const material=o.material;
    const key=JSON.stringify([material.metalness,material.roughness,o.castShadow]);
    let bucket=buckets.get(key);
    if(!bucket){
      bucket={geometries:[],material:new THREE.MeshStandardMaterial({metalness:material.metalness,roughness:material.roughness,vertexColors:true}),shadow:o.castShadow};
      buckets.set(key,bucket);
    }
    const shape:THREE.BufferGeometry=o.geometry.index ? o.geometry.toNonIndexed():o.geometry.clone();
    shape.applyMatrix4(o.matrixWorld);
    for(const attr of Object.keys(shape.attributes)) if(attr!=='position'&&attr!=='normal')shape.deleteAttribute(attr);
    const count=shape.getAttribute('position').count;
    const color=new Float32Array(count*3);
    for(let i=0;i<count;i++){color[i*3]=material.color.r;color[i*3+1]=material.color.g;color[i*3+2]=material.color.b;}
    shape.setAttribute('color',new THREE.BufferAttribute(color,3));
    shape.clearGroups();
    bucket.geometries.push(shape);
  });
  const group=new THREE.Group();
  group.name=input.name;
  group.userData=input.userData;
  for(const [key,bucket] of buckets){
    const geometry=mergeGeometries(bucket.geometries);
    for(const g of bucket.geometries)g.dispose();
    if(geometry===null){bucket.material.dispose();continue;}
    const mesh=new THREE.Mesh(geometry,bucket.material);
    mesh.name=key;
    mesh.castShadow=bucket.shadow;
    mesh.receiveShadow=true;
    group.add(mesh);
  }
  disposeF032Replacement(input);
  return group;
}

/** Transform is fixture-local; the caller applies the unchanged F032 origin and yaw. */
export function makeF032Replacement(model:F032ReplacementModel,{batch=true}:{batch?:boolean}={}):THREE.Group{
  const group=new THREE.Group();
  group.name='F032 reversible gondola trial';
  const counts:Record<string,number>={};
  for(const p of model.placements)counts[p.sourceSlot.model]=(counts[p.sourceSlot.model]??0)+1;
  group.userData={fixtureId:model.fixtureId,sourceItemCount:model.sourceItemCount,productCount:model.placements.length,
    sourceEnvelopeM:model.sourceEnvelopeM,replacementEnvelopeM:model.replacementEnvelopeM,lod:model.lod,stocked:model.stocked,counts};
  appendRack(group,model);
  appendItems(group,model);
  return batch ? batchScene(group):group;
}

export function disposeF032Replacement(group:THREE.Group):void{
  const geometry=new Set<THREE.BufferGeometry>(),material=new Set<THREE.Material>();
  group.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    geometry.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material])material.add(m);
  });
  geometry.forEach(g=>g.dispose());
  material.forEach(m=>m.dispose());
}
