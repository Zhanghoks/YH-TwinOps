// Generates the closed demo authority from the existing catalog and model factories.
// Run from repo root: node --import tsx scripts/export-yh-merchandising-authority.ts
import { writeFileSync } from 'node:fs';
import { layout } from '../apps/web/src/data';
import { generatePlanningLayout } from '../apps/web/src/scene/planningLayout';
import { buildProductPlacements } from '../apps/web/src/catalog/productPlacements';
import { PRODUCT_CATALOG_SEED } from '../apps/web/src/catalog/productCatalog';
import { buildShelfGroupReplacement } from '../apps/web/src/scene/shelfGroupReplacement';

const dense = generatePlanningLayout(layout).layout;
const placements = buildProductPlacements(dense.fixtures);
if (placements.length !== 596) throw new Error('The reviewed placement mapping must remain 596 records');
const shelf = dense.fixtures.find(f => f.fixtureId === 'F077');
const model = shelf ? buildShelfGroupReplacement(shelf) : undefined;
if (!model) throw new Error('F077 dense fixture must match the source factory');
const eligible = new Map(model.placements.map(p => [p.sourceId, [
  Math.floor(p.slot.cellSize[0] * 1000 + 1e-6) - 6,
  Math.floor(p.mount.size[1] * 1000 + 1e-6),
  Math.floor(p.mount.size[2] * 1000 + 1e-6) - 120,
]]));
const fixtureIds = new Set(placements.map(p => p.fixtureId));
const data = {
  storeId: dense.storeId, widthM: dense.widthM, depthM: dense.depthM,
  fixtures: dense.fixtures.filter(f=>fixtureIds.has(f.fixtureId as typeof placements[number]['fixtureId'])).map(f=>({
    fixtureId:f.fixtureId, zoneId:f.zoneId, fixtureType:f.fixtureType, x:f.x,y:f.y,z:f.z,
    widthM:f.widthM,heightM:f.heightM,depthM:f.depthM,rotationY:f.rotationY,designVariant:f.designVariant??null,
  })),
  products: PRODUCT_CATALOG_SEED.map(({sku,name,category,temperatureZone,modelKey,referenceSizeMm,synthetic}) =>
    ({sku,name,category,temperatureZone,modelKey,referenceSizeMm,synthetic})),
};
const rows=placements.map(p=>JSON.stringify([
  p.fixtureId,p.sourceSlotId,p.sku,p.moduleIndex,p.mountId,eligible.get(p.sourceSlotId)??null,
]));
const header=JSON.stringify(data,null,2).slice(0,-2);
writeFileSync('packages/merchandising/src/authority-data.json',`${header},\n  "positions": [\n    ${rows.join(',\n    ')}\n  ]\n}\n`);
