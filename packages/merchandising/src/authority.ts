import type { FixtureSlot, ProductDefinition, ProductPlacement, StoreLayout, MerchandisingSubmission } from '@yh/contracts';
import { productDefinitionSchema } from '@yh/contracts';
import authority from './authority-data.json';

const versionedProducts: ProductDefinition[] = authority.products.map(p => productDefinitionSchema.parse(p));
export const MERCHANDISING_SEED_BASELINE_COUNT = authority.positions.length;

const near = (a: number,b: number) => Math.abs(a-b) < 1e-7;
const physicalKeys = ['x','y','z','widthM','depthM','heightM','rotationY'] as const;

export function getMerchandisingAuthority(layout:StoreLayout) {
  if (!layout.synthetic || layout.storeId !== authority.storeId || !near(layout.widthM,authority.widthM) || !near(layout.depthM,authority.depthM)) return undefined;
  if (!authority.fixtures.every(known => {
    const f=layout.fixtures.find(x=>x.fixtureId===known.fixtureId);
    return f && f.zoneId===known.zoneId && f.fixtureType===known.fixtureType &&
      physicalKeys.every(k=>near(f[k],known[k])) && ('designVariant' in f ? f.designVariant ?? null : null)===known.designVariant;
  })) return undefined;
  const slots:FixtureSlot[]=[];
  const baselinePlacements:ProductPlacement[]=[];
  const validSlotIdsByFixture:Record<string,string[]> = Object.fromEntries(authority.fixtures.map(f=>[f.fixtureId,[]]));
  for(const [fixtureId,slotId,sku,moduleIndex,mountId,space] of authority.positions) {
    if(typeof fixtureId!=='string'||typeof slotId!=='string'||typeof sku!=='string'||typeof moduleIndex!=='number'||typeof mountId!=='string') throw new Error('Invalid compiled shelf authority');
    const row:FixtureSlot={fixtureId,slotId,moduleIndex,mountId};
    if(fixtureId==='F077' && Array.isArray(space) && space.length===3) {
      const [w,h,d]=space;
      if(typeof w!=='number'||typeof h!=='number'||typeof d!=='number') throw new Error('Invalid compiled clearance');
      row.sizeMm=[w,h,d]; row.allowedCategories=['包装食品'];row.allowedTemperatureZones=['常温'];
    }
    slots.push(row);
    validSlotIdsByFixture[fixtureId]?.push(slotId);
    baselinePlacements.push({placementId:`${fixtureId}/${slotId}`,storeId:layout.storeId,fixtureId,slotId,sku,origin:'SEED',synthetic:true});
  }
  return {validSlotIdsByFixture,slots,baselinePlacements,seedProducts:versionedProducts.map(p=>({...p,referenceSizeMm:[...p.referenceSizeMm]}))};
}

/** Browser-supplied claims never establish a seed fact, a template size, or a legal slot. */
export function validateMerchandisingSubmission(layout:StoreLayout,submission:MerchandisingSubmission) {
  const trusted=getMerchandisingAuthority(layout);
  if(!trusted) throw new Error('商品上下文仅支持已核验的密集教学场景');
  const seeds=new Map(trusted.seedProducts.map(p=>[p.sku,p]));
  const products=new Set<string>();
  for(const p of submission.products) {
    const seed=seeds.get(p.sku);
    const template=seed ?? (p.templateSku ? seeds.get(p.templateSku) : undefined);
    if(!template || (seed && p.templateSku) || products.has(p.sku)
      ||p.category!==template.category||p.temperatureZone!==template.temperatureZone||p.modelKey!==template.modelKey
      ||p.referenceSizeMm.some((v,i)=>v!==template.referenceSizeMm[i])) throw new Error('商品模板、尺寸或 SKU 不符合已核验目录');
    products.add(p.sku);
  }
  if(trusted.seedProducts.some(p=>!products.has(p.sku))||submission.products.length>trusted.seedProducts.length+32) throw new Error('商品上下文缺少基线商品或超过本机预算');
  const baseline=new Map(trusted.baselinePlacements.map(p=>[p.placementId,p]));
  const seen=new Set<string>();
  const placementOverrides:ProductPlacement[]=[];
  if(submission.placements.length!==baseline.size) throw new Error('商品上下文必须保留原 596 个货位');
  for(const p of submission.placements) {
    const expect=baseline.get(p.placementId);
    if(!expect||seen.has(p.placementId)||p.fixtureId!==expect.fixtureId||p.slotId!==expect.slotId||p.storeId!==expect.storeId||!products.has(p.sku)) throw new Error('陈列位置不是该场景内的已核验货位');
    seen.add(p.placementId);
    if(p.origin==='USER_SANDBOX'){
      if(p.fixtureId!=='F077'||placementOverrides.length) throw new Error('仅允许一个 F077 原有货位的教学覆盖');
      placementOverrides.push(p);
    } else if(p.sku!==expect.sku) throw new Error('试点基线陈列不可改写');
  }
  const stockObservations=submission.stockObservations??[];
  if(stockObservations.some(o=>o.sourceId!=='synthetic-stock-fixture')) throw new Error('仅可提交教学库存来源');
  return {products:submission.products,slots:trusted.slots,baselinePlacements:trusted.baselinePlacements,validSlotIdsByFixture:trusted.validSlotIdsByFixture,placementOverrides,stockObservations};
}
