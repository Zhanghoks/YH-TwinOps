import {describe,it,expect} from 'vitest';
import {layout as baseline} from '../data';
import {buildReferenceDisplayFixtures,generatePlanningLayout} from './planningLayout';
import {buildCustomerRoutes,customerPose,customerPointClear,CUSTOMER_RADIUS_M} from './customerMotion';

describe('synthetic shopper aisle animation',()=>{
 for(const dense of [false,true])it(`keeps 28 staged shoppers clear for 5 minutes (${dense?'dense':'baseline'})`,()=>{
  const layout=dense?generatePlanningLayout(baseline).layout:baseline;
  const decorations=dense?buildReferenceDisplayFixtures(layout):[];
  const before=JSON.stringify(layout),fixtures=[...layout.fixtures,...decorations];
  const routes=buildCustomerRoutes(layout,decorations);
  expect(routes).toHaveLength(28);
  expect(buildCustomerRoutes(layout,decorations)).toEqual(routes);
  expect(JSON.stringify(layout)).toBe(before);
  let walks=0,stops=0,turns=0;
  for(let t=0;t<=300;t+=.5){
   const poses=routes.map((r,i)=>customerPose(r,t,i));
   poses.forEach((p,i)=>{
    expect(customerPointClear([p.x,p.z],fixtures)).toBe(true);
    expect(Math.abs(p.x)+CUSTOMER_RADIUS_M).toBeLessThan(layout.widthM/2);
    expect(Math.abs(p.z)+CUSTOMER_RADIUS_M).toBeLessThan(layout.depthM/2);
    if(dense){expect(p.z).toBeLessThanOrEqual(31);expect(p.z).toBeGreaterThanOrEqual(-30);}
    expect([p.x,p.z,p.yaw,p.stride,p.phase].every(Number.isFinite)).toBe(true);
    if(p.walking)walks++;else{stops++;expect(p.stride).toBe(0);}
    if(p.state==='turning')turns++;
    for(let j=i+1;j<poses.length;j++)expect(Math.hypot(p.x-poses[j]!.x,p.z-poses[j]!.z)).toBeGreaterThanOrEqual(1.15-1e-7);
   });
  }
  expect(walks).toBeGreaterThan(0);expect(stops).toBeGreaterThan(0);expect(turns).toBeGreaterThan(0);
 });
 it('caps count and keeps an empty scene cheap',()=>{
  expect(buildCustomerRoutes(baseline,[],0)).toEqual([]);
  expect(()=>buildCustomerRoutes(baseline,[],65)).toThrow();
  const route=buildCustomerRoutes(baseline,[],1)[0]!;
  expect(()=>customerPose(route,-1)).toThrow();
  const p=customerPose(route,0);expect(p.stride).toBe(0);
 });
});
