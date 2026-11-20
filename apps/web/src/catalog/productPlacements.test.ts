import {describe,expect,it} from 'vitest';
import {layout} from '../data';
import {buildFreshGroupReplacement} from '../scene/freshGroupReplacement';
import {makeFreshGroupReplacement,disposeFreshGroupReplacement} from '../scene/freshGroupReplacementThree';
import {generatePlanningLayout} from '../scene/planningLayout';
import {buildServiceGroupReplacement} from '../scene/serviceGroupReplacement';
import {makeServiceGroupReplacement,disposeServiceGroupReplacement} from '../scene/serviceGroupReplacementThree';
import {buildShelfGroupReplacement} from '../scene/shelfGroupReplacement';
import {makeShelfGroupReplacement,disposeShelfGroupReplacement} from '../scene/shelfGroupReplacementThree';
import {PRODUCT_CATALOG_SEED,seedSkuIdForKind} from './productCatalog';
import {buildProductPlacements,PRODUCT_PLACEMENT_SCOPE} from './productPlacements';

const fixtures=generatePlanningLayout(layout).layout.fixtures;
const byId=(fixtureId:string)=>{
  const f=fixtures.find(p=>p.fixtureId===fixtureId);
  if(!f)throw new Error('Missing dense '+fixtureId);
  return f;
};

describe('prospective synthetic pilot product placements',()=>{
  it('identifies each actual slot exactly once and only across the five mapped pilots',()=>{
    const links=buildProductPlacements();
    const counts=Object.fromEntries(PRODUCT_PLACEMENT_SCOPE.fixtureIds.map(id=>[id,links.filter(p=>p.fixtureId===id).length]));
    expect(counts).toEqual({F029:144,F050:30,F074:30,F077:160,F107:232});
    expect(links).toHaveLength(596);
    expect(new Set(links.map(p=>p.placementId)).size).toBe(596);
    expect(buildProductPlacements([...fixtures].reverse())).toEqual(links);
    expect(buildProductPlacements(layout.fixtures)).toEqual([]);
    expect(buildProductPlacements([byId('F007'),byId('F032'),byId('F120')])).toEqual([]);
    expect(Object.isFrozen(links)).toBe(true);
    for (const link of links){
      expect(link.placementId).toBe(link.fixtureId+'/'+link.sourceSlotId);
      expect(link.sku).toBe(seedSkuIdForKind(link.modelKey));
      expect(Object.isFrozen(link)).toBe(true);
      expect(link.mountId).not.toBe('');
      expect(link.moduleIndex).toBeGreaterThanOrEqual(0);
    }
    const covered=new Set(links.map(p=>p.modelKey));
    expect(PRODUCT_CATALOG_SEED.map(p=>p.modelKey).filter(m=>!covered.has(m)).sort()).toEqual(['can','capped-bottle','meat-tray']);
  });
  it('does not silently duplicate links for repeated caller input',()=>{
    expect(()=>buildProductPlacements([byId('F077'),byId('F077')])).toThrow(/Duplicate product placement/);
  });
  it.each(PRODUCT_PLACEMENT_SCOPE.fixtureIds)('matches actual %s detailed renderer metadata at both LODs',(fixtureId)=>{
    const f=byId(fixtureId);
    const links=buildProductPlacements([f]);
    for(const lod of ['near','far'] as const){
      if(fixtureId==='F077'||fixtureId==='F107'){
        const p=buildShelfGroupReplacement(f,{lod});
        if(!p)throw new Error('Missing shelf pilot '+fixtureId);
        const scene=makeShelfGroupReplacement(p,{batch:false,products:'detailed'});
        for(const row of links){
          const render=scene.getObjectByName(fixtureId+'-item-'+row.sourceSlotId);
          expect(render?.userData.detailedKind).toBe(row.modelKey);
          expect(render?.userData.mount).toBe(row.mountId);
          expect(render?.userData.rack).toBe(row.moduleIndex+1);
        }
        disposeShelfGroupReplacement(scene);
      }else if(fixtureId==='F074'){
        const p=buildServiceGroupReplacement(f,{lod});
        if(!p)throw new Error('Missing refrigerated pilot '+fixtureId);
        const scene=makeServiceGroupReplacement(p,{batch:false,products:'detailed'});
        for(const row of links){
          const render=scene.getObjectByName(row.sourceSlotId);
          expect(render?.userData.detailedKind).toBe(row.modelKey);
          expect(render?.userData.mountId).toBe(row.mountId);
          expect(render?.userData.moduleIndex).toBe(row.moduleIndex);
        }
        disposeServiceGroupReplacement(scene);
      }else{
        const p=buildFreshGroupReplacement(f,{lod});
        if(!p)throw new Error('Missing fresh pilot '+fixtureId);
        const scene=makeFreshGroupReplacement(p,{batch:false,products:'detailed'});
        for(const row of links){
          const render=scene.getObjectByName(row.sourceSlotId);
          expect(render?.userData.detailedKind).toBe(row.modelKey);
          expect(render?.userData.mountId).toBe(row.mountId);
          expect(render?.userData.moduleIndex).toBe(row.moduleIndex);
        }
        disposeFreshGroupReplacement(scene);
      }
    }
  });
});
