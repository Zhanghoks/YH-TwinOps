import { describe, expect, it } from 'vitest';
import { METRICS, type TwinSignal } from '@yh/contracts';
import { makeSignal } from '@yh/contracts/testing';
import { projectTwinState } from '@yh/twin-state';
import { runCheckoutScenario } from '@yh/simulation';
import { createAgentTools, answerLocally, answerWithPi, createAnswerEngine } from './index';
import type { AgentAnswer, PiCompleteFn } from './index';
import type { AssistantMessage, Context, TextContent, ToolCall } from '@earendil-works/pi-ai';
import type { CheckoutScenario } from '@yh/simulation';

const AT = '2026-11-15T18:00:00Z';
const testLayout = {
  storeId: 'store-yh-01',
  name: '合成教学卖场',
  synthetic: true,
  widthM: 100,
  depthM: 80,
  zones: [
    { zoneId: 'zone-checkout', name: '收银区', zoneType: 'CHECKOUT' as const },
    { zoneId: 'zone-frozen', name: '冷冻区', zoneType: 'FROZEN' as const },
    { zoneId: 'zone-produce', name: '蔬菜区', zoneType: 'PRODUCE' as const },
  ],
  fixtures: [
    {
      fixtureId: 'co-01',
      zoneId: 'zone-checkout',
      fixtureType: 'CHECKOUT' as const,
      assetId: 'yh-checkout-counter',
      x: 10,
      y: 0,
      z: 5,
      rotationY: 0,
      widthM: 3.6,
      depthM: 1.2,
      heightM: 1.1,
      fixed: true,
      capacity: 4,
      categoryIds: [] as string[],
    },
  ],
};

function busySignals(): TwinSignal[] {
  return [
    makeSignal({ id: 'arr1', zoneId: 'zone-checkout', metric: 'checkout_arrivals_per_min', unit: '人/分钟', value: 6, observedAt: '2026-11-15T17:59:00Z' }),
    makeSignal({ id: 'svc1', zoneId: 'zone-checkout', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5, observedAt: '2026-11-15T17:59:00Z' }),
    makeSignal({ id: 'q1', zoneId: 'zone-checkout', metric: METRICS.queueLength, unit: '人', value: 16, observedAt: '2026-11-15T17:59:00Z' }),
    makeSignal({ id: 'lanes1', zoneId: 'zone-checkout', metric: METRICS.checkoutLanesOpen, unit: '条', value: 4, observedAt: '2026-11-15T17:59:00Z' }),
    makeSignal({ id: 'staff1', zoneId: 'zone-checkout', metric: METRICS.staffCount, unit: '人', value: 2, observedAt: '2026-11-15T17:59:00Z' }),
    makeSignal({ id: 'qual1', zoneId: 'zone-checkout', metric: METRICS.checkoutQualifiedStaff, unit: '人', value: 2, observedAt: '2026-11-15T17:59:00Z' }),
    makeSignal({ id: 'sale1', zoneId: 'zone-checkout', metric: METRICS.salesAmount, unit: '元', value: 300, observedAt: '2026-11-15T17:58:00Z' }),
  ];
}

function blindSpotSignals(): TwinSignal[] {
  return [
    makeSignal({ id: 'gap-traffic', zoneId: 'zone-produce', metric: METRICS.trafficCount, unit: '人', value: null, kind: 'UNKNOWN', observedAt: '2026-11-15T17:59:00Z' }),
  ];
}

function makeTools(signals: TwinSignal[] = busySignals()) {
  const snapshot = projectTwinState(signals, testLayout, AT);
  return { snapshot, tools: createAgentTools({ snapshot, signals, runScenario: runCheckoutScenario }) };
}

describe('Agent 工具层（S3 缝）', () => {
  it('get_store_overview 返回告警与证据引用', () => {
    const { tools } = makeTools();
    const result = tools.get_store_overview();
    expect(result.status).toBe('OK');
    const alerts = result.data['topAlerts'] as { severity: string; zoneId: string }[];
    expect(alerts.some((a) => a.severity === 'CRITICAL')).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0]?.signalId).toBeTruthy();
  });

  it('get_zone_snapshot 对未知分区返回 UNKNOWN，不编造数据（AT-06）', () => {
    const { tools } = makeTools();
    const result = tools.get_zone_snapshot({ zoneId: 'zone-nope' });
    expect(result.status).toBe('UNKNOWN');
    expect(result.evidence).toHaveLength(0);
    expect(result.message).toMatch(/不存在/);
  });

  it('query_sales 有观测时返回窗口合计与证据；无观测时 UNKNOWN', () => {
    const { tools } = makeTools();
    const ok = tools.query_sales({ windowMin: 15, zoneId: 'zone-checkout' });
    expect(ok.status).toBe('OK');
    expect(ok.data['sum']).toBe(300);
    expect(ok.evidence.map((e) => e.signalId)).toContain('sale1');

    const blind = makeTools([]);
    const unknown = blind.tools.query_sales({ windowMin: 15, zoneId: 'zone-checkout' });
    expect(unknown.status).toBe('UNKNOWN');
    expect(unknown.data['sum']).toBeNull();
  });

  it('query_traffic 无计数观测时明确 UNKNOWN（AT-03：不能声称没人）', () => {
    const blind = makeTools([]);
    const result = blind.tools.query_traffic({ windowMin: 15, zoneId: 'zone-checkout' });
    expect(result.status).toBe('UNKNOWN');
    expect(result.message).toMatch(/不能|无|没有/);
  });

  it('explain_data_gap 区分从未上报 / 过期 / 离线 / 覆盖四种成因', () => {
    const { tools } = makeTools();
    const never = tools.explain_data_gap({ zoneId: 'zone-produce', metric: METRICS.trafficCount });
    expect(never.status).toBe('UNKNOWN');
    expect(never.data['cause']).toBe('never-reported');
    expect(never.data['suggestion']).toBeTruthy();

    const stale = makeTools([
      makeSignal({ id: 'old-traffic', zoneId: 'zone-produce', metric: METRICS.trafficCount, unit: '人', value: 20, observedAt: '2026-11-15T17:00:00Z' }),
    ]);
    const staleGap = stale.tools.explain_data_gap({ zoneId: 'zone-produce', metric: METRICS.trafficCount });
    expect(staleGap.data['cause']).toBe('stale');

    const offline = makeTools(blindSpotSignals());
    const offlineGap = offline.tools.explain_data_gap({ zoneId: 'zone-produce', metric: METRICS.trafficCount });
    expect(offlineGap.data['cause']).toBe('offline');

    const covered = tools.explain_data_gap({ zoneId: 'zone-checkout', metric: METRICS.queueLength });
    expect(covered.status).toBe('OK');
    expect(covered.data['cause']).toBe('covered');
  });

  it('simulate_intervention 传回快照与种子；非法方案如实转述约束错误', () => {
    const { tools, snapshot } = makeTools();
    const valid = tools.simulate_intervention({ scenario: { name: '基线', lanesOpen: 4, extraStaff: 0, horizonMin: 30 }, seed: 42 });
    expect(valid.status).toBe('OK');
    const scenario = valid.data['scenario'] as { snapshotId: string; seed: number };
    expect(scenario.snapshotId).toBe(snapshot.snapshotId);
    expect(scenario.seed).toBe(42);

    const invalid = tools.simulate_intervention({ scenario: { name: 'x', lanesOpen: 99, extraStaff: 0, horizonMin: 30 } });
    expect(invalid.status).toBe('ERROR');
    expect(invalid.message).toMatch(/超过现有通道总数/);
  });

  it('compare_scenarios 同种子对比三方案', () => {
    const { tools } = makeTools();
    const result = tools.compare_scenarios({ seed: 42 });
    expect(result.status).toBe('OK');
    const scenarios = result.data['scenarios'] as {
      name: string;
      ok: boolean;
      avgWaitMin?: { mean: number };
      extraCostCny?: number | null;
    }[];
    expect(scenarios).toHaveLength(3);
    expect(scenarios.every((s) => s.ok)).toBe(true);
    expect(result.data['note']).toMatch(/模拟情景/);
    // 方案 A/B 未提供时薪：成本如实留空；方案 C 带合成教学时薪：成本可核算。
    const byName = new Map(scenarios.map((s) => [s.name, s]));
    const a = byName.get('A 保持现状');
    const c = byName.get('C 调 1 人支援收银');
    expect(a?.extraCostCny ?? null).toBeNull();
    expect(c?.extraCostCny).toBe(12.5);
    // 调 1 人支援（+1 服务通道）在相同种子下等待不高于现状。
    expect(c?.avgWaitMin?.mean).toBeLessThanOrEqual(a?.avgWaitMin?.mean ?? Number.POSITIVE_INFINITY);
  });

  it('propose_action_plan 只产出待审批草案（sandbox），不写任何真实系统', () => {
    const { tools } = makeTools();
    const plan = tools.propose_action_plan({
      scenarioId: 'sc-1',
      scenario: { name: '调 1 人支援收银', lanesOpen: 4, extraStaff: 1, horizonMin: 30 },
    });
    expect(plan.status).toBe('OK');
    expect(plan.data['requiresApproval']).toBe(true);
    expect(plan.data['sandboxOnly']).toBe(true);
    expect(String(plan.data['note'])).toMatch(/审批必须由店长触发/);
  });
});

describe('本地规则解释器（默认离线路径）', () => {
  it('“哪里最需要关注”给出告警分区与证据 ID', () => {
    const { tools } = makeTools();
    const answer = answerLocally('现在门店哪里最需要我处理？有什么可靠证据？', tools);
    expect(answer.mode).toBe('rules-local');
    expect(answer.answer).toMatch(/zone-checkout/);
    expect(answer.evidence.length).toBeGreaterThan(0);
    expect(answer.toolCalls.some((c) => c.tool === 'get_store_overview')).toBe(true);
  });

  it('“调 3 人支援收银”触发单方案仿真；超过可用员工数时如实拒绝', () => {
    const { tools } = makeTools(); // 夹具在岗 2 人、持资格 2 人：3 人先撞员工数约束
    const answer = answerLocally('调 3 人支援收银可以吗？', tools);
    expect(answer.mode).toBe('rules-local');
    expect(answer.toolCalls.some((c) => c.tool === 'simulate_intervention')).toBe(true);
    expect(answer.answer).toMatch(/无法执行/);
    expect(answer.answer).toMatch(/超过可用员工数 2/);
    expect(answer.answer).toMatch(/补齐对应信号|调整方案参数/);
  });

  it('“调 1 人支援收银”在资格内时给出预测指标与成本口径', () => {
    const { tools } = makeTools();
    const answer = answerLocally('调 1 人支援收银可以吗？', tools);
    expect(answer.toolCalls.some((c) => c.tool === 'simulate_intervention')).toBe(true);
    expect(answer.answer).toMatch(/预测平均等待/);
    expect(answer.answer).toMatch(/成本约 12\.5 元/);
    expect(answer.answer).toMatch(/合成教学时薪假设/);
  });

  it('“为什么没数据”解释数据盲区（AT-03）', () => {
    const { tools } = makeTools(blindSpotSignals());
    const answer = answerLocally('zone-produce 这个区域为什么没数据？是没有人在还是传感器离线？', tools);
    expect(answer.answer).toMatch(/UNKNOWN|离线|无计数|盲区/);
    expect(answer.toolCalls.some((c) => c.tool === 'explain_data_gap')).toBe(true);
  });

  it('“假设增开通道”触发同种子三方案对比（模拟情景措辞）', () => {
    const { tools } = makeTools();
    const answer = answerLocally('假设多开 1 条收银通道、从其他岗位调 1 个人，未来 30 分钟会怎么样？', tools);
    expect(answer.answer).toMatch(/模拟情景/);
    expect(answer.toolCalls.some((c) => c.tool === 'compare_scenarios')).toBe(true);
  });

  it('数据不足时明确不能判断', () => {
    const blind = makeTools([]);
    const answer = answerLocally('现在门店哪里最需要我处理？', blind.tools);
    expect(answer.cannotJudge.length + answer.answer.length).toBeGreaterThan(0);
    expect(answer.answer).toMatch(/UNKNOWN|暂无|无法判断/);
  });
});

// —— pi 适配器循环（注入假 complete，不联网） ——

function assistantMessage(content: (ToolCall | TextContent)[]): AssistantMessage {
  return {
    role: 'assistant',
    content,
    api: 'openai-completions',
    provider: 'openai',
    model: 'gpt-test',
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: 'stop',
    timestamp: Date.now(),
  };
}

describe('pi 后端适配器（@earendil-works/pi-ai）', () => {
  it('工具调用循环：先调工具再给最终回答，证据被收集', async () => {
    const { tools } = makeTools();
    let callCount = 0;
    const complete: PiCompleteFn = async (_context: Context) => {
      callCount += 1;
      if (callCount === 1) {
        return assistantMessage([
          { type: 'toolCall', id: 'call-1', name: 'get_store_overview', arguments: {} },
        ]);
      }
      return assistantMessage([{ type: 'text', text: '收银 B 区队列异常，建议关注（证据来自工具返回）。' }]);
    };
    const answer = await answerWithPi({ complete, modelLabel: 'openai/gpt-test' }, '哪里最需要关注？', tools);
    expect(answer.mode).toBe('pi-llm');
    expect(answer.toolCalls.map((c) => c.tool)).toEqual(['get_store_overview']);
    expect(answer.evidence.length).toBeGreaterThan(0);
    expect(answer.answer).toMatch(/收银/);
  });

  it('模型引用 UNKNOWN 工具结果时不编造：cannotJudge 记录工具信息', async () => {
    const blind = makeTools([]);
    let callCount = 0;
    const complete: PiCompleteFn = async () => {
      callCount += 1;
      if (callCount === 1) {
        return assistantMessage([{ type: 'toolCall', id: 'c1', name: 'query_traffic', arguments: { windowMin: 15, zoneId: 'zone-checkout' } }]);
      }
      return assistantMessage([{ type: 'text', text: '工具说不能判断。' }]);
    };
    const answer = await answerWithPi({ complete, modelLabel: 'x/y' }, '现在有多少人？', blind.tools);
    expect(answer.cannotJudge.length).toBeGreaterThan(0);
  });

  it('LLM 报错时如实返回错误与降级指引，不编造回答', async () => {
    const { tools } = makeTools();
    const complete: PiCompleteFn = async () => {
      const message = assistantMessage([]);
      return { ...message, stopReason: 'error' as const, errorMessage: 'missing API key' };
    };
    const answer = await answerWithPi({ complete, modelLabel: 'x/y' }, '概况', tools);
    expect(answer.error).toBe('missing API key');
    expect(answer.answer).toMatch(/本地规则模式/);
  });

  it('达到迭代上限时给出诚实小结而非编造', async () => {
    const { tools } = makeTools();
    const complete: PiCompleteFn = async () =>
      assistantMessage([{ type: 'toolCall', id: `c-${Math.random()}`, name: 'get_store_overview', arguments: {} }]);
    const answer = await answerWithPi({ complete, modelLabel: 'x/y', maxToolIterations: 3 }, '概况', tools);
    expect(answer.answer).toMatch(/迭代上限/);
    expect(answer.toolCalls).toHaveLength(3);
  });
});

describe('回答引擎工厂（离线降级）', () => {
  it('无 LLM 配置时默认本地规则路径', () => {
    const { tools } = makeTools();
    const engine = createAnswerEngine(tools, {});
    expect(engine.kind).toBe('rules-local');
    expect(engine.model).toBe('yh-rules-local-0.1');
  });

  it('配置未知 provider/model 在创建时即抛错（而不是运行中编造）', () => {
    const { tools } = makeTools();
    expect(() =>
      createAnswerEngine(tools, { YH_AGENT_PROVIDER: 'no-such-provider', YH_AGENT_MODEL: 'no-such-model' }),
    ).toThrow(/未收录模型/);
  });

  it('规则引擎回答为确定性：同问题两次回答一致', async () => {
    const { tools } = makeTools();
    const engine = createAnswerEngine(tools, {});
    const a = await engine.answer('哪里最需要关注？');
    const b = await engine.answer('哪里最需要关注？');
    expect((a as AgentAnswer).answer).toBe((b as AgentAnswer).answer);
  });
});

// 场景类型仅做静态一致性检查。
const scenarioCheck: CheckoutScenario = { name: 'x', lanesOpen: 1, extraStaff: 0, horizonMin: 10 };
void scenarioCheck;
