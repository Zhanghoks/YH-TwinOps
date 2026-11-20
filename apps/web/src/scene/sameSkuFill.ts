import { PRODUCT_CATALOG_SEED } from '../catalog/productCatalog'
import type { DetailedProductKind } from './detailedProduct'
import type { DetailFixtureShape } from './detailGeometry'
import type { ShelfMount } from './dimensionedShelf'
import { buildShelfGroupReplacement } from './shelfGroupReplacement'
export interface SameSkuFillRequest {sku:string;scope:'cell'|'level'|'fixture';side:-1|1;level:number;moduleIndex:number;bay:number;gapMm:number}
export interface SameSkuPlacement {id:string;mountKey:string;groupKey:string;moduleIndex:number;side:-1|1;bay:number;level:number;depthRow:number;column:number;sku:string;modelKey:DetailedProductKind;sizeM:readonly[number,number,number];position:readonly[number,number,number];yaw:number;color:string}
export interface SameSkuFillResult {ok:boolean;placements:SameSkuPlacement[];replacedMountKeys:string[];counts:{requestedMounts:number;filledMounts:number;products:number;skippedMounts:number};skipped:{mountKey:string;reason:string}[];incompatibility:string|null}
export const SAME_SKU_MAX_PRODUCTS=4096
export const sameSkuMountKey=(moduleIndex:number,mount:Pick<ShelfMount,'side'|'bay'|'level'>)=>`F077/module-${moduleIndex}/side-${mount.side}/bay-${mount.bay}/level-${mount.level}`
export function buildSameSkuFill(fixture:DetailFixtureShape,request:SameSkuFillRequest):SameSkuFillResult {
 const result:SameSkuFillResult={ok:false,placements:[],replacedMountKeys:[],counts:{requestedMounts:0,filledMounts:0,products:0,skippedMounts:0},skipped:[],incompatibility:null}
 const fail=(reason:string):SameSkuFillResult=>({ok:false,placements:[],replacedMountKeys:[],counts:{requestedMounts:0,filledMounts:0,products:0,skippedMounts:0},skipped:[],incompatibility:reason})
 if(fixture.fixtureId!=='F077')return fail('仅支持已核验的 F077 货架')
 const model=buildShelfGroupReplacement(fixture,{stocked:false,lod:'far'});if(!model)return fail('货架尺寸、位置或分区不符合严格试验范围')
 if(!request||!['cell','level','fixture'].includes(request.scope)||![-1,1].includes(request.side)||!Number.isInteger(request.level)||request.level<0||request.level>4||!Number.isInteger(request.moduleIndex)||request.moduleIndex<0||request.moduleIndex>=model.rackOffsetsM.length||!Number.isInteger(request.bay)||request.bay<0||request.bay>1||!Number.isFinite(request.gapMm)||request.gapMm<0||request.gapMm>100)return fail('填充参数无效；间隔范围为 0–100 mm')
 const product=PRODUCT_CATALOG_SEED.find(p=>p.sku===request.sku)
 if(!product||product.category!=='包装食品'||product.temperatureZone!=='常温'||!product.applicableZones.includes('zone-packaged'))return fail('该商品不是本货架支持的常温包装食品')
 const size=product.referenceSizeMm.map(n=>n/1000) as [number,number,number],gap=request.gapMm/1000
 for(const [moduleIndex,offset] of model.rackOffsetsM.entries())for(const mount of model.frame.mounts){
  if(request.scope!=='fixture'&&(mount.side!==request.side||mount.level!==request.level))continue
  if(request.scope==='cell'&&(moduleIndex!==request.moduleIndex||mount.bay!==request.bay))continue
  const key=sameSkuMountKey(moduleIndex,mount);result.counts.requestedMounts++
  const columns=Math.floor((mount.size[0]+gap+1e-10)/(size[0]+gap)),rows=Math.floor((mount.size[2]+gap+1e-10)/(size[2]+gap))
  if(size[1]>mount.size[1]+1e-10||columns<1||rows<1){result.skipped.push({mountKey:key,reason:size[1]>mount.size[1]?'商品高于该格净高，保留原商品':'原尺寸无法放入该格，保留原商品'});continue}
  if(result.placements.length+columns*rows>SAME_SKU_MAX_PRODUCTS)return fail('本次填充超过安全数量预算；未替换任何格')
  result.replacedMountKeys.push(key)
  for(let depthRow=0;depthRow<rows;depthRow++)for(let column=0;column<columns;column++){
   const groupKey=`${key}/depth-${depthRow}/sku-${product.sku}`
   result.placements.push({id:`${groupKey}/col-${column}`,groupKey,mountKey:key,moduleIndex,side:mount.side,bay:mount.bay,level:mount.level,depthRow,column,sku:product.sku,modelKey:product.modelKey,sizeM:size,position:[offset+mount.anchor[0]+(column-(columns-1)/2)*(size[0]+gap),mount.anchor[1],mount.anchor[2]+mount.side*((rows-1)/2-depthRow)*(size[2]+gap)],yaw:mount.side===1?0:Math.PI,color:product.color})
  }
 }
 result.counts.filledMounts=result.replacedMountKeys.length;result.counts.products=result.placements.length;result.counts.skippedMounts=result.skipped.length
 result.ok=result.placements.length>0;if(!result.ok)result.incompatibility='所选格净尺寸不足，原商品保持不变'
 return result
}
