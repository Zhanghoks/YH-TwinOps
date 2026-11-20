import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SkuStockObservation } from '@yh/contracts';
import { projectTwinState } from '@yh/twin-state';
import { buildMerchandiseSource, projectWebMerchandise } from '../catalog/merchandisingAdapter';
import { PRODUCT_CATALOG_SEED } from '../catalog/productCatalog';
import { layout } from '../data';
import { generatePlanningLayout } from '../scene/planningLayout';
import { useWorkbench } from '../state';
import { SelectionInfo } from './SelectionInfo';

const dense = generatePlanningLayout(layout).layout;
const source = buildMerchandiseSource(dense)!;
const at = '2026-11-20T10:00:00Z';
const later = '2026-11-20T10:16:00Z';
const slot = source.trialSlots[0]!;
const observation: SkuStockObservation = {
  id:'inventory-test',storeId:dense.storeId,zoneId:'zone-packaged',fixtureId:'F077',sku:slot.sku,
  kind:'OBSERVED',sourceId:'synthetic-stock-fixture',quantity:9,unit:'件',observedAt:at,ingestedAt:at,validUntil:'2026-11-20T10:15:00Z',synthetic:true,
};

describe('Selected fixture merchandising details', () => {
  afterEach(()=>useWorkbench.getState().select(null));

  it('reads the active layout version and suppresses merchandising from a different snapshot time', () => {
    useWorkbench.getState().select({kind:'fixture',id:'F077'});
    const fixture=dense.fixtures.find(item=>item.fixtureId==='F077')!;
    const merchandising=projectWebMerchandise(dense,at,PRODUCT_CATALOG_SEED,source);
    const {rerender} = render(<SelectionInfo snapshot={projectTwinState([],dense,at)} layout={dense} merchandising={merchandising} selectedSlotId={slot.slotId}/>);
    expect(screen.getByText(`${fixture.x} × ${fixture.y} × ${fixture.z} m（当前布局）`)).toBeTruthy();
    expect(screen.getByText('无可靠观测（UNKNOWN，不代表 0 件）')).toBeTruthy();
    rerender(<SelectionInfo snapshot={projectTwinState([],dense,later)} layout={dense} merchandising={merchandising}/>);
    expect(screen.queryByRole('region',{name:'设施陈列与库存'})).toBeNull();
    rerender(<SelectionInfo snapshot={projectTwinState([],layout,at)} layout={layout}/>);
    const legacy=layout.fixtures.find(item=>item.fixtureId==='F077')!;
    expect(screen.getByText(`${legacy.x} × ${legacy.y} × ${legacy.z} m（当前布局）`)).toBeTruthy();
    expect(screen.queryByRole('region',{name:'设施陈列与库存'})).toBeNull();
  });

  it('shows independent synthetic reading/provenance, expiry does not retain current quantity', () => {
    useWorkbench.getState().select({kind:'fixture',id:'F077'});
    const inject = vi.fn();
    const select = vi.fn();
    const {rerender} = render(<SelectionInfo snapshot={projectTwinState([],dense,at)} layout={dense}
      merchandising={projectWebMerchandise(dense,at,PRODUCT_CATALOG_SEED,source,undefined,[observation])}
      selectedSlotId={slot.slotId} onSelectSlot={select} onInjectStock={inject}/>);
    const details=within(screen.getByRole('region',{name:'设施陈列与库存'}));
    expect(details.getByText('9 件 · 合成观测（OBSERVED）')).toBeTruthy();
    expect(details.getByText('inventory-test')).toBeTruthy();
    fireEvent.change(details.getByLabelText('查看货位'),{target:{value:source.trialSlots[1]!.slotId}});
    expect(select).toHaveBeenCalledWith(source.trialSlots[1]!.slotId);
    fireEvent.click(details.getByRole('button',{name:'注入合成库存观测'}));
    expect(inject).toHaveBeenCalledWith(slot.sku,'F077');
    rerender(<SelectionInfo snapshot={projectTwinState([],dense,later)} layout={dense}
      merchandising={projectWebMerchandise(dense,later,PRODUCT_CATALOG_SEED,source,undefined,[observation])}
      selectedSlotId={slot.slotId}/>);
    expect(screen.getByText('最近库存观测已过期，不用于决策。')).toBeTruthy();
    expect(screen.queryByText('9 件 · 合成观测（OBSERVED）')).toBeNull();
    expect(screen.getByText('inventory-test')).toBeTruthy();
  });
});
