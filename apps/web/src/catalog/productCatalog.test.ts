import {describe,it,expect} from 'vitest'
import {DETAILED_PRODUCT_KINDS} from '../scene/detailedProduct'
import {PRODUCT_CATALOG_SEED as seed,PRODUCT_MODEL_REGISTRY,PRODUCT_SKU_BY_MODEL,seedSkuIdForKind,parseProductCatalog,loadProductCatalog,saveProductCatalog,updateProductMetadata,filterProductCatalog,exportProductCatalog,PRODUCT_CATALOG_STORAGE_KEY} from './productCatalog'
describe('versioned synthetic catalog',()=>{
 it('has 16 explicit stable unique identities and all registered model kinds',()=>{
  expect(seed).toHaveLength(16);expect(new Set(seed.map(p=>p.sku)).size).toBe(16)
  expect(Object.keys(PRODUCT_MODEL_REGISTRY).sort()).toEqual([...DETAILED_PRODUCT_KINDS].sort())
  for(const p of [...seed].reverse()){expect(p.sku).toBe(PRODUCT_SKU_BY_MODEL[p.modelKey]);expect(seedSkuIdForKind(p.modelKey)).toBe(p.sku);expect(p.synthetic).toBe(true);expect(p.referenceSizeMm.every(n=>n>0&&Number.isFinite(n))).toBe(true);expect(Object.isFrozen(p.referenceSizeMm)).toBe(true)}
  expect(seedSkuIdForKind('snack-pouch')).toBe('YH-DEMO-001');expect(seedSkuIdForKind('meat-tray')).toBe('YH-DEMO-016')
 })
 it('edits only safe metadata while preserving immutable mapping and seed',()=>{
  const changed=updateProductMetadata(seed,seed[0]!.sku,{name:' 新名称 ',specification:'新规格',notes:'用户备注',modelKey:'apple',referenceSizeMm:[1,1,1],category:'果蔬'} as never)
  expect(changed[0]!.name).toBe('新名称');expect(changed[0]!.modelKey).toBe(seed[0]!.modelKey);expect(changed[0]!.referenceSizeMm).toEqual(seed[0]!.referenceSizeMm);expect(changed[0]!.category).toBe(seed[0]!.category);expect(seed[0]!.name).not.toBe('新名称')
 })
 it('round trips metadata storage and reports read/write failures',()=>{
  const data=new Map<string,string>();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}
  expect(loadProductCatalog(storage).status).toBe('seed');const items=updateProductMetadata(seed,seed[0]!.sku,{notes:'只在本机'})
  expect(saveProductCatalog(items,storage).ok).toBe(true);expect(loadProductCatalog(storage).products[0]!.notes).toBe('只在本机')
  expect(data.get(PRODUCT_CATALOG_STORAGE_KEY)).not.toContain('modelKey');expect(data.get(PRODUCT_CATALOG_STORAGE_KEY)).not.toContain('referenceSizeMm')
  const broken={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('quota')}}
  expect(loadProductCatalog(broken)).toMatchObject({status:'unavailable',products:seed});expect(saveProductCatalog(items,broken).ok).toBe(false)
 })
 it('invalid versions/malformed/oversize/duplicate input fall back to seed',()=>{
  for(const raw of ['{','null','[]',JSON.stringify({version:2,overrides:[]}),JSON.stringify({version:1,overrides:Array(17).fill({})}),' '.repeat(64001),JSON.stringify({version:1,overrides:[{sku:seed[0]!.sku},{sku:seed[0]!.sku}]})]){expect(parseProductCatalog(raw).status).toBe('invalid');expect(parseProductCatalog(raw).products).toEqual(seed)}
 })
 it('filters unknown and malicious fields, invalid lengths, prototypes and blank names',()=>{
  const raw=`{"version":1,"overrides":[{"sku":"${seed[0]!.sku}","name":" ","notes":"ok","specification":42,"modelKey":"apple","referenceSizeMm":[999,999,999],"__proto__":{"polluted":true}},{"sku":"unknown","name":"bad"}]}`
  const p=parseProductCatalog(raw).products[0]!;expect(p).toEqual({...seed[0]!,notes:'ok'});expect(({} as {polluted?:boolean}).polluted).toBeUndefined()
  const long=updateProductMetadata(seed,seed[0]!.sku,{name:'a'.repeat(81),notes:'x'.repeat(1001),specification:'bad\u0000text'});expect(long).toEqual(seed)
 })
 it('supports case-insensitive search and category intersection without mutation',()=>{
  expect(filterProductCatalog(seed,{query:'yh-demo-001'}).map(p=>p.sku)).toEqual(['YH-DEMO-001']);expect(filterProductCatalog(seed,{category:'果蔬'})).toHaveLength(3);expect(filterProductCatalog(seed,{category:'果蔬',query:'苹果'})).toHaveLength(1)
 })
 it('exports complete reference fields and dimension order but never live inventory',()=>{
  const v=JSON.parse(exportProductCatalog());expect(v).toMatchObject({version:1,synthetic:true,units:'mm',sizeOrder:'width,height,depth',sizeOrderLabel:'宽 × 高 × 深'});expect(v.products).toEqual(seed);expect(v.notice).toContain('非真实');expect(v.products[0]!).not.toHaveProperty('stock')
 })
})
