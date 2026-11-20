import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {layout} from '../data'
import {generatePlanningLayout} from './planningLayout'
import {buildSameSkuFill,sameSkuMountKey,type SameSkuFillRequest} from './sameSkuFill'
import {makeSameSkuFillProducts,disposeSameSkuFillProducts} from './sameSkuFillThree'
import {buildShelfGroupReplacement} from './shelfGroupReplacement'
import {makeDimensionedShelf,disposeDimensionedShelf} from './dimensionedShelfThree'
const fixture=generatePlanningLayout(layout).layout.fixtures.find(f=>f.fixtureId==='F077')!
const req:SameSkuFillRequest={sku:'YH-DEMO-004',scope:'cell',side:1,level:0,moduleIndex:0,bay:0,gapMm:10}
function overlap(a:THREE.Box3,b:THREE.Box3){return ['x','y','z'].every(k=>Math.min(a.max[k as 'x'],b.max[k as 'x'])-Math.max(a.min[k as 'x'],b.min[k as 'x'])>1e-7)}
describe('same SKU bounded fixed-size fill',()=>{
 it('fills a cell 32, one side level 128, all fitting cells 1024; skips top 8',()=>{
  const cell=buildSameSkuFill(fixture,req);expect(cell.ok).toBe(true);expect(cell.counts.products).toBe(32);expect(cell.replacedMountKeys).toHaveLength(1)
  expect(buildSameSkuFill(fixture,{...req,scope:'level'}).counts.products).toBe(128)
  const full=buildSameSkuFill(fixture,{...req,scope:'fixture'});expect(full.counts).toEqual({requestedMounts:40,filledMounts:32,products:1024,skippedMounts:8});expect(full.skipped.every(s=>s.mountKey.endsWith('level-4'))).toBe(true)
  expect(new Set(full.placements.map(p=>p.id)).size).toBe(1024);expect(full.placements.every(p=>p.sizeM.join(',')==='0.125,0.22,0.085')).toBe(true)
 })
 it('rejects other fixture, changed guard, cold/household SKU and invalid parameters',()=>{
  expect(buildSameSkuFill({...fixture,x:fixture.x+.01},req).ok).toBe(false)
  for(const patch of [{sku:'YH-DEMO-014'},{sku:'YH-DEMO-006'},{gapMm:NaN},{gapMm:-1},{moduleIndex:2},{level:5},{bay:2}])expect(buildSameSkuFill(fixture,{...req,...patch}).ok).toBe(false)
  expect(buildSameSkuFill({...fixture,fixtureId:'F107'},req).ok).toBe(false)
 })
 it('keeps unselected original mount goods and explicit stable depth identity',()=>{
  const model=buildShelfGroupReplacement(fixture)!,fill=buildSameSkuFill(fixture,req)
  const kept=model.placements.filter(p=>!fill.replacedMountKeys.includes(sameSkuMountKey(p.rackIndex,p.mount)))
  expect(kept.length).toBeGreaterThan(0);expect(kept.length).toBeLessThan(model.placements.length)
  expect(buildSameSkuFill(fixture,req)).toEqual(fill)
  expect(new Set(fill.placements.map(p=>p.depthRow)).size).toBe(4)
 })
 it('actual near/far instanced vertices stay in mount, contact support and avoid all frame solids and other goods',()=>{
  const fill=buildSameSkuFill(fixture,{...req,scope:'fixture'}),model=buildShelfGroupReplacement(fixture)!
  const structure:THREE.Box3[]=[]
  for(const x of model.rackOffsetsM){const rack=makeDimensionedShelf(model.frame);rack.position.x=x;rack.updateMatrixWorld(true);rack.traverse(o=>{if(o instanceof THREE.Mesh)structure.push(new THREE.Box3().setFromObject(o))});disposeDimensionedShelf(rack)}
  for(const lod of ['near','far'] as const){const group=makeSameSkuFillProducts(fill,lod);group.updateMatrixWorld(true);const bounds=fill.placements.map(()=>new THREE.Box3());const m=new THREE.Matrix4()
   group.traverse(o=>{if(o instanceof THREE.InstancedMesh){o.geometry.computeBoundingBox();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);bounds[i]!.union(o.geometry.boundingBox!.clone().applyMatrix4(m))}}})
   for(const [i,p]of fill.placements.entries()){const b=bounds[i]!,mount=model.frame.mounts.find(m=>sameSkuMountKey(p.moduleIndex,m)===p.mountKey)!,x=model.rackOffsetsM[p.moduleIndex]!+mount.anchor[0]
    expect(b.min.y).toBeCloseTo(mount.anchor[1],6);expect(b.max.y).toBeLessThanOrEqual(mount.anchor[1]+mount.size[1]+1e-6)
    expect(b.min.x).toBeGreaterThanOrEqual(x-mount.size[0]/2-1e-6);expect(b.max.x).toBeLessThanOrEqual(x+mount.size[0]/2+1e-6)
    expect(b.min.z).toBeGreaterThanOrEqual(mount.anchor[2]-mount.size[2]/2-1e-6);expect(b.max.z).toBeLessThanOrEqual(mount.anchor[2]+mount.size[2]/2+1e-6)
    expect(structure.some(s=>overlap(b,s))).toBe(false)
    let collision=false;for(let j=0;j<i;j++)if(overlap(b,bounds[j]!)){collision=true;break}expect(collision).toBe(false)
   }expect(group.children.length).toBeLessThanOrEqual(4);disposeSameSkuFillProducts(group)
  }
 })
})
