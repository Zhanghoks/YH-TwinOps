import { createHash } from 'node:crypto';
import {
  METRICS,
  isDecisionUsable,
  parseTwinSignal,
  type Alert,
  type KpiReading,
  type StoreLayout,
  type TwinSignal,
  type TwinSnapshot,
  type ZoneCoverage,
  type ZoneState,
} from '@yh/contracts';

/**
 * S1 接缝：唯一新增的核心纯逻辑缝。
 * 信号校验、四级分级、synthetic 标记、新鲜度/stale 判定、分区 KPI 与告警规则全部在此判定；
 * 3D 图层、Agent 工具与仿真只消费投影输出的快照。
 */

export interface ProjectionOptions {
  /** 距上次观测超过该分钟数即视为 stale（默认 10 分钟）。 */
  staleAfterMin?: number;
  alertRules?: AlertRules;
}

export const DEFAULT_STALE_AFTER_MIN = 10;

function minutesBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 60_000;
}

function compareTime(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b);
}

/** 确定性快照 ID：相同输入必得相同 ID，内容不同则 ID 不同（可重放、可追溯）。 */
function computeSnapshotId(storeId: string, atTime: string, signals: TwinSignal[]): string {
  const digest = signals
    .map((s) => `${s.id}|${s.metric}|${s.value === null ? 'null' : s.value}|${s.kind}|${s.observedAt}|${s.sourceId}|${s.ingestedAt}`)
    .sort()
    .join('\n');
  const hash = createHash('sha256');
  hash.update(`${storeId}|${atTime}\n${digest}`);
  return `snap-${hash.digest('hex').slice(0, 16)}`;
}

function toReading(signal: TwinSignal, atTime: string, staleAfterMin: number, scope: 'zone' | 'fixture'): KpiReading {
  const freshnessMin = minutesBetween(signal.observedAt, atTime);
  const expired = signal.validUntil !== undefined && compareTime(signal.validUntil, atTime) < 0;
  const staleByAge = signal.observedAt > atTime ? false : freshnessMin > staleAfterMin;
  const stale = signal.kind !== 'UNKNOWN' && (staleByAge || expired);
  const staleReason = stale ? (expired ? 'expired' : 'stale') : signal.kind === 'UNKNOWN' ? 'no-data' : null;
  // stale/过期即降级为 UNKNOWN：主值清空，真实观测只留在 lastValue 供追溯（PRD §5.1）。
  const usable = signal.kind !== 'UNKNOWN' && !stale;
  return {
    metric: signal.metric,
    unit: signal.unit,
    value: usable ? signal.value : null,
    kind: stale ? 'UNKNOWN' : signal.kind,
    synthetic: signal.synthetic,
    sourceId: signal.sourceId,
    observedAt: signal.observedAt,
    freshnessMin: signal.kind === 'UNKNOWN' ? null : Math.max(0, Math.round(freshnessMin * 100) / 100),
    stale,
    staleReason,
    lastValue: stale ? signal.value : null,
    confidence: signal.confidence ?? null,
    coverage: signal.coverage,
    scope,
    evidenceIds: [signal.id, ...signal.evidenceIds],
  };
}

function pickLatest(signals: TwinSignal[]): TwinSignal | undefined {
  return signals.reduce<TwinSignal | undefined>(
    (best, s) => (best === undefined || compareTime(s.observedAt, best.observedAt) > 0 || (compareTime(s.observedAt, best.observedAt) === 0 && compareTime(s.ingestedAt, best.ingestedAt) >= 0) ? s : best),
    undefined,
  );
}

/** 汇总窗口内的指标总和（如 15 分钟 POS 销售额）；只统计决策可用信号。 */
export function sumMetricInWindow(
  signals: TwinSignal[],
  metric: string,
  atTime: string,
  windowMin: number,
  scope?: { zoneId?: string; fixtureId?: string },
): { sum: number; evidenceIds: string[] } {
  const lower = new Date(Date.parse(atTime) - windowMin * 60_000).toISOString();
  const evidenceIds: string[] = [];
  let sum = 0;
  for (const s of signals) {
    if (s.metric !== metric) continue;
    if (scope?.zoneId !== undefined && s.zoneId !== scope.zoneId) continue;
    if (scope?.fixtureId !== undefined && s.fixtureId !== scope.fixtureId) continue;
    if (s.kind === 'UNKNOWN' || s.value === null) continue;
    if (s.observedAt < lower || s.observedAt > atTime) continue;
    sum += s.value;
    evidenceIds.push(s.id);
  }
  return { sum, evidenceIds };
}

export interface AlertRuleContext {
  zoneId: string;
  zoneType: string;
  atTime: string;
  readings: Record<string, KpiReading>;
  signals: TwinSignal[];
}

export type AlertRules = (ctx: AlertRuleContext) => Omit<Alert, 'raisedAt'>[];

const QUEUE_WARN = 8;
const QUEUE_CRITICAL = 15;
const COLD_CHAIN_ZONE_TYPES = new Set(['FROZEN', 'COLDROOM', 'DAIRY']);

/** 默认告警规则：红色预警只来自规则与指标，禁止视觉密度之类的非证据依据（PRD §2.2）。 */
export const defaultAlertRules: AlertRules = (ctx) => {
  const alerts: Omit<Alert, 'raisedAt'>[] = [];
  const queue = ctx.readings[METRICS.queueLength];
  if (isDecisionUsable(queue)) {
    const value = queue.value as number;
    if (value >= QUEUE_CRITICAL) {
      alerts.push({
        alertId: `alert-queue-critical-${ctx.zoneId}`,
        severity: 'CRITICAL',
        zoneId: ctx.zoneId,
        metric: METRICS.queueLength,
        rule: 'queue_length >= 15',
        reason: `收银/通道队列长度 ${value} 达到 CRITICAL 阈值（≥15）`,
        evidenceIds: queue.evidenceIds,
        suggestedRole: '收银主管',
      });
    } else if (value >= QUEUE_WARN) {
      alerts.push({
        alertId: `alert-queue-warning-${ctx.zoneId}`,
        severity: 'WARNING',
        zoneId: ctx.zoneId,
        metric: METRICS.queueLength,
        rule: 'queue_length >= 8',
        reason: `收银/通道队列长度 ${value} 达到 WARNING 阈值（≥8）`,
        evidenceIds: queue.evidenceIds,
        suggestedRole: '收银主管',
      });
    }
  }
  const online = ctx.readings[METRICS.equipmentOnline];
  if (isDecisionUsable(online) && online.value === 0) {
    const coldChain = COLD_CHAIN_ZONE_TYPES.has(ctx.zoneType);
    alerts.push({
      alertId: `alert-equipment-offline-${ctx.zoneId}`,
      severity: coldChain ? 'CRITICAL' : 'WARNING',
      zoneId: ctx.zoneId,
      metric: METRICS.equipmentOnline,
      rule: 'equipment_online == 0',
      reason: coldChain ? '冷链区域设备离线，温度监控中断' : '设备离线，遥测中断',
      evidenceIds: online.evidenceIds,
      suggestedRole: 'IT/数据管理员',
    });
  }
  const stock = ctx.readings[METRICS.stockLevel];
  const sales = sumMetricInWindow(ctx.signals, METRICS.salesAmount, ctx.atTime, 15, { zoneId: ctx.zoneId });
  if (isDecisionUsable(stock) && stock.value === 0 && sales.sum > 0) {
    alerts.push({
      alertId: `alert-stockout-risk-${ctx.zoneId}`,
      severity: 'WARNING',
      zoneId: ctx.zoneId,
      metric: METRICS.stockLevel,
      rule: 'stock_level == 0 且近 15 分钟有销售',
      reason: `库存为 0 而近 15 分钟仍有销售（合计 ${sales.sum}），存在缺货风险`,
      evidenceIds: [...stock.evidenceIds, ...sales.evidenceIds],
      suggestedRole: '生鲜主管',
    });
  }
  return alerts;
};

/**
 * 投影：事件流 + 布局 + 时刻 → 全店快照。
 * 幂等（按 signal id 去重）、支持乱序（按 observedAt 取最新）、过期信号降级为 UNKNOWN。
 */
export function projectTwinState(
  signalsInput: readonly TwinSignal[],
  layout: StoreLayout,
  atTime: string,
  options: ProjectionOptions = {},
): TwinSnapshot {
  if (Number.isNaN(Date.parse(atTime))) {
    throw new Error(`atTime 不是合法时间戳：${atTime}`);
  }
  const staleAfterMin = options.staleAfterMin ?? DEFAULT_STALE_AFTER_MIN;
  const rules = options.alertRules ?? defaultAlertRules;

  // 校验先行（AGENTS.md：生成候选必须先校验）。
  const signals = signalsInput.map((s) => parseTwinSignal(s));

  // 幂等去重：同 id 保留 ingestedAt 最新的一条。
  const byId = new Map<string, TwinSignal>();
  let ignoredFuture = 0;
  for (const signal of signals) {
    const existing = byId.get(signal.id);
    if (existing === undefined || compareTime(signal.ingestedAt, existing.ingestedAt) >= 0) {
      byId.set(signal.id, signal);
    }
  }
  const deduped = [...byId.values()];
  const usableSignals: TwinSignal[] = [];
  for (const signal of deduped) {
    if (signal.observedAt > atTime) {
      ignoredFuture += 1;
      continue;
    }
    usableSignals.push(signal);
  }

  const zones: Record<string, ZoneState> = {};
  for (const zone of layout.zones) {
    zones[zone.zoneId] = {
      zoneId: zone.zoneId,
      zoneType: zone.zoneType,
      kpis: {},
      fixtures: {},
      coverage: { totalSignals: 0, staleCount: 0, unknownCount: 0, lastObservedAt: null, freshnessMin: null },
    };
  }
  for (const fixture of layout.fixtures) {
    const zone = zones[fixture.zoneId];
    if (zone === undefined) continue;
    zone.fixtures[fixture.fixtureId] = {
      fixtureId: fixture.fixtureId,
      fixtureType: fixture.fixtureType,
      capacity: fixture.capacity ?? null,
      kpis: {},
    };
  }

  const perZoneSignals = new Map<string, TwinSignal[]>();
  for (const signal of usableSignals) {
    if (signal.zoneId === undefined) continue;
    const bucket = perZoneSignals.get(signal.zoneId) ?? [];
    bucket.push(signal);
    perZoneSignals.set(signal.zoneId, bucket);
  }

  const allAlerts: Alert[] = [];
  const storeObservedAt: string[] = [];
  let storeStale = 0;
  let storeUnknown = 0;

  for (const zone of layout.zones) {
    const zoneSignals = perZoneSignals.get(zone.zoneId) ?? [];
    const zoneState = zones[zone.zoneId];
    if (zoneState === undefined) continue;

    const byMetric = new Map<string, TwinSignal[]>();
    for (const signal of zoneSignals) {
      const bucket = byMetric.get(signal.metric) ?? [];
      bucket.push(signal);
      byMetric.set(signal.metric, bucket);
    }
    for (const [metric, metricSignals] of byMetric) {
      // 口径分离：分区级信号（无 fixtureId）与设施级信号各自取最新，不互相遮蔽。
      const zoneScope = metricSignals.filter((s) => s.fixtureId === undefined);
      const zoneLatest = zoneScope.length > 0 ? pickLatest(zoneScope) : undefined;
      if (zoneLatest !== undefined) {
        zoneState.kpis[metric] = toReading(zoneLatest, atTime, staleAfterMin, 'zone');
      }
      const byFixture = new Map<string, TwinSignal[]>();
      for (const signal of metricSignals) {
        if (signal.fixtureId === undefined) continue;
        const bucket = byFixture.get(signal.fixtureId) ?? [];
        bucket.push(signal);
        byFixture.set(signal.fixtureId, bucket);
      }
      for (const [fixtureId, fixtureSignals] of byFixture) {
        const latest = pickLatest(fixtureSignals);
        const fixtureState = zoneState.fixtures[fixtureId];
        if (latest !== undefined && fixtureState !== undefined) {
          fixtureState.kpis[metric] = toReading(latest, atTime, staleAfterMin, 'fixture');
        }
      }
      // 分区兜底：该指标没有分区级信号时，取时间上最新的设施级读数作为分区代表（scope 标 'fixture'）。
      if (zoneState.kpis[metric] === undefined) {
        const fixtureCandidates = Object.values(zoneState.fixtures)
          .map((f) => f.kpis[metric])
          .filter((r): r is KpiReading => r !== undefined)
          .sort((a, b) => compareTime(b.observedAt, a.observedAt));
        const representative = fixtureCandidates[0];
        if (representative !== undefined) zoneState.kpis[metric] = representative;
      }
    }

    const zoneReadings: Record<string, KpiReading> = { ...zoneState.kpis };
    for (const fixture of Object.values(zoneState.fixtures)) {
      for (const [metric, reading] of Object.entries(fixture.kpis)) {
        if (zoneReadings[metric] === undefined) zoneReadings[metric] = reading;
      }
    }

    for (const alert of rules({ zoneId: zone.zoneId, zoneType: zone.zoneType, atTime, readings: zoneReadings, signals: usableSignals })) {
      allAlerts.push({ ...alert, raisedAt: atTime });
    }

    const staleCount = zoneSignals.filter((s) => toReading(s, atTime, staleAfterMin, 'zone').stale).length;
    const unknownCount = zoneSignals.filter((s) => s.kind === 'UNKNOWN').length;
    const observedAtList = zoneSignals.filter((s) => s.kind !== 'UNKNOWN').map((s) => s.observedAt);
    const lastObservedAt = observedAtList.length > 0 ? observedAtList.reduce((a, b) => (compareTime(a, b) >= 0 ? a : b)) : null;
    zoneState.coverage = {
      totalSignals: zoneSignals.length,
      staleCount,
      unknownCount,
      lastObservedAt,
      freshnessMin: lastObservedAt === null ? null : Math.max(0, minutesBetween(lastObservedAt, atTime)),
    };
    storeStale += staleCount;
    storeUnknown += unknownCount;
    storeObservedAt.push(...observedAtList);
  }

  const lastObservedAt = storeObservedAt.length > 0 ? storeObservedAt.reduce((a, b) => (compareTime(a, b) >= 0 ? a : b)) : null;

  return {
    snapshotId: computeSnapshotId(layout.storeId, atTime, deduped),
    storeId: layout.storeId,
    atTime,
    zones,
    alerts: allAlerts,
    coverage: {
      totalSignals: signals.length,
      dedupedSignals: deduped.length,
      ignoredFutureSignals: ignoredFuture,
      syntheticSignals: signals.filter((s) => s.synthetic).length,
      sources: [...new Set(signals.map((s) => s.sourceId))].sort(),
      storeLastObservedAt: lastObservedAt,
      storeFreshnessMin: lastObservedAt === null ? null : Math.max(0, minutesBetween(lastObservedAt, atTime)),
      staleCount: storeStale,
      unknownCount: storeUnknown,
    },
  };
}
