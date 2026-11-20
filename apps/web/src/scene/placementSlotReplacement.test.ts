import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildMerchandiseSource, resolvePlacementReplacement, tryPlacementOverride, type ShelfSlotReplacement } from '../catalog/merchandisingAdapter';
import { addProductFromTemplate, PRODUCT_CATALOG_SEED } from '../catalog/productCatalog';
import { layout } from '../data';
import { generatePlanningLayout } from './planningLayout';
import { buildSameSkuFill } from './sameSkuFill';
import { buildShelfGroupReplacement } from './shelfGroupReplacement';
import { disposeShelfGroupReplacement, makeShelfGroupReplacement } from './shelfGroupReplacementThree';

const dense = generatePlanningLayout(layout).layout;
const fixture = dense.fixtures.find(f => f.fixtureId === 'F077')!;
const slot = buildShelfGroupReplacement(fixture)!.placements[0]!;
const placementReplacement: ShelfSlotReplacement = {slotId:slot.sourceId,sku:'YH-LOCAL-001',modelKey:'can',sizeM:[.07,.11,.07],color:'#487245'};
const renderedSlotName = `F077-item-${slot.sourceId}`;

describe('F077 single visible slot substitution', () => {
  for (const lod of ['far', 'near'] as const) {
    it(`uses the real mount in ${lod}, changes one SKU and preserves matching original slots`, () => {
      const model = buildShelfGroupReplacement(fixture,{lod})!;
      const original = makeShelfGroupReplacement(model,{batch:false});
      const replace = makeShelfGroupReplacement(model,{batch:false,placementReplacement});
      try {
        const originalSlot = original.getObjectByName(renderedSlotName)!;
        const localSlot = replace.getObjectByName(renderedSlotName)!;
        expect(localSlot.userData.sku).toBe(placementReplacement.sku);
        expect(localSlot.children[0]!.getObjectByName('round-body')).toBeDefined();
        expect(originalSlot.userData.sku).toBeUndefined();
        expect(replace.userData.productCount).toBe(model.placements.length);
        const matches: THREE.Object3D[] = [];
        replace.traverse(node => {if (node.name === renderedSlotName) matches.push(node);});
        expect(matches).toHaveLength(1);
        const box = new THREE.Box3().setFromObject(localSlot,true);
        expect(box.min.y).toBeCloseTo(slot.slot.anchor[1],10);
        const center = box.getCenter(new THREE.Vector3());
        expect(center.x).toBeCloseTo(slot.slot.anchor[0],10);
        expect(center.z).toBeCloseTo(slot.slot.anchor[2],10);
        model.placements.slice(1).forEach(p => {
          const name = `F077-item-${p.sourceId}`;
          expect(new THREE.Box3().setFromObject(replace.getObjectByName(name)!,true)).toEqual(
            new THREE.Box3().setFromObject(original.getObjectByName(name)!,true),
          );
        });
      } finally {
        disposeShelfGroupReplacement(original);
        disposeShelfGroupReplacement(replace);
      }
    });
  }
  it('fails closed for a missing slot, unstocked shelf or concurrent fill', () => {
    const fillPlan = buildSameSkuFill(fixture,{sku:'YH-DEMO-004',scope:'cell',side:1,level:0,moduleIndex:0,bay:0,gapMm:10});
    expect(fillPlan.ok).toBe(true);
    const model = buildShelfGroupReplacement(fixture)!;
    const unknown = makeShelfGroupReplacement(model,{placementReplacement:{...placementReplacement,slotId:'missing'}});
    const empty = makeShelfGroupReplacement(buildShelfGroupReplacement(fixture,{stocked:false})!,{placementReplacement});
    const conflicting = makeShelfGroupReplacement(model,{placementReplacement,fillPlan});
    try {
      expect(unknown.userData.placementReplacement).toBeUndefined();
      expect(empty.userData.placementReplacement).toBeUndefined();
      expect(conflicting.userData.placementReplacement).toBeUndefined();
      expect(conflicting.userData.fillCount).toBeGreaterThan(0);
    } finally {
      [unknown,empty,conflicting].forEach(disposeShelfGroupReplacement);
    }
  });
  it.each(['near','far'] as const)('actual batched %s scene uses validated local SKU without confusing its seed template', lod => {
    const source = buildMerchandiseSource(dense)!;
    const products = addProductFromTemplate(PRODUCT_CATALOG_SEED,{sku:'YH-LOCAL-016',templateSku:'YH-DEMO-003',name:'本机果酱示意',specification:'试摆几何测试'});
    const at = '2026-11-20T10:00:00Z';
    const slots = source.trialSlots.filter(p => p.sku === 'YH-DEMO-003');
    const plan = slots.map(p=>tryPlacementOverride(dense,source,at,products,p.slotId,'YH-LOCAL-016')).find(result=>result.ok);
    if(!plan?.ok)throw new Error('Missing valid same-template jar slot');
    const replacement=resolvePlacementReplacement(plan.override,products)!;
    expect(replacement.modelKey).toBe('jar');
    const model = buildShelfGroupReplacement(fixture,{lod})!;
    const original = makeShelfGroupReplacement(model,{batch:false});
    const output = makeShelfGroupReplacement(model,{placementReplacement:replacement});
    try {
      const change = output.getObjectByName(`F077-item-${plan.override.slotId}`)!;
      expect(change.userData.sku).toBe('YH-LOCAL-016');
      expect(output.userData.placementReplacement).toEqual({sku:'YH-LOCAL-016',slotId:plan.override.slotId});
      expect(change.children[0]!.getObjectByName('round-body')).toBeDefined();
      let numberOfChangedRoots = 0;
      output.traverse(node => {if(node.userData.sku==='YH-LOCAL-016')numberOfChangedRoots++;});
      expect(numberOfChangedRoots).toBe(1);
      expect(output.userData.productCount).toBe(model.placements.length);
      const placedBox = new THREE.Box3().setFromObject(change,true);
      const p = model.placements.find(p=>p.sourceId===plan.override.slotId)!;
      const [x,y,z]=p.slot.anchor, [w,h,d]=replacement.sizeM;
      expect(new THREE.Box3(
        new THREE.Vector3(x-w/2,y,z-d/2),new THREE.Vector3(x+w/2,y+h,z+d/2),
      ).expandByScalar(2e-6).containsBox(placedBox)).toBe(true);
      placedBox.expandByScalar(-2e-6);
      for(const other of model.placements.filter(other=>other.sourceId!==p.sourceId)){
        const oldProduct=original.getObjectByName(`F077-item-${other.sourceId}`)!;
        expect(new THREE.Box3().setFromObject(oldProduct,true).intersectsBox(placedBox),other.sourceId).toBe(false);
      }
      for(const unit of model.rackOffsetsM) for(const part of model.frame.parts){
        const m=new THREE.Vector3(part.min[0]+unit,part.min[1],part.min[2]);
        const M=new THREE.Vector3(part.max[0]+unit,part.max[1],part.max[2]);
        expect(new THREE.Box3(m,M).intersectsBox(placedBox),part.id).toBe(false);
      }
    } finally {disposeShelfGroupReplacement(original);disposeShelfGroupReplacement(output);}
  });

});
