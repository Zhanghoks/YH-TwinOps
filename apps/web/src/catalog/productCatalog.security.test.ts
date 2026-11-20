import {describe,it,expect} from 'vitest';
import {PRODUCT_CATALOG_SEED,parseProductCatalog,loadProductCatalog,saveProductCatalog,updateProductMetadata,exportProductCatalog} from './productCatalog';

describe('catalog hostile or unavailable local persistence',()=>{
 it('rejects corrupt JSON, unsupported versions and excessive payloads',()=>{
  for(const raw of ['{',JSON.stringify({version:999,overrides:[]}),JSON.stringify({version:1,overrides:Array(17).fill({})}),' '.repeat(64001)]){
   const result=parseProductCatalog(raw);
   expect(result.status).toBe('invalid');expect(result.products).toEqual(PRODUCT_CATALOG_SEED);
  }
 });
 it('does not merge prototype or immutable catalog fields from storage',()=>{
  const raw='{"version":1,"overrides":[{"sku":"YH-DEMO-001","name":"local edit","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"modelKey":"meat-tray","referenceSizeMm":[999,999,999],"synthetic":false,"category":"fake","color":"red"}]}';
  const result=parseProductCatalog(raw);
  expect(result.status).toBe('loaded');
  expect(result.products[0]).toEqual({...PRODUCT_CATALOG_SEED[0],name:'local edit'});
  expect(Object.prototype).not.toHaveProperty('polluted');
  expect(Object.getPrototypeOf(result.products[0])).toBe(Object.prototype);
 });
 it('keeps edit/export allowlists and treats HTML as plain text data',()=>{
  const text='<img src=x onerror=alert(1)>';
  const patch=JSON.parse(JSON.stringify({name:text,modelKey:'meat-tray',referenceSizeMm:[999,999,999],sku:'other'}));
  const products=updateProductMetadata(PRODUCT_CATALOG_SEED,'YH-DEMO-001',patch);
  expect(products[0]).toEqual({...PRODUCT_CATALOG_SEED[0],name:text});
  const exported=JSON.parse(exportProductCatalog(products));
  expect(exported.products[0].name).toBe(text);expect(exported.products[0].synthetic).toBe(true);
 });
 it('returns failure rather than claiming quota/privacy save success',()=>{
  const storage={getItem:()=>{throw new Error('privacy');},setItem:()=>{throw new Error('quota');}};
  expect(loadProductCatalog(storage).status).toBe('unavailable');
  expect(saveProductCatalog(PRODUCT_CATALOG_SEED,storage)).toMatchObject({ok:false});
 });
 it('rejects duplicate known identities, ignores unknown ids and invalid patch values',()=>{
  expect(parseProductCatalog(JSON.stringify({version:1,overrides:[{sku:'YH-DEMO-001'},{sku:'YH-DEMO-001'}]})).status).toBe('invalid');
  const result=parseProductCatalog(JSON.stringify({version:1,overrides:[{sku:'__proto__',name:'attack'},{sku:'YH-DEMO-001',name:'',specification:'x'.repeat(201),notes:'bad\u0000value'}]}));
  expect(result.products).toEqual(PRODUCT_CATALOG_SEED);
 });
});
