import * as THREE from 'three';
import type { RetailFinish, RetailFixtureModel, RetailPart } from './retailFixture';

const finishes:Record<RetailFinish,THREE.MeshStandardMaterialParameters>={
  body:{color:'#536254',metalness:.1,roughness:.53},
  wood:{color:'#aa7550',metalness:.02,roughness:.60},
  steel:{color:'#c2c9ca',metalness:.53,roughness:.46},
  dark:{color:'#282e31',metalness:.24,roughness:.55},
  trim:{color:'#5e6c67',metalness:.23,roughness:.44},
  glass:{color:'#c2e4eb',metalness:.02,roughness:.16,opacity:.17,transparent:true,depthWrite:false,side:THREE.DoubleSide},
  rubber:{color:'#292c31',metalness:.01,roughness:.79},
  screen:{color:'#355461',emissive:'#26424e',emissiveIntensity:.2,roughness:.32},
};

function prismGeometry(part:RetailPart,section:readonly (readonly [number,number])[]):THREE.BufferGeometry {
  const profile=section.map(([y,z])=>new THREE.Vector2(y,z));
  const shape=new THREE.Shape(profile);
  const g=new THREE.ExtrudeGeometry(shape,{depth:part.max[0]-part.min[0],bevelEnabled:false});
  // (u, v, t) -> (t, u, v) is an orientation-preserving rotation.
  g.applyMatrix4(new THREE.Matrix4().set(0,0,1,part.min[0], 1,0,0,0, 0,1,0,0, 0,0,0,1));
  return g;
}

export function makeRetailFixture(model:RetailFixtureModel):THREE.Group {
  const group=new THREE.Group();
  group.name=`Empty supermarket retail fixture (${model.kind})`;
  group.userData={dimensionsMm:model.dimensionsMm,mounts:model.mounts,detail:model.detail,storage:'empty teaching model, not a manufactured or rated unit'};
  const materials=new Map<RetailFinish,THREE.MeshStandardMaterial>();
  for(const part of model.parts){
    let mat=materials.get(part.finish);
    if(!mat){
      mat=new THREE.MeshStandardMaterial({name:part.finish,...finishes[part.finish]});
      materials.set(part.finish,mat);
    }
    const {min,max}=part;
    const mesh=new THREE.Mesh(part.profile?prismGeometry(part,part.profile):new THREE.BoxGeometry(max[0]-min[0],max[1]-min[1],max[2]-min[2]),mat);
    mesh.name=part.id;
    if(!part.profile) mesh.position.set((min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2);
    mesh.castShadow=part.finish!=='glass';
    mesh.receiveShadow=part.finish!=='glass';
    group.add(mesh);
  }
  return group;
}

export function disposeRetailFixture(group:THREE.Group):void {
  const seen=new Set<THREE.Material>();
  group.traverse(n=>{
    if (!(n instanceof THREE.Mesh)) return;
    n.geometry.dispose();
    for(const mat of Array.isArray(n.material)?n.material:[n.material])seen.add(mat);
  });
  for(const mat of seen)mat.dispose();
}
