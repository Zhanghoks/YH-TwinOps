import {buildFixtureDetail,type DetailFixtureShape,type DetailPart} from './detailGeometry';
import {buildRetailFixture,type RetailFixtureModel} from './retailFixture';
import {buildRefrigerationFixture,type RefrigerationFixtureModel} from './refrigerationFixture';
export interface ServicePlacement {sourceId:string;sourcePart:DetailPart;renderPart:DetailPart;role:'product'|'tray-lining';moduleIndex:number;mountId:string;anchor:readonly[number,number,number];pitchRad:0;scale:number;localCenter:readonly[number,number,number]}
export interface ServiceGroupReplacementModel {fixtureId:'F074'|'F007';lod:'near'|'far';stocked:boolean;kind:'open'|'service';frame:RetailFixtureModel|RefrigerationFixtureModel;offsets:readonly (readonly[number,number,number])[];placements:readonly ServicePlacement[];sourceItemCount:number;sourceEnvelopeM:readonly[number,number,number];replacementEnvelopeM:readonly[number,number,number];audit:{heightDeltaM:number;minProductScale:number;productCount:number;liningCount:number;notes:string[]}}
const near=(a:number,b:number)=>Math.abs(a-b)<1e-7;
export function isServiceGroupReplacementFixture(f:DetailFixtureShape):boolean {
 const e=f.fixtureId==='F074'?{type:'FREEZER',zone:'zone-daily',x:52,z:-28,w:11,d:1.4,h:2.1}:f.fixtureId==='F007'?{type:'DELI_COUNTER',zone:'zone-meat',x:-34,z:-29,w:15,d:1.8,h:1.12}:null;
 return !!e&&f.fixtureType===e.type&&f.zoneId===e.zone&&f.designVariant===undefined&&near(f.x,e.x)&&near(f.z,e.z)&&near(f.y,0)&&near(f.widthM,e.w)&&near(f.depthM,e.d)&&near(f.heightM,e.h)&&near(f.rotationY,0);
}
/** Opt-in only. Same fixture origin and +Z customer-facing orientation; source remains untouched. */
export function buildServiceGroupReplacement(f:DetailFixtureShape,{stocked=true,lod='near'}:{stocked?:boolean;lod?:'near'|'far'}={}):ServiceGroupReplacementModel|null {
 if(!isServiceGroupReplacementFixture(f))return null;
 const open=f.fixtureId==='F074',detail=lod==='near'?'high':'low';
 const frame=open?buildRefrigerationFixture('open',{},detail):buildRetailFixture('service',{},detail);
 const offsets:readonly (readonly[number,number,number])[]=Array.from({length:open?4:7},(_,i)=>[(i-(open?1.5:3))*(open?2.58:1.955),0,0] as const);
 const original=buildFixtureDetail(f),source=original.filter(p=>open?/^chilled-pack-\d-\d+$/.test(p.id):/^fresh-item-\d-\d+$/.test(p.id));
 if(source.length!==(open?30:24))throw new Error('Service source goods changed; review remount');
 const linings=original.filter(p=>/^tray-food-\d+$/.test(p.id));if(!open&&linings.length!==4)throw new Error('Service lining semantics changed');
 const placements:ServicePlacement[]=[];
 if(stocked)source.forEach((part,i)=>{
  const slot=Math.floor(i*offsets.length*frame.mounts.length/source.length),moduleIndex=Math.floor(slot/frame.mounts.length),mount=frame.mounts[slot%frame.mounts.length]!,offset=offsets[moduleIndex]!;
  const anchor=[offset[0]+mount.anchor[0],mount.anchor[1],mount.anchor[2]] as const;
  let floor=0;
  // Four original food-bed identities remain independent lining objects, not extra SKU stock.
  // Their old stretched footprint is re-cut to the new stainless tray, not uniformly miniaturized food.
  if(!open&&i%6===0){const lining=linings[i/6]!;floor=lining.size[1];const renderPart:DetailPart={...lining,size:[mount.size[0]-.012,floor,mount.size[2]-.012]};placements.push({sourceId:lining.id,sourcePart:lining,renderPart,role:'tray-lining',moduleIndex,mountId:mount.id,anchor,pitchRad:0,scale:1,localCenter:[0,floor/2,0]});}
  const scale=Math.min(1,(mount.size[0]-.018)/part.size[0],(mount.size[2]-.018)/part.size[2],(mount.size[1]-floor-.006)/part.size[1]);
  if(scale<=0)throw new Error('No service merchandise clearance');
  placements.push({sourceId:part.id,sourcePart:part,renderPart:part,role:'product',moduleIndex,mountId:mount.id,anchor,pitchRad:0,scale,localCenter:[0,floor+part.size[1]*scale/2,0]});
 });
 const height=Math.max(frame.dimensionsMm.height/1000,...placements.map(p=>p.anchor[1]+p.localCenter[1]+p.renderPart.size[1]*p.scale/2));
 const products=placements.filter(p=>p.role==='product');
 return {fixtureId:open?'F074':'F007',lod,stocked,kind:open?'open':'service',frame,offsets,placements,sourceItemCount:source.length,sourceEnvelopeM:[f.widthM,f.heightM,f.depthM],replacementEnvelopeM:[frame.dimensionsMm.width/1000*offsets.length,height,frame.dimensionsMm.depth/1000],audit:{heightDeltaM:Math.max(0,height-f.heightM),minProductScale:products.length?Math.min(...products.map(p=>p.scale)):1,productCount:products.length,liningCount:placements.length-products.length,notes:[open?'30 original package objects independently remounted; front return-air path is not a product mount.':'24 original meat objects retained. Four original tray-food beds retain identity/color but are re-cut to new tray footprints; replaced tray hardware is not counted as merchandise.','Source item ID, primitive and color retained; product dimensions use disclosed uniform scale.','Original +Z display face and fixture origin/yaw are unchanged; employee-side clearance audited separately.']}};
}
