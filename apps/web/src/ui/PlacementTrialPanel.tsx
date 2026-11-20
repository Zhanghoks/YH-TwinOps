import { useState } from 'react';
import { Grid2X2 } from 'lucide-react';
import type { ProductCatalogItem } from '../catalog/productCatalog';
import { BeautifulButton as Button } from './beautiful/Button';

export interface PlacementTrialSlot {
  slotId: string;
  mountId: string;
  moduleIndex: number;
  side: -1 | 1;
  bay: number;
  level: number;
  sku: string;
}
export interface PlacementTrialPreview {
  ok: boolean;
  reason: string;
  oldSku?: string;
  oldSizeMm?: readonly [number, number, number];
  newSizeMm?: readonly [number, number, number];
}
export interface PlacementTrialControls {
  slots: readonly PlacementTrialSlot[];
  /** Changes when the source scene or effective placement configuration changes, not per clock tick. */
  revision?: string;
  enabled: boolean;
  blockReason?: string;
  active?: {slotId: string; sku: string};
  onPreview: (slotId: string, sku: string) => PlacementTrialPreview;
  onApply: (slotId: string, sku: string) => void;
  onRevert: () => void;
}

const renderMm = (size?: readonly [number, number, number]) => size ? `${size.join(' × ')} mm` : '—';

export function PlacementTrialPanel({product,controls}: {product: ProductCatalogItem; controls: PlacementTrialControls}) {
  const [slotId, setSlotId] = useState('');
  const [checked, setChecked] = useState<{slotId: string; sku: string; revision?: string; result: PlacementTrialPreview}>();
  const slot = controls.slots.find(item => item.slotId === slotId);
  const preview = controls.enabled && slot && checked?.slotId === slot.slotId && checked.sku === product.sku && checked.revision === controls.revision
    ? checked.result : undefined;
  return (
    <section className="pc-fill" aria-label="试摆到货位">
      <div className="pc-fill-head">
        <h4><Grid2X2 size={17} aria-hidden="true" />试摆到货位</h4>
        <span className="pc-badge">F077 · 单个模型位置</span>
      </div>
      <p>商品陈列示意，不代表库存，也不会更改销售数据。</p>
      {controls.blockReason && <p className="pc-fill-error" role="status">{controls.blockReason}</p>}
      <div className="pc-fill-controls">
        <label>选择 F077 货位
          <select value={slot ? slotId : ''} disabled={!controls.enabled} onChange={e => { setSlotId(e.currentTarget.value);setChecked(undefined); }}>
            <option value="">选择一个现有货位</option>
            {controls.slots.map(option => <option key={option.slotId} value={option.slotId}>
              {option.slotId} · 模块 {option.moduleIndex+1} · {option.side===1 ? '正面':'背面'} · 第 {option.bay+1} 格 · 第 {option.level+1} 层 · {option.sku}
            </option>)}
          </select>
        </label>
      </div>
      <p className="pc-fill-rule">目标：{product.sku} · {product.name} · {product.temperatureZone} · {renderMm(product.referenceSizeMm)}</p>
      {preview && (
        <div className="pc-fill-preview" role="status">
          <strong>{preview.ok ? '试摆校验通过' : '无法试摆，原陈列保留'}</strong>
          <span className={preview.ok ? undefined : 'pc-fill-error'}>{preview.reason}</span>
          <span>原陈列：{preview.oldSku ?? slot?.sku ?? '—'} · {renderMm(preview.oldSizeMm)}</span>
          <span>目标 SKU：{product.sku} · {renderMm(preview.newSizeMm ?? product.referenceSizeMm)}</span>
        </div>
      )}
      {controls.active && <p role="status">当前试摆：{controls.active.slotId} · {controls.active.sku}（教学沙盒）</p>}
      <div className="pc-actions">
        <Button disabled={!controls.enabled || !slot} onClick={() => {
          if (controls.enabled && slot) setChecked({slotId:slot.slotId,sku:product.sku,revision:controls.revision,result:controls.onPreview(slot.slotId,product.sku)});
        }}>预览试摆</Button>
        <Button variant="accent" disabled={!preview?.ok || !slot} onClick={() => {
          if (preview?.ok && slot) { controls.onApply(slot.slotId, product.sku); setChecked(undefined); }
        }}>应用到本机模拟场景</Button>
        <Button variant="quiet" disabled={!controls.active} onClick={() => { controls.onRevert();setChecked(undefined); }}>撤回单格试摆</Button>

      </div>
    </section>
  );
}
