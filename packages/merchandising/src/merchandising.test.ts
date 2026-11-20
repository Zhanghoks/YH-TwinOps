import {describe,it,expect} from 'vitest';
import {makeTestLayout} from '@yh/contracts/testing';
import {skuStockObservationSchema,merchandisingSubmissionSchema,type ProductDefinition,type ProductPlacement,type SkuStockObservation} from '@yh/contracts';
import {projectMerchandisingState} from './index';
const layout=makeTestLayout();layout.fixtures[0]!.fixtureId='F077';
const product:ProductDefinition={sku:'YH-DEMO-004',name:'示意盒',category:'包装食品',temperatureZone:'常温',modelKey:'carton',referenceSizeMm:[125,220,85],synthetic:true};
const placement:ProductPlacement={placementId:'F077/slot-a',storeId:layout.storeId,fixtureId:'F077',slotId:'slot-a',sku:product.sku,origin:'SEED',synthetic:true};
const input={at:'2026-11-20T10:00:00Z',layout,products:[product],baselinePlacements:[placement],validSlotIdsByFixture:{F077:['slot-a']},slots:[{fixtureId:'F077',slotId:'slot-a',moduleIndex:0,mountId:'mount-a',sizeMm:[140,240,100] as [number,number,number],allowedCategories:['包装食品'],allowedTemperatureZones:['常温' as const]}]};
const observation:SkuStockObservation={id:'obs-a',storeId:layout.storeId,zoneId:layout.fixtures[0]!.zoneId,fixtureId:'F077',sku:product.sku,quantity:12,unit:'件',kind:'OBSERVED',synthetic:true,sourceId:'synthetic-stock-fixture',observedAt:'2026-11-20T09:00:00Z',ingestedAt:'2026-11-20T09:01:00Z'};
describe('merchandising pure authority-scoped projection',()=>{
 it('does not invent inventory from placements, keeps baseline immutable and coverage explicit',()=>{
  const before=JSON.stringify(input),result=projectMerchandisingState(input);
  expect(result.placements).toEqual([placement]);expect(result.coveredFixtureIds).toEqual(['F077']);
  expect(result.inventory[0]).toMatchObject({onHand:null,kind:'UNKNOWN',stale:false,evidenceIds:[]});
  expect(JSON.stringify(input)).toBe(before);
 });
 it('accepts exactly one compatible overlay then rollback restores baseline',()=>{
  const p={...product,sku:'YH-LOCAL-001',templateSku:product.sku};
  const override={...placement,sku:p.sku,origin:'USER_SANDBOX' as const};
  expect(projectMerchandisingState({...input,products:[product,p],placementOverrides:[override]}).placements).toEqual([override]);
  expect(projectMerchandisingState(input).placements).toEqual([placement]);
  for(const bad of [{slotId:'fake'},{fixtureId:'nope'},{sku:'missing'},{storeId:'wrong'},{origin:'SEED' as const}])expect(()=>projectMerchandisingState({...input,placementOverrides:[{...override,...bad}]})).toThrow();
  expect(()=>projectMerchandisingState({...input,products:[product,p],placementOverrides:[override,override]})).toThrow();
  expect(()=>projectMerchandisingState({...input,products:[product,p],slots:undefined,placementOverrides:[override]})).toThrow();
  for(const bad of [{referenceSizeMm:[141,220,85] as [number,number,number]},{temperatureZone:'冷冻' as const},{category:'果蔬'}])expect(()=>projectMerchandisingState({...input,products:[product,{...p,...bad}],placementOverrides:[override]})).toThrow();
 });
 it('deduplicates observations, orders by time, ignores future and exposes independent evidence',()=>{
  const old={...observation,id:'old',quantity:2,observedAt:'2026-11-20T08:00:00Z'},future={...observation,id:'future',quantity:99,observedAt:'2026-11-20T11:00:00Z',ingestedAt:'2026-11-20T11:01:00Z'};
  const a=projectMerchandisingState({...input,stockObservations:[future,observation,old,observation]});
  const b=projectMerchandisingState({...input,stockObservations:[old,observation,future]});
  expect(a).toEqual(b);expect(a.inventory[0]).toMatchObject({onHand:12,kind:'OBSERVED',evidenceIds:['obs-a']});
  expect(a.stockObservations).toHaveLength(2);
  expect(()=>projectMerchandisingState({...input,stockObservations:[observation,{...observation,quantity:4}]})).toThrow();
 });
 it('expires without falling back to older readings; unknown does not equal zero',()=>{
  const expired={...observation,validUntil:input.at};
  expect(projectMerchandisingState({...input,stockObservations:[expired]}).inventory[0]).toMatchObject({onHand:null,kind:'UNKNOWN',stale:true,evidenceIds:['obs-a'],sourceId:observation.sourceId});
  const unknown={...observation,kind:'UNKNOWN' as const,quantity:null};
  expect(projectMerchandisingState({...input,stockObservations:[unknown]}).inventory[0]).toMatchObject({onHand:null,kind:'UNKNOWN',stale:false});
 });
 it('ties by ingestion time, isolates SKU identities, and does not disclose future receipts',()=>{
  const newer={...observation,id:'later-ingest',ingestedAt:'2026-11-20T09:30:00Z',quantity:18};
  const late={...observation,id:'not-received',ingestedAt:'2026-11-20T11:00:00Z',quantity:50};
  const other={...product,sku:'YH-LOCAL-002'};
  const result=projectMerchandisingState({...input,products:[product,other],stockObservations:[late,newer,observation,{...observation,id:'other',sku:other.sku,quantity:7}]});
  expect(result.inventory.find(r=>r.sku===product.sku)?.onHand).toBe(18);
  expect(result.inventory.find(r=>r.sku===other.sku)?.onHand).toBe(7);
  expect(result.stockObservations.some(o=>o.id===late.id)).toBe(false);
  const unknown=projectMerchandisingState({...input,stockObservations:[late]});expect(unknown.inventory[0]?.onHand).toBeNull();
  const expired={...newer,validUntil:input.at};
  expect(projectMerchandisingState({...input,stockObservations:[observation,expired]}).inventory[0]).toMatchObject({onHand:null,stale:true,evidenceIds:['later-ingest']});
 });
 it('strict schemas reject geometry/slot spoofing, provenance failures and array budgets',()=>{
  expect(()=>merchandisingSubmissionSchema.parse({products:[product],placements:[placement],validSlotIdsByFixture:{F077:['fake']}})).toThrow();
  expect(()=>merchandisingSubmissionSchema.parse({products:Array(65).fill(product),placements:[]})).toThrow();
  for(const bad of [{quantity:-1},{quantity:NaN},{synthetic:false},{kind:'UNKNOWN',quantity:1},{kind:'SIMULATED'},{kind:'ESTIMATED'},{rogue:true}])expect(skuStockObservationSchema.safeParse({...observation,...bad}).success).toBe(false);
  expect(()=>projectMerchandisingState({...input,stockObservations:[{...observation,zoneId:'wrong'}]})).toThrow();
  expect(()=>projectMerchandisingState({...input,baselinePlacements:[placement,placement]})).toThrow();
 });
});
