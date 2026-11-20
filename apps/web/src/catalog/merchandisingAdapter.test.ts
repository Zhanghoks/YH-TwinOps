import {describe,expect,it} from 'vitest';
import {layout} from '../data';
import {generatePlanningLayout} from '../scene/planningLayout';
import {PRODUCT_CATALOG_SEED,addProductFromTemplate} from './productCatalog';
import {buildProductPlacements} from './productPlacements';
import {buildMerchandiseSource,projectWebMerchandise,resolvePlacementReplacement,toMerchandisingSubmission,tryPlacementOverride} from './merchandisingAdapter';
import {loadPlacementOverride,PLACEMENT_STORAGE_KEY,savePlacementOverride} from './placementStorage';
import {validateMerchandisingSubmission} from '@yh/merchandising/authority';

const dense=generatePlanningLayout(layout).layout, at='2026-11-20T10:00:00Z';
const authority=buildMerchandiseSource(dense);
if(!authority)throw new Error('Expected dense fixture authority');

describe('reviewed product placement bridge',()=>{
 it('AT-01/07 keeps all exact factory ids and scopes the projection to the dense fixture geometry',()=>{
  const links=buildProductPlacements(dense.fixtures);
  const m=projectWebMerchandise(dense,at,PRODUCT_CATALOG_SEED,authority);
  expect(m?.products).toHaveLength(16);
  expect(m?.placements.map(p=>[p.placementId,p.sku])).toEqual(links.map(p=>[p.placementId,p.sku]));
  expect(m?.placements).toHaveLength(596);
  expect(m?.inventory.every(i=>i.kind==='UNKNOWN'&&i.onHand===null)).toBe(true);
  expect(buildMerchandiseSource(layout)).toBeUndefined();
  expect(buildMerchandiseSource({...dense,fixtures:dense.fixtures.map(f=>f.fixtureId==='F077'?{...f,rotationY:.1}:f)})).toBeUndefined();
 });
 it('AT-02/03/04/14 keeps same-template local SKU identity at the same existing source slot',()=>{
  const items=addProductFromTemplate(PRODUCT_CATALOG_SEED,{templateSku:'YH-DEMO-004',sku:'YH-LOCAL-001',name:'本机饼干',specification:'示意盒'});
  const seed=projectWebMerchandise(dense,at,items,authority);
  expect(seed?.placements.some(p=>p.sku==='YH-LOCAL-001')).toBe(false);
  const target=authority.trialSlots.find(p=>p.sku==='YH-DEMO-004'&&tryPlacementOverride(dense,authority,at,items,p.slotId,'YH-LOCAL-001').ok);
  expect(target).toBeDefined();
  if(!target)throw Error('Expected a fitting slot');
  expect(tryPlacementOverride(dense,authority,at,items,'imaginary','YH-LOCAL-001').ok).toBe(false);
  expect(tryPlacementOverride(dense,authority,at,items,target.slotId,'YH-DEMO-014').ok).toBe(false);
  const result=tryPlacementOverride(dense,authority,at,items,target.slotId,'YH-LOCAL-001');
  if(!result.ok)throw Error(result.reason);
  const after=projectWebMerchandise(dense,at,items,authority,result.override);
  const changed=after?.placements.filter(p=>!seed?.placements.some(o=>o.placementId===p.placementId&&p.sku===o.sku));
  expect(changed).toEqual([result.override]);
  expect(resolvePlacementReplacement(result.override,items)).toMatchObject({slotId:target.slotId,sku:'YH-LOCAL-001',modelKey:'carton',sizeM:[.125,.22,.085]});
  const submission=toMerchandisingSubmission(after,[]);
  if(!submission)throw Error('Expected submission');
  expect(validateMerchandisingSubmission(dense,submission).placementOverrides).toEqual([result.override]);
  expect(projectWebMerchandise(dense,at,items,authority)?.placements).toEqual(seed?.placements);
 });
 it('AT-14/15 saves only versioned single fixture override data; invalid storage falls back without touching its source',()=>{
  const map=new Map<string,string>();
  const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
  const base=authority.baselinePlacements.find(p=>p.fixtureId==='F077');
  if(!base)throw Error('Expected source placement');
  const placement={...base,origin:'USER_SANDBOX' as const};
  expect(savePlacementOverride(placement,storage)).toBe(true);
  expect(loadPlacementOverride(storage)).toEqual({value:placement});
  expect(savePlacementOverride(undefined,storage)).toBe(true);
  expect(loadPlacementOverride(storage)).toEqual({});
  map.set(PLACEMENT_STORAGE_KEY,JSON.stringify({version:1,placement:{...placement,x:3}}));
  expect(loadPlacementOverride(storage).error).toContain('已退回原版');
  expect(map.has(PLACEMENT_STORAGE_KEY)).toBe(true);
 });
});
