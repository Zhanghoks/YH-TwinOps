import type { DetailedProductKind } from '../scene/detailedProduct'

export const PRODUCT_CATALOG_VERSION = 1 as const
export const PRODUCT_CATALOG_STORAGE_KEY = 'yh-twinops:product-catalog:v1'
export const PRODUCT_CATALOG_NOTICE = '原创示意商品目录，非真实 SKU、库存、售价或供应商数据；尺寸仅为模型参考。'
export type ProductCategory = '包装食品'|'日用百货'|'果蔬'|'冷冻食品'|'冷藏乳品'|'生鲜肉类'
export type TemperatureZone = '常温'|'冷藏'|'冷冻'
export interface ProductCatalogItem {
 readonly sku:string; readonly templateSku?:string; name:string; readonly category:ProductCategory; specification:string
 readonly referenceSizeMm:readonly [number,number,number]; readonly temperatureZone:TemperatureZone
 readonly applicableZones:readonly string[]; readonly modelKey:DetailedProductKind; readonly color:string
 notes:string; readonly synthetic:true
}
export type ProductMetadataPatch = Partial<Pick<ProductCatalogItem,'name'|'specification'|'notes'>>
/** Declarative registry, intentionally independent of inventory and render instances. */
export const PRODUCT_MODEL_REGISTRY:Readonly<Record<DetailedProductKind,{readonly label:string;readonly geometryVersion:1}>> = Object.freeze({
 'snack-pouch':{label:'封口零食袋',geometryVersion:1},can:{label:'金属罐',geometryVersion:1},jar:{label:'旋盖罐',geometryVersion:1},carton:{label:'纸盒',geometryVersion:1},'capped-bottle':{label:'旋盖瓶',geometryVersion:1},'handled-detergent':{label:'开孔提手洗涤瓶',geometryVersion:1},'pump-bottle':{label:'泵头瓶',geometryVersion:1},'tissue-pack':{label:'软抽纸包',geometryVersion:1},apple:{label:'带叶苹果',geometryVersion:1},citrus:{label:'柑橘',geometryVersion:1},'leafy-greens':{label:'叶菜',geometryVersion:1},'frozen-pouch':{label:'冷冻袋装',geometryVersion:1},'frozen-box':{label:'冷冻盒装',geometryVersion:1},'milk-carton':{label:'屋顶奶盒',geometryVersion:1},'yogurt-cup':{label:'封膜酸奶杯',geometryVersion:1},'meat-tray':{label:'肉品托盘',geometryVersion:1},
})
export const PRODUCT_SKU_BY_MODEL:Readonly<Record<DetailedProductKind,string>> = Object.freeze({
 'snack-pouch':'YH-DEMO-001',
 'can':'YH-DEMO-002',
 'jar':'YH-DEMO-003',
 'carton':'YH-DEMO-004',
 'capped-bottle':'YH-DEMO-005',
 'handled-detergent':'YH-DEMO-006',
 'pump-bottle':'YH-DEMO-007',
 'tissue-pack':'YH-DEMO-008',
 'apple':'YH-DEMO-009',
 'citrus':'YH-DEMO-010',
 'leafy-greens':'YH-DEMO-011',
 'frozen-pouch':'YH-DEMO-012',
 'frozen-box':'YH-DEMO-013',
 'milk-carton':'YH-DEMO-014',
 'yogurt-cup':'YH-DEMO-015',
 'meat-tray':'YH-DEMO-016',
})
export const PRODUCT_SIZE_ORDER = 'width,height,depth' as const
export const PRODUCT_SIZE_ORDER_LABEL = '宽 × 高 × 深'
const rows:readonly (readonly [DetailedProductKind,string,ProductCategory,string,readonly [number,number,number],TemperatureZone,string,string])[] = [
 ['snack-pouch','示意薯片袋','包装食品','袋装 · 示意',[140,230,45],'常温','zone-packaged','#ca6748'],
 ['can','示意罐装食品','包装食品','罐装 · 示意',[76,120,76],'常温','zone-packaged','#cb9a52'],
 ['jar','示意果酱罐','包装食品','旋盖罐装 · 示意',[95,160,95],'常温','zone-packaged','#719188'],
 ['carton','示意饼干盒','包装食品','纸盒装 · 示意',[125,220,85],'常温','zone-packaged','#6d8397'],
 ['capped-bottle','示意饮料瓶','包装食品','旋盖瓶装 · 示意',[86,290,86],'常温','zone-packaged','#78a1ad'],
 ['handled-detergent','示意洗衣液','日用百货','提手瓶装 · 示意',[160,250,85],'常温','zone-household','#7085a7'],
 ['pump-bottle','示意洗手液','日用百货','泵头瓶装 · 示意',[85,210,85],'常温','zone-household','#a4aaca'],
 ['tissue-pack','示意抽纸','日用百货','软包抽纸 · 示意',[170,85,95],'常温','zone-household','#aea3c0'],
 ['apple','示意苹果','果蔬','单果 · 示意',[85,85,85],'常温','zone-produce','#b84542'],
 ['citrus','示意柑橘','果蔬','单果 · 示意',[90,82,90],'常温','zone-produce','#da8546'],
 ['leafy-greens','示意叶菜','果蔬','一束 · 示意',[130,150,140],'冷藏','zone-produce','#61834b'],
 ['frozen-pouch','示意冷冻食品袋','冷冻食品','袋装 · 示意',[125,210,50],'冷冻','zone-frozen','#5f8a9d'],
 ['frozen-box','示意冷冻食品盒','冷冻食品','盒装 · 示意',[150,190,50],'冷冻','zone-frozen','#7489ac'],
 ['milk-carton','示意鲜奶','冷藏乳品','屋顶纸盒 · 示意',[80,235,80],'冷藏','zone-daily','#7095b0'],
 ['yogurt-cup','示意酸奶','冷藏乳品','封膜杯装 · 示意',[87,105,87],'冷藏','zone-daily','#d49a81'],
 ['meat-tray','示意肉品托盘','生鲜肉类','托盘装 · 示意',[220,70,140],'冷藏','zone-meat','#b46a67'],
]
export const PRODUCT_CATALOG_SEED:readonly ProductCatalogItem[] = Object.freeze(rows.map(r=>Object.freeze({sku:PRODUCT_SKU_BY_MODEL[r[0]],modelKey:r[0],name:r[1],category:r[2],specification:r[3],referenceSizeMm:Object.freeze([...r[4]]) as readonly[number,number,number],temperatureZone:r[5],applicableZones:Object.freeze([r[6]]),color:r[7],notes:'',synthetic:true as const})))
export const PRODUCT_CATEGORIES:readonly ProductCategory[] = Object.freeze([...new Set(PRODUCT_CATALOG_SEED.map(p=>p.category))])
export function seedSkuIdForKind(kind:DetailedProductKind):string {const p=PRODUCT_CATALOG_SEED.find(p=>p.modelKey===kind);if(!p)throw new Error('Unknown product model');return p.sku}
const limits={name:80,specification:200,notes:1000} as const
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k)
function cleanPatch(value:unknown):ProductMetadataPatch {
 const out:ProductMetadataPatch={};if(!value||typeof value!=='object'||Array.isArray(value))return out
 for(const key of ['name','specification','notes'] as const){if(!own(value,key))continue;const v=(value as Record<string,unknown>)[key];if(typeof v!=='string'||v.length>limits[key]||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))continue;const text=v.trim();if(key==='name'&&!text)continue;out[key]=text}return out
}
export const PRODUCT_CATALOG_MAX_ADDITIONS = 32
export interface AddProductFromTemplateInput {templateSku:string;sku:string;name:string;specification:string;notes?:string}
function fromTemplate(value:unknown):ProductCatalogItem & {readonly templateSku:string} {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('商品条目格式无效')
 const p=value as Record<string,unknown>
 const template=PRODUCT_CATALOG_SEED.find(s=>own(p,'templateSku')&&s.sku===p.templateSku)
 if(!template)throw new Error('请选择原始目录中的有效模型模板')
 const rawSku=typeof p.sku==='string'?p.sku.trim():''
 const sku=rawSku.toUpperCase()
 if(!/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/.test(rawSku)||['CONSTRUCTOR','PROTOTYPE','__PROTO__'].includes(sku))throw new Error('SKU 须为 3–40 位英文字母、数字、下划线或短横线，并以字母或数字开头')
 const metadata=cleanPatch(p)
 if(!metadata.name)throw new Error('商品名称不能为空，且不得超过 80 字符或含控制字符')
 if(!metadata.specification)throw new Error('商品规格不能为空，且不得超过 200 字符或含控制字符')
 if(own(p,'notes')&&p.notes!==undefined&&metadata.notes===undefined)throw new Error('商品简介不得超过 1000 字符或含控制字符')
 return {...template,sku,templateSku:template.sku,name:metadata.name,specification:metadata.specification,notes:metadata.notes??''}
}
function normalized(products:readonly ProductCatalogItem[]):ProductCatalogItem[]{
 const result=PRODUCT_CATALOG_SEED.map(seed=>({...seed,...cleanPatch(products.find(p=>p.sku===seed.sku))}))
 const seen=new Set(result.map(p=>p.sku))
 for(const p of products){
  if(PRODUCT_CATALOG_SEED.some(s=>s.sku===p.sku))continue
  const item=fromTemplate(p)
  if(seen.has(item.sku))throw new Error('SKU 已存在，请使用不同的编号')
  if(result.length>=PRODUCT_CATALOG_SEED.length+PRODUCT_CATALOG_MAX_ADDITIONS)throw new Error('本机商品最多新增 32 条')
  seen.add(item.sku);result.push(item)
 }
 return result
}
/** Creates catalog metadata only, never placements, stock, or uploaded geometry. */
export function addProductFromTemplate(products:readonly ProductCatalogItem[],input:AddProductFromTemplateInput):ProductCatalogItem[]{
 const result=normalized(products),item=fromTemplate(input)
 if(result.some(p=>p.sku===item.sku))throw new Error('SKU 已存在，请使用不同的编号')
 if(result.length>=PRODUCT_CATALOG_SEED.length+PRODUCT_CATALOG_MAX_ADDITIONS)throw new Error('本机商品最多新增 32 条')
 return [...result,item]
}
export function updateProductMetadata(products:readonly ProductCatalogItem[],sku:string,patch:ProductMetadataPatch):ProductCatalogItem[]{return normalized(products).map(p=>{if(p.sku!==sku)return p;const safe=cleanPatch(patch);if(p.templateSku&&safe.specification==='')delete safe.specification;return {...p,...safe}})}
export interface CatalogStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export interface CatalogLoadResult {products:ProductCatalogItem[];status:'seed'|'loaded'|'invalid'|'unavailable';error?:string}
const seeds=()=>PRODUCT_CATALOG_SEED.map(p=>({...p}))
export function parseProductCatalog(raw:string|null):CatalogLoadResult {
 if(raw===null)return {products:seeds(),status:'seed'}
 try{if(raw.length>64000)throw new Error('目录数据过大');const v:unknown=JSON.parse(raw)
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('目录格式无效')
  const data=v as Record<string,unknown>;if(data.version!==PRODUCT_CATALOG_VERSION||!Array.isArray(data.overrides)||data.overrides.length>16)throw new Error('目录版本或条目数无效')
  const seen=new Set<string>(),patches=new Map<string,ProductMetadataPatch>()
  for(const item of data.overrides){if(!item||typeof item!=='object'||Array.isArray(item))continue;const p=item as Record<string,unknown>;if(typeof p.sku!=='string'||!PRODUCT_CATALOG_SEED.some(s=>s.sku===p.sku))continue;if(seen.has(p.sku))throw new Error('目录条目重复');seen.add(p.sku);patches.set(p.sku,cleanPatch(p))}
  let products:ProductCatalogItem[]=PRODUCT_CATALOG_SEED.map(p=>({...p,...patches.get(p.sku)}))
  if(own(data,'additions')){
   if(!Array.isArray(data.additions)||data.additions.length>PRODUCT_CATALOG_MAX_ADDITIONS)throw new Error('新增商品条目数无效')
   for(const addition of data.additions)products=addProductFromTemplate(products,fromTemplate(addition))
  }
  return {products,status:'loaded'}
 }catch{return {products:seeds(),status:'invalid',error:'本地目录格式或版本不受支持，已使用原始示意目录。'}}
}
export function loadProductCatalog(storage?:CatalogStorage):CatalogLoadResult {try{const target=storage??(typeof localStorage==='undefined'?undefined:localStorage);if(!target)return {products:seeds(),status:'seed'};return parseProductCatalog(target.getItem(PRODUCT_CATALOG_STORAGE_KEY))}catch{return {products:seeds(),status:'unavailable',error:'无法读取本地目录，已使用原始示意目录。'}}}
export function saveProductCatalog(products:readonly ProductCatalogItem[],storage?:CatalogStorage):{ok:boolean;error?:string}{try{const target=storage??(typeof localStorage==='undefined'?undefined:localStorage);if(!target)throw new Error('Storage unavailable');const normalizedProducts=normalized(products);const metadata=(p:ProductCatalogItem)=>({sku:p.sku,name:p.name,specification:p.specification,notes:p.notes});const raw=JSON.stringify({version:PRODUCT_CATALOG_VERSION,overrides:normalizedProducts.filter(p=>!p.templateSku).map(metadata),additions:normalizedProducts.filter(p=>p.templateSku).map(p=>({...metadata(p),templateSku:p.templateSku}))});if(raw.length>64000)throw new Error('目录数据超过本机保存预算');target.setItem(PRODUCT_CATALOG_STORAGE_KEY,raw);return {ok:true}}catch{return {ok:false,error:'本地保存失败，修改尚未持久化；请导出 JSON 留存。'}}}
export function filterProductCatalog(products:readonly ProductCatalogItem[],{query='',category}:{query?:string;category?:ProductCategory|string}={}):ProductCatalogItem[]{const q=query.trim().toLocaleLowerCase();return products.filter(p=>(!category||p.category===category)&&(!q||[p.sku,p.name,p.specification,p.category,p.modelKey,p.notes].some(v=>v.toLocaleLowerCase().includes(q))))}
/** Full, useful catalog export is separate from the metadata-only local persistence format. */
export function exportProductCatalog(products:readonly ProductCatalogItem[]=PRODUCT_CATALOG_SEED):string{return JSON.stringify({version:PRODUCT_CATALOG_VERSION,synthetic:true,notice:PRODUCT_CATALOG_NOTICE,units:'mm',sizeOrder:PRODUCT_SIZE_ORDER,sizeOrderLabel:PRODUCT_SIZE_ORDER_LABEL,products:normalized(products)},null,2)}
