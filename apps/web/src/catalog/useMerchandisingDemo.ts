import {useMemo,useRef,useState} from 'react';
import type {ProductPlacement,SkuStockObservation,StoreLayout} from '@yh/contracts';
import {loadProductCatalog,type ProductCatalogItem} from './productCatalog';
import {buildMerchandiseSource,projectWebMerchandise,resolvePlacementReplacement,toMerchandisingSubmission,tryPlacementOverride} from './merchandisingAdapter';
import {loadPlacementOverride,savePlacementOverride} from './placementStorage';

export function useMerchandisingDemo(layout:StoreLayout,at:string,bulkActive:boolean,stocked:boolean) {
  const [items,setItems]=useState<ProductCatalogItem[]>(()=>loadProductCatalog().products);
  const [saved]=useState(loadPlacementOverride);
  const [override,setOverride]=useState<ProductPlacement|undefined>(saved.value);
  const [notice,setNotice]=useState(saved.error);
  const [stock,setStock]=useState<SkuStockObservation[]>([]);
  const serial=useRef(0);
  const source=useMemo(()=>buildMerchandiseSource(layout),[layout]);
  const verified=useMemo(()=>{
    if(!override||!source)return undefined;
    const checked=tryPlacementOverride(layout,source,at,items,override.slotId,override.sku);
    return checked.ok&&checked.override.storeId===override.storeId&&checked.override.placementId===override.placementId
      ? checked.override:undefined;
  },[layout,source,at,items,override]);
  const observations=useMemo(()=>stock.filter(s=>items.some(p=>p.sku===s.sku)),[stock,items]);
  // Bulk rendering is a different trial. Its decorative placements are never presented as SKU slot facts.
  const merchandise=useMemo(()=>bulkActive?undefined:projectWebMerchandise(layout,at,items,source,verified,observations),[layout,at,items,source,verified,observations,bulkActive]);
  const submission=useMemo(()=>toMerchandisingSubmission(merchandise,observations),[merchandise,observations]);
  const replacement=useMemo(()=>stocked&&!bulkActive?resolvePlacementReplacement(verified,items):undefined,[verified,items,bulkActive,stocked]);

  const blockReason=bulkActive?'请先撤回同款填充。':!source?'仅支持已核验的 130×100 m 密集场景。':!stocked?'请先在 3D 打开填充商品。':undefined;
  function preview(slotId:string,sku:string) {
    return blockReason?{ok:false as const,reason:blockReason}:tryPlacementOverride(layout,source,at,items,slotId,sku);
  }
  function apply(slotId:string,sku:string): boolean {
    const tested=preview(slotId,sku);
    if(!tested.ok) {setNotice(tested.reason);return false;}
    if(!savePlacementOverride(tested.override)){setNotice('本地保存失败，原陈列保持不变。');return false;}
    setOverride(tested.override);
    setNotice('已应用本机单货位试摆；不代表库存。');
    return true;
  }
  function revert() {
    if(!savePlacementOverride(undefined)){setNotice('本地撤回失败，原设置保持不变。');return;}
    setOverride(undefined);
    setNotice('已撤回本机试摆，恢复原陈列。');
  }
  function inject(sku:string,fixtureId:string) {
    const fixture=layout.fixtures.find(f=>f.fixtureId===fixtureId);
    if(!fixture||!merchandise?.placements.some(p=>p.sku===sku&&p.fixtureId===fixtureId))return;
    const sample:SkuStockObservation={
      id:`teaching-stock-${++serial.current}`,storeId:layout.storeId,zoneId:fixture.zoneId,fixtureId,sku,
      quantity:7,unit:'件',kind:'OBSERVED',synthetic:true,sourceId:'synthetic-stock-fixture',
      observedAt:at,ingestedAt:at,validUntil:new Date(Date.parse(at)+5*60_000).toISOString(),
    };
    setStock(old=>[...old.slice(-199),sample]);
    setNotice('合成观测：7 件，有效 5 分钟，不影响陈列。');
  }
  const invalid=!!source&&!!override&&!verified;
  const status=invalid?'本地陈列数据不兼容，已退回原版。':notice;
  const activeSlots=(source?.trialSlots??[]).map(s=>verified?.slotId===s.slotId?{...s,sku:verified.sku}:s);
  return {items,setItems,activeSlots,blockReason,preview,apply,revert,inject,status,merchandise,submission,replacement,
    active:verified,renderAllowed:!!source&&!bulkActive,hasSavedOverride:!!override};
}
