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

/**
 * 纯 TS sha256（摘要与 node:crypto 一致）：投影缝要在浏览器与 Node 两端运行，
 * 不能依赖 node:crypto；也不用 crypto.subtle（异步）。FIPS 常数表按标准实现。
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLenHi = Math.floor((bytes.length * 8) / 2 ** 32);
  const bitLenLo = (bytes.length * 8) >>> 0;
  const padded = new Uint8Array((((bytes.length + 9) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLenHi);
  view.setUint32(padded.length - 4, bitLenLo);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15] as number, 7) ^ rotr(w[i - 15] as number, 18) ^ ((w[i - 15] as number) >>> 3);
      const s1 = rotr(w[i - 2] as number, 17) ^ rotr(w[i - 2] as number, 19) ^ ((w[i - 2] as number) >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0;
    }
    let a = h[0] as number;
    let b = h[1] as number;
    let c = h[2] as number;
    let d = h[3] as number;
    let e = h[4] as number;
    let f = h[5] as number;
    let g = h[6] as number;
    let hh = h[7] as number;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (SHA256_K[i] as number) + (w[i] as number)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = ((h[0] as number) + a) >>> 0;
    h[1] = ((h[1] as number) + b) >>> 0;
    h[2] = ((h[2] as number) + c) >>> 0;
    h[3] = ((h[3] as number) + d) >>> 0;
    h[4] = ((h[4] as number) + e) >>> 0;
    h[5] = ((h[5] as number) + f) >>> 0;
    h[6] = ((h[6] as number) + g) >>> 0;
    h[7] = ((h[7] as number) + hh) >>> 0;
  }
  return Array.from(h)
    .map((x) => x.toString(16).padStart(8, '0'))
    .join('');
}

/** 确定性快照 ID：相同输入必得相同 ID，内容不同则 ID 不同（可重放、可追溯）。 */
function computeSnapshotId(storeId: string, atTime: string, signals: TwinSignal[]): string {
  const digest = signals
    .map((s) => `${s.id}|${s.metric}|${s.value === null ? 'null' : s.value}|${s.kind}|${s.observedAt}|${s.sourceId}|${s.ingestedAt}`)
    .sort()
    .join('\n');
  return `snap-${sha256Hex(`${storeId}|${atTime}\n${digest}`).slice(0, 16)}`;
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
