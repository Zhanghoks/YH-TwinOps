import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {ProductCatalog} from './ProductCatalog';
import type {SameSkuFillRequest} from '../scene/sameSkuFill';
afterEach(()=>{cleanup();localStorage.clear();});

test('uses catalog selection, previews each scope without applying, applies explicit request and reverts',()=>{
 const apply=vi.fn(),revert=vi.fn();
 const preview=vi.fn((request:SameSkuFillRequest)=>({count:request.scope==='cell'?32:request.scope==='level'?128:1024,skippedLevels:request.scope==='fixture'?['第 5 层：净高不足']:[]}));
 const view=render(<ProductCatalog onApplyFill={apply} onRevertFill={revert} previewFill={preview}/>);
 fireEvent.change(screen.getByRole('searchbox',{name:'搜索商品'}),{target:{value:'YH-DEMO-004'}});
 expect(screen.getByText('计划摆放 32 个')).toBeTruthy();
 expect(screen.getByRole('button',{name:'撤回同款铺满'}).hasAttribute('disabled')).toBe(true);
 fireEvent.change(screen.getByLabelText('格位'),{target:{value:'1'}});
 expect(preview.mock.lastCall?.[0]).toMatchObject({sku:'YH-DEMO-004',scope:'cell',bay:1});
 fireEvent.change(screen.getByLabelText('铺满范围'),{target:{value:'level'}});
 expect(screen.queryByLabelText('格位')).toBeNull();
 expect(screen.getByText('计划摆放 128 个')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('铺满范围'),{target:{value:'fixture'}});
 expect(screen.queryByLabelText('货架面')).toBeNull();
 expect(screen.getByText('第 5 层：净高不足')).toBeTruthy();
 expect(screen.getByText('计划摆放 1024 个')).toBeTruthy();
 expect(apply).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'应用到 F077 并查看'}));
 expect(apply).toHaveBeenCalledWith({sku:'YH-DEMO-004',scope:'fixture',side:1,level:0,moduleIndex:0,bay:1,gapMm:10});
 view.rerender(<ProductCatalog onApplyFill={apply} onRevertFill={revert} previewFill={preview} fillRequest={{sku:'YH-DEMO-004',scope:'fixture',side:1,level:0,moduleIndex:0,bay:1,gapMm:10}}/>);
 fireEvent.click(screen.getByRole('button',{name:'撤回同款铺满'}));
 expect(revert).toHaveBeenCalledOnce();
});

test('incompatible or zero-count previews cannot be applied and expose the reason',()=>{
 const apply=vi.fn();
 const view=render(<ProductCatalog onApplyFill={apply} previewFill={()=>({count:0,skippedLevels:[],error:'仅支持常温包装食品'})}/>);
 expect(screen.getByText('仅支持常温包装食品')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'应用到 F077 并查看'}));
 expect(apply).not.toHaveBeenCalled();
 view.rerender(<ProductCatalog onApplyFill={apply} previewFill={()=>({count:0,skippedLevels:['高度不足']})}/>);
 fireEvent.click(screen.getByRole('button',{name:'应用到 F077 并查看'}));
 expect(apply).not.toHaveBeenCalled();
});
