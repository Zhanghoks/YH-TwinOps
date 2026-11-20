import { buildDimensionedShelf, type DimensionedShelfModel, type ShelfMount } from './dimensionedShelf';
import { type DetailFixtureShape, type DetailPart } from './detailGeometry';
import { buildMerchandise, buildShelfPlanogram, type ShelfSlot } from './shelfDisplay';

export type F032ReplacementLod='near'|'far';
export interface F032ReplacementModel {
  fixtureId:'F032';
  lod:F032ReplacementLod;
  stocked:boolean;
  sourceEnvelopeM:readonly [number,number,number];
  replacementEnvelopeM:readonly [number,number,number];
  frame:DimensionedShelfModel;
  rackOffsetsM:readonly number[];
  sourceItemCount:number;
  placements:readonly F032Placement[];
}
export interface F032Placement {
  sourceId:string;
  sourceSlot:ShelfSlot;
  mount:ShelfMount;
  rackIndex:number;
  /** Uniform scale only if the original visual item cannot fit the allocated net envelope. */
  scale:number;
  slot:ShelfSlot;
  merchandise:readonly DetailPart[];
}

const RACK_OFFSETS=[-2.4,0,2.4] as const;
const ENVELOPE=[7.2,1.6,1] as const; // Three.js order: width, height, depth.
const approx=(a:number,b:number)=>Math.abs(a-b)<1e-6;

/** Guard against the baseline's different F032 and accidental reuse for another fixture. */
export function isDenseF032Fixture(f:DetailFixtureShape):boolean {
  return f.fixtureId==='F032'&&f.fixtureType==='GONDOLA'&&f.zoneId==='zone-featured'&&
    approx(f.x,9)&&approx(f.y,0)&&approx(f.z,26.25)&&approx(f.rotationY,0)&&
    approx(f.widthM,7.6)&&approx(f.depthM,1.2)&&approx(f.heightM,1.48)&&f.designVariant===undefined;
}

/** Each product keeps its original model/color. Preserve exact size where it fits. */
export function buildF032Replacement(
  fixture:DetailFixtureShape,{stocked=true,lod='near'}:{stocked?:boolean;lod?:F032ReplacementLod}={},
):F032ReplacementModel|null {
  if(!isDenseF032Fixture(fixture)) return null;
  const frame=buildDimensionedShelf('gondola',{},lod==='near'?'high':'low');
  const source=buildShelfPlanogram(fixture);
  const placements:F032Placement[]=[];
  if(stocked) for(const face of [-1,1] as const){
    const onSide=source.filter(slot=>slot.side===face);
    const fitsTop=onSide.filter(slot=>slot.modelSize[1]<=.192);
    // Keep the fifth deck useful while preserving full-scale tall packaging below.
    // Select across the original assortments rather than lifting one entire facing group.
    const top=new Set(fitsTop.filter((_,i)=>Math.floor((i+1)*20/fitsTop.length)>Math.floor(i*20/fitsTop.length)));
    const lower=onSide.filter(s=>!top.has(s));
    for(let level=0;level<5;level++){
      const row=level===4?onSide.filter(s=>top.has(s)):
        lower.slice(Math.floor(level*lower.length/4),Math.floor((level+1)*lower.length/4));
      const mounts=frame.mounts.filter(m=>m.side===face&&m.level===level);
      const mountTotal=RACK_OFFSETS.length*mounts.length;
      for(const [rackIndex,offset] of RACK_OFFSETS.entries())for(const [bay,mount] of mounts.entries()){
        const col=rackIndex*mounts.length+bay;
        const facing=row.slice(Math.floor(col*row.length/mountTotal),Math.floor((col+1)*row.length/mountTotal));
        const cellWidth=mount.size[0]/Math.max(1,facing.length);
        for(const [i,item] of facing.entries()){
          const scale=Math.min(1,(cellWidth-.006)/item.modelSize[0],mount.size[1]/item.modelSize[1],(mount.size[2]-.12)/item.modelSize[2]);
          const slot:ShelfSlot={...item,level,col:i,cellSize:[cellWidth,mount.size[1],mount.size[2]],
            modelSize:[item.modelSize[0]*scale,item.modelSize[1]*scale,item.modelSize[2]*scale],
            anchor:[offset+mount.anchor[0]+(i+.5-facing.length/2)*cellWidth,mount.anchor[1],mount.anchor[2]+face*.045]};
          // Use the original level for decoration rules (e.g. the carton stripe).
          const merchandise=buildMerchandise({...slot,level:item.level});
          placements.push({sourceId:item.id,sourceSlot:item,mount,rackIndex,scale,slot,merchandise});
        }
      }
    }
  }
  return {fixtureId:'F032',lod,stocked,sourceEnvelopeM:[fixture.widthM,fixture.heightM,fixture.depthM],
    replacementEnvelopeM:ENVELOPE,frame,rackOffsetsM:RACK_OFFSETS,sourceItemCount:source.length,placements};
}
