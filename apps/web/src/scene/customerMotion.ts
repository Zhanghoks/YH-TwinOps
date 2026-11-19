import type { Fixture, StoreLayout } from '@yh/contracts';

/** Synthetic staged shoppers, never observations, demand forecasts or a crowd simulator. */
export const CUSTOMER_RADIUS_M = .4;
const CLEARANCE = .52;
type Point = readonly [number, number];
export interface CustomerRoute { from: Point; to: Point; speed: number; pauseSeconds: number }
export interface CustomerPose { x:number; z:number; yaw:number; walking:boolean; stride:number; phase:number; state:'walking'|'browsing'|'turning' }
type Obstacle = Pick<Fixture,'x'|'z'|'widthM'|'depthM'|'rotationY'>;
interface Box { x0:number;x1:number;z0:number;z1:number }
function bounds(f:Obstacle,pad=0):Box {
 const c=Math.abs(Math.cos(f.rotationY)),s=Math.abs(Math.sin(f.rotationY));
 const x=(c*f.widthM+s*f.depthM)/2+pad,z=(s*f.widthM+c*f.depthM)/2+pad;
 return {x0:f.x-x,x1:f.x+x,z0:f.z-z,z1:f.z+z};
}
function routeBox(r:CustomerRoute):Box {return {x0:Math.min(r.from[0],r.to[0]),x1:Math.max(r.from[0],r.to[0]),z0:Math.min(r.from[1],r.to[1]),z1:Math.max(r.from[1],r.to[1])};}
function gap(a:Box,b:Box) {return Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.z0-b.z1,b.z0-a.z1));}
/** Conservative rotated-fixture clearance used both by planning and regression tests. */
export function customerPointClear(point:Point,fixtures:readonly Obstacle[],radius=CUSTOMER_RADIUS_M):boolean {
 return fixtures.every(f=>{const b=bounds(f,radius);return point[0]<b.x0||point[0]>b.x1||point[1]<b.z0||point[1]>b.z1;});
}
/** Short separate aisle segments keep staged shoppers off fixtures and one another.
 * Does not assert end-to-end shopping/navigation or avoidance of unregistered objects.
 */
export function buildCustomerRoutes(layout:StoreLayout,decorations:readonly Obstacle[]=[],count=28):CustomerRoute[] {
 if(!Number.isInteger(count)||count<0||count>64)throw new RangeError('Customer count must be 0–64');
 if(count===0)return [];
 const obstacles=[...layout.fixtures,...decorations].map(f=>bounds(f,CLEARANCE));
 // Stay out of the shell, south checkout line and northern backroom/service architecture.
 const xmin=-layout.widthM/2+4,xmax=layout.widthM/2-4;
 const zmin=-layout.depthM/2+(layout.widthM>=100?20:8),zmax=layout.widthM>=100?31:layout.depthM/2-10;
 const candidates:CustomerRoute[]=[];
 const clear=(x:number,z:number)=>obstacles.every(b=>x<b.x0||x>b.x1||z<b.z0||z>b.z1);
 for(const vertical of [false,true]) {
  const acrossMin=vertical?xmin:zmin,acrossMax=vertical?xmax:zmax;
  const alongMin=vertical?zmin:xmin,alongMax=vertical?zmax:xmax;
  for(let a=acrossMin;a<=acrossMax;a+=1.1) {
   let start:number|undefined;
   const emit=(end:number)=>{if(start===undefined)return;for(let v=start;v+3.6<=end;v+=6.8){const e=Math.min(v+5.5,end);candidates.push({from:vertical?[a,v]:[v,a],to:vertical?[a,e]:[e,a],speed:.8,pauseSeconds:3});}};
   for(let b=alongMin;b<=alongMax+.3;b+=.25) {
    const free=b<=alongMax&&clear(vertical?a:b,vertical?b:a);
    if(free&&start===undefined)start=b;
    if(!free&&start!==undefined){emit(b-.25);start=undefined;}
   }
  }
 }
 // Verify entire route against expanded boxes, not only sampled points.
 const safe=candidates.filter(r=>obstacles.every(b=>gap(routeBox(r),b)>1e-7));
 const chosen:CustomerRoute[]=[];
 while(chosen.length<count&&safe.length) {
  let best=-1,bestScore=-Infinity;
  for(let i=0;i<safe.length;i++) {
   const r=safe[i]!,box=routeBox(r);
   if(chosen.some(other=>gap(box,routeBox(other))<1.15))continue;
   const mid=[(r.from[0]+r.to[0])/2,(r.from[1]+r.to[1])/2];
   const distance=chosen.length?Math.min(...chosen.map(o=>Math.hypot(mid[0]!-(o.from[0]+o.to[0])/2,mid[1]!-(o.from[1]+o.to[1])/2))): -Math.hypot(mid[0]!,mid[1]!);
   if(distance>bestScore){bestScore=distance;best=i;}
  }
  if(best<0)break;
  const r=safe.splice(best,1)[0]!;chosen.push({...r,speed:.65+(chosen.length%5)*.075,pauseSeconds:2.8+(chosen.length%4)*.65});
 }
 return chosen;
}
const smooth=(v:number)=>v*v*(3-2*v);
export function customerPose(route:CustomerRoute,time:number,index=0):CustomerPose {
 if(!Number.isFinite(time)||time<0)throw new RangeError('Customer time must be finite and nonnegative');
 const dx=route.to[0]-route.from[0],dz=route.to[1]-route.from[1],length=Math.hypot(dx,dz);
 const travel=length/route.speed,pause=route.pauseSeconds,half=travel+pause,cycle=half*2;
 const t=(time+index*2.731)%cycle,back=t>=half,local=t%half;
 const walking=local<travel,progress=walking?local/travel:1;
 const u=back?1-progress:progress,base=Math.atan2(dx,dz)+(back?Math.PI:0);
 const rest=Math.max(0,local-travel)/pause;
 // Browsing for the first 65% of a stop, then a smooth half-turn before returning.
 const turn=walking?0:smooth(Math.max(0,(rest-.65)/.35));
 const phase=local*route.speed*8.5;
 const ramp=walking?Math.min(1,local/.3,(travel-local)/.3):0;
 return {x:route.from[0]+dx*u,z:route.from[1]+dz*u,yaw:base+turn*Math.PI,walking,stride:walking?Math.sin(phase)*Math.max(0,ramp):0,phase,state:walking?'walking':turn>0?'turning':'browsing'};
}
