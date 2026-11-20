import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

// No WebGL in jsdom. Keep the production Agent shell, conversation, and rule engine.
vi.mock('./scene/Scene', () => ({
  Scene: ({ snapshot }: { snapshot: { atTime: string } }) =>
    <output data-testid="scenario-time">{snapshot.atTime}</output>,
}));
vi.mock('./useOperatingClock', () => ({
  useOperatingClock: () => new Date('2026-11-13T09:13:00.000Z'),
}));
vi.mock('./api', async (importOriginal) => ({
  ...await importOriginal<typeof import('./api')>(),
  createApprovalsClient: vi.fn(async () => null),
  fetchAgentStatus: vi.fn(async () => null),
}));
afterEach(() => vi.unstubAllGlobals());

describe('peer workspaces with the real Agent', () => {
  it('keeps an actual reply and tool disclosure when visiting analytics at the same time', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ assets: [] }) })));
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<App />);
    const select = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));
    select('经营看板');
    fireEvent.change(screen.getByRole('combobox', { name: '经营模拟时段' }), { target: { value: '17' } });
    const at = screen.getByTestId('scenario-time').textContent;
    select('3D 孪生');
    const agent = screen.getByRole('complementary', { name: '门店运营 Agent 对话框' });
    await within(agent).findByText('浏览器本地规则（离线）');
    fireEvent.click(within(agent).getByRole('button', { name: /收银排队/ }));
    const reply = await within(agent).findByRole('article', { name: '助手回答' });
    const trace = within(reply).getByRole('button', { name: '展开证据与工具轨迹' });
    fireEvent.click(trace);
    expect(trace.getAttribute('aria-expanded')).toBe('true');

    select('经营看板');
    expect(screen.getByRole('main', { name: '经营看板页面' })).toBeTruthy();
    expect((screen.getByRole('combobox', { name: '经营模拟时段' }) as HTMLSelectElement).value).toBe('17');
    select('3D 孪生');
    expect(screen.queryByRole('region', { name: '门店运营驾驶舱' })).toBeNull();
    expect(screen.getByTestId('scenario-time').textContent).toBe(at);
    expect(within(agent).getByRole('article', { name: '助手回答' })).toBe(reply);
    expect(trace.getAttribute('aria-expanded')).toBe('true');
  });
});
