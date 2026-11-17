import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createAgent } from '@ui-sdk/react/agent';
import { App } from './App';

vi.mock('./scene/Scene', () => ({ Scene: (props: { mode: string; cameraView: string; cameraRevision: number; showLabels: boolean }) => <output data-testid="scene-state">{JSON.stringify(props)}</output> }));
vi.mock('./ui/AgentShell', () => ({ AgentShell: () => <div>Agent workspace</div> }));
vi.mock('./api', () => ({ createApprovalsClient: vi.fn(async () => null), fetchAgentStatus: vi.fn(async () => null) }));

describe('scene presentation controls', () => {
  it('keeps model mode separate from signals, supports reversible camera/label controls', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ assets: [{ assetId: 'baseline', status: 'approved', file: 'baseline.glb', role: 'store-shell' }] }) })));
    const user = userEvent.setup();
    render(<App />);
    const state = () => JSON.parse(screen.getByTestId('scene-state').textContent ?? '{}') as { mode: string; cameraView: string; cameraRevision: number; showLabels: boolean };
    expect(state().mode).toBe('detail');
    expect(screen.getByText(/商品为装饰，不代表库存/)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('radio', { name: '原始外壳' }).hasAttribute('disabled')).toBe(false));
    const agent = createAgent();
    const labels = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== 'more').map((entry) => entry.label);
    expect(labels).toContain('模型表现');
    await user.click(screen.getByRole('radio', { name: '白膜' }));
    expect(state().mode).toBe('white');
    await user.click(screen.getByRole('radio', { name: '原始外壳' }));
    expect(state().mode).toBe('shell');
    await user.click(screen.getByRole('radio', { name: '精细模型' }));
    expect(state().mode).toBe('detail');
    await user.click(screen.getByRole('button', { name: '俯视布局' }));
    expect(state().cameraView).toBe('top');
    await user.click(screen.getByRole('button', { name: '全店视角' }));
    await user.click(screen.getByRole('button', { name: '全店视角' }));
    expect(state().cameraView).toBe('overview');
    expect(state().cameraRevision).toBe(3);
    await user.click(screen.getByRole('button', { name: '隐藏分区' }));
    expect(state().showLabels).toBe(false);
    await user.click(screen.getByRole('button', { name: '显示分区' }));
    expect(state().showLabels).toBe(true);
    vi.unstubAllGlobals();
  });
});
