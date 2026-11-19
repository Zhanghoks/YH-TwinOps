import {useLayoutEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {departmentFloorPanels} from './departmentFloor';
import type {ReferenceRegion} from './planningLayout';
export function DepartmentFloor({regions}:{regions:readonly ReferenceRegion[]}) {
 const panels=useMemo(()=>departmentFloorPanels(regions),[regions]),mesh=useRef<THREE.InstancedMesh>(null);
 useLayoutEffect(()=>{if(!mesh.current)return;const o=new THREE.Object3D(),c=new THREE.Color();panels.forEach((p,i)=>{o.position.set(p.x,.016,p.z);o.scale.set(p.width,.002,p.depth);o.updateMatrix();mesh.current!.setMatrixAt(i,o.matrix);mesh.current!.setColorAt(i,c.set(p.color));});mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;mesh.current.computeBoundingSphere();},[panels]);
 return <instancedMesh ref={mesh} args={[undefined,undefined,panels.length]}><boxGeometry args={[1,1,1]}/><meshBasicMaterial transparent opacity={.20} depthWrite={false}/></instancedMesh>;
}
