import {
  METRICS,
  isDecisionUsable,
  type SignalKind,
  type TwinSignal,
  type TwinSnapshot,
  type ZoneState,
} from '@yh/contracts';
import { sumMetricInWindow } from '@yh/twin-state';
import { checkoutBaseline, runCheckoutScenario, TEACHING_WAGE_CNY_PER_HOUR, type CheckoutScenario } from '@yh/simulation';

/**
 * S3 接缝：Agent 工具层是 S1+S2 的函数组合，不引入新的抽象缝隙。
 * 铁律：数值全部来自确定性计算；每个结果带证据（signal id / 时间 / 来源 / 分级）；
 * 数据不足时如实返回 UNKNOWN，绝不补数。
 */

/** Agent 默认随机种子（对比方案的"同种子"基准），避免散落的魔法数。 */
export const DEFAULT_AGENT_SEED = 42;

export interface AgentEvidence {
  signalId: string;
  metric: string;
  observedAt: string;
  sourceId: string;
  kind: SignalKind;
  synthetic: boolean;
  confidence: number | null;
}

export interface AgentToolResult {
  status: 'OK' | 'UNKNOWN' | 'ERROR';
  message?: string;
  /** 结构化载荷（各工具自定义）。 */
  data: Record<string, unknown>;
  evidence: AgentEvidence[];
}

export interface AgentTools {
  get_store_overview(): AgentToolResult;
  get_zone_snapshot(args: { zoneId: string }): AgentToolResult;
  query_sales(args: { windowMin: number; zoneId?: string }): AgentToolResult;
  query_traffic(args: { windowMin: number; zoneId?: string }): AgentToolResult;
  query_operational_alerts(): AgentToolResult;
  explain_data_gap(args: { zoneId: string; metric?: string }): AgentToolResult;
  simulate_intervention(args: { scenario: CheckoutScenario; seed?: number }): AgentToolResult;
  compare_scenarios(args: { seed?: number }): AgentToolResult;
  propose_action_plan(args: { scenarioId: string; scenario: CheckoutScenario; seed?: number }): AgentToolResult;
}

function evidenceOf(signal: TwinSignal): AgentEvidence {
  return {
    signalId: signal.id,
    metric: signal.metric,
    observedAt: signal.observedAt,
    sourceId: signal.sourceId,
    kind: signal.kind,
    synthetic: signal.synthetic,
    confidence: signal.confidence ?? null,
  };
}

function evidenceFromReading(zone: ZoneState, metric: string): AgentEvidence[] {
  const reading = zone.kpis[metric];
  if (reading === undefined) return [];
  return [
    {
      signalId: reading.evidenceIds[0] ?? 'unattributed',
      metric,
      observedAt: reading.observedAt,
      sourceId: reading.sourceId,
      kind: reading.kind,
      synthetic: reading.synthetic,
      confidence: reading.confidence,
    },
  ];
}

/** 共享的窗口聚合查询：sales/traffic 同形逻辑的唯一实现。 */
function windowQuery(
  deps: { signals: TwinSignal[]; asOf: string },
  metric: string,
  args: { windowMin: number; zoneId?: string },
  emptyHint: string,
): AgentToolResult {
  const scope = args.zoneId === undefined ? {} : { zoneId: args.zoneId };
  const { sum, evidenceIds } = sumMetricInWindow(deps.signals, metric, deps.asOf, args.windowMin, scope);
  if (evidenceIds.length === 0) {
    return {
      status: 'UNKNOWN',
      message: `窗口内没有可用的 ${metric} 观测（scope=${args.zoneId ?? '全店'}）——${emptyHint}`,
      data: { windowMin: args.windowMin, zoneId: args.zoneId ?? null, sum: null },
      evidence: [],
    };
  }
  const byId = new Map(deps.signals.map((s) => [s.id, s]));
  return {
    status: 'OK',
    data: { windowMin: args.windowMin, zoneId: args.zoneId ?? '全店', sum, sampleCount: evidenceIds.length },
    evidence: evidenceIds.flatMap((id) => {
      const signal = byId.get(id);
      return signal === undefined ? [] : [evidenceOf(signal)];
    }),
  };
}

export interface AgentToolDeps {
  snapshot: TwinSnapshot;
  /** 投影所用的原始信号流（供窗口聚合与证据追溯）。 */
  signals: TwinSignal[];
  runScenario?: typeof runCheckoutScenario;
  defaultSeed?: number;
}

export function createAgentTools(deps: AgentToolDeps): AgentTools {
  const { snapshot, signals } = deps;
  const runScenario = deps.runScenario ?? runCheckoutScenario;
  const defaultSeed = deps.defaultSeed ?? DEFAULT_AGENT_SEED;
  const asOf = snapshot.atTime;
  const checkoutZoneId = () => Object.values(snapshot.zones).find((z) => z.zoneType === 'CHECKOUT')?.zoneId ?? '';
  const alertsEvidence = (): AgentEvidence[] =>
    snapshot.alerts.flatMap((a) => {
      const zone = snapshot.zones[a.zoneId];
      return zone === undefined ? [] : evidenceFromReading(zone, a.metric);
    });

  return {
    get_store_overview: () => ({
      status: 'OK',
      data: {
        storeId: snapshot.storeId,
        snapshotId: snapshot.snapshotId,
        atTime: asOf,
        topAlerts: snapshot.alerts.map((a) => ({ alertId: a.alertId, severity: a.severity, zoneId: a.zoneId, reason: a.reason, rule: a.rule })),
        zones: Object.values(snapshot.zones).map((zone) => {
          const queueReading = zone.kpis[METRICS.queueLength];
          return {
            zoneId: zone.zoneId,
            zoneType: zone.zoneType,
            queueLength: isDecisionUsable(queueReading) ? queueReading.value : null,
            lastObservedAt: zone.coverage.lastObservedAt,
            freshnessMin: zone.coverage.freshnessMin,
            unknownMetrics: Object.values(zone.kpis).filter((r) => r.kind === 'UNKNOWN').length,
            staleMetrics: zone.coverage.staleCount,
          };
        }),
        coverage: snapshot.coverage,
      },
      evidence: alertsEvidence(),
    }),

    get_zone_snapshot: ({ zoneId }) => {
      const zone = snapshot.zones[zoneId];
      if (zone === undefined) {
        return {
          status: 'UNKNOWN',
          message: `布局中不存在分区 ${zoneId}（不引用不存在的证据）`,
          data: { zoneId },
          evidence: [],
        };
      }
      return {
        status: 'OK',
        data: {
          zoneId: zone.zoneId,
          zoneType: zone.zoneType,
          kpis: Object.values(zone.kpis).map((r) => ({
            metric: r.metric,
            value: r.value,
            kind: r.kind,
            stale: r.stale,
            unit: r.unit,
            observedAt: r.observedAt,
            sourceId: r.sourceId,
          })),
          fixtures: Object.values(zone.fixtures).map((f) => ({ fixtureId: f.fixtureId, fixtureType: f.fixtureType, capacity: f.capacity })),
          coverage: zone.coverage,
          alerts: snapshot.alerts.filter((a) => a.zoneId === zoneId).map((a) => ({ alertId: a.alertId, severity: a.severity, reason: a.reason })),
        },
        evidence: Object.values(zone.kpis).map((r) => ({
          signalId: r.evidenceIds[0] ?? 'unattributed',
          metric: r.metric,
          observedAt: r.observedAt,
          sourceId: r.sourceId,
          kind: r.kind,
          synthetic: r.synthetic,
          confidence: r.confidence,
        })),
      };
    },

    query_sales: ({ windowMin, zoneId }) =>
      windowQuery({ signals, asOf }, METRICS.salesAmount, { windowMin, zoneId }, '不能给出销售额'),

    query_traffic: ({ windowMin, zoneId }) =>
      windowQuery({ signals, asOf }, METRICS.trafficCount, { windowMin, zoneId }, '可能是无传感器、信号过期或计数源离线'),

    query_operational_alerts: () => ({
      status: 'OK',
      data: {
        alerts: snapshot.alerts.map((a) => ({
          alertId: a.alertId,
          severity: a.severity,
          zoneId: a.zoneId,
          metric: a.metric,
          rule: a.rule,
          reason: a.reason,
          suggestedRole: a.suggestedRole,
        })),
        counts: snapshot.alerts.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.severity]: (acc[a.severity] ?? 0) + 1 }), {}),
      },
      evidence: alertsEvidence(),
    }),

    explain_data_gap: ({ zoneId, metric }) => {
      const zone = snapshot.zones[zoneId];
      if (zone === undefined) {
        return { status: 'UNKNOWN', message: `布局中不存在分区 ${zoneId}`, data: { zoneId, metric: metric ?? null, cause: 'no-such-zone' }, evidence: [] };
      }
      if (metric !== undefined && zone.kpis[metric] === undefined) {
        return {
          status: 'UNKNOWN',
          message: `分区 ${zoneId} 从未上报过 ${metric}——该指标可能没有布置传感器或未接入适配器`,
          data: { zoneId, metric, cause: 'never-reported', suggestion: `为 ${zoneId} 接入 ${metric} 数据源，或安排人工巡检上报` },
          evidence: [],
        };
      }
      const candidates = metric === undefined ? Object.values(zone.kpis) : [zone.kpis[metric] as (typeof zone.kpis)[string]];
      const staleOnes = candidates.filter((r) => r.stale);
      const unknownOnes = candidates.filter((r) => r.kind === 'UNKNOWN' && !r.stale);
      if (staleOnes.length > 0) {
        const worst = staleOnes.reduce((a, b) => (Date.parse(a.observedAt) <= Date.parse(b.observedAt) ? a : b));
        return {
          status: 'UNKNOWN',
          message: `分区 ${zoneId} 的数据已过期：最后一次观测 ${worst.observedAt}（${worst.metric}），超出新鲜度阈值`,
          data: { zoneId, metric: metric ?? null, cause: 'stale', lastObservedAt: worst.observedAt, sourceId: worst.sourceId },
          evidence: evidenceFromReading(zone, worst.metric),
        };
      }
      if (unknownOnes.length > 0) {
        return {
          status: 'UNKNOWN',
          message: `分区 ${zoneId} 的数据源上报为 UNKNOWN（离线或无计数），不能推断现场情况`,
          data: { zoneId, metric: metric ?? null, cause: 'offline', suggestion: '检查传感器/计数器在线状态，或安排人工盘点' },
          evidence: unknownOnes.flatMap((r) => evidenceFromReading(zone, r.metric)),
        };
      }
      if (candidates.length === 0) {
        return {
          status: 'OK',
          message: `分区 ${zoneId} 没有任何 KPI 读数——仅凭现有数据无法区分"无传感器覆盖"还是"无人在场"（两种情形的表现相同）；需要接入计数源或安排人工巡检来验证`,
          data: { zoneId, metric: metric ?? null, cause: 'empty-zone', suggestion: '接入匿名区域计数器，或在巡检 App 上报在场人数' },
          evidence: [],
        };
      }
      return {
        status: 'OK',
        message: `分区 ${zoneId} 当前数据可用，没有数据盲区`,
        data: { zoneId, metric: metric ?? null, cause: 'covered', usableMetrics: candidates.filter((r) => !r.stale && r.kind !== 'UNKNOWN').map((r) => r.metric) },
        evidence: candidates.flatMap((r) => evidenceFromReading(zone, r.metric)),
      };
    },

    simulate_intervention: ({ scenario, seed }) => {
      const evalResult = runScenario(snapshot, scenario, seed ?? defaultSeed);
      if (!evalResult.ok) {
        return { status: 'ERROR', message: evalResult.why, data: { scenarioName: scenario.name }, evidence: [] };
      }
      const checkoutZone = snapshot.zones[checkoutZoneId()];
      return {
        status: 'OK',
        data: { scenario: evalResult.result },
        evidence: checkoutZone === undefined ? [] : evidenceFromReading(checkoutZone, METRICS.checkoutArrivalsPerMin),
      };
    },

    compare_scenarios: ({ seed }) => {
      const baselineEval = checkoutBaseline(snapshot);
      if (!baselineEval.ok) {
        return { status: 'UNKNOWN', message: `无法构建对比基线：${baselineEval.missing.join('；')}`, data: {}, evidence: [] };
      }
      const checkoutZone = snapshot.zones[checkoutZoneId()];
      const lanesReading = checkoutZone?.kpis[METRICS.checkoutLanesOpen];
      const lanesOpenNow = isDecisionUsable(lanesReading) ? lanesReading.value : baselineEval.baseline.totalLanes;
      const trio: CheckoutScenario[] = [
        { name: 'A 保持现状', lanesOpen: lanesOpenNow, extraStaff: 0, horizonMin: 30 },
        { name: 'B 增开 1 条通道', lanesOpen: Math.min(lanesOpenNow + 1, baselineEval.baseline.totalLanes), extraStaff: 0, horizonMin: 30 },
        // 方案 C 带合成教学时薪，便于工作台并排比较工时成本；假设里如实登记成本口径。
        { name: 'C 调 1 人支援收银', lanesOpen: lanesOpenNow, extraStaff: 1, horizonMin: 30, staffWageCnyPerHour: TEACHING_WAGE_CNY_PER_HOUR },
      ];
      const results = trio.map((scenario) => {
        const evalResult = runScenario(snapshot, scenario, seed ?? defaultSeed);
        return evalResult.ok
          ? {
              name: scenario.name,
              ok: true as const,
              avgWaitMin: evalResult.result.metrics.avgWaitMin,
              p95WaitMin: evalResult.result.metrics.p95WaitMin,
              maxBacklog: evalResult.result.metrics.maxBacklog,
              extraStaffHours: evalResult.result.extraStaffHours,
              extraCostCny: evalResult.result.extraCostCny,
              laneChangeCount: evalResult.result.laneChangeCount,
            }
          : { name: scenario.name, ok: false as const, why: evalResult.why };
      });
      const lanesOpenAssumed = !(checkoutZone !== undefined && isDecisionUsable(checkoutZone.kpis[METRICS.checkoutLanesOpen]));
      return {
        status: results.every((r) => r.ok) ? 'OK' : 'UNKNOWN',
        data: {
          snapshotId: snapshot.snapshotId,
          seed: seed ?? defaultSeed,
          scenarios: results,
          lanesOpenAssumed,
          note: lanesOpenAssumed
            ? `模拟情景对比，同种子同客流假设；当前开放通道数无可用观测，方案 A 按通道总数 ${baselineEval.baseline.totalLanes} 假设全开（不是观测到的"现状"）；不是真实预测`
            : '模拟情景对比，同种子同客流假设；不是真实预测',
        },
        evidence: checkoutZone === undefined ? [] : evidenceFromReading(checkoutZone, METRICS.queueLength),
      };
    },

    propose_action_plan: ({ scenarioId, scenario, seed }) => {
      const evalResult = runScenario(snapshot, scenario, seed ?? defaultSeed);
      return {
        status: 'OK',
        data: {
          planId: `plan-${scenarioId}-${snapshot.snapshotId}`,
          scenarioId,
          scenarioName: scenario.name,
          requiresApproval: true,
          sandboxOnly: true,
          steps: [
            `由收银主管确认「${scenario.name}」的可执行性（通道数 ${scenario.lanesOpen}，临时支援 ${scenario.extraStaff} 人）`,
            '店长在工作台审批后才进入模拟执行日志',
            '执行 30 分钟后回看排队指标，校准模型假设',
          ],
          simulation: evalResult.ok ? evalResult.result : null,
          simulationError: evalResult.ok ? null : evalResult.why,
          note: '任务草案只写入教学沙盒，不触碰任何真实门店系统；审批必须由店长触发',
        },
        evidence: [],
      };
    },
  };
}
