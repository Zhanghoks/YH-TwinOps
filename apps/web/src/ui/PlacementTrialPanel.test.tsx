import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PRODUCT_CATALOG_SEED } from '../catalog/productCatalog';
import { PlacementTrialPanel, type PlacementTrialControls } from './PlacementTrialPanel';

const product = PRODUCT_CATALOG_SEED[0]!;
const slots = [
  {slotId:'source-slot-A', mountId:'m1', moduleIndex:0, side:1 as const, bay:0, level:0, sku:'YH-DEMO-002'},
  {slotId:'source-slot-B', mountId:'m2', moduleIndex:1, side:-1 as const, bay:1, level:4, sku:'YH-DEMO-003'},
];
const previewOk = {ok:true, reason:'温区匹配，净空校验通过', oldSku:'YH-DEMO-002', oldSizeMm:[100, 117, 78] as const, newSizeMm:product.referenceSizeMm};
const selectSlot = (slotId: string) => fireEvent.change(screen.getByLabelText('选择 F077 货位'), {target:{value:slotId}});
const preview = () => fireEvent.click(screen.getByRole('button', {name:'预览试摆'}));
const apply = () => screen.getByRole<HTMLButtonElement>('button', {name:'应用到本机模拟场景'});

describe('F077 单格试摆', () => {
  it('显式校验且只提交刚才预览的商品和真实格位；切换格位使预览过期', () => {
    const onPreview = vi.fn(() => previewOk);
    const onApply = vi.fn();
    render(<PlacementTrialPanel product={product} controls={{slots, enabled:true, onPreview, onApply, onRevert:vi.fn()}}/>);
    expect(apply().disabled).toBe(true);
    selectSlot(slots[0]!.slotId);
    preview();
    expect(onPreview).toHaveBeenCalledWith(slots[0]!.slotId, product.sku);
    expect(screen.getByText('温区匹配，净空校验通过')).toBeTruthy();
    expect(screen.getByText('100 × 117 × 78 mm', {exact:false})).toBeTruthy();
    expect(apply().disabled).toBe(false);
    selectSlot(slots[1]!.slotId);
    expect(apply().disabled).toBe(true);
    selectSlot(slots[0]!.slotId);
    expect(apply().disabled).toBe(true);
    preview();
    fireEvent.click(apply());
    expect(onApply.mock.calls).toEqual([[slots[0]!.slotId, product.sku]]);
  });

  it('拒绝超限试摆且同款铺满互斥', () => {
    const onPreview = vi.fn(() => ({ok:false, reason:'超出格位净空'}));
    const onApply = vi.fn();
    const controls: PlacementTrialControls = {slots, enabled:true, onPreview, onApply, onRevert:vi.fn()};
    const { rerender } = render(<PlacementTrialPanel product={product} controls={controls}/>);
    selectSlot(slots[0]!.slotId);
    preview();
    expect(screen.getByText('超出格位净空')).toBeTruthy();
    expect(apply().disabled).toBe(true);
    rerender(<PlacementTrialPanel product={product} controls={{...controls, enabled:false, blockReason:'请先撤回同款填充'}}/>);
    expect(screen.getByText('请先撤回同款填充')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', {name:'预览试摆'}).disabled).toBe(true);
    expect(onApply).not.toHaveBeenCalled();
  });
});
