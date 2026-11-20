import type { Fixture, StoreLayout } from '@yh/contracts';
import { DIMENSIONED_SHELF_DEFAULTS } from './dimensionedShelf';
import { REFRIGERATION_DEFAULTS } from './refrigerationFixture';
import { RETAIL_FIXTURE_DEFAULTS, type RetailFixtureKind } from './retailFixture';

/** Read-only migration audit. A candidate is NOT permission to replace a live fixture. */
export type ReplacementAsset = 'shelf-wall'|'shelf-gondola'|'cooling-island'|'cooling-upright'|'cooling-open'|'retail-produce'|'retail-service'|'retail-checkout';
export type ReplacementReason = 'unsupported-category'|'factory-pending'|'footprint-too-small'|'height-too-small'|'front-unverified'|'operation-clearance-blocked'|'product-remount-required'|'group-footprint-underfilled';
export interface ReplacementDecision {
 fixtureId:string; source:'business'|'decoration'; asset:ReplacementAsset|null;
 status:'keep-legacy'; reasons:ReplacementReason[];
 geometryCandidate:boolean;
 /** Same world transform and business ID: no moving, reorientation, tiling or forced scaling. */
 transform:{x:number;y:number;z:number;rotationY:number;scale:1};
 assetSizeM:readonly[number,number,number]|null;
 clearanceM:number|null;
 /** Empty-asset trial only. All modules remain under the original fixture ID. */
 preview:{mode:'empty-geometry-only';moduleOffsetsX:readonly number[];widthCoverage:number;depthCoverage:number}|null;
}
interface Asset {id:ReplacementAsset;width:number;depth:number;height:number;front:'both'|'positive';clearance:number;available:boolean}
const shelf=(kind:'wall'|'gondola'):Asset=>{const d=DIMENSIONED_SHELF_DEFAULTS[kind];return {id:`shelf-${kind}`,width:d.width/1000,depth:d.depth/1000,height:d.height/1000,front:kind==='gondola'?'both':'positive',clearance:1,available:true};};
const cooling=(kind:'island'|'upright'|'open'):Asset=>{const d=REFRIGERATION_DEFAULTS[kind];return {id:`cooling-${kind}`,width:d.width/1000,depth:d.depth/1000,height:d.height/1000,front:kind==='island'?'both':'positive',clearance:kind==='upright'?1.35:1,available:true};};
const retail=(kind:RetailFixtureKind):Asset=>{const d=RETAIL_FIXTURE_DEFAULTS[kind];return {id:`retail-${kind}`,width:d.width/1000,depth:d.depth/1000,height:d.height/1000,front:kind==='produce'?'both':'positive',clearance:1.2,available:true};};
function select(f:Fixture):Asset|null {
 if(f.fixtureType==='GONDOLA'&&['zone-packaged','zone-household','zone-beverages','zone-featured'].includes(f.zoneId))return shelf('gondola');
 // Bulk bins are not an ordinary shelf, and a low freezer is not an upright cabinet.
 if(f.fixtureType==='FREEZER'&&f.zoneId==='zone-frozen')return cooling(f.heightM<1.5?'island':'upright');
 if(f.fixtureType==='FREEZER'&&['zone-daily','zone-dairy'].includes(f.zoneId))return cooling('open');
 if(f.fixtureType==='PRODUCE_ISLAND')return retail('produce');
 if(f.fixtureType==='DELI_COUNTER'&&['zone-meat','zone-deli'].includes(f.zoneId))return retail('service');
 if(f.fixtureType==='CHECKOUT')return retail('checkout');
 return null;
}
interface Box {x:number;z:number;hx:number;hz:number;yaw:number}
function intersects(a:Box,b:Box):boolean {
 const axes=[a.yaw,a.yaw+Math.PI/2,b.yaw,b.yaw+Math.PI/2];
 return axes.every(t=>{
  const ux=Math.cos(t),uz=-Math.sin(t),dx=b.x-a.x,dz=b.z-a.z;
  const extent=(q:Box)=>q.hx*Math.abs(Math.cos(t-q.yaw))+q.hz*Math.abs(Math.sin(t-q.yaw));
  return Math.abs(dx*ux+dz*uz)<extent(a)+extent(b)-1e-8;
 });
}
/** Optional verified fronts identify real +Z service orientation, not an inferred aisle direction.
 * Layout/decorations exclude architectural doors/walls, so even passing clearance is provisional.
 */
export function planFixtureReplacements(layout:StoreLayout,decorations:readonly Fixture[]=[],verifiedPositiveFronts:ReadonlySet<string>=new Set()):ReplacementDecision[] {
 const fixtures=[...layout.fixtures,...decorations];
 return fixtures.map((f,index)=>{
  const a=select(f),reasons:ReplacementReason[]=[];
  const modules=a?Math.floor((f.widthM+1e-8)/a.width):0;
  const widthCoverage=a?modules*a.width/f.widthM:0,depthCoverage=a?a.depth/f.depthM:0;
  if(!a)reasons.push('unsupported-category');
  else {
   if(!a.available)reasons.push('factory-pending');
   if(a.width>f.widthM+1e-8||a.depth>f.depthM+1e-8)reasons.push('footprint-too-small');
   if(a.height>f.heightM+1e-8)reasons.push('height-too-small');
   if(modules>0&&(widthCoverage<.75||depthCoverage<.6))reasons.push('group-footprint-underfilled');
   if(a.front==='positive'&&!verifiedPositiveFronts.has(f.fixtureId))reasons.push('front-unverified');
   const sides=a.front==='both'||a.id==='retail-service'||a.id==='retail-checkout'?[-1,1]:[1];
   const blocked=sides.some(side=>{
    // Reserve from the OLD envelope, not inside unused space of a shorter new model.
    const z=side*(f.depthM/2+a.clearance/2);
    const box={x:f.x+Math.sin(f.rotationY)*z,z:f.z+Math.cos(f.rotationY)*z,hx:f.widthM/2,hz:a.clearance/2,yaw:f.rotationY};
    const c=Math.abs(Math.cos(box.yaw)),s=Math.abs(Math.sin(box.yaw));
    if(Math.abs(box.x)+c*box.hx+s*box.hz>layout.widthM/2||Math.abs(box.z)+s*box.hx+c*box.hz>layout.depthM/2)return true;
    return fixtures.some(other=>other!==f&&intersects(box,{x:other.x,z:other.z,hx:other.widthM/2,hz:other.depthM/2,yaw:other.rotationY}));
   });
   if(blocked)reasons.push('operation-clearance-blocked');
  }
  const geometryCandidate=!!a&&reasons.length===0;
  // Old goods depend on old shelf/cavity anchors. Do not remove them or leave them floating.
  if(a)reasons.push('product-remount-required');
  return {fixtureId:f.fixtureId,source:index<layout.fixtures.length?'business':'decoration',asset:a?.id??null,status:'keep-legacy',reasons,geometryCandidate,
   transform:{x:f.x,y:f.y,z:f.z,rotationY:f.rotationY,scale:1},assetSizeM:a?[a.width,a.depth,a.height]:null,clearanceM:a?.clearance??null,
   preview:a&&modules>0?{mode:'empty-geometry-only',moduleOffsetsX:Array.from({length:modules},(_,i)=>(i-(modules-1)/2)*a.width),widthCoverage,depthCoverage}:null};
 });
}
