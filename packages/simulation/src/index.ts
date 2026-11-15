import { METRICS, isDecisionUsable, type TwinSnapshot } from '@yh/contracts';

/**
 * S2 接缝：高峰收银拥堵的离散事件仿真。
 * 相同种子 + 相同输入 → 相同结果（可复现）；方案间差异必须方向合理；
 * 违反约束的方案直接拒绝。缺少观测基线时拒绝仿真而不是编造到达率。
 */

export const SIM_MODEL_VERSION = 'yh-checkout-des-0.1';
export const DEFAULT_REPLICATIONS = 5;

export interface CheckoutScenario {
  name: string;
  /** 拟开放的收银通道数。 */
  lanesOpen: number;
  /** 从其他岗位临时调来支援的人数（每 1 人相当于增开 1 条服务通道）。 */
  extraStaff: number;
  /** 仿真时长（分钟），10–120。 */
  horizonMin: number;
  /** 现状通道数（用于计算改动次数），缺省视为与 lanesOpen 相同。 */
  baselineLanesOpen?: number;
  /** 覆盖到达率（人/分钟）；缺省时从快照的 checkout_arrivals_per_min 读数取。 */
  arrivalRatePerMin?: number;
  /** 覆盖单通道服务率（人/分钟）；缺省时从快照读数取。 */
  serviceRatePerMinPerLane?: number;
}

export interface ScenarioStat {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface ScenarioResult {
  snapshotId: string;
  seed: number;
  scenarioName: string;
  lanesOpen: number;
  extraStaff: number;
  horizonMin: number;
  modelVersion: string;
  assumptions: Record<string, unknown>;
  metrics: {
    avgWaitMin: ScenarioStat;
    p95WaitMin: ScenarioStat;
    maxBacklog: ScenarioStat;
    servedCount: ScenarioStat;
  };
  /** 一次代表性复制（种子 = seed）的逐分钟队列长度，供时间线展示。 */
  queueTimeline: { tMin: number; queueLength: number }[];
  extraStaffHours: number;
  laneChangeCount: number;
}

export type ScenarioEval = { ok: true; result: ScenarioResult } | { ok: false; why: string };

export interface SimulationOptions {
  replications?: number;
}

/** mulberry32：确定性 32 位 PRNG，种子可复现。 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expovariate(rng: () => number, ratePerMin: number): number {
  const u = Math.max(rng(), Number.EPSILON);
  return -Math.log(1 - u) / ratePerMin;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx] as number;
}

function stat(values: number[]): ScenarioStat {
  const n = values.length;
  const mean = n === 0 ? 0 : values.reduce((a, b) => a + b, 0) / n;
  const variance = n === 0 ? 0 : values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return {
    mean: round2(mean),
    std: round2(Math.sqrt(variance)),
    min: n === 0 ? 0 : round2(Math.min(...values)),
    max: n === 0 ? 0 : round2(Math.max(...values)),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export interface CheckoutBaseline {
  arrivalRatePerMin: number;
  serviceRatePerMinPerLane: number;
  initialQueueLength: number;
  totalLanes: number;
  availableStaff: number | null;
}

/** 从快照推导仿真基线；缺少决策可用读数时如实报告缺失项。 */
export function checkoutBaseline(snapshot: TwinSnapshot): { ok: true; baseline: CheckoutBaseline } | { ok: false; missing: string[] } {
  const checkoutZone = Object.values(snapshot.zones).find((z) => z.zoneType === 'CHECKOUT');
  if (checkoutZone === undefined) return { ok: false, missing: ['CHECKOUT 分区不存在于布局'] };

  const missing: string[] = [];
  const arrivalsReading = checkoutZone.kpis['checkout_arrivals_per_min'];
  const arrivalsValue = isDecisionUsable(arrivalsReading) ? arrivalsReading.value : null;
  if (arrivalsValue === null) missing.push('checkout_arrivals_per_min（收银区到达率，OBSERVED/ESTIMATED）');
  const serviceReading = checkoutZone.kpis[METRICS.checkoutServiceRate];
  const serviceValue = isDecisionUsable(serviceReading) ? serviceReading.value : null;
  if (serviceValue === null) missing.push('checkout_service_rate_per_lane_per_min（单通道服务率）');

  const totalLanes = Object.values(checkoutZone.fixtures)
    .filter((f) => f.fixtureType === 'CHECKOUT')
    .reduce((sum, f) => sum + (f.capacity ?? 0), 0);
  if (totalLanes <= 0) missing.push('CHECKOUT 设施 capacity（通道总数）');

  if (missing.length > 0 || arrivalsValue === null || serviceValue === null) return { ok: false, missing };

  const staffReading = checkoutZone.kpis[METRICS.staffCount];
  const queueReading = checkoutZone.kpis[METRICS.queueLength];
  return {
    ok: true,
    baseline: {
      arrivalRatePerMin: arrivalsValue,
      serviceRatePerMinPerLane: serviceValue,
      initialQueueLength: isDecisionUsable(queueReading) ? queueReading.value : 0,
      totalLanes,
      availableStaff: isDecisionUsable(staffReading) ? Math.floor(staffReading.value) : null,
    },
  };
}

/** 单次复制：共享 FIFO 队列 + 指数服务时间的 c 通道仿真，确定性种子。 */
function replicateOnce(
  rng: () => number,
  baseline: CheckoutBaseline,
  lanesOpen: number,
  horizonMin: number,
): { avgWaitMin: number; p95WaitMin: number; maxBacklog: number; servedCount: number; timeline: { tMin: number; queueLength: number }[] } {
  const busyUntil: number[] = new Array<number>(lanesOpen).fill(0);
  const queue: number[] = [];
  const waits: number[] = [];
  const timeline: { tMin: number; queueLength: number }[] = [];
  let served = 0;
  let t = 0;

  // 初始积压：快照观测到的当前队列长度直接进入等待序列（到达时刻记 0）。
  for (let i = 0; i < baseline.initialQueueLength; i += 1) queue.push(0);
  let backlogPeak = queue.length;

  // 有空闲通道就把队首顾客派上服务。
  const tryDispatch = (now: number): void => {
    for (let i = 0; i < busyUntil.length; i += 1) {
      const freeAt = busyUntil[i] as number;
      if (freeAt <= now && queue.length > 0) {
        const arrival = queue.shift() as number;
        const startAt = Math.max(now, freeAt);
        waits.push(startAt - arrival);
        busyUntil[i] = startAt + expovariate(rng, baseline.serviceRatePerMinPerLane);
        served += 1;
      }
    }
  };
  tryDispatch(0);

  let nextArrival = expovariate(rng, baseline.arrivalRatePerMin);
  let nextSample = 1;
  while (true) {
    // 只统计仍在服务的通道（busyUntil > t）；空闲通道不算事件源，否则死循环。
    const nextDeparture = busyUntil.reduce<number>((min, b) => (b > t && b < min ? b : min), Infinity);
    const nextSampleT = nextSample <= horizonMin ? nextSample : Infinity;
    const nextEvent = Math.min(nextArrival, nextDeparture, nextSampleT);
    if (nextEvent > horizonMin) break;
    t = nextEvent;
    if (nextEvent === nextSampleT) {
      timeline.push({ tMin: t, queueLength: queue.length });
      nextSample += 1;
      continue;
    }
    if (nextEvent === nextArrival) {
      queue.push(t);
      backlogPeak = Math.max(backlogPeak, queue.length);
      nextArrival = t + expovariate(rng, baseline.arrivalRatePerMin);
    }
    // 到达或服务完成之后，都先尝试把空闲通道派上队首顾客。
    tryDispatch(t);
  }

  // 结束前仍未被服务的顾客不计入等待统计（截尾，与真实窗口口径一致）。
  return {
    avgWaitMin: waits.length === 0 ? 0 : waits.reduce((a, b) => a + b, 0) / waits.length,
    p95WaitMin: percentile([...waits].sort((a, b) => a - b), 0.95),
    maxBacklog: backlogPeak,
    servedCount: served,
    timeline,
  };
}

/**
 * 运行一个收银调度方案：相同随机种子与客流场景对比，多次复制报告均值和范围（PRD §8.1）。
 * 结果只表述"模拟情景"，不声称真实门店的实际收益。
 */
export function runCheckoutScenario(
  snapshot: TwinSnapshot,
  scenario: CheckoutScenario,
  seed: number,
  options: SimulationOptions = {},
): ScenarioEval {
  if (!Number.isInteger(scenario.lanesOpen) || scenario.lanesOpen < 1) {
    return { ok: false, why: 'lanesOpen 必须是 ≥1 的整数' };
  }
  if (!Number.isInteger(scenario.extraStaff) || scenario.extraStaff < 0) {
    return { ok: false, why: 'extraStaff 必须是 ≥0 的整数' };
  }
  if (!Number.isInteger(scenario.horizonMin) || scenario.horizonMin < 10 || scenario.horizonMin > 120) {
    return { ok: false, why: 'horizonMin 必须在 10–120 分钟之间' };
  }
  if (scenario.arrivalRatePerMin !== undefined && scenario.arrivalRatePerMin <= 0) {
    return { ok: false, why: 'arrivalRatePerMin 必须 > 0' };
  }
  if (scenario.serviceRatePerMinPerLane !== undefined && scenario.serviceRatePerMinPerLane <= 0) {
    return { ok: false, why: 'serviceRatePerMinPerLane 必须 > 0' };
  }

  const baselineEval = checkoutBaseline(snapshot);
  if (!baselineEval.ok) {
    return { ok: false, why: `仿真基线缺少决策可用读数：${baselineEval.missing.join('；')}。请先补采或明确假设，不能编造基线。` };
  }
  const baseline = baselineEval.baseline;
  if (scenario.lanesOpen > baseline.totalLanes) {
    return { ok: false, why: `lanesOpen=${scenario.lanesOpen} 超过现有通道总数 ${baseline.totalLanes}` };
  }
  if (scenario.extraStaff > 0) {
    if (baseline.availableStaff === null) {
      return { ok: false, why: 'staff_count 无可用观测（UNKNOWN），无法验证调人约束；请补采员工在岗信号或将 extraStaff 设为 0' };
    }
    if (scenario.extraStaff > baseline.availableStaff) {
      return { ok: false, why: `extraStaff=${scenario.extraStaff} 超过可用员工数 ${baseline.availableStaff}` };
    }
  }

  const arrivalRate = scenario.arrivalRatePerMin ?? baseline.arrivalRatePerMin;
  const serviceRate = scenario.serviceRatePerMinPerLane ?? baseline.serviceRatePerMinPerLane;
  const replications = options.replications ?? DEFAULT_REPLICATIONS;

  const avgWaits: number[] = [];
  const p95Waits: number[] = [];
  const backlogs: number[] = [];
  const serveds: number[] = [];
  let representativeTimeline: { tMin: number; queueLength: number }[] = [];
  for (let i = 0; i < replications; i += 1) {
    const rng = mulberry32((seed + i) >>> 0);
    const run = replicateOnce(rng, { ...baseline, arrivalRatePerMin: arrivalRate, serviceRatePerMinPerLane: serviceRate }, scenario.lanesOpen, scenario.horizonMin);
    avgWaits.push(run.avgWaitMin);
    p95Waits.push(run.p95WaitMin);
    backlogs.push(run.maxBacklog);
    serveds.push(run.servedCount);
    if (i === 0) representativeTimeline = run.timeline;
  }

  const baselineLanes = scenario.baselineLanesOpen ?? scenario.lanesOpen;
  return {
    ok: true,
    result: {
      snapshotId: snapshot.snapshotId,
      seed,
      scenarioName: scenario.name,
      lanesOpen: scenario.lanesOpen,
      extraStaff: scenario.extraStaff,
      horizonMin: scenario.horizonMin,
      modelVersion: SIM_MODEL_VERSION,
      assumptions: {
        queueModel: '共享 FIFO 队列 + 指数服务时间（M/M/c 近似）',
        arrivalRatePerMin: arrivalRate,
        serviceRatePerMinPerLane: serviceRate,
        initialQueueLength: baseline.initialQueueLength,
        replications,
        note: '模拟情景结果，不是真实门店的预测；仅在假设成立时成立',
      },
      metrics: {
        avgWaitMin: stat(avgWaits),
        p95WaitMin: stat(p95Waits),
        maxBacklog: stat(backlogs),
        servedCount: stat(serveds),
      },
      queueTimeline: representativeTimeline,
      extraStaffHours: round2((scenario.extraStaff * scenario.horizonMin) / 60),
      laneChangeCount: Math.abs(scenario.lanesOpen - baselineLanes) + scenario.extraStaff,
    },
  };
}
