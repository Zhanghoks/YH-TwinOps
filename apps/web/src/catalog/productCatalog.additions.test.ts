import {describe,it,expect} from 'vitest'
import {PRODUCT_CATALOG_SEED as seed,addProductFromTemplate,parseProductCatalog,saveProductCatalog,loadProductCatalog,updateProductMetadata,exportProductCatalog,PRODUCT_CATALOG_MAX_ADDITIONS} from './productCatalog'
const input={templateSku:'YH-DEMO-004',sku:' test-001 ',name:'新饼干',specification:'示意 200g',notes:'新品简介'}
describe('trusted-template local catalog additions',()=>{
 it('appends without mutation, retains seed ordering and inherits only verified geometry',()=>{
  const items=addProductFromTemplate(seed,input)
  expect(items.slice(0,16)).toEqual(seed);expect(seed).toHaveLength(16)
  expect(items[16]).toEqual({...seed[3],sku:'TEST-001',templateSku:'YH-DEMO-004',name:input.name,specification:input.specification,notes:input.notes})
  expect(Object.isFrozen(items[16]!.referenceSizeMm)).toBe(true)
  expect(addProductFromTemplate(seed,{...input,notes:undefined})[16]!.notes).toBe('')
  expect(updateProductMetadata(items,'TEST-001',{specification:' '})[16]!.specification).toBe(input.specification)
  expect(()=>addProductFromTemplate(items,{...input,sku:'test-001'})).toThrow('SKU 已存在')
 })
 it('rejects unsupported ids/templates, missing/overlong fields and template chaining',()=>{
  for(const sku of ['a','__proto__','constructor','prototype','含中文','a b','x'.repeat(41),'YH-DEMO-004'])expect(()=>addProductFromTemplate(seed,{...input,sku})).toThrow()
  for(const change of [{templateSku:'TEST-001'},{templateSku:'__proto__'},{name:''},{name:'x'.repeat(81)},{specification:' '},{specification:'x'.repeat(201)},{notes:'x'.repeat(1001)},{notes:'bad\u0000'}])expect(()=>addProductFromTemplate(seed,{...input,...change})).toThrow()
 })
 it('roundtrips new metadata plus old v1 edits without arbitrary geometry',()=>{
  const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}}
  const old=parseProductCatalog(JSON.stringify({version:1,overrides:[{sku:seed[0]!.sku,name:'旧编辑'}]})).products
  const items=updateProductMetadata(addProductFromTemplate(old,input),'TEST-001',{notes:'修改简介'})
  expect(saveProductCatalog(items,storage).ok).toBe(true)
  expect(loadProductCatalog(storage).products).toEqual(items)
  expect(JSON.parse(exportProductCatalog(items)).products).toHaveLength(17)
  const hostile=JSON.parse(JSON.stringify({...input,sku:'HOSTILE',referenceSizeMm:[999,999,999],modelKey:'apple',category:'果蔬',synthetic:false,__proto__:{polluted:true}}))
  const loaded=parseProductCatalog(JSON.stringify({version:1,overrides:[],additions:[hostile]}))
  expect(loaded.status).toBe('loaded');expect(loaded.products[16]!.referenceSizeMm).toEqual(seed[3]!.referenceSizeMm);expect(loaded.products[16]!.modelKey).toBe('carton')
  expect(Object.prototype).not.toHaveProperty('polluted')
 })
 it('enforces quota and rejects duplicate/invalid persisted additions atomically',()=>{
  let items=[...seed]
  for(let i=0;i<PRODUCT_CATALOG_MAX_ADDITIONS;i++)items=addProductFromTemplate(items,{...input,sku:'NEW-'+i})
  expect(()=>addProductFromTemplate(items,{...input,sku:'OVER-QUOTA'})).toThrow('最多新增')
  for(const additions of [[input,input],[{...input,templateSku:'__proto__'}],Array(33).fill(input),{}]){
   const result=parseProductCatalog(JSON.stringify({version:1,overrides:[],additions}))
   expect(result.status).toBe('invalid');expect(result.products).toEqual(seed)
  }
 })
})
