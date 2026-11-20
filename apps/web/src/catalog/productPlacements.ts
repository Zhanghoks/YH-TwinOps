import {layout} from '../data';
import type {DetailedProductKind} from '../scene/detailedProduct';
import type {DetailFixtureShape} from '../scene/detailGeometry';
import {buildFreshGroupReplacement} from '../scene/freshGroupReplacement';
import {generatePlanningLayout} from '../scene/planningLayout';
import {buildServiceGroupReplacement} from '../scene/serviceGroupReplacement';
import {buildShelfGroupReplacement} from '../scene/shelfGroupReplacement';
import {selectPlacementProductKind} from './placementProductKind';
import {seedSkuIdForKind} from './productCatalog';

export const PRODUCT_PLACEMENT_SCOPE=Object.freeze({
  synthetic:true, pilotOnly:true, fixtureIds:Object.freeze(['F029','F050','F074','F077','F107'] as const),
});
export type ProductPlacementFixtureId=typeof PRODUCT_PLACEMENT_SCOPE.fixtureIds[number];
export interface ProductPlacement{
  readonly placementId:string;
  readonly fixtureId:ProductPlacementFixtureId;
  readonly sourceSlotId:string;
  readonly sku:string;
  readonly modelKey:DetailedProductKind;
  readonly moduleIndex:number;
  readonly mountId:string;
}

/** Prospective SKU-to-fixture links for five trial points. Not a live assortment,
 * enabled pilot state, sales feed, or inventory. The factory allocates data only.
 */
export function buildProductPlacements(fixtures:readonly DetailFixtureShape[] = generatePlanningLayout(layout).layout.fixtures):readonly ProductPlacement[]{
  const links:ProductPlacement[]=[];
  const ids=new Set<string>();
  function add(fixtureId:ProductPlacementFixtureId,sourceSlotId:string,modelKey:DetailedProductKind|undefined,moduleIndex:number,mountId:string):void{
    if(modelKey===undefined)throw new Error(`No catalog model for ${fixtureId}/${sourceSlotId}`);
    const placementId=`${fixtureId}/${sourceSlotId}`;
    if(ids.has(placementId))throw new Error(`Duplicate product placement: ${placementId}`);
    ids.add(placementId);
    links.push(Object.freeze({placementId,fixtureId,sourceSlotId,sku:seedSkuIdForKind(modelKey),modelKey,moduleIndex,mountId}));
  }
  for(const fixture of fixtures){
    if(fixture.fixtureId==='F077'||fixture.fixtureId==='F107'){
      const model=buildShelfGroupReplacement(fixture);
      if(model===null)continue;
      for(const p of model.placements) add(model.fixtureId,p.sourceId,
        selectPlacementProductKind({fixtureId:model.fixtureId,sourceModel:p.sourceSlot.model}),p.rackIndex,p.mount.id);
    }else if(fixture.fixtureId==='F029'||fixture.fixtureId==='F050'){
      const model=buildFreshGroupReplacement(fixture);
      if(model===null)continue;
      for(const p of model.placements) add(model.fixtureId,p.sourceId,
        selectPlacementProductKind({fixtureId:model.fixtureId,moduleIndex:p.moduleIndex,mountIndex:model.frame.mounts.findIndex(m=>m.id===p.mountId)}),p.moduleIndex,p.mountId);
    }else if(fixture.fixtureId==='F074'){
      const model=buildServiceGroupReplacement(fixture);
      if(model===null||model.fixtureId!=='F074')continue;
      for(const p of model.placements) if(p.role==='product') add(model.fixtureId,p.sourceId,
        selectPlacementProductKind({fixtureId:model.fixtureId,moduleIndex:p.moduleIndex,mountIndex:model.frame.mounts.findIndex(m=>m.id===p.mountId),role:p.role}),p.moduleIndex,p.mountId);
    }
  }
  return Object.freeze(links.sort((a,b)=>a.placementId<b.placementId?-1:a.placementId>b.placementId?1:0));
}
