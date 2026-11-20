import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {layout} from '../data';
import {generatePlanningLayout} from './planningLayout';
import {buildShelfGroupReplacement} from './shelfGroupReplacement';
import {disposeShelfGroupReplacement,makeShelfGroupReplacement} from './shelfGroupReplacementThree';

const dense=generatePlanningLayout(layout).layout;
const cases=[
  {id:'F077',items:160,kinds:{'snack-pouch':53,jar:39,carton:68},nearBudget:36000,farBudget:7400},
  {id:'F107',items:232,kinds:{'pump-bottle':77,'handled-detergent':97,'tissue-pack':58},nearBudget:72000,farBudget:26000},
] as const;
const axes=['x','y','z'] as const;

describe('detailed shelf merchandise rehang',()=>{
  it.each(cases)('fits every updated $id SKU into its exact old merchandise bounds across both LODs',({id,items,kinds})=>{
    const fixture=dense.fixtures.find(p=>p.fixtureId===id);
    if(!fixture)throw new Error('Missing dense '+id);
    for(const lod of ['near','far'] as const){
      const model=buildShelfGroupReplacement(fixture,{lod});
      if(!model)throw new Error('Missing replacement '+id);
      const geometry=makeShelfGroupReplacement(model,{batch:false});
      expect(geometry.userData.products).toBe('detailed');
      expect(geometry.userData.sourceItemCount).toBe(items);
      const layer=geometry.getObjectByName(id+' original products');
      if(!layer)throw new Error('missing goods layer');
      expect(layer.children).toHaveLength(items);
      const counts:Record<string,number>={};
      for(const p of model.placements){
        const node=layer.getObjectByName(id+'-item-'+p.sourceId);
        if(!node)throw new Error('Missing SKU '+p.sourceId);
        const kind=node.userData.detailedKind;
        counts[kind]=(counts[kind]??0)+1;
        expect(node.userData.model).toBe(p.sourceSlot.model);
        expect(node.children[0]?.rotation.y).toBe(p.sourceSlot.side===-1?Math.PI:0);
        const before=new THREE.Box3();
        for(const part of p.merchandise){
          const c=new THREE.Vector3(...part.position),h=new THREE.Vector3(...part.size).multiplyScalar(.5);
          before.expandByPoint(c.clone().sub(h));
          before.expandByPoint(c.clone().add(h));
        }
        const after=new THREE.Box3().setFromObject(node,true);
        expect(after.min.y).toBeCloseTo(p.mount.anchor[1],7);
        for(const axis of axes) {
          expect(after.min[axis]).toBeGreaterThanOrEqual(before.min[axis]-1e-7);
          expect(after.max[axis]).toBeLessThanOrEqual(before.max[axis]+1e-7);
        }
      }
      expect(counts).toEqual(kinds);
      disposeShelfGroupReplacement(geometry);
    }
  });

  it.each(cases)('keeps $id stocked geometry batched, with a real legacy comparison and isolated empty frame',({id,items,nearBudget,farBudget})=>{
    const fixture=dense.fixtures.find(p=>p.fixtureId===id);
    if(!fixture)throw new Error('missing dense '+id);
    for(const lod of ['near','far'] as const){
      const model=buildShelfGroupReplacement(fixture,{lod});
      const emptyData=buildShelfGroupReplacement(fixture,{lod,stocked:false});
      if(!model||!emptyData)throw new Error('missing replacements');
      const detailed=makeShelfGroupReplacement(model);
      const legacy=makeShelfGroupReplacement(model,{batch:false,products:'legacy'});
      const empty=makeShelfGroupReplacement(emptyData);
      expect(legacy.userData.productCount).toBe(items);
      expect(legacy.getObjectByName(id+' original products')?.children.every(c=>c.userData.detailedKind===undefined)).toBe(true);
      expect(empty.userData.productCount).toBe(0);
      expect(empty.children).toHaveLength(5);
      expect(detailed.children).toHaveLength(6);
      let faces=0;
      detailed.traverse(node=>{
        if(node instanceof THREE.Mesh)faces+=(node.geometry.index?.count??node.geometry.getAttribute('position').count)/3;
      });
      expect(faces).toBeLessThan(lod==='near'?nearBudget:farBudget);
      const fit=(g:THREE.Group)=>new THREE.Box3().setFromObject(g);
      for(const axis of axes){
        expect(fit(detailed).min[axis]).toBeCloseTo(fit(empty).min[axis],6);
        expect(fit(detailed).max[axis]).toBeCloseTo(fit(empty).max[axis],6);
      }
      for(const g of [detailed,legacy,empty])disposeShelfGroupReplacement(g);
    }
  });
});
