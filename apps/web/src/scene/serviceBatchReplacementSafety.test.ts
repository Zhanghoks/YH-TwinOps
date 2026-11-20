import {expect,it} from 'vitest';
import * as THREE from 'three';
import {layout as baseline} from '../data';
import {generatePlanningLayout,buildReferenceDisplayFixtures} from './planningLayout';
import {buildReferenceArchitecture} from './referenceArchitecture';
import {buildStoreArchitecture} from './storeArchitecture';
import {buildExteriorArchitecture} from './exteriorArchitecture';
import {buildCityContext} from './cityContext';
import {buildUrbanFabric} from './urbanFabric';
import {buildCustomerRoutes,customerPose,CUSTOMER_RADIUS_M} from './customerMotion';

// Real-factory geometry regression, NOT queue simulation or a statutory aisle certification.
const layout=generatePlanningLayout(baseline).layout;
const all=[...layout.fixtures,...buildReferenceDisplayFixtures(layout)];
const routes=buildCustomerRoutes(layout,buildReferenceDisplayFixtures(layout));
const sourceSnapshot=JSON.stringify(all);
const architecture=[...buildStoreArchitecture(130,100,{entranceCenterX:-22.5,entranceWidthM:23,neutralFacade:true}).filter(p=>!p.id.startsWith('entrance-cart-rack')),...buildReferenceArchitecture(layout.fixtures),...buildExteriorArchitecture(130,100,-22.5),...buildCityContext(130,100),...buildUrbanFabric(130,100)];
type Rect={x0:number;x1:number;z0:number;z1:number};
function rect(x:number,z:number,w:number,d:number,yaw=0):Rect{const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),hx=(c*w+s*d)/2,hz=(s*w+c*d)/2;return{x0:x-hx,x1:x+hx,z0:z-hz,z1:z+hz};}
const gap=(a:Rect,b:Rect)=>Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.z0-b.z1,b.z0-a.z1));
const intersects=(a:Rect,b:Rect)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)+1e-6&&Math.min(a.z1,b.z1)>Math.max(a.z0,b.z0)+1e-6;
function obstacles(id:string){return[...all.filter(f=>f.fixtureId!==id).map(f=>({id:f.fixtureId,r:rect(f.x,f.z,f.widthM,f.depthM,f.rotationY),bottom:f.y,top:f.y+f.heightM})),...architecture.map(p=>({id:p.id,r:rect(p.position[0],p.position[2],p.size[0],p.size[2]),bottom:p.position[1]-p.size[1]/2,top:p.position[1]+p.size[1]/2}))];}
// Actual factory meshes are required below; no candidate dimensions substitute
// for missing production geometry.
import {buildCheckoutReplacement} from './checkoutReplacement';
import {makeCheckoutReplacement,disposeCheckoutReplacement} from './checkoutReplacementThree';
function audit(id:string,group:THREE.Group){
 const f=all.find(f=>f.fixtureId===id)!;
 const local=new THREE.Box3().setFromObject(group,true),size=local.getSize(new THREE.Vector3());
 expect(size.x).toBeLessThanOrEqual(f.widthM+1e-5);expect(size.z).toBeLessThanOrEqual(f.depthM+1e-5);
 expect(group.userData.fixtureId).toBe(id);
 group.position.set(f.x,f.y,f.z);group.rotation.y=f.rotationY;group.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(group,true),r={x0:box.min.x,x1:box.max.x,z0:box.min.z,z1:box.max.z};
 const obs=obstacles(id),vertical=obs.filter(o=>o.top>box.min.y+.08&&o.bottom<box.max.y-1e-5);
 expect(vertical.filter(o=>intersects(r,o.r)).map(o=>o.id)).toEqual([]);
 const nearest=vertical.map(o=>({id:o.id,gap:gap(r,o.r)})).sort((a,b)=>a.gap-b.gap)[0]!;
 let clearance=Infinity;
 for(const route of routes){const a={x0:Math.min(route.from[0],route.to[0]),x1:Math.max(route.from[0],route.to[0]),z0:Math.min(route.from[1],route.to[1]),z1:Math.max(route.from[1],route.to[1])};expect(gap(r,a)).toBeGreaterThanOrEqual(CUSTOMER_RADIUS_M);}
 for(let t=0;t<=300;t+=.5)for(const [i,route]of routes.entries()){const p=customerPose(route,t,i);clearance=Math.min(clearance,gap(r,{x0:p.x,x1:p.x,z0:p.z,z1:p.z})-CUSTOMER_RADIUS_M);}
 expect(clearance).toBeGreaterThanOrEqual(0);expect(JSON.stringify(all)).toBe(sourceSnapshot);
 const band=(side:'front'|'back',depth:number)=>{const b={...r,z0:side==='front'?r.z1:r.z0-depth,z1:side==='front'?r.z1+depth:r.z0};const hits=obs.filter(o=>o.top>.08&&o.bottom<1.85&&intersects(b,o.r)).map(o=>o.id);expect(hits).toEqual([]);return{side,depth,hits};};
 console.log(JSON.stringify({id,size:size.toArray(),nearest,shopperBodyClearance:clearance,worldMin:box.min.toArray(),worldMax:box.max.toArray()}));
 return{f,r,obs,band};
}
for(const lod of ['near','far'] as const)it(`F120 ${lod}: actual geometry and operating body positions clear retained fixtures/architecture`,()=>{
 const f=all.find(f=>f.fixtureId==='F120')!,m=buildCheckoutReplacement(f,{stocked:true,lod})!;expect(m).not.toBeNull();
 expect(f).toMatchObject({x:-1.25,y:0,z:39.75,rotationY:0});
 expect(m.itemFlow).toEqual(['-Z','+Z']);expect(m.customerSide).toBe('+X');expect(m.staffSide).toBe('-X');
 const group=makeCheckoutReplacement(m);try{const a=audit('F120',group);
  for(const action of m.actions){const p={x0:f.x+action.stand[0],x1:f.x+action.stand[0],z0:f.z+action.stand[1],z1:f.z+action.stand[1]};
   expect(gap(a.r,p),`${action.id} own equipment body clearance`).toBeGreaterThanOrEqual(CUSTOMER_RADIUS_M-1e-5);
   for(const obstacle of a.obs.filter(o=>o.top>.08&&o.bottom<1.85))expect(gap(obstacle.r,p),`${action.id} vs ${obstacle.id}`).toBeGreaterThanOrEqual(CUSTOMER_RADIUS_M-1e-5);
  }
 }finally{disposeCheckoutReplacement(group);}
});
import {buildServiceGroupReplacement} from './serviceGroupReplacement';
import {makeServiceGroupReplacement,disposeServiceGroupReplacement} from './serviceGroupReplacementThree';
for(const id of ['F074','F007'])for(const lod of ['near','far'] as const)it(`${id} ${lod}: actual stocked group plus front/rear operating bands clear retained obstacles`,()=>{
 const f=all.find(f=>f.fixtureId===id)!,m=buildServiceGroupReplacement(f,{stocked:true,lod})!;expect(m).not.toBeNull();
 expect(f).toMatchObject(id==='F074'?{x:52,y:0,z:-28,rotationY:0}:{x:-34,y:0,z:-29,rotationY:0});
 expect(m.offsets.length).toBe(id==='F074'?4:7);
 const group=makeServiceGroupReplacement(m);try{const measured=new THREE.Box3().setFromObject(group,true).getSize(new THREE.Vector3()).toArray();
  measured.forEach((n,i)=>expect(n).toBeCloseTo(m.replacementEnvelopeM[i]!,5));
  const a=audit(id,group);
  a.band('front',1.2);a.band('back',1.2);
  const nearestFixtures=all.filter(o=>o.fixtureId!==id).map(o=>({id:o.fixtureId,gap:gap(a.r,rect(o.x,o.z,o.widthM,o.depthM,o.rotationY))})).sort((x,y)=>x.gap-y.gap);
  console.log(JSON.stringify({id,lod,declaredEnvelope:m.replacementEnvelopeM,nearestFixture:nearestFixtures[0],frontBandM:1.2,rearBandM:1.2}));
 }finally{disposeServiceGroupReplacement(group);}
});
