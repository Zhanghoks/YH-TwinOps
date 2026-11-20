import {useEffect,useMemo,useState} from 'react';
import {useFrame,type ThreeEvent} from '@react-three/fiber';
import type {Fixture} from '@yh/contracts';
import {buildF032Replacement,type F032ReplacementLod} from './f032Replacement';
import {makeF032Replacement,disposeF032Replacement} from './f032ReplacementThree';
/** Visual-only trial; original fixture is still the sole business identity. */
export function F032TrialPreview({fixture,stocked,selected,onSelect}:{fixture:Fixture;stocked:boolean;selected:boolean;onSelect:(id:string)=>void}){
 const [lod,setLod]=useState<F032ReplacementLod>('near');
 useFrame(({camera})=>{const d=Math.hypot(camera.position.x-fixture.x,camera.position.y-fixture.y,camera.position.z-fixture.z);const next=selected?'near':lod==='near'?(d>42?'far':'near'):(d<34?'near':'far');if(next!==lod)setLod(next);});
 const group=useMemo(()=>{const model=buildF032Replacement(fixture,{stocked,lod});return model?makeF032Replacement(model):null;},[fixture,stocked,lod]);
 useEffect(()=>()=>{if(group)disposeF032Replacement(group);},[group]);
 if(!group)return null;
 const select=(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();onSelect(fixture.fixtureId);};
 return <group position={[fixture.x,fixture.y,fixture.z]} rotation={[0,fixture.rotationY,0]} onPointerDown={select}>
   <primitive object={group}/>
   <mesh position={[0,.8,0]}><boxGeometry args={[7.2,1.6,1]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false}/></mesh>
   {selected&&<mesh position={[0,.8,0]}><boxGeometry args={[7.26,1.66,1.06]}/><meshBasicMaterial color="#f59e0b" wireframe/></mesh>}
 </group>;
}
