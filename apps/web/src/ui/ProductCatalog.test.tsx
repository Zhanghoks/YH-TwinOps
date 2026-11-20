import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import {ProductCatalog} from './ProductCatalog';
import {PRODUCT_CATALOG_SEED, type ProductCatalogItem} from '../catalog/productCatalog';

vi.mock('./ProductModelPreview', () => ({
  ProductModelPreview: ({product}: {product:ProductCatalogItem}) => <div data-testid="product-preview">{product.sku} / {product.modelKey}</div>,
}));

beforeEach(() => localStorage.clear());
afterEach(() => {cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear();});

test('filters by normalized search and category, and labels pilot placements as non-inventory', () => {
  render(<ProductCatalog trialCounts={{'YH-DEMO-001':596}}/>);
  expect(screen.getByText(/596 个试换陈列位置/)).toBeTruthy();
  const search = screen.getByRole('searchbox', {name:'搜索商品'});
  fireEvent.change(search,{target:{value:' yh-demo-001 '}});
  expect(screen.getByText('1 项结果')).toBeTruthy();
  expect(screen.getByText('596 个')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox',{name:'分类'}),{target:{value:'果蔬'}});
  expect(screen.getByText('0 项结果')).toBeTruthy();
  fireEvent.change(search,{target:{value:''}});
  expect(screen.getByText('3 项结果')).toBeTruthy();
  expect(screen.getByText('0 个（未关联试换位置）')).toBeTruthy();
});

test('saves editable data across remount, leaves geometry alone, and restores after confirmation', () => {
  const view = render(<ProductCatalog/>);
  const edit = () => fireEvent.click(screen.getByRole('button',{name:'编辑资料'}));
  edit();
  fireEvent.change(screen.getByLabelText('商品名称'),{target:{value:'试换薯片'}});
  fireEvent.change(screen.getByLabelText('商品规格'),{target:{value:'新规格'}});
  fireEvent.change(screen.getByLabelText('备注'),{target:{value:'自定义说明'}});
  fireEvent.click(screen.getByRole('button',{name:'保存到此浏览器'}));
  expect(screen.getByRole('status').textContent).toContain('已保存');
  view.unmount();
  render(<ProductCatalog/>);
  expect(screen.getByRole('heading',{name:'试换薯片'})).toBeTruthy();
  expect(screen.getByText('自定义说明')).toBeTruthy();
  expect(screen.getByText('140 × 230 × 45 mm')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'恢复原版'}));
  fireEvent.click(screen.getByRole('button',{name:'取消恢复'}));
  expect(screen.getByRole('heading',{name:'试换薯片'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'恢复原版'}));
  fireEvent.click(screen.getByRole('button',{name:'确认恢复'}));
  expect(screen.getByRole('heading',{name:PRODUCT_CATALOG_SEED[0]?.name})).toBeTruthy();
});

test('does not claim a save when browser storage rejects it', () => {
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new DOMException('full','QuotaExceededError');});
  render(<ProductCatalog/>);
  fireEvent.click(screen.getByRole('button',{name:'编辑资料'}));
  fireEvent.change(screen.getByLabelText('商品名称'),{target:{value:'不会保存'}});
  fireEvent.click(screen.getByRole('button',{name:'保存到此浏览器'}));
  expect(screen.getByRole('alert').textContent).toContain('未能保存');
  expect(within(screen.getByRole('region',{name:'商品资料'})).getByRole('heading',{name:'示意薯片袋'})).toBeTruthy();
});

test('exports a named JSON blob', () => {
  const makeUrl = vi.fn(() => 'blob:catalog-test');
  class TestURL extends URL {
    static override createObjectURL = makeUrl;
    static override revokeObjectURL = vi.fn();
  }
  vi.stubGlobal('URL',TestURL);
  const activation = vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement) {
    expect(this.download).toBe('yh-twinops-product-catalog-v1.json');
  });
  vi.useFakeTimers();
  render(<ProductCatalog/>);
  fireEvent.click(screen.getByRole('button',{name:'导出 JSON'}));
  expect(activation).toHaveBeenCalledOnce();
  expect(makeUrl).toHaveBeenCalledWith(expect.objectContaining({type:'application/json;charset=utf-8'}));
  vi.runOnlyPendingTimers();
  expect(TestURL.revokeObjectURL).toHaveBeenCalledWith("blob:catalog-test");
});

test('rejects a metadata value the model would otherwise silently filter', () => {
  render(<ProductCatalog/>);
  fireEvent.click(screen.getByRole('button',{name:'编辑资料'}));
  fireEvent.change(screen.getByLabelText('备注'),{target:{value:'保留\u001f删除'}});
  fireEvent.click(screen.getByRole('button',{name:'保存到此浏览器'}));
  expect(screen.getByRole('alert').textContent).toContain('不支持的控制字符');
  expect(localStorage.length).toBe(0);
});

test('adds a unique local SKU, selects it, and restores its metadata and inherited model after reload', () => {
  const view = render(<ProductCatalog previewFill={() => ({count:32,skippedLevels:[]})}/>);
  fireEvent.change(screen.getByRole('searchbox',{name:'搜索商品'}),{target:{value:'薯片'}});
  expect(screen.getByTestId('product-preview').textContent).toBe('YH-DEMO-001 / snack-pouch');
  fireEvent.click(screen.getByRole('button',{name:'新增商品'}));
  const form = within(screen.getByRole('form',{name:'新增商品表单'}));
  const model = form.getByRole('combobox',{name:'3D 模型模板'});
  expect(document.activeElement).toBe(model);
  fireEvent.change(model,{target:{value:'YH-DEMO-004'}});
  expect(form.getByText('包装食品 · 125 × 220 × 85 mm')).toBeTruthy();
  fireEvent.change(form.getByLabelText('商品 SKU'),{target:{value:'yh-local-cookie'}});
  fireEvent.change(form.getByLabelText('商品名称'),{target:{value:'海盐方脆饼'}});
  fireEvent.change(form.getByLabelText('商品规格'),{target:{value:'纸盒 · 180 g'}});
  fireEvent.change(form.getByLabelText('商品介绍（可选）'),{target:{value:'展示新口味的陈列包装。'}});
  fireEvent.click(form.getByRole('button',{name:'保存商品'}));
  expect(screen.getByRole('status').textContent).toContain('已新增 海盐方脆饼');
  expect(screen.getByRole('heading',{name:'海盐方脆饼'})).toBeTruthy();
  expect(screen.getByTestId('product-preview').textContent).toBe('YH-LOCAL-COOKIE / carton');
  expect(screen.getByText('展示新口味的陈列包装。')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'应用到 F077 并查看'})).toBeNull();
  expect(screen.getByRole('searchbox',{name:'搜索商品'})).toHaveProperty('value','');
  view.unmount();
  render(<ProductCatalog/>);
  fireEvent.change(screen.getByRole('searchbox',{name:'搜索商品'}),{target:{value:'yh-local-cookie'}});
  expect(screen.getByRole('heading',{name:'海盐方脆饼'})).toBeTruthy();
  expect(screen.getByText('125 × 220 × 85 mm')).toBeTruthy();
  expect(screen.getByTestId('product-preview').textContent).toBe('YH-LOCAL-COOKIE / carton');
});

test('keeps invalid entries out of storage and restores keyboard focus on cancel', () => {
  render(<ProductCatalog/>);
  const add = screen.getByRole('button',{name:'新增商品'});
  fireEvent.click(add);
  const form = within(screen.getByRole('form',{name:'新增商品表单'}));
  fireEvent.change(form.getByLabelText('商品 SKU'),{target:{value:'yh-demo-001'}});
  fireEvent.change(form.getByLabelText('商品名称'),{target:{value:'重复编号'}});
  fireEvent.change(form.getByLabelText('商品规格'),{target:{value:'示意袋装'}});
  fireEvent.click(form.getByRole('button',{name:'保存商品'}));
  expect(form.getByRole('alert').textContent).toContain('SKU 已存在');
  expect(localStorage.length).toBe(0);
  fireEvent.click(form.getByRole('button',{name:'取消新增'}));
  expect(document.activeElement).toBe(add);
  expect(screen.queryByRole('form',{name:'新增商品表单'})).toBeNull();
});
