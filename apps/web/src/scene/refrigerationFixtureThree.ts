import * as THREE from 'three';
import type { RefrigerationFinish, RefrigerationFixtureModel } from './refrigerationFixture';

const finishes:Record<RefrigerationFinish,THREE.MeshStandardMaterialParameters>={
  body:{color:'#c4c9cb',metalness:.35,roughness:.42},
  metal:{color:'#a1aeb3',metalness:.58,roughness:.37},
  liner:{color:'#d7e0e2',metalness:.25,roughness:.43},
  trim:{color:'#3b4549',metalness:.38,roughness:.49},
  rail:{color:'#eff1ed',metalness:.21,roughness:.41},
  glass:{color:'#b3dce3',metalness:.02,roughness:.19,opacity:.18,transparent:true,depthWrite:false,side:THREE.DoubleSide},
  light:{color:'#edf9fa',emissive:'#d2f1f4',emissiveIntensity:.32,roughness:.37},
};

export function makeRefrigerationFixture(model:RefrigerationFixtureModel):THREE.Group {
  const group=new THREE.Group();
  group.name=`Empty supermarket refrigeration fixture (${model.kind})`;
  group.userData={dimensionsMm:model.dimensionsMm,mounts:model.mounts,detail:model.detail,storage:'empty teaching model, not a manufactured or rated unit'};
  const materials=new Map<RefrigerationFinish,THREE.MeshStandardMaterial>();
  for(const part of model.parts){
    let mat=materials.get(part.finish);
    if(!mat){
      mat=new THREE.MeshStandardMaterial({name:part.finish,...finishes[part.finish]});
      materials.set(part.finish,mat);
    }
    const {min,max}=part;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(max[0]-min[0],max[1]-min[1],max[2]-min[2]),mat);
    mesh.name=part.id;
    mesh.position.set((min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2);
    mesh.castShadow=part.finish!=='glass';
    mesh.receiveShadow=part.finish!=='glass';
    group.add(mesh);
  }
  return group;
}

export function disposeRefrigerationFixture(group:THREE.Group):void {
  const seen=new Set<THREE.Material>();
  group.traverse(n=>{
    if (!(n instanceof THREE.Mesh)) return;
    n.geometry.dispose();
    for(const mat of Array.isArray(n.material)?n.material:[n.material])seen.add(mat);
  });
  for(const mat of seen)mat.dispose();
}
