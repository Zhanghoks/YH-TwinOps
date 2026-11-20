import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentTools } from '@yh/agent/tools';
import { METRICS } from '@yh/contracts';
import { makeSignal, makeTestLayout, TEST_AT } from '@yh/contracts/testing';
import { projectTwinState } from '@yh/twin-state';
import { AgentPanel } from './AgentPanel';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    fetchAgentStatus: vi.fn(async () => null),
    askStoreAgent: vi.fn(async () => {
      throw new Error('api offline');
    }),
  };
});

const layout = makeTestLayout();
const signals = [
  makeSignal({ id: 'q1', zoneId: 'zone-checkout', metric: METRICS.queueLength, unit: '人', value: 16, observedAt: '2026-11-15T17:59:00Z' }),
  makeSignal({ id: 'lanes1', zoneId: 'zone-checkout', metric: METRICS.checkoutLanesOpen, unit: '条', value: 4, observedAt: '2026-11-15T17:59:00Z' }),
  makeSignal({ id: 'staff1', zoneId: 'zone-checkout', metric: METRICS.staffCount, unit: '人', value: 2, observedAt: '2026-11-15T17:59:00Z' }),
  makeSignal({ id: 'qual1', zoneId: 'zone-checkout', metric: METRICS.checkoutQualifiedStaff, unit: '人', value: 1, observedAt: '2026-11-15T17:59:00Z' }),
  makeSignal({ id: 'arr1', zoneId: 'zone-checkout', metric: 'checkout_arrivals_per_min', unit: '人/分钟', value: 6, observedAt: '2026-11-15T17:59:00Z' }),
  makeSignal({ id: 'svc1', zoneId: 'zone-checkout', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5, observedAt: '2026-11-15T17:59:00Z' }),
];
const snapshot = projectTwinState(signals, layout, TEST_AT);
const tools = createAgentTools({ snapshot, signals });
const agent = createAgent();

describe('门店助手对话框（ui-sdk agent-ready）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('agent 能找到并操作提问框与预设', async () => {
    const user = userEvent.setup();
    render(<AgentPanel tools={tools} signals={signals} layout={layout} at={TEST_AT} />);

    await waitFor(() => {
      expect(screen.getByText('浏览器本地规则（离线）')).toBeTruthy();
    });

    const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== 'more');
    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }
    const labels = components.map((entry) => entry.label);
    expect(labels, '向门店助手提问 is missing').toContain('向门店助手提问');
    expect(labels, '提问 is missing').toContain('提问');
    expect(labels.some((l) => l?.includes('人员支援')), '预设提问 missing').toBe(true);
    expect(screen.getByText('合成教学数据')).toBeTruthy();
    const home=screen.getByText('今天有什么可以帮你？').closest('.chat-empty');
    expect(home).toBeTruthy();
    const composer=home?.querySelector('[data-promptbar]');
    const suggestions=home?.querySelector('[aria-label="预设提问"]');
    expect(composer).toBeTruthy();
    expect(suggestions).toBeTruthy();
    expect(Boolean(composer && suggestions && composer.compareDocumentPosition(suggestions) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(document.querySelector('.ba-composer-dock')).toBeNull();
    expect(screen.getByText('建议与推演，不直接执行门店操作')).toBeTruthy();

    const result = await agent.act({
      steps: [{ ref: '向门店助手提问', action: 'setValue', args: ['调 1 人支援收银可以吗？'] }],
    });
    expect(result.ok, result.error?.message).toBe(true);
    expect(screen.getByLabelText<HTMLTextAreaElement>('向门店助手提问').value).toBe('调 1 人支援收银可以吗？');

    await user.click(screen.getByRole('button', { name: /^提问$/ }));
    await waitFor(() => {
      expect(screen.getByText(/预测平均等待|无法执行|岗位资格|模拟/)).toBeTruthy();
    });
  });

  it('does not submit while Chinese IME composition confirms Enter',async()=>{
    const user=userEvent.setup();
    render(<AgentPanel tools={tools} signals={signals} layout={layout} at={TEST_AT}/>);
    await screen.findByText('浏览器本地规则（离线）');
    const input=screen.getByLabelText<HTMLTextAreaElement>('向门店助手提问');
    await user.type(input,'收银区为什么排队？');
    fireEvent.keyDown(input,{key:'Enter',isComposing:true});
    expect(screen.queryByLabelText('我的提问')).toBeNull();
    expect(input.value).toBe('收银区为什么排队？');
    await user.keyboard('{Enter}');
    await waitFor(()=>expect(screen.getByLabelText('我的提问').textContent).toBe('收银区为什么排队？'));
  });

  it('human-readable presets submit supported questions and preserve evidence access', async()=>{
    const user=userEvent.setup();
    render(<AgentPanel tools={tools} signals={signals} layout={layout} at={TEST_AT}/>);
    await screen.findByText('浏览器本地规则（离线）');
    await user.click(screen.getByRole('button',{name:/收银排队/}));
    await waitFor(()=>expect(screen.getByLabelText('我的提问').textContent).toBe('收银区为什么排队？'));
    expect(screen.queryByText('今天有什么可以帮你？')).toBeNull();
    expect(document.querySelectorAll('[data-promptbar]')).toHaveLength(1);
    expect(document.querySelector('.ba-composer-dock [data-promptbar]')).toBeTruthy();
    const evidence=await screen.findByRole('button',{name:'展开证据与工具轨迹'});
    await user.click(evidence);
    expect(screen.getByText(/工具调用：/)).toBeTruthy();
    expect(screen.getAllByText('来源').length).toBeGreaterThan(0);
    expect(screen.getAllByText('时间').length).toBeGreaterThan(0);
    expect(screen.getAllByText('置信').length).toBeGreaterThan(0);
    expect(screen.getAllByText('合成信号').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('向门店助手提问')).toBeTruthy();
  });
});

it('Beautiful UI trace follows real pending state, blocks duplicate sends, and reveals only returned calls', async()=>{
  vi.clearAllMocks();
  const {fetchAgentStatus,askStoreAgent}=await import('../api');
  vi.mocked(fetchAgentStatus).mockResolvedValueOnce({ok:true,service:'yh-agent',engine:'rules-local',model:'test-rules',note:'test'});
  let finish:((answer:Awaited<ReturnType<typeof askStoreAgent>>)=>void)|undefined;
  vi.mocked(askStoreAgent).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const user=userEvent.setup();
  render(<AgentPanel tools={tools} signals={signals} layout={layout} at={TEST_AT}/>);
  await screen.findByText('服务端本地规则 · test-rules');
  const input=screen.getByLabelText<HTMLTextAreaElement>('向门店助手提问');
  await user.type(input,'检查门店');
  await user.keyboard('{Enter}{Enter}');
  expect(askStoreAgent).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button',{name:'提问'}).hasAttribute('disabled')).toBe(true);
  await user.click(screen.getByRole('button',{name:'查看查询状态'}));
  expect(screen.getByText('正在等待查询结果，尚无工具轨迹。')).toBeTruthy();
  expect(screen.queryByText('get_store_overview')).toBeNull();
  finish?.({answer:'已检查当前合成场景。',mode:'rules-local',toolCalls:[{tool:'get_store_overview',args:{windowMin:5}}],evidence:[],cannotJudge:['不能据此判断真实销量']});
  await screen.findByText('已检查当前合成场景。');
  expect(screen.getByText('不能据此判断真实销量')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'展开证据与工具轨迹'}));
  expect(screen.getByText('get_store_overview')).toBeTruthy();
  expect(screen.getByText(/"windowMin": 5/)).toBeTruthy();
  expect(screen.getByText('（本回答无证据引用）')).toBeTruthy();
  expect(screen.queryByText('Thought for 4 seconds')).toBeNull();
});

it('keeps newline and whitespace behavior and reports API fallback honestly',async()=>{
  vi.clearAllMocks();
  const {fetchAgentStatus,askStoreAgent}=await import('../api');
  vi.mocked(fetchAgentStatus).mockResolvedValueOnce({ok:true,service:'yh-agent',engine:'rules-local',model:'test-rules',note:'test'});
  const user=userEvent.setup();
  render(<AgentPanel tools={tools} signals={signals} layout={layout} at={TEST_AT}/>);
  await screen.findByText('服务端本地规则 · test-rules');
  const input=screen.getByLabelText<HTMLTextAreaElement>('向门店助手提问');
  await user.type(input,'   ');
  await user.keyboard('{Enter}');
  expect(screen.queryByLabelText('我的提问')).toBeNull();
  await user.clear(input);
  await user.type(input,'检查');
  await user.keyboard('{Shift>}{Enter}{/Shift}');
  expect(input.value).toBe('检查\n');
  await user.type(input,'排队');
  await user.click(screen.getByRole('button',{name:'提问'}));
  await screen.findByText('浏览器本地规则（离线）');
  expect(screen.getByText(/服务端助手暂不可用，已改用浏览器内本地规则/)).toBeTruthy();
  expect(askStoreAgent).toHaveBeenCalled();
});
