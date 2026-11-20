import {merchandisingTimestampSchema,productDefinitionSchema,productPlacementSchema,skuStockObservationSchema,fixtureSlotSchema,type StoreLayout,type ProductDefinition,type ProductPlacement,type SkuStockObservation,type FixtureSlot} from '@yh/contracts';
export interface MerchandisingInput {at:string;layout:StoreLayout;products:readonly ProductDefinition[];baselinePlacements:readonly ProductPlacement[];placementOverrides?:readonly ProductPlacement[];stockObservations?:readonly SkuStockObservation[];validSlotIdsByFixture:Readonly<Record<string,readonly string[]>>;slots?:readonly FixtureSlot[]}
const key=(fixtureId:string,slotId:string)=>JSON.stringify([fixtureId,slotId]);
export function validateMerchandisingInput(input:MerchandisingInput){
 merchandisingTimestampSchema.parse(input.at);
 if(!Number.isFinite(Date.parse(input.at))||!input.layout.synthetic)throw Error('情景时间或合成布局无效');
 if(input.products.length>64||input.baselinePlacements.length>1000||(input.placementOverrides?.length??0)>1||(input.stockObservations?.length??0)>1000||(input.slots?.length??0)>1000)throw Error('商品上下文超过条目预算');
 const products=input.products.map(p=>productDefinitionSchema.parse(p)),baselinePlacements=input.baselinePlacements.map(p=>productPlacementSchema.parse(p)),placementOverrides=(input.placementOverrides??[]).map(p=>productPlacementSchema.parse(p)),stockObservations=(input.stockObservations??[]).map(p=>skuStockObservationSchema.parse(p)),slots=(input.slots??[]).map(s=>fixtureSlotSchema.parse(s));
 const catalog=new Map(products.map(p=>[p.sku,p]));if(catalog.size!==products.length)throw Error('SKU 重复');
 const fixtures=new Map(input.layout.fixtures.map(f=>[f.fixtureId,f]));
 const covered=Object.keys(input.validSlotIdsByFixture);
 if(covered.length>1000)throw Error('货位授权超过预算');
 const legal=new Set<string>();
 for(const fixtureId of covered){if(!fixtures.has(fixtureId))throw Error('货位设施不存在');const ids=input.validSlotIdsByFixture[fixtureId]!;if(!Array.isArray(ids)||ids.length>1000||legal.size+ids.length>1000)throw Error('货位授权超过预算');for(const id of ids){const k=key(fixtureId,id);if(legal.has(k))throw Error('货位授权重复');legal.add(k)}}
 const slotMap=new Map(slots.map(s=>[key(s.fixtureId,s.slotId),s]));if(slotMap.size!==slots.length)throw Error('物理货位重复');
 for(const s of slots)if(!legal.has(key(s.fixtureId,s.slotId)))throw Error('物理货位未被授权');
 const check=(p:ProductPlacement)=>{if(p.storeId!==input.layout.storeId||!catalog.has(p.sku)||!fixtures.has(p.fixtureId)||!legal.has(key(p.fixtureId,p.slotId)))throw Error('陈列的门店/SKU/设施/货位关联无效')};
 const occupied=new Set<string>();
 for(const p of baselinePlacements){check(p);if(p.origin!=='SEED'||occupied.has(key(p.fixtureId,p.slotId)))throw Error('基线货位重复或来源无效');occupied.add(key(p.fixtureId,p.slotId))}
 for(const p of placementOverrides){check(p);if(p.fixtureId!=='F077'||p.origin!=='USER_SANDBOX'||!occupied.has(key(p.fixtureId,p.slotId)))throw Error('仅允许覆盖 F077 的一个既有货位');
  const slot=slotMap.get(key(p.fixtureId,p.slotId)),product=catalog.get(p.sku)!;
  if(!slot?.sizeMm||!slot.allowedCategories||!slot.allowedTemperatureZones)throw Error('缺少可信货位净空或品类约束');
  if(!slot.allowedCategories.includes(product.category)||!slot.allowedTemperatureZones.includes(product.temperatureZone)||product.referenceSizeMm.some((v,i)=>v>slot.sizeMm![i]!+1e-6))throw Error('商品品类/温区或尺寸不符合货位约束');
 }
 const observations=new Map<string,SkuStockObservation>();
 for(const o of stockObservations){if(o.storeId!==input.layout.storeId||!catalog.has(o.sku)||fixtures.get(o.fixtureId)?.zoneId!==o.zoneId||!covered.includes(o.fixtureId))throw Error('库存观测的门店/SKU/设施/分区关联无效');const prior=observations.get(o.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(o))throw Error('同一库存观测 ID 内容冲突');observations.set(o.id,o)}
 return {...input,products,baselinePlacements,placementOverrides,stockObservations:[...observations.values()],slots};
}
