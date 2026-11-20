import {it,expect} from 'vitest';
import {buildFreshGroupReplacement} from './freshGroupReplacement';
import {buildShelfGroupReplacement} from './shelfGroupReplacement';
import {layout as baseline} from '../data';
import {generatePlanningLayout,buildReferenceDisplayFixtures} from './planningLayout';
import {buildReferenceArchitecture} from './referenceArchitecture';
import {buildStoreArchitecture} from './storeArchitecture';
import {buildCustomerRoutes,customerPose,CUSTOMER_RADIUS_M} from './customerMotion';

// Proposed fixed-size groups. Geometry approval alone does not certify goods remounting,
// actual operation direction, temperature class or a binding aisle standard.
const proposals=[
 {id:'F029',kind:'produce',width:4.88,depth:1.45,height:.94,modules:4},
 {id:'F050',kind:'island',width:10.008,depth:1.806,height:.833,modules:8},
 {id:'F077',kind:'gondola-food',width:4.8,depth:1,height:1.6,modules:2},
 {id:'F107',kind:'gondola-household-explicit-2300mm',width:6.9,depth:1,height:1.6,modules:3},
 {id:'F007',kind:'service-review-only',width:13.685,depth:1.086,height:1.29,modules:7},
 {id:'F074',kind:'open-review-only',width:10.32,depth:.915,height:2.09,modules:4},
];
const layout=generatePlanningLayout(baseline).layout,decorations=buildReferenceDisplayFixtures(layout);
const all=[...layout.fixtures,...decorations];
type Box={x0:number;x1:number;z0:number;z1:number};
function bounds(f:{x:number;z:number;widthM:number;depthM:number;rotationY:number}):Box{
 const c=Math.abs(Math.cos(f.rotationY)),s=Math.abs(Math.sin(f.rotationY));
 const hx=(c*f.widthM+s*f.depthM)/2,hz=(s*f.widthM+c*f.depthM)/2;
 return{x0:f.x-hx,x1:f.x+hx,z0:f.z-hz,z1:f.z+hz};
}
const gap=(a:Box,b:Box)=>Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.z0-b.z1,b.z0-a.z1));
const architecture=[...buildStoreArchitecture(130,100,{entranceCenterX:-22.5,entranceWidthM:23,neutralFacade:true}).filter(p=>!p.id.startsWith('entrance-cart-rack')),...buildReferenceArchitecture(layout.fixtures)];
const routes=buildCustomerRoutes(layout,decorations);
for(const proposed of proposals)it(`${proposed.id} ${proposed.kind}: retains original transform and does not obstruct fixtures, modeled architecture or existing shopper tracks`,()=>{
 const f=layout.fixtures.find(f=>f.fixtureId===proposed.id)!;
 const built=buildFreshGroupReplacement(f)??buildShelfGroupReplacement(f);
 if(['F029','F050','F077','F107'].includes(f.fixtureId)){
  expect(built).not.toBeNull();
  expect(built!.replacementEnvelopeM[0]).toBeCloseTo(proposed.width);
  expect(built!.replacementEnvelopeM[2]).toBeCloseTo(proposed.depth);
 }
 const p={...proposed,height:built?.replacementEnvelopeM[1]??proposed.height};
 expect(f.rotationY).toBe(p.id==='F029'?Math.PI/3:0);expect(p.width).toBeLessThanOrEqual(f.widthM+1e-8);expect(p.depth).toBeLessThanOrEqual(f.depthM+1e-8);
 const b=bounds({...f,widthM:p.width,depthM:p.depth});
 const neighbors=all.filter(g=>g.fixtureId!==p.id).map(g=>({id:g.fixtureId,b:bounds(g)})).sort((a,c)=>gap(b,a.b)-gap(b,c.b));
 expect(gap(b,neighbors[0]!.b)).toBeGreaterThanOrEqual(1);
 const overlaps=architecture.filter(part=>part.position[1]+part.size[1]/2>0&&part.position[1]-part.size[1]/2<p.height).filter(part=>{
  const a={x0:part.position[0]-part.size[0]/2,x1:part.position[0]+part.size[0]/2,z0:part.position[2]-part.size[2]/2,z1:part.position[2]+part.size[2]/2};
  return Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)+1e-8&&Math.min(a.z1,b.z1)>Math.max(a.z0,b.z0)+1e-8;
 });
 expect(overlaps.map(p=>p.id)).toEqual([]);
 let minimum=Infinity;
 for(const route of routes){
  const a={x0:Math.min(route.from[0],route.to[0]),x1:Math.max(route.from[0],route.to[0]),z0:Math.min(route.from[1],route.to[1]),z1:Math.max(route.from[1],route.to[1])};
  expect(gap(b,a)).toBeGreaterThanOrEqual(CUSTOMER_RADIUS_M);
 }
 for(let t=0;t<=300;t+=.5)routes.forEach((route,i)=>{const pose=customerPose(route,t,i),d=gap(b,{x0:pose.x,x1:pose.x,z0:pose.z,z1:pose.z});minimum=Math.min(minimum,d);expect(d).toBeGreaterThanOrEqual(CUSTOMER_RADIUS_M);});
 console.log(JSON.stringify({id:p.id,original:{x:f.x,z:f.z,yaw:f.rotationY,w:f.widthM,d:f.depthM,h:f.heightM},proposal:p,nearest:neighbors[0]!.id,gap:gap(b,neighbors[0]!.b),shopperBodyClearance:minimum-CUSTOMER_RADIUS_M,architecturalOverlaps:overlaps.length}));
});
it('does not treat fixed-yaw checkouts or shallow wall shelves as interchangeable equipment',()=>{
 const checkout=layout.fixtures.find(f=>f.fixtureId==='F120')!;
 expect(checkout.widthM).toBeLessThan(2.5);

 // No upright freezer may be inferred from a shallow island footprint alone.
 expect(layout.fixtures.filter(f=>f.zoneId==='zone-frozen').every(f=>f.heightM<1.5)).toBe(true);
});
