import { TEACHING_WAGE_CNY_PER_HOUR, type CheckoutScenario } from '@yh/simulation';
import { DEFAULT_AGENT_SEED, type AgentEvidence, type AgentTools } from './tools';

/**
 * 本地规则解释器：无 LLM Key / 断网时的默认路径（PRD §9.1，AGENTS.md 离线约束）。
 * 确定性意图路由 → 工具调用 → 组装带证据引用的回答。
 * 数值全部来自工具；回答永远注明证据与分级。
 */

export interface AgentAnswer {
  answer: string;
  mode: 'rules-local';
  toolCalls: { tool: string; args: Record<string, unknown> }[];
  evidence: AgentEvidence[];
  /** 明确不能判断的部分（AT-03/06：数据不足必须明说）。 */
  cannotJudge: string[];
}

function cite(evidence: AgentEvidence[]): string {
  return evidence
    .map((e) => {
      const parts = [
        e.signalId,
        e.metric,
        `来源 ${e.sourceId}`,
        e.kind,
        e.synthetic ? '合成观测' : null,
        e.observedAt,
        e.confidence !== null ? `置信 ${e.confidence}` : null,
      ].filter((p): p is string => p !== null);
      return `${parts[0]}（${parts.slice(1).join('，')}）`;
    })
    .join('；');
}

function zoneIdIn(text: string): string | undefined {
  return text.match(/zone-[\w-]+/)?.[0];
}

export function answerLocally(question: string, tools: AgentTools): AgentAnswer {
  const toolCalls: AgentAnswer['toolCalls'] = [];
  const evidence: AgentEvidence[] = [];
  const cannotJudge: string[] = [];
  const track = (
    tool: string,
    args: Record<string, unknown>,
    result: { status: string; message?: string; data: Record<string, unknown>; evidence: AgentEvidence[] },
  ) => {
    toolCalls.push({ tool, args });
    evidence.push(...result.evidence);
    return result;
  };

  const wantsCompare = /(增开|多开|假设|如果|what.?if|仿真|三方案|方案对比|对比)/i.test(question);
  const wantsAttention = /(哪里|哪些|最需要|关注|处理|概况|全店|overview)/i.test(question);
  const wantsGap = /(没数据|无数据|盲区|离线|过期|为什么.*没有|没有传感器|信号缺失)/i.test(question);
  const wantsStock = /(缺货|库存|补货|临期)/i.test(question);
  const wantsQueue = /(排队|拥堵|队列|瓶颈|收银)/i.test(question);

  if (wantsCompare) {
    const compare = track('compare_scenarios', { seed: DEFAULT_AGENT_SEED }, tools.compare_scenarios({ seed: DEFAULT_AGENT_SEED }));
    if (compare.status === 'OK') {
      const scenarios = (compare.data['scenarios'] as { name: string; ok: boolean; avgWaitMin?: { mean: number }; why?: string }[]) ?? [];
      const lines = scenarios.map((s) => (s.ok ? `· ${s.name}：预测平均等待 ${s.avgWaitMin?.mean} 分钟` : `· ${s.name}：无法仿真（${s.why}）`));
      return {
        answer: [
          '【模拟情景对比】基于当前快照、相同种子与客流假设的三方案（不是真实预测）：',
          ...lines,
          `假设与模型版本见方案明细（assumptions）。${evidence.length > 0 ? `证据：${cite(evidence)}` : ''}`,
          '店长确认后可在方案工作台生成模拟任务单（审批由人触发）。',
        ].join('\n'),
        mode: 'rules-local',
        toolCalls,
        evidence,
        cannotJudge,
      };
    }
    cannotJudge.push(compare.message ?? '仿真基线缺失');
  }

  // 「调 N 人支援收银」：单方案 what-if（含岗位资格/成本约束校验，拒绝也如实回答）。
  const simMatch = /调\s*(\d+)\s*人/.exec(question);
  if (simMatch !== null) {
    const extra = Math.max(1, Math.min(9, Number.parseInt(simMatch[1] ?? '1', 10)));
    const compare = track('compare_scenarios', { seed: DEFAULT_AGENT_SEED }, tools.compare_scenarios({ seed: DEFAULT_AGENT_SEED }));
    const lanesOpenNow = Number(compare.data['lanesOpenNow'] ?? 4);
    const scenario: CheckoutScenario = {
      name: `调 ${extra} 人支援收银`,
      lanesOpen: lanesOpenNow,
      extraStaff: extra,
      horizonMin: 30,
      staffWageCnyPerHour: TEACHING_WAGE_CNY_PER_HOUR,
    };
    const sim = track('simulate_intervention', { scenario }, tools.simulate_intervention({ scenario }));
    if (sim.status === 'OK') {
      const result = sim.data['scenario'] as {
        metrics: { avgWaitMin: { mean: number }; p95WaitMin: { mean: number }; maxBacklog: { mean: number } };
        extraStaffHours: number;
        extraCostCny: number | null;
        assumptions: Record<string, unknown>;
      };
      return {
        answer: [
          `【模拟情景】${scenario.name}（开放 ${lanesOpenNow} 条通道 + ${extra} 名调配人手，30 分钟窗口）：`,
          `· 预测平均等待 ${result.metrics.avgWaitMin.mean} 分钟，P95 ${result.metrics.p95WaitMin.mean} 分钟，最大积压 ${result.metrics.maxBacklog.mean} 人`,
          `· 调人工时 ${result.extraStaffHours} 小时${result.extraCostCny !== null ? `，成本约 ${result.extraCostCny} 元（${String(result.assumptions['costBasis'])}）` : '（未提供时薪假设，成本未核算）'}`,
          `假设与模型版本见 assumptions；这是模拟情景，不是真实预测。${evidence.length > 0 ? `证据：${cite(evidence)}` : ''}`,
          '如需落地请到「方案对比」页送店长审批（审批由人触发）。',
        ].join('\n'),
        mode: 'rules-local',
        toolCalls,
        evidence,
        cannotJudge,
      };
    }
    return {
      answer: [
        `【模拟情景】${scenario.name} 无法执行：${sim.message ?? '约束校验未通过'}`,
        '如需放开该方案，请先补齐对应信号（岗位资格/员工在岗），或调整方案参数后再试。',
        `${evidence.length > 0 ? `证据：${cite(evidence)}` : ''}`,
      ].join('\n'),
      mode: 'rules-local',
      toolCalls,
      evidence,
      cannotJudge,
    };
  }

  if (wantsGap) {
    const zoneId = zoneIdIn(question);
    if (zoneId !== undefined) {
      const gap = track('explain_data_gap', { zoneId }, tools.explain_data_gap({ zoneId }));
      return {
        answer: [gap.message ?? '该分区数据状态未知', gap.evidence.length > 0 ? `证据：${cite(gap.evidence)}` : '', '建议：见上方原因与补采建议。'].filter(Boolean).join('\n'),
        mode: 'rules-local',
        toolCalls,
        evidence,
        cannotJudge,
      };
    }
    const overview = track('get_store_overview', {}, tools.get_store_overview());
    const zones = (overview.data['zones'] as { zoneId: string; unknownMetrics: number; staleMetrics: number; freshnessMin: number | null }[]) ?? [];
    const problemZones = zones.filter((z) => z.unknownMetrics > 0 || z.staleMetrics > 0);
    if (problemZones.length === 0) {
      return {
        answer: '当前各分区没有报告数据盲区；如需逐分区核查请指明分区 ID（如 zone-checkout）。',
        mode: 'rules-local',
        toolCalls,
        evidence,
        cannotJudge,
      };
    }
    return {
      answer: [
        '以下分区存在数据盲区或过期信号：',
        ...problemZones.map((z) => `· ${z.zoneId}：UNKNOWN 指标 ${z.unknownMetrics} 个，过期信号 ${z.staleMetrics} 条，最后观测 ${z.freshnessMin === null ? '无记录' : `${Math.round(z.freshnessMin)} 分钟前`}`),
        '盲区不等于"没有人"，只代表系统无法观测。',
      ].join('\n'),
      mode: 'rules-local',
      toolCalls,
      evidence,
      cannotJudge,
    };
  }

  if (wantsStock) {
    const alerts = track('query_operational_alerts', {}, tools.query_operational_alerts());
    const stockAlerts = ((alerts.data['alerts'] as { zoneId: string; reason: string; severity: string; metric: string }[]) ?? []).filter((a) => a.metric.includes('stock'));
    if (stockAlerts.length > 0) {
      return {
        answer: [`缺货风险信号：`, ...stockAlerts.map((a) => `· ${a.zoneId}（${a.severity}）：${a.reason}`), `证据：${cite(alerts.evidence)}`].join('\n'),
        mode: 'rules-local',
        toolCalls,
        evidence,
        cannotJudge,
      };
    }
    cannotJudge.push('当前没有触阈的缺货风险信号；若要判断具体分区，请提供分区 ID 与库存指标窗口');
  }

  if (wantsQueue || wantsAttention) {
    const overview = track('get_store_overview', {}, tools.get_store_overview());
    const zones = (overview.data['zones'] as { zoneId: string; zoneType: string; queueLength: number | null; freshnessMin: number | null }[]) ?? [];
    const checkout = zones.find((z) => z.zoneType === 'CHECKOUT');
    const alerts = (overview.data['topAlerts'] as { zoneId: string; severity: string; reason: string }[]) ?? [];
    const lines: string[] = ['【全店概况】当前最需要关注的信号：'];
    lines.push(...(alerts.length > 0 ? alerts.map((a) => `· ${a.zoneId}（${a.severity}）：${a.reason}`) : ['· 暂无触阈告警']));
    if (checkout !== undefined) {
      lines.push(
        checkout.queueLength === null
          ? `· 收银区 ${checkout.zoneId}：队列数据 UNKNOWN（不能声称没人或没拥堵）`
          : `· 收银区 ${checkout.zoneId}：当前队列 ${checkout.queueLength} 人`,
      );
    } else {
      cannotJudge.push('布局中没有 CHECKOUT 分区');
    }
    lines.push(`证据：${cite(evidence)}`);
    lines.push('数据不足的部分已如实标注 UNKNOWN；如需 what-if 请问"假设增开 1 条收银通道会怎样"');
    return { answer: lines.join('\n'), mode: 'rules-local', toolCalls, evidence, cannotJudge };
  }

  const overview = track('get_store_overview', {}, tools.get_store_overview());
  return {
    answer: [
      '未识别出具体意图，给出全店概况：',
      `· 快照 ${String(overview.data['snapshotId'])}（${String(overview.data['atTime'])}）`,
      `· 触阈告警 ${((overview.data['topAlerts'] as unknown[]) ?? []).length} 条；可问"哪里最需要关注"、"假设增开 1 条收银通道"、"这个区域为什么没数据"`,
      cannotJudge.length > 0 ? `· 无法判断：${cannotJudge.join('；')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    mode: 'rules-local',
    toolCalls,
    evidence,
    cannotJudge,
  };
}
