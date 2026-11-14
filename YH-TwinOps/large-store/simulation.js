// Pure deterministic spatial simulation; no sales forecasts.
export function makeSimulationEngine(layout){
const Z=Object.fromEntries(layout.zones.map(z=>[z.id,z]));
const STEP=1, NX=79,NZ=49;
const toIndex=(x,z)=>{const ix=Math.round(x+39),iz=Math.round(z+24);return Math.max(0,Math.min(NZ-1,iz))*NX+Math.max(0,Math.min(NX-1,ix))};
const fromIndex=(id)=>({x:(id%NX)-39,z:Math.floor(id/NX)-24});
const adjacency=[[1,0],[-1,0],[0,1],[0,-1]];
function makeGrid(fixtures){
 const blocked=new Uint8Array(NX*NZ);
 for(const f of fixtures){
  // Every shelf and counter becomes an actual obstacle for customer pathing.
  const bx=f.w/2+.27,bz=f.d/2+.27;
  for(let z=Math.max(-24,Math.ceil(f.z-bz));z<=Math.min(24,Math.floor(f.z+bz));z++)
   for(let x=Math.max(-39,Math.ceil(f.x-bx));x<=Math.min(39,Math.floor(f.x+bx));x++)blocked[toIndex(x,z)]=1;
 }
 return blocked;
}
function closestFree(x,z,blocked){
 let best=-1,dist=Infinity;
 for(let dz=-5;dz<=5;dz++)for(let dx=-5;dx<=5;dx++){
  const px=Math.max(-39,Math.min(39,Math.round(x+dx)));
  const pz=Math.max(-24,Math.min(24,Math.round(z+dz)));
  const id=toIndex(px,pz);if(blocked[id])continue;
  const d=Math.hypot(px-x,pz-z);if(d<dist){best=id;dist=d;}
 }
 return best;
}
function shortest(src,dst,blocked){
 if(src<0||dst<0)return [];
 if(src===dst)return[src];
 const seen=new Uint8Array(NX*NZ),prev=new Int32Array(NX*NZ).fill(-1),q=new Int32Array(NX*NZ);
 let head=0,tail=1;q[0]=src;seen[src]=1;
 while(head<tail){
  const u=q[head++];if(u===dst)break;
  const ux=u%NX,uz=Math.floor(u/NX);
  for(const [dx,dz] of adjacency){
   const xx=ux+dx,zz=uz+dz;if(xx<0||xx>=NX||zz<0||zz>=NZ)continue;
   const v=zz*NX+xx;if(seen[v]||blocked[v])continue;seen[v]=1;prev[v]=u;q[tail++]=v;
  }
 }
 if(!seen[dst])return [];
 const out=[];for(let p=dst;p!==-1;p=prev[p])out.push(p);return out.reverse();
}
function seeded(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)}
const basketZones=['produce','seafood','meat','deli','bakery','packaged','frozen','beverages','bulk','household'];
const baskets=(()=>{
 const r=seeded(20261114);const out=[];
 for(let i=0;i<68;i++){
  const n=3+Math.floor(r()*3),items=[];
  for(let j=0;j<n;j++)items.push(basketZones[Math.floor(r()*basketZones.length)]);
  out.push(items);
 }
 return out;
})();
function simulate(fixtures){
 const blocked=makeGrid(fixtures),visits=new Uint16Array(NX*NZ),paths=[];
 const entrance=closestFree(-23,23,blocked);
 const exitIds=[closestFree(-11,23,blocked),closestFree(0,-23,blocked),closestFree(38,2,blocked)];
 const targets=new Map();
 for(const key of basketZones){
  const zoneFixtures=fixtures.filter(f=>f.zoneId===key);
  const p=zoneFixtures.length?zoneFixtures[Math.floor(zoneFixtures.length/2)]:null;
  const z=Z[key];const center=p?{x:p.x+p.w/2+1.25,z:p.z}: {x:z.x,z:z.z};
  targets.set(key,closestFree(center.x,center.z,blocked));
 }
 let total=0,miss=0;
 for(let i=0;i<baskets.length;i++){
  const b=baskets[i];let cur=entrance,route=[entrance];
  for(const key of b){const dst=targets.get(key);const seg=shortest(cur,dst,blocked);if(seg.length){route.push(...seg.slice(1));cur=dst;}else miss++;}
  let best=[];
  for(const exit of exitIds){const p=shortest(cur,exit,blocked);if(p.length&&(!best.length||p.length<best.length))best=p;}
  if(best.length)route.push(...best.slice(1));else miss++;
  total+=route.length;for(const cell of route)visits[cell]++;
  paths.push(route);
 }
 let squared=0,peak=0,hotCells=0;
 for(const count of visits){peak=Math.max(peak,count);if(count>12){squared+=(count-12)*(count-12);hotCells++;}}
 const count=paths.length;
 return {avgDist:total/count,congestion:Math.round(10*squared/(count*count))/10,hotCells,peak,miss,paths,visits,blocked};
}
function validate(fixtures){
 for(let i=0;i<fixtures.length;i++){
  const a=fixtures[i];if(Math.abs(a.x)+a.w/2>39.7||Math.abs(a.z)+a.d/2>24.8)return {ok:false,why:'货架越过门店边界'};
  for(let j=i+1;j<fixtures.length;j++){
   const b=fixtures[j];
   const dx=(a.w+b.w)/2-Math.abs(a.x-b.x),dz=(a.d+b.d)/2-Math.abs(a.z-b.z);
   if(dx>.02&&dz>.02)return {ok:false,why:`${a.id} 与 ${b.id} 发生几何碰撞`};
  }
 }
 return {ok:true,why:'布局边界与货架碰撞检查通过'};
}
function candidates(){
 const base=layout.fixtures;
 const cross=base.filter(f=>!['F044','F045'].includes(f.id));
 const fresh=base.map(f=>f.zoneId==='produce'&&Math.abs(f.z+10.5)<.3?{...f,z:f.z+1.25}:f);
 return [
  {id:'base',title:'方案 A · 原始分区',desc:'保留现有陈列对象，作为配对仿真基线。',fixtures:base},
  {id:'cross',title:'方案 B · 增设跨区通道',desc:'调整两节中央散称粮油岛台，释放中区交叉通道；需复核陈列容量。',fixtures:cross},
  {id:'fresh',title:'方案 C · 生鲜岛台错位',desc:'将中段蔬果岛台前移约 1.25m，试验生鲜步行路径变化。',fixtures:fresh}
 ];
}

return {simulate,validate,candidates,fromIndex,NX,NZ};
}
