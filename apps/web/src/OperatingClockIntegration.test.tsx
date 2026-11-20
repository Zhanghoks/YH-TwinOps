import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { buildLiveOperatingScenario } from './operatingClock';

vi.mock('./scene/Scene', () => ({ Scene: (props: { snapshot: { atTime: string } }) => <output data-testid="clock-scene">{props.snapshot.atTime}</output> }));
vi.mock('./ui/AgentShell', () => ({ AgentShell: (props: { at: string }) => {
  const [saved, setSaved] = useState(false);
  return <div><output data-testid="agent-clock">{props.at}</output><button onClick={() => setSaved(true)}>{saved ? 'chat preserved' : 'save chat'}</button></div>;
} }));
vi.mock('./api', () => ({ createApprovalsClient: vi.fn(async () => null), fetchAgentStatus: vi.fn(async () => null) }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('shared live scenario and manual review', () => {
  it('updates clock without remounting chat, freezes manual time, resumes and handles midnight', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T01:12:20Z'));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ assets: [] }) })));
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
    render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name:'save chat' }));
    expect(screen.getByTestId('clock-scene').textContent).toBe('2026-11-13T01:12:00.000Z');
    act(() => vi.advanceTimersByTime(40_000));
    expect(screen.getByTestId('agent-clock').textContent).toBe('2026-11-13T01:13:00.000Z');
    expect(screen.getByRole('button',{name:'chat preserved'})).toBeTruthy();
    fireEvent.click(screen.getByRole('radio',{name:'经营看板'}));
    fireEvent.click(screen.getByRole('radio',{name:'3D 孪生'}));
    expect(screen.getByRole('button',{name:'chat preserved'})).toBeTruthy();
    fireEvent.click(screen.getByRole('radio',{name:'经营看板'}));
    fireEvent.change(screen.getByRole('combobox',{name:'经营模拟时段'}),{target:{value:'18'}});
    const manualAt = screen.getByTestId('agent-clock').textContent;
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByTestId('agent-clock').textContent).toBe(manualAt);
    expect(screen.getByText('手动回看 · 完整小时情景')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'返回随钟模拟'}));
    expect(screen.getByTestId('agent-clock').textContent).toBe('2026-11-13T01:14:00.000Z');
    act(() => { vi.setSystemTime(new Date('2026-11-13T16:00:00Z')); window.dispatchEvent(new Event('focus')); });
    expect(screen.getByTestId('agent-clock').textContent).toBe('2026-11-13T16:00:00.000Z');
    expect(screen.getByRole('radio',{name:'周末'}).getAttribute('aria-checked')).toBe('true');
    const s=buildLiveOperatingScenario(new Date('2026-11-13T16:00:00Z'));
    expect(s.cumulative.entrants).toBe(0);
    expect(screen.getByText(/00:00 随钟模拟/)).toBeTruthy();
  });
});
