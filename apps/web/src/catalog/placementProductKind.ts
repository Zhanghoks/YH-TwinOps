import type { DetailedProductKind } from '../scene/detailedProduct';
import type { MerchandiseModel } from '../scene/shelfDisplay';

export type PlacementProductInput =
  | {fixtureId:'F077'|'F107';sourceModel:MerchandiseModel}
  | {fixtureId:'F029'|'F050'|'F074'|'F007';moduleIndex:number;mountIndex:number;role?:'product'|'tray-lining'};

const shelves:Readonly<Partial<Record<MerchandiseModel,DetailedProductKind>>>={
  carton:'carton',pouch:'snack-pouch',jar:'jar',bottle:'pump-bottle',detergent:'handled-detergent',tissue:'tissue-pack',
};

/** This is the one assignment function for both trial rendering and catalog links. */
export function selectPlacementProductKind(input:PlacementProductInput):DetailedProductKind|undefined{
  if('sourceModel' in input) return shelves[input.sourceModel];
  const {fixtureId,moduleIndex,mountIndex,role}=input;
  if(!Number.isInteger(moduleIndex)||moduleIndex<0||!Number.isInteger(mountIndex)||mountIndex<0||role==='tray-lining')return undefined;
  switch(fixtureId){
    case 'F029':return (['apple','citrus','leafy-greens'] as const)[(moduleIndex+mountIndex)%3];
    case 'F050':return moduleIndex%2===0?'frozen-pouch':'frozen-box';
    case 'F074':return (moduleIndex+mountIndex)%2===0?'milk-carton':'yogurt-cup';
    case 'F007':return undefined; // The legacy fresh counter does not place the new catalog meat tray.
  }
}
