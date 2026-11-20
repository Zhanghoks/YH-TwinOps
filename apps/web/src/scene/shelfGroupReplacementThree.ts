import {sameSkuMountKey,type SameSkuFillResult} from './sameSkuFill';
import {makeSameSkuFillProducts} from './sameSkuFillThree';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeDimensionedShelf } from './dimensionedShelfThree';
import type { ShelfGroupPlacement, ShelfGroupReplacementModel } from './shelfGroupReplacement';
import { detailPartsAtLod } from './detailLod';
import { makeDetailedProduct } from './detailedProductThree';
import {selectPlacementProductKind} from '../catalog/placementProductKind';
import type { ShelfSlotReplacement } from '../catalog/merchandisingAdapter';

export type ShelfProductStyle='legacy'|'detailed';

function appendRack(group:THREE.Group,model:ShelfGroupReplacementModel):void{
  for(const [index,x] of model.rackOffsetsM.entries()){
    const rack=makeDimensionedShelf(model.frame);
    rack.position.x=x;
    rack.name=`gondola-unit-${index+1}`;
    group.add(rack);
  }
}

/** Reuse the old actual complete merchandise AABB, not the wider theoretical cell. */
function addDetailedItem(item:THREE.Group,p:ShelfGroupPlacement,model:ShelfGroupReplacementModel):boolean{
  const kind=selectPlacementProductKind({fixtureId:model.fixtureId,sourceModel:p.sourceSlot.model});
  if(kind===undefined)return false;
  const bounds=new THREE.Box3();
  for(const part of p.merchandise) {
    const c=new THREE.Vector3(...part.position), h=new THREE.Vector3(...part.size).multiplyScalar(.5);
    bounds.expandByPoint(c.clone().sub(h));
    bounds.expandByPoint(c.clone().add(h));
  }
  const extent=bounds.getSize(new THREE.Vector3());
  const product=makeDetailedProduct({kind,size:[extent.x,extent.y,extent.z],color:p.sourceSlot.color,lod:model.lod});
  product.rotation.y=p.sourceSlot.side===-1?Math.PI:0;
  // The name and SKU linkage live on the wrapper; re-center the detailed geometry
  // in the original envelope and keep direct contact with the same shelf surface.
  const actual=new THREE.Box3().setFromObject(product,true);
  const actualSize=actual.getSize(new THREE.Vector3());
  const scale=Math.min(1,extent.x/actualSize.x,extent.y/actualSize.y,extent.z/actualSize.z);
  if(scale<1)product.scale.multiplyScalar(scale);
  const after=new THREE.Box3().setFromObject(product,true);
  const wantedCenter=bounds.getCenter(new THREE.Vector3()), center=after.getCenter(new THREE.Vector3());
  product.position.set(wantedCenter.x-center.x,bounds.min.y-after.min.y,wantedCenter.z-center.z);
  item.userData.detailedKind=kind;
  item.add(product);
  return true;
}

function appendItems(group:THREE.Group,model:ShelfGroupReplacementModel,products:ShelfProductStyle):void{
  if(!model.stocked)return;
  const goods=new THREE.Group();
  goods.name=model.fixtureId+' original products';
  const base:Partial<Record<'box'|'sphere',THREE.BufferGeometry>>={};
  const colors=new Map<string,THREE.MeshStandardMaterial>();
  for(const placement of model.placements){
    const item=new THREE.Group();
    item.name=`${model.fixtureId}-item-${placement.sourceId}`;
    item.userData={model:placement.sourceSlot.model,mount:placement.mount.id,rack:placement.rackIndex+1,uniformScale:placement.scale};
    if(products==='detailed'&&addDetailedItem(item,placement,model)){
      goods.add(item);
      continue;
    }
    for(const part of detailPartsAtLod([...placement.merchandise],model.lod)){
      let material=colors.get(part.color);
      if(material===undefined){
        material=new THREE.MeshStandardMaterial({color:part.color,roughness:.66});
        colors.set(part.color,material);
      }
      const geometry=base[part.primitive]??=part.primitive==='box'?new THREE.BoxGeometry(1,1,1):
        model.lod==='near'?new THREE.SphereGeometry(.5,8,6):new THREE.OctahedronGeometry(.5,0);
      const mesh=new THREE.Mesh(geometry,material);
      mesh.name=part.id;
      mesh.position.set(...part.position);
      mesh.scale.set(...part.size);
      item.add(mesh);
    }
    goods.add(item);
  }
  group.add(goods);
}

/** Mount the validated template at the existing source slot; no added/removed slot capacity. */
function slotReplacementItem(model:ShelfGroupReplacementModel,p:ShelfGroupPlacement,replacement:ShelfSlotReplacement):THREE.Group {
  const item=new THREE.Group();
  item.name=`${model.fixtureId}-item-${p.sourceId}`;
  item.userData={sku:replacement.sku,slotId:p.sourceId,detailedKind:replacement.modelKey,mount:p.mount.id,rack:p.rackIndex+1,origin:'USER_SANDBOX'};
  const product=makeDetailedProduct({kind:replacement.modelKey,size:replacement.sizeM,color:replacement.color,lod:model.lod});
  product.rotation.y=p.mount.side===-1 ? Math.PI : 0;
  const actual=new THREE.Box3().setFromObject(product,true);
  const center=actual.getCenter(new THREE.Vector3());
  const [x,y,z]=p.slot.anchor;
  product.position.set(x-center.x,y-actual.min.y,z-center.z);
  item.add(product);
  return item;
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
  disposeShelfGroupReplacement(input);
  return group;
}

/** Transform is fixture-local; the caller applies the unchanged business-fixture origin and yaw. */
export function makeShelfGroupReplacement(model:ShelfGroupReplacementModel,{batch=true,products='detailed',fillPlan,placementReplacement}:{batch?:boolean;products?:ShelfProductStyle;fillPlan?:SameSkuFillResult;placementReplacement?:ShelfSlotReplacement}={}):THREE.Group{
  const group=new THREE.Group();
  group.name=model.fixtureId+' reversible gondola trial';
  const counts:Record<string,number>={};
  for(const p of model.placements)counts[p.sourceSlot.model]=(counts[p.sourceSlot.model]??0)+1;
  group.userData={fixtureId:model.fixtureId,sourceItemCount:model.sourceItemCount,productCount:model.placements.length,
    sourceEnvelopeM:model.sourceEnvelopeM,replacementEnvelopeM:model.replacementEnvelopeM,lod:model.lod,stocked:model.stocked,counts,products};
  appendRack(group,model);
  const fill=model.fixtureId==='F077'&&model.stocked&&fillPlan?.ok ? fillPlan : undefined;
  const target=model.fixtureId==='F077'&&model.stocked&&!fill&&placementReplacement
    ? model.placements.find(p=>p.sourceId===placementReplacement.slotId) : undefined;
  const removed=new Set(fill?.replacedMountKeys ?? []);
  const retained=fill || target ? {...model,placements:model.placements.filter(p=>p!==target&&!removed.has(sameSkuMountKey(p.rackIndex,p.mount)))} : model;
  appendItems(group,retained,products);
  const output=batch ? batchScene(group):group;
  if(target&&placementReplacement){
    // The one changed object stays addressable even while the unchanged structure and products are batched.
    output.add(slotReplacementItem(model,target,placementReplacement));
    output.userData.placementReplacement={slotId:target.sourceId,sku:placementReplacement.sku};
  }
  if(fill){output.add(makeSameSkuFillProducts(fill,model.lod));output.userData.fillCount=fill.placements.length;output.userData.retainedCount=retained.placements.length;output.userData.productCount=retained.placements.length+fill.placements.length;}
  return output;
}

export function disposeShelfGroupReplacement(group:THREE.Group):void{
  const geometry=new Set<THREE.BufferGeometry>(),material=new Set<THREE.Material>();
  group.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    if(o instanceof THREE.InstancedMesh)o.dispose();
    geometry.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material])material.add(m);
  });
  geometry.forEach(g=>g.dispose());
  material.forEach(m=>m.dispose());
}
