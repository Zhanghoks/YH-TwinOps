import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SceneBoundary } from './scene/SceneBoundary';

it('isolates scene failures and lets the user retry without losing adjacent tools', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  let fail = true;
  function Scene() {
    if (fail) throw new Error('WebGL context unavailable');
    return <div>Rendered scene</div>;
  }
  try {
    render(<><SceneBoundary><Scene /></SceneBoundary><aside>Operations remain available</aside></>);
    expect(screen.getByRole('alert').textContent).toContain('3D 场景暂时不可用');
    expect(screen.getByText('Operations remain available')).toBeTruthy();
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: '重试 3D 场景' }));
    expect(screen.getByText('Rendered scene')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  } finally { log.mockRestore(); }
});

it('shows the selected store layout and retains a usable facility picker when WebGL fails', async () => {
  const { ScenePlanFallback } = await import('./scene/ScenePlanFallback');
  const { layout } = await import('./data');
  const { useWorkbench } = await import('./state');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const f077 = layout.fixtures.find(fixture => fixture.fixtureId === 'F077')!;
  const at = '2026-11-20T06:00:00Z';
  const merchandising = { version: 1 as const, synthetic: true as const, storeId: layout.storeId, at,
    products: [], inventory: [], stockObservations: [], coveredFixtureIds: ['F077'],
    placements: [{ placementId: 'F077/0-1-0', storeId: layout.storeId, synthetic: true as const,
      fixtureId: 'F077', slotId: '0-1-0', sku: 'YH-LOCAL-001', origin: 'USER_SANDBOX' as const }],
  };
  function NoRenderer(): never { throw new Error('WebGL2 not supported'); }
  try {
    useWorkbench.getState().select(null);
    const { container } = render(<SceneBoundary fallback={<ScenePlanFallback layout={layout} merchandising={merchandising} />}><NoRenderer /></SceneBoundary>);
    expect(screen.getByRole('img', { name: '当前门店二维平面示意' })).toBeTruthy();
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
    await userEvent.setup().selectOptions(screen.getByLabelText('查看设施'), f077.fixtureId);
    expect(useWorkbench.getState().selection).toEqual({kind: 'fixture', id: 'F077'});
    expect(screen.getByText('本机单格试摆：0-1-0 · YH-LOCAL-001（不代表库存）')).toBeTruthy();
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    await userEvent.setup().selectOptions(screen.getByLabelText('查看设施'), '');
    expect(useWorkbench.getState().selection).toBeNull();
  } finally { useWorkbench.getState().select(null); log.mockRestore(); }
});
