import {z} from 'zod';
const text=(max:number)=>z.string().min(1).max(max).refine(v=>v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v),'标识或文本包含空白边界/控制字符');
const id=text(160).refine(v=>!['__proto__','prototype','constructor'].includes(v.toLowerCase()),'保留标识不可使用');
const sku=text(40).refine(v=>/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(v),'SKU 格式无效').refine(v=>!['CONSTRUCTOR','PROTOTYPE','__PROTO__'].includes(v),'保留 SKU');
export const merchandisingTimestampSchema=z.string().datetime({offset:true});
const at=merchandisingTimestampSchema;
const temperature=z.enum(['常温','冷藏','冷冻']);
const size=z.tuple([z.number().finite().positive().max(10000),z.number().finite().positive().max(10000),z.number().finite().positive().max(10000)]);
export const productDefinitionSchema=z.object({sku,name:text(80),category:text(80),temperatureZone:temperature,modelKey:text(80),referenceSizeMm:size,synthetic:z.literal(true),templateSku:sku.optional()}).strict();
export type ProductDefinition=z.infer<typeof productDefinitionSchema>;
/** Trusted local authority only: never accept slot geometry as a browser authorization. */
export const fixtureSlotSchema=z.object({fixtureId:id,slotId:id,moduleIndex:z.number().int().min(0).max(100),mountId:id,sizeMm:size.optional(),allowedCategories:z.array(text(80)).min(1).max(32).optional(),allowedTemperatureZones:z.array(temperature).min(1).max(3).optional()}).strict();
export type FixtureSlot=z.infer<typeof fixtureSlotSchema>;
export const productPlacementSchema=z.object({placementId:text(330),storeId:id,fixtureId:id,slotId:id,sku,origin:z.enum(['SEED','USER_SANDBOX']),synthetic:z.literal(true)}).strict().refine(p=>p.placementId===p.fixtureId+'/'+p.slotId,'placementId 必须由 fixtureId/slotId 稳定生成');
export type ProductPlacement=z.infer<typeof productPlacementSchema>;
export const skuStockObservationSchema=z.object({id,storeId:id,zoneId:id,fixtureId:id,sku,quantity:z.number().finite().nonnegative().max(1e9).nullable(),unit:z.literal('件'),kind:z.enum(['OBSERVED','ESTIMATED','SIMULATED','UNKNOWN']),synthetic:z.literal(true),sourceId:id,observedAt:at,ingestedAt:at,validUntil:at.optional(),confidence:z.number().finite().min(0).max(1).optional(),scenarioId:id.optional(),modelVersion:text(80).optional()}).strict().superRefine((v,c)=>{
 const issue=(message:string)=>c.addIssue({code:z.ZodIssueCode.custom,message});
 if((v.kind==='UNKNOWN')!==(v.quantity===null))issue('UNKNOWN 数量必须为 null；其他分级必须有非负数量');
 if(v.kind==='SIMULATED'&&(!v.scenarioId||!v.modelVersion))issue('SIMULATED 必须有 scenarioId 和 modelVersion');
 if(v.kind==='ESTIMATED'&&v.confidence===undefined)issue('ESTIMATED 必须有 confidence');
 if(Date.parse(v.ingestedAt)<Date.parse(v.observedAt))issue('接收时间不得早于观测时间');
 if(v.validUntil&&Date.parse(v.validUntil)<Date.parse(v.observedAt))issue('过期时间不得早于观测时间');
});
export type SkuStockObservation=z.infer<typeof skuStockObservationSchema>;
export const skuInventoryReadingSchema=z.object({sku,fixtureId:id,onHand:z.number().finite().nonnegative().nullable(),unit:z.literal('件'),kind:z.enum(['OBSERVED','ESTIMATED','SIMULATED','UNKNOWN']),stale:z.boolean(),sourceId:id.nullable(),observedAt:at.nullable(),evidenceIds:z.array(id).max(1000),synthetic:z.literal(true),reason:z.enum(['no-observation','expired','unknown-observation']).optional()}).strict().refine(v=>(v.kind==='UNKNOWN')===(v.onHand===null)&&(!v.stale||v.kind==='UNKNOWN'),'UNKNOWN/过期库存不得提供当前数值');
export type SkuInventoryReading=z.infer<typeof skuInventoryReadingSchema>;
export const merchandisingSnapshotSchema=z.object({version:z.literal(1),at,storeId:id,products:z.array(productDefinitionSchema).max(64),placements:z.array(productPlacementSchema).max(1000),inventory:z.array(skuInventoryReadingSchema).max(2000),stockObservations:z.array(skuStockObservationSchema).max(1000),coveredFixtureIds:z.array(id).max(1000),synthetic:z.literal(true)}).strict();
export type MerchandisingSnapshot=z.infer<typeof merchandisingSnapshotSchema>;
/** Untrusted API DTO. Authority must validate products and reconstruct seed/slot data. */
export const merchandisingSubmissionSchema=z.object({contextVersion:z.literal(1).optional(),products:z.array(productDefinitionSchema).max(64),placements:z.array(productPlacementSchema).max(1000),stockObservations:z.array(skuStockObservationSchema).max(1000).optional()}).strict();
export type MerchandisingSubmission=z.infer<typeof merchandisingSubmissionSchema>;
