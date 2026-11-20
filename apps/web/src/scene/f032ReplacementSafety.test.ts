import {describe,it,expect} from 'vitest';
import {layout as baseline} from '../data';
import {generatePlanningLayout,buildReferenceDisplayFixtures} from './planningLayout';
import {buildDimensionedShelf} from './dimensionedShelf';
import {buildReferenceArchitecture} from './referenceArchitecture';
import {buildStoreArchitecture} from './storeArchitecture';
import {buildExteriorArchitecture} from './exteriorArchitecture';
import {buildCityContext} from './cityContext';
import {buildUrbanFabric} from './urbanFabric';
import {buildCustomerRoutes,customerPose,CUSTOMER_RADIUS_M} from './customerMotion';

// This test describes the user's explicit F032-only height exception. It grants no
// generalized migration permission and does not alter fixtures, routes or goods.
const layout=generatePlanningLayout(baseline).layout;
const decorations=buildReferenceDisplayFixtures(layout);
const original=layout.fixtures.find(f=>f.fixtureId==='F032')!;
const replacement={...original,widthM:7.2,depthM:1,heightM:1.6};
type Box={x0:number;x1:number;z0:number;z1:number};
const bounds=(f:{x:number;z:number;widthM:number;depthM:number;rotationY:number}):Box=>{
 const c=Math.abs(Math.cos(f.rotationY)),s=Math.abs(Math.sin(f.rotationY));
 const hx=(c*f.widthM+s*f.depthM)/2,hz=(s*f.widthM+c*f.depthM)/2;
 return{x0:f.x-hx,x1:f.x+hx,z0:f.z-hz,z1:f.z+hz};
};
const box=bounds(replacement);
const gap=(a:Box,b:Box)=>Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.z0-b.z1,b.z0-a.z1));

describe('F032-only full-size three-gondola trial safety',()=>{
 it('keeps the original ID/world transform and confines three unscaled factory modules to its footprint',()=>{
  expect(original).toMatchObject({fixtureId:'F032',zoneId:'zone-featured',x:9,y:0,rotationY:0,widthM:7.6,depthM:1.2,heightM:1.48});
  expect(original.z).toBeCloseTo(26.25);
  expect(replacement.heightM-original.heightM).toBeCloseTo(.12);
  const model=buildDimensionedShelf('gondola');
  expect(model.dimensionsMm).toMatchObject({width:2400,depth:1000,height:1600});
  for(const offset of [-2.4,0,2.4])for(const p of model.parts){
   expect(p.min[0]+offset).toBeGreaterThanOrEqual(-3.6-1e-8);
   expect(p.max[0]+offset).toBeLessThanOrEqual(3.6+1e-8);
   expect(p.min[2]).toBeGreaterThanOrEqual(-.5-1e-8);expect(p.max[2]).toBeLessThanOrEqual(.5+1e-8);
   expect(p.max[1]).toBeLessThanOrEqual(1.6+1e-8);
  }
  const old=bounds(original);expect(box.x0-old.x0).toBeCloseTo(.2);expect(old.x1-box.x1).toBeCloseTo(.2);
  expect(box.z0-old.z0).toBeCloseTo(.1);expect(old.z1-box.z1).toBeCloseTo(.1);
 });
 it('retains 1.75m to nearest rack F047 and clear front/back service strips',()=>{
  const neighbors=[...layout.fixtures,...decorations].filter(f=>f.fixtureId!=='F032').map(f=>({id:f.fixtureId,b:bounds(f)})).sort((a,b)=>gap(box,a.b)-gap(box,b.b));
  expect(neighbors[0]!.id).toBe('F047');expect(gap(box,neighbors[0]!.b)).toBeCloseTo(1.75);
  expect(gap(box,neighbors.find(f=>f.id==='F033')!.b)).toBeCloseTo(3.6);
  for(const strip of [{...box,z0:box.z1,z1:box.z1+1},{...box,z0:box.z0-1,z1:box.z0}]){
   for(const n of neighbors)expect(gap(strip,n.b)).toBeGreaterThan(1e-8);
  }
 });
 it('does not intersect any currently generated building/detail envelope at its new height',()=>{
  const shell=buildStoreArchitecture(130,100,{entranceCenterX:-22.5,entranceWidthM:23,neutralFacade:true}).filter(p=>!p.id.startsWith('entrance-cart-rack'));
  const parts=[...shell,...buildReferenceArchitecture(layout.fixtures),...buildExteriorArchitecture(130,100,-22.5),...buildCityContext(130,100),...buildUrbanFabric(130,100)];
  const overlaps=parts.filter(p=>p.position[1]+p.size[1]/2>0&&p.position[1]-p.size[1]/2<1.6).filter(p=>{
   const b={x0:p.position[0]-p.size[0]/2,x1:p.position[0]+p.size[0]/2,z0:p.position[2]-p.size[2]/2,z1:p.position[2]+p.size[2]/2};
   return Math.min(box.x1,b.x1)>Math.max(box.x0,b.x0)+1e-8&&Math.min(box.z1,b.z1)>Math.max(box.z0,b.z0)+1e-8;
  });
  expect(overlaps.map(p=>p.id)).toEqual([]);
 });
 it('does not reroute or obstruct the existing 28 shoppers over five minutes',()=>{
  const routes=buildCustomerRoutes(layout,decorations),before=JSON.stringify(routes);
  expect(routes).toHaveLength(28);
  let minimum=Infinity;
  for(const route of routes){
   // Whole-segment envelope proof complements time sampling, including pauses/turns.
   const b={x0:Math.min(route.from[0],route.to[0]),x1:Math.max(route.from[0],route.to[0]),z0:Math.min(route.from[1],route.to[1]),z1:Math.max(route.from[1],route.to[1])};
   expect(gap(box,b)).toBeGreaterThanOrEqual(CUSTOMER_RADIUS_M);
  }
  for(let time=0;time<=300;time+=.25)routes.forEach((route,index)=>{
   const p=customerPose(route,time,index),distance=gap(box,{x0:p.x,x1:p.x,z0:p.z,z1:p.z});
   minimum=Math.min(minimum,distance);expect(distance).toBeGreaterThanOrEqual(CUSTOMER_RADIUS_M);
  });
  expect(JSON.stringify(routes)).toBe(before);
  console.log('F032 minimum existing shopper center distance',minimum,'body clearance',minimum-CUSTOMER_RADIUS_M);
 });
});
