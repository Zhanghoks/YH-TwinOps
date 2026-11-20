import {buildFixtureDetail,type DetailFixtureShape,type DetailPart} from './detailGeometry';
import {buildRetailFixture,type RetailFixtureModel} from './retailFixture';
import {buildRefrigerationFixture,type RefrigerationFixtureModel} from './refrigerationFixture';
export interface FreshPlacement {sourceId:string;sourcePart:DetailPart;moduleIndex:number;mountId:string;anchor:readonly[number,number,number];pitchRad:number;scale:number;/** Product centered in mount-local coordinates; its bottom sits on support plane. */localCenter:readonly[number,number,number]}
export interface FreshGroupReplacementModel {fixtureId:'F029'|'F050';lod:'near'|'far';stocked:boolean;kind:'produce'|'island';frame:RetailFixtureModel|RefrigerationFixtureModel;offsets:readonly (readonly[number,number,number])[];placements:readonly FreshPlacement[];sourceItemCount:number;sourceEnvelopeM:readonly[number,number,number];replacementEnvelopeM:readonly[number,number,number];audit:{heightDeltaM:number;minProductScale:number;sourceTypes:Record<string,number>;productCount:number;notes:string[]}}
const near=(a:number,b:number)=>Math.abs(a-b)<1e-7;
export function isDenseFreshFixture(f:DetailFixtureShape):boolean {
 const expected=f.fixtureId==='F029'?{type:'PRODUCE_ISLAND',zone:'zone-produce',x:-59,z:8,w:6,d:2,h:.85,yaw:Math.PI/3}:f.fixtureId==='F050'?{type:'FREEZER',zone:'zone-frozen',x:-17,z:-29.6,w:11,d:2,h:.95,yaw:0}:null;
 return !!expected&&f.fixtureType===expected.type&&f.zoneId===expected.zone&&f.designVariant===undefined&&near(f.x,expected.x)&&near(f.z,expected.z)&&near(f.y,0)&&near(f.widthM,expected.w)&&near(f.depthM,expected.d)&&near(f.heightM,expected.h)&&near(f.rotationY,expected.yaw);
}
/** Explicit opt-in candidate only. Source fixture, products and global scene are never mutated. */
export function buildFreshGroupReplacement(f:DetailFixtureShape,{stocked=true,lod='near'}:{stocked?:boolean;lod?:'near'|'far'}={}):FreshGroupReplacementModel|null {
 if(!isDenseFreshFixture(f))return null;
 const produce=f.fixtureId==='F029';
 const frame=produce?buildRetailFixture('produce',{},lod==='near'?'high':'low'):buildRefrigerationFixture('island',{},lod==='near'?'high':'low');
 const offsets:readonly (readonly[number,number,number])[]=produce?[-1.83,-.61,.61,1.83].map(x=>[x,0,0]):[-3.753,-1.251,1.251,3.753].flatMap(x=>[-.4765,.4765].map(z=>[x,0,z] as const));
 const source=buildFixtureDetail(f).filter(p=>produce?/^crate-\d-\d-fruit-\d+$/.test(p.id):/^chilled-pack-\d-\d+$/.test(p.id));
 if(source.length!==(produce?144:30))throw new Error('Fresh source merchandise changed; remount review required');
 const placements:FreshPlacement[]=[];
 const total=offsets.length*frame.mounts.length;
 if(stocked)offsets.forEach((offset,moduleIndex)=>frame.mounts.forEach((mount,mountIndex)=>{
  const cell=moduleIndex*frame.mounts.length+mountIndex;
  const row=source.slice(Math.floor(cell*source.length/total),Math.floor((cell+1)*source.length/total));
  // Select the least-shrinking rectangular arrangement, rather than forcing two columns.
  let cols=1,best=-Infinity;
  for(let n=1;n<=Math.max(1,row.length);n++){const rows=Math.ceil(row.length/n);const score=Math.min(...row.map(p=>Math.min(1,(mount.size[0]/n-.006)/p.size[0],(mount.size[2]/rows-.006)/p.size[2],mount.size[1]/p.size[1])));if(score>best){best=score;cols=n;}}
  const rows=Math.ceil(row.length/cols),cw=mount.size[0]/cols,cd=mount.size[2]/Math.max(1,rows);
  row.forEach((part,index)=>{
   const scale=Math.min(1,(cw-.006)/part.size[0],(cd-.006)/part.size[2],mount.size[1]/part.size[1]);
   if(scale<=0)throw new Error('No usable fresh product mount');
   placements.push({sourceId:part.id,sourcePart:part,moduleIndex,mountId:mount.id,
    anchor:[offset[0]+mount.anchor[0],mount.anchor[1],offset[2]+mount.anchor[2]],pitchRad:'pitchRad' in mount?mount.pitchRad:0,scale,
    localCenter:[(index%cols+.5-cols/2)*cw,part.size[1]*scale/2,(Math.floor(index/cols)+.5-rows/2)*cd]});
  });
 }));
 const width=produce?4.88:10.008,depth=produce?1.45:1.806;
 let height=frame.dimensionsMm.height/1000;
 for(const p of placements){const c=Math.cos(p.pitchRad),s=Math.sin(p.pitchRad);height=Math.max(height,p.anchor[1]+p.localCenter[1]*c-p.localCenter[2]*s+(Math.abs(c)*p.sourcePart.size[1]+Math.abs(s)*p.sourcePart.size[2])*p.scale/2);}
 const sourceTypes:Record<string,number>={};source.forEach(p=>{sourceTypes[p.primitive]=(sourceTypes[p.primitive]??0)+1;});
 return {fixtureId:produce?'F029':'F050',lod,stocked,kind:produce?'produce':'island',frame,offsets,placements,sourceItemCount:source.length,sourceEnvelopeM:[f.widthM,f.heightM,f.depthM],replacementEnvelopeM:[width,height,depth],audit:{heightDeltaM:Math.max(0,height-f.heightM),minProductScale:placements.length?Math.min(...placements.map(p=>p.scale)):1,sourceTypes,productCount:placements.length,notes:[produce?'144 original fruit objects retained; six legacy produce-bed filler surfaces are support dressing, not SKU objects.':'30 original chilled-pack objects retained; cavity support replaces legacy deck heights.','Original product IDs, primitive types and colors preserved; uniform scale reported per placement.','Explicit trial only; no stock, capacity or legal clearance assertion.']}};
}
