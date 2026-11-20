/** Read-only merchandising tools. Counts of placements never imply inventory. */
import type {MerchandisingSnapshot} from '@yh/contracts';
import type {AgentEvidence,AgentToolResult,AgentTools} from './tools';

function validArgs(value:unknown,required:string,optional?:string):value is Record<string,string> {
 if(value===null||typeof value!=='object'||Array.isArray(value))return false;
 const entries=Object.entries(value);
 return entries.every(([key,v])=>(key===required||key===optional)&&typeof v==='string'&&v.trim().length>0&&v.length<=160)
  && entries.some(([key])=>key===required);
}
export function createMerchandiseTools(snapshot:MerchandisingSnapshot|undefined,storeId:string,at:string):Pick<AgentTools,'get_fixture_products'|'get_sku_inventory'> {
 const available=snapshot!==undefined&&snapshot.storeId===storeId&&snapshot.at===at;
 const unknown=(reason:string,message:string):AgentToolResult=>({status:'UNKNOWN',message,data:{reason,synthetic:true,requiredSource:'SKU 级库存观测（合成教学源），含设施、SKU、来源和时间'},evidence:[]});
 const unavailable=()=>unknown('merchandise-unavailable','UNKNOWN：当前情景没有一致的商品上下文，不能判断陈列或库存。');
 return {
  get_fixture_products:(args)=>{
   if(!validArgs(args,'fixtureId'))return {status:'ERROR',message:'fixtureId 必须是非空字符串，不能含额外字段',data:{},evidence:[]};
   if(!available||snapshot===undefined)return unavailable();
   if(!snapshot.coveredFixtureIds.includes(args.fixtureId))return unknown('fixture-not-covered',`UNKNOWN：设施 ${args.fixtureId} 尚未核验陈列映射。`);
   const placements=snapshot.placements.filter(p=>p.fixtureId===args.fixtureId).map(p=>({...p,name:snapshot.products.find(x=>x.sku===p.sku)?.name??p.sku,editable:p.fixtureId==='F077'}));
   const skus=[...new Set([...placements.filter(p=>p.origin==='USER_SANDBOX'),...placements].map(p=>p.sku))];
   const displayLines=skus.slice(0,8).map(sku=>{
    const rows=placements.filter(p=>p.sku===sku);
    const changed=rows.filter(p=>p.origin==='USER_SANDBOX');
    const examples=changed.length?changed:rows.slice(0,2);
    const slotNote=examples.map(p=>p.slotId).join('、')+(rows.length>examples.length?`（另 ${rows.length-examples.length} 格，完整记录见证据）`:'');
    return `${sku} · ${rows[0]?.name}：${rows.length} 个陈列位置（不是库存）；${changed.length?'已试摆货位':'货位示例'} ${slotNote}；来源 ${[...new Set(rows.map(p=>p.origin))].join('/')}`;
   });
   if(skus.length>8)displayLines.push(`另有 ${skus.length-8} 种 SKU，完整陈列映射保留在工具数据与证据中。`);
   return {status:'OK',data:{fixtureId:args.fixtureId,placements,synthetic:true,at:snapshot.at,displayLines:displayLines.length?displayLines:['已核验：该设施没有陈列映射（不代表库存为零）。']},
    evidence:placements.map(p=>({signalId:p.placementId,metric:'product_placement',observedAt:snapshot.at,sourceId:p.origin==='SEED'?'synthetic-placement-seed':'browser-sandbox-placement',kind:'SIMULATED',synthetic:true,confidence:null}))};
  },
  get_sku_inventory:(args)=>{
   if(!validArgs(args,'sku','fixtureId'))return {status:'ERROR',message:'sku/fixtureId 必须是非空字符串，不能含额外字段',data:{},evidence:[]};
   if(!available||snapshot===undefined)return unavailable();
   if(!snapshot.products.some(p=>p.sku===args.sku))return unknown('sku-not-found',`UNKNOWN：商品目录没有 ${args.sku}。`);
   const readings=snapshot.inventory.filter(r=>r.sku===args.sku&&(args.fixtureId===undefined||r.fixtureId===args.fixtureId));
   if(!readings.length)return unknown('no-observation',`UNKNOWN：${args.sku} 没有对应设施的可靠库存观测；不能根据陈列数量推断。`);
   const evidence:AgentEvidence[]=readings.flatMap(r=>r.evidenceIds.flatMap(id=>{
    const source=snapshot.stockObservations.find(o=>o.id===id);
    return source===undefined?[]:[{signalId:source.id,metric:'sku_inventory',observedAt:source.observedAt,sourceId:source.sourceId,kind:source.kind,synthetic:true,confidence:source.confidence??null}];
   }));
   const missing=readings.some(r=>r.stale||r.kind==='UNKNOWN'||r.onHand===null);
   return {status:missing?'UNKNOWN':'OK',message:missing?'UNKNOWN：部分或全部设施没有当前可决策的库存观测；过期值不作为当前库存。':undefined,
    data:{sku:args.sku,readings,synthetic:true,requiredSource:'SKU 级库存观测（合成教学源），不得用模型数量推算',displayLines:readings.map(r=>`${r.fixtureId} · ${r.sku}：${r.stale||r.kind==='UNKNOWN'||r.onHand===null?'UNKNOWN（'+(r.stale?'已过期':r.reason??'无可靠观测')+'）':r.onHand+' 件'}；${r.kind} · 合成观测；来源 ${r.sourceId??'未提供'}；时间 ${r.observedAt??'未提供'}`)},evidence};
  },
 };
}
