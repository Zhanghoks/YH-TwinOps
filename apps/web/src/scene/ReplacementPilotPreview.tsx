import type {ShelfSlotReplacement} from '../catalog/merchandisingAdapter';
import {buildSameSkuFill,type SameSkuFillRequest} from './sameSkuFill';
import {buildServiceGroupReplacement,isServiceGroupReplacementFixture} from './serviceGroupReplacement';
import {makeServiceGroupReplacement,disposeServiceGroupReplacement} from './serviceGroupReplacementThree';
import {buildCheckoutReplacement,isDenseCheckoutReplacement} from './checkoutReplacement';
import {makeCheckoutReplacement,disposeCheckoutReplacement} from './checkoutReplacementThree';
import {useEffect,useMemo,useState} from 'react';
import {useFrame,type ThreeEvent} from '@react-three/fiber';
import type {Fixture} from '@yh/contracts';
import {buildShelfGroupReplacement,isShelfGroupReplacementFixture} from './shelfGroupReplacement';
import {makeShelfGroupReplacement,disposeShelfGroupReplacement} from './shelfGroupReplacementThree';
import {buildFreshGroupReplacement,isDenseFreshFixture} from './freshGroupReplacement';
import {makeFreshGroupReplacement,disposeFreshGroupReplacement} from './freshGroupReplacementThree';
export function isReplacementPilotFixture(f:Fixture){return isShelfGroupReplacementFixture(f)||isDenseFreshFixture(f)||isServiceGroupReplacementFixture(f)||isDenseCheckoutReplacement(f);}
/** Same fixture identity, independent reversible visual asset; no state writes. */
export function ReplacementPilotPreview({fixture,stocked,selected,onSelect,fillRequest,placementReplacement}:{fixture:Fixture;stocked:boolean;selected:boolean;onSelect:(id:string)=>void;fillRequest?:SameSkuFillRequest;placementReplacement?:ShelfSlotReplacement}){
 const [lod,setLod]=useState<'near'|'far'>('near');
 useFrame(({camera})=>{const d=Math.hypot(camera.position.x-fixture.x,camera.position.y-fixture.y,camera.position.z-fixture.z);const next=selected?'near':lod==='near'?(d>42?'far':'near'):(d<34?'near':'far');if(next!==lod)setLod(next);});
 const result=useMemo(()=>{
  const service=buildServiceGroupReplacement(fixture,{stocked,lod});
  if(service)return {group:makeServiceGroupReplacement(service),envelope:service.replacementEnvelopeM,dispose:disposeServiceGroupReplacement};
  const checkout=buildCheckoutReplacement(fixture,{stocked,lod});
  if(checkout)return {group:makeCheckoutReplacement(checkout),envelope:checkout.replacementEnvelopeM,dispose:disposeCheckoutReplacement};
  const shelf=buildShelfGroupReplacement(fixture,{stocked,lod});
  if(shelf)return {group:makeShelfGroupReplacement(shelf,{placementReplacement:fixture.fixtureId==='F077'?placementReplacement:undefined,fillPlan:fillRequest&&fixture.fixtureId==='F077'?buildSameSkuFill(fixture,fillRequest):undefined}),envelope:shelf.replacementEnvelopeM,dispose:disposeShelfGroupReplacement};
  const fresh=buildFreshGroupReplacement(fixture,{stocked,lod});
  return fresh?{group:makeFreshGroupReplacement(fresh),envelope:fresh.replacementEnvelopeM,dispose:disposeFreshGroupReplacement}:null;
 },[fixture,stocked,lod,fillRequest,placementReplacement]);
 useEffect(()=>()=>{if(result)result.dispose(result.group);},[result]);
 if(!result)return null;
 const [w,h,d]=result.envelope;
 const select=(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();onSelect(fixture.fixtureId);};
 return <group position={[fixture.x,fixture.y,fixture.z]} rotation={[0,fixture.rotationY,0]} onPointerDown={select}>
  <primitive object={result.group}/>
  <mesh position={[0,h/2,0]}><boxGeometry args={[w,h,d]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false}/></mesh>
  {selected&&<mesh position={[0,h/2,0]}><boxGeometry args={[w+.06,h+.06,d+.06]}/><meshBasicMaterial color="#f59e0b" wireframe/></mesh>}
 </group>;
}
