import type { ProductDefinition, ProductPlacement, StoreLayout, SkuStockObservation, MerchandisingSubmission } from '@yh/contracts';
import { projectMerchandisingState } from '@yh/merchandising';
import { getMerchandisingAuthority } from '@yh/merchandising/authority';
import { buildShelfGroupReplacement } from '../scene/shelfGroupReplacement';
import type { DetailedProductKind } from '../scene/detailedProduct';
import { buildProductPlacements } from './productPlacements';
import type { ProductCatalogItem } from './productCatalog';

export interface ShelfSlotReplacement {
  slotId:string; sku:string; modelKey:DetailedProductKind;
  sizeM:readonly [number, number, number]; color:string;
}

export interface TrialSlot {
  slotId:string; mountId:string; moduleIndex:number; side:-1|1; bay:number; level:number; sku:string;
}

export function toProductDefinition(row:ProductCatalogItem):ProductDefinition {
  return {
    sku:row.sku,name:row.name,category:row.category,temperatureZone:row.temperatureZone,modelKey:row.modelKey,
    referenceSizeMm:[...row.referenceSizeMm],synthetic:true,...(row.templateSku?{templateSku:row.templateSku}:{}),
  };
}

export function buildMerchandiseSource(layout: StoreLayout) {
  const authority=getMerchandisingAuthority(layout);
  if(!authority)return undefined;
  const links=buildProductPlacements(layout.fixtures);
  const matching=links.length===authority.baselinePlacements.length && links.every((link,i)=>{
    const row=authority.baselinePlacements[i];
    return row?.placementId===link.placementId&&row.sku===link.sku&&row.slotId===link.sourceSlotId;
  });
  if(!matching) return undefined;
  const fixture=layout.fixtures.find(f=>f.fixtureId==='F077');
  const frame=fixture&&buildShelfGroupReplacement(fixture);
  if(!frame) return undefined;
  const skuBySlot=new Map(links.filter(p=>p.fixtureId==='F077').map(p=>[p.sourceSlotId,p.sku]));
  const trialSlots:TrialSlot[]=[];
  for(const p of frame.placements){
    const sku=skuBySlot.get(p.sourceId);
    if(!sku)return undefined;
    trialSlots.push({slotId:p.sourceId,mountId:p.mount.id,moduleIndex:p.rackIndex,
      side:p.mount.side,bay:p.mount.bay,level:p.mount.level,sku});
  }
  return {...authority,trialSlots};
}

export function projectWebMerchandise(
  layout:StoreLayout, at:string, items:readonly ProductCatalogItem[], source:ReturnType<typeof buildMerchandiseSource>,
  override?:ProductPlacement, observations:readonly SkuStockObservation[]=[]
) {
  if(!source)return undefined;
  return projectMerchandisingState({
    at,layout, products:items.map(toProductDefinition), baselinePlacements:source.baselinePlacements,
    validSlotIdsByFixture:source.validSlotIdsByFixture,slots:source.slots,
    placementOverrides:override?[override]:[],stockObservations:observations,
  });
}

export function tryPlacementOverride(layout:StoreLayout,source:ReturnType<typeof buildMerchandiseSource>,at:string,items:readonly ProductCatalogItem[],slotId:string,sku:string) {
  if(!source) return {ok:false as const,reason:'仅支持已核验的 130×100 m 密集场景。'};
  const old=source.baselinePlacements.find(x=>x.fixtureId==='F077'&&x.slotId===slotId);
  const before=items.find(p=>p.sku===old?.sku);
  const after=items.find(p=>p.sku===sku);
  if(!old||!before||!after) return {ok:false as const,reason:'未找到合法货位或商品。'};
  const override:ProductPlacement={...old,sku,origin:'USER_SANDBOX'};
  const detail={oldSku:before.sku,oldSizeMm:before.referenceSizeMm,newSizeMm:after.referenceSizeMm};
  try {
    projectWebMerchandise(layout,at,items,source,override);
    return {ok:true as const,reason:'原尺寸通过格位净空与温区校验。',override,...detail};
  } catch(error){
    return {ok:false as const,reason:error instanceof Error?error.message:'试摆校验失败。',...detail};
  }
}

export function resolvePlacementReplacement(override:ProductPlacement|undefined, items:readonly ProductCatalogItem[]):ShelfSlotReplacement|undefined {
  const product=items.find(p=>p.sku===override?.sku);
  if(!override||!product)return undefined;
  const [w,h,d]=product.referenceSizeMm;
  return {slotId:override.slotId,sku:product.sku,modelKey:product.modelKey,sizeM:[w/1000,h/1000,d/1000],color:product.color};
}

export function toMerchandisingSubmission(snapshot:ReturnType<typeof projectWebMerchandise>,observations:readonly SkuStockObservation[]):MerchandisingSubmission|undefined{
  if(!snapshot)return undefined;
  return {contextVersion:1,products:[...snapshot.products],placements:[...snapshot.placements],stockObservations:[...observations]};
}
