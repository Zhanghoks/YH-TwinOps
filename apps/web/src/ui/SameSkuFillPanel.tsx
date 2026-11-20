import {useState} from 'react';
import { Layers3 } from 'lucide-react';
import { BeautifulButton as Button } from './beautiful/Button';
import type {ProductCatalogItem} from '../catalog/productCatalog';
import type {SameSkuFillRequest} from '../scene/sameSkuFill';

export interface FillPreview {count:number; skippedLevels:readonly string[]; error?:string}
export interface SameSkuFillControls {
  fillRequest?:SameSkuFillRequest;
  previewFill?:(request:SameSkuFillRequest)=>FillPreview;
  onApplyFill?:(request:SameSkuFillRequest)=>void;
  onRevertFill?:()=>void;
}
const SCOPE_LABELS = {cell:'单格',level:'单侧整层',fixture:'整架双面'} as const;

export function SameSkuFillPanel({product,fillRequest,previewFill,onApplyFill,onRevertFill}:SameSkuFillControls & {product:ProductCatalogItem}) {
  const [target,setTarget]=useState<Omit<SameSkuFillRequest,'sku'>>({scope:'cell',side:1,level:0,moduleIndex:0,bay:0,gapMm:10});
  const request:SameSkuFillRequest={...target,sku:product.sku};
  const preview=previewFill?.(request);
  const enabled=!!onApplyFill && !!preview && !preview.error && preview.count>0;
  return <section className="pc-fill" aria-label="F077 同款铺满试用">
    <div className="pc-fill-head"><h4><Layers3 size={17} aria-hidden="true"/> 同款铺满</h4><span className="pc-badge">F077 食品架 · 试用</span></div>
    <p>使用目录当前选中的 <strong>{product.name}</strong>（{product.sku}），按参考尺寸重复摆放，不拉伸商品。</p>
    <div className="pc-fill-controls">
      <label>铺满范围<select value={target.scope} onChange={e=>{const scope=e.currentTarget.value;if(scope==='cell'||scope==='level'||scope==='fixture')setTarget({...target,scope});}}>
        {Object.entries(SCOPE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
      {target.scope!=='fixture' && <>
        <label>货架面<select value={target.side} onChange={e=>setTarget({...target,side:e.currentTarget.value==='1'?1:-1})}><option value={1}>正面</option><option value={-1}>背面</option></select></label>
        <label>层位<select value={target.level} onChange={e=>setTarget({...target,level:Number(e.currentTarget.value)})}>{[200,500,800,1100,1400].map((height,index)=><option key={height} value={index}>第 {index+1} 层 · {height} mm</option>)}</select></label>
      </>}
      {target.scope==='cell' && <>
        <label>模块<select value={target.moduleIndex} onChange={e=>setTarget({...target,moduleIndex:Number(e.currentTarget.value)})}>{[0,1].map(index=><option key={index} value={index}>模块 {index+1}</option>)}</select></label>
        <label>格位<select value={target.bay} onChange={e=>setTarget({...target,bay:Number(e.currentTarget.value)})}>{[0,1].map(index=><option key={index} value={index}>第 {index+1} 格</option>)}</select></label>
      </>}
    </div>
    <p className="pc-fill-rule">间距 10 mm · 单侧整层覆盖两模块的四格 · 整架覆盖双面</p>
    <div className="pc-fill-preview" role="status" aria-live="polite">
      {preview ? <><strong>计划摆放 {preview.count} 个</strong><span>仅为 3D 示意摆放数量，非库存或真实补货。</span>
        {preview.error && <p className="pc-fill-error">{preview.error}</p>}
        {preview.skippedLevels.length>0 && <><p>以下位置不满足尺寸要求，将跳过：</p><ul>{preview.skippedLevels.map((reason,index)=><li key={`${index}-${reason}`}>{reason}</li>)}</ul></>}
      </> : <p>F077 铺满预览暂不可用，不能应用。</p>}
    </div>
    <p>{fillRequest ? `已应用：${fillRequest.sku} · ${SCOPE_LABELS[fillRequest.scope]}。切换商品或范围只更新预览。` : '尚未应用。只影响 F077 试换，不改其他货架或正式基线。'}</p>
    <div className="pc-actions"><Button variant="accent" disabled={!enabled} onClick={()=>{if(enabled)onApplyFill?.(request);}}>应用到 F077 并查看</Button><Button variant="quiet" disabled={!fillRequest||!onRevertFill} onClick={()=>onRevertFill?.()}>撤回同款铺满</Button></div>
    <p>撤回恢复 F077 此前试换开关与陈列；本次铺满不保存，刷新后恢复。</p>
  </section>;
}
