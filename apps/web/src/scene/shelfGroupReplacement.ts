import { buildDimensionedShelf, type DimensionedShelfModel, type ShelfMount } from './dimensionedShelf';
import type { DetailFixtureShape, DetailPart } from './detailGeometry';
import { buildMerchandise, buildShelfPlanogram, type ShelfSlot } from './shelfDisplay';

export type ShelfGroupReplacementId = 'F077'|'F107';
type Lod = 'near'|'far';
interface Spec {
  zoneId:'zone-packaged'|'zone-household';
  origin:readonly [number,number,number];
  envelope:readonly [number,number,number];
  moduleWidthMm:number;
  modules:number;
}
export const SHELF_GROUP_REPLACEMENT_SPECS:Readonly<Record<ShelfGroupReplacementId,Spec>> = {
  F077:{zoneId:'zone-packaged',origin:[-20,0,-10.8],envelope:[4.8,1.54,1.2],moduleWidthMm:2400,modules:2},
  F107:{zoneId:'zone-household',origin:[37,0,-3],envelope:[7,1.54,1.5],moduleWidthMm:2300,modules:3},
};
export interface ShelfGroupPlacement {
  sourceId:string;
  sourceSlot:ShelfSlot;
  mount:ShelfMount;
  rackIndex:number;
  scale:number;
  slot:ShelfSlot;
  merchandise:readonly DetailPart[];
}
export interface ShelfGroupReplacementModel {
  fixtureId:ShelfGroupReplacementId;
  lod:Lod;
  stocked:boolean;
  sourceEnvelopeM:readonly [number,number,number];
  replacementEnvelopeM:readonly [number,number,number];
  frame:DimensionedShelfModel;
  rackOffsetsM:readonly number[];
  sourceItemCount:number;
  placements:readonly ShelfGroupPlacement[];
}

const equal=(a:number,b:number)=>Math.abs(a-b)<1e-6;
export function isShelfGroupReplacementFixture(f:DetailFixtureShape):f is DetailFixtureShape & {fixtureId:ShelfGroupReplacementId} {
  if(f.fixtureId!=='F077'&&f.fixtureId!=='F107')return false;
  const spec=SHELF_GROUP_REPLACEMENT_SPECS[f.fixtureId];
  const [x,y,z]=spec.origin,[w,h,d]=spec.envelope;
  return f.zoneId===spec.zoneId&&f.fixtureType==='GONDOLA'&&f.designVariant===undefined&&
    equal(f.x,x)&&equal(f.y,y)&&equal(f.z,z)&&equal(f.widthM,w)&&equal(f.heightM,h)&&equal(f.depthM,d)&&equal(f.rotationY,0);
}

export function buildShelfGroupReplacement(f:DetailFixtureShape,{stocked=true,lod='near'}:{stocked?:boolean;lod?:Lod}={}):ShelfGroupReplacementModel|null {
  if(!isShelfGroupReplacementFixture(f))return null;
  const spec=SHELF_GROUP_REPLACEMENT_SPECS[f.fixtureId];
  const frame=buildDimensionedShelf('gondola',{width:spec.moduleWidthMm},lod==='near'?'high':'low');
  const w=frame.dimensionsMm.width/1000;
  const rackOffsetsM=Array.from({length:spec.modules},(_,i)=>(i+.5-spec.modules/2)*w);
  const source=buildShelfPlanogram(f);
  const placements:ShelfGroupPlacement[]=[];
  if(stocked) for(const face of [-1,1] as const){
    const onSide=source.filter(s=>s.side===face);
    const topNet=frame.mounts.find(m=>m.side===face&&m.level===4)?.size[1] ?? 0;
    // Set aside shallow products for the 192 mm top row; keep related products
    // in their original stable side order when allocating all five levels.
    const fitsTop=onSide.filter(s=>s.modelSize[1]<=topNet);
    const useTop=Math.min(Math.ceil(onSide.length/5),fitsTop.length);
    const top=new Set(fitsTop.filter((_,i)=>Math.floor((i+1)*useTop/fitsTop.length)>Math.floor(i*useTop/fitsTop.length)));
    const lower=onSide.filter(s=>!top.has(s));
    for(let level=0;level<5;level++){
      const row=level===4?onSide.filter(s=>top.has(s)):
        lower.slice(Math.floor(level*lower.length/4),Math.floor((level+1)*lower.length/4));
      const mounts=frame.mounts.filter(m=>m.side===face&&m.level===level);
      const mountCount=mounts.length*rackOffsetsM.length;
      for(const [rackIndex,offset] of rackOffsetsM.entries()) for(const [bay,mount] of mounts.entries()){
        const m=mounts.length*rackIndex+bay;
        const items=row.slice(Math.floor(row.length*m/mountCount),Math.floor(row.length*(m+1)/mountCount));
        const cellWidth=mount.size[0]/Math.max(1,items.length);
        for(const [col,article] of items.entries()){
          const [sx,sy,sz]=article.modelSize;
          const scale=Math.min(1,(cellWidth-.006)/sx,mount.size[1]/sy,(mount.size[2]-.12)/sz);
          const slot:ShelfSlot={...article,level,col,modelSize:[sx*scale,sy*scale,sz*scale],
            anchor:[offset+mount.anchor[0]+(col+.5-items.length/2)*cellWidth,mount.anchor[1],mount.anchor[2]+face*.045],
            cellSize:[cellWidth,mount.size[1],mount.size[2]]};
          // The source's level is part of the product's original decoration recipe.
          const merchandise=buildMerchandise({...slot,level:article.level});
          placements.push({sourceId:article.id,sourceSlot:article,rackIndex,mount,scale,slot,merchandise});
        }
      }
    }
  }
  return {fixtureId:f.fixtureId,lod,stocked,sourceEnvelopeM:spec.envelope,
    replacementEnvelopeM:[w*spec.modules,frame.dimensionsMm.height/1000,frame.dimensionsMm.depth/1000],
    frame,rackOffsetsM,sourceItemCount:source.length,placements};
}
