import type {ProductPlacement,SkuStockObservation,SkuInventoryReading} from '@yh/contracts';
export function projectSkuInventory(at:string,placements:readonly ProductPlacement[],observations:readonly SkuStockObservation[]):{inventory:SkuInventoryReading[];stockObservations:SkuStockObservation[]}{
 const time=Date.parse(at);
 const visible=observations.filter(o=>Date.parse(o.observedAt)<=time&&Date.parse(o.ingestedAt)<=time).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)||Date.parse(a.ingestedAt)-Date.parse(b.ingestedAt)||a.id.localeCompare(b.id));
 const keys=new Map<string,{fixtureId:string;sku:string}>(),latest=new Map<string,SkuStockObservation>();
 for(const p of placements)keys.set(JSON.stringify([p.fixtureId,p.sku]),{fixtureId:p.fixtureId,sku:p.sku});
 for(const o of visible){const key=JSON.stringify([o.fixtureId,o.sku]);keys.set(key,{fixtureId:o.fixtureId,sku:o.sku});latest.set(key,o)}
 const inventory=[...keys.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,p]):SkuInventoryReading=>{
  const o=latest.get(key),stale=!!o?.validUntil&&Date.parse(o.validUntil)<=time;
  return {...p,onHand:!o||stale?null:o.quantity,unit:'件',kind:!o||stale?'UNKNOWN':o.kind,stale,sourceId:o?.sourceId??null,observedAt:o?.observedAt??null,evidenceIds:o?[o.id]:[],synthetic:true,...(!o?{reason:'no-observation' as const}:stale?{reason:'expired' as const}:o.kind==='UNKNOWN'?{reason:'unknown-observation' as const}:{})};
 });
 return {inventory,stockObservations:visible};
}
