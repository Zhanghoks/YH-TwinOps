import type {MerchandisingSnapshot} from '@yh/contracts';
import {validateMerchandisingInput,type MerchandisingInput} from './validate';
import {applyPlacementOverlay} from './placementOverlay';
import {projectSkuInventory} from './inventory';
export * from './validate';
export * from './placementOverlay';
export * from './inventory';
export function projectMerchandisingState(input:MerchandisingInput):MerchandisingSnapshot{
 const valid=validateMerchandisingInput(input),placements=applyPlacementOverlay(valid.baselinePlacements,valid.placementOverrides);
 return {version:1,at:valid.at,storeId:valid.layout.storeId,products:valid.products,placements,...projectSkuInventory(valid.at,placements,valid.stockObservations),coveredFixtureIds:Object.keys(valid.validSlotIdsByFixture).sort(),synthetic:true};
}
export type {MerchandisingSnapshot,ProductDefinition,ProductPlacement,FixtureSlot,SkuStockObservation,SkuInventoryReading,MerchandisingSubmission} from '@yh/contracts';
