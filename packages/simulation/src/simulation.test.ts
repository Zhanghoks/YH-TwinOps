import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { METRICS, type TwinSnapshot, type TwinSignal } from '@yh/contracts';
import { makeSignal } from '@yh/contracts/testing';
import { projectTwinState } from '@yh/twin-state';
import { checkoutBaseline, runCheckoutScenario, type CheckoutScenario } from './index';

const AT = '2026-11-15T18:00:00Z';
const testLayout = {
  storeId: 'store-yh-01',
  name: '合成教学卖场',
  synthetic: true,
  widthM: 100,
  depthM: 80,
  zones: [{ zoneId: 'zone-checkout', name: '收银区', zoneType: 'CHECKOUT' as const }],
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
    {
      fixtureId: 'co-02',
      zoneId: 'zone-checkout',
      fixtureType: 'CHECKOUT' as const,
      assetId: 'yh-checkout-counter',
      x: 14,
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

/** 构造带完整仿真基线的快照：到达率 / 服务率 / 初始队列 / 在岗员工 / 持收银资格人数。 */
function peakSnapshot(signals: TwinSignal[] = []): TwinSnapshot {
  return projectTwinState(
    [
      makeSignal({ id: 'arr1', zoneId: 'zone-checkout', metric: 'checkout_arrivals_per_min', unit: '人/分钟', value: 6, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'svc1', zoneId: 'zone-checkout', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'q1', zoneId: 'zone-checkout', metric: METRICS.queueLength, unit: '人', value: 5, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'staff1', zoneId: 'zone-checkout', metric: METRICS.staffCount, unit: '人', value: 2, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'qual1', zoneId: 'zone-checkout', metric: METRICS.checkoutQualifiedStaff, unit: '人', value: 2, observedAt: '2026-11-15T17:59:00Z' }),
      ...signals,
    ],
    testLayout,
    AT,
  );
}

const baselineScenario: CheckoutScenario = { name: '保持现状', lanesOpen: 4, extraStaff: 0, horizonMin: 30 };

describe('runCheckoutScenario（S2 缝）', () => {
  it('同种子同输入完全可复现（AT-05）', () => {
    const snapshot = peakSnapshot();
    const a = runCheckoutScenario(snapshot, baselineScenario, 42);
    const b = runCheckoutScenario(snapshot, baselineScenario, 42);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.result).toEqual(b.result);
  });

  it('不同种子产生不同抽样（模型有随机性而非常量）', () => {
    const snapshot = peakSnapshot();
    const a = runCheckoutScenario(snapshot, baselineScenario, 42);
    const b = runCheckoutScenario(snapshot, baselineScenario, 43);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.result.metrics.avgWaitMin.mean).not.toBe(b.result.metrics.avgWaitMin.mean);
  });

  it('增开通道降低平均等待（方案差异方向合理）', () => {
    const snapshot = peakSnapshot();
    const base = runCheckoutScenario(snapshot, baselineScenario, 42);
    const more = runCheckoutScenario(snapshot, { name: '增开 2 通道', lanesOpen: 6, extraStaff: 0, horizonMin: 30 }, 42);
    expect(base.ok && more.ok).toBe(true);
    if (base.ok && more.ok) {
      expect(more.result.metrics.avgWaitMin.mean).toBeLessThan(base.result.metrics.avgWaitMin.mean);
      expect(more.result.metrics.p95WaitMin.mean).toBeLessThan(base.result.metrics.p95WaitMin.mean);
      expect(more.result.metrics.maxBacklog.mean).toBeLessThan(base.result.metrics.maxBacklog.mean);
    }
  });

  it('结果带 seed/snapshot_id/模型版本/假设（可重放可审计，PRD §8.3）', () => {
    const snapshot = peakSnapshot();
    const evalResult = runCheckoutScenario(snapshot, baselineScenario, 42);
    expect(evalResult.ok).toBe(true);
    if (evalResult.ok) {
      expect(evalResult.result.seed).toBe(42);
      expect(evalResult.result.snapshotId).toBe(snapshot.snapshotId);
      expect(evalResult.result.modelVersion).toBe('yh-checkout-des-0.1');
      expect(evalResult.result.assumptions.note).toMatch(/模拟情景/);
      expect(evalResult.result.assumptions.arrivalRatePerMin).toBe(6);
    }
  });

  it('调人方案报告工时与改动次数', () => {
    const snapshot = peakSnapshot();
    const evalResult = runCheckoutScenario(
      snapshot,
      { name: '增开 1 通道并调 1 人', lanesOpen: 5, extraStaff: 1, baselineLanesOpen: 4, horizonMin: 30 },
      42,
    );
    expect(evalResult.ok).toBe(true);
    if (evalResult.ok) {
      expect(evalResult.result.extraStaffHours).toBe(0.5);
      expect(evalResult.result.laneChangeCount).toBe(2);
    }
  });

  it('提供时薪假设时核算成本并注明合成口径', () => {
    const snapshot = peakSnapshot();
    const evalResult = runCheckoutScenario(
      snapshot,
      { name: '调 1 人支援', lanesOpen: 4, extraStaff: 1, horizonMin: 30, staffWageCnyPerHour: 25 },
      42,
    );
    expect(evalResult.ok).toBe(true);
    if (evalResult.ok) {
      expect(evalResult.result.extraCostCny).toBe(12.5);
      expect(evalResult.result.assumptions['staffWageCnyPerHour']).toBe(25);
      expect(evalResult.result.assumptions['costBasis']).toMatch(/合成教学时薪假设/);
    }
  });

  it('未提供时薪时成本如实留空（不编造成本数字）', () => {
    const snapshot = peakSnapshot();
    const evalResult = runCheckoutScenario(snapshot, { name: '调 1 人支援', lanesOpen: 4, extraStaff: 1, horizonMin: 30 }, 42);
    expect(evalResult.ok).toBe(true);
    if (evalResult.ok) {
      expect(evalResult.result.extraCostCny).toBeNull();
      expect(evalResult.result.assumptions['costBasis']).toBeUndefined();
    }
  });

  it('成本超预算的方案被拒绝；恰好等于预算时放行（成本约束，AT-05）', () => {
    const snapshot = peakSnapshot(); // 1 人 × 30 分钟 × 25 元/时 = 12.5 元
    const over = runCheckoutScenario(
      snapshot,
      { name: 'x', lanesOpen: 4, extraStaff: 1, horizonMin: 30, staffWageCnyPerHour: 25, maxExtraCostCny: 10 },
      42,
    );
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.why).toMatch(/超过预算 10 元/);
      expect(over.why).toMatch(/成本约束/);
    }
    const exact = runCheckoutScenario(
      snapshot,
      { name: 'x', lanesOpen: 4, extraStaff: 1, horizonMin: 30, staffWageCnyPerHour: 25, maxExtraCostCny: 12.5 },
      42,
    );
    expect(exact.ok).toBe(true);
  });

  it('设置预算但未提供时薪时拒绝（不能编造成本）', () => {
    const snapshot = peakSnapshot();
    const evalResult = runCheckoutScenario(
      snapshot,
      { name: 'x', lanesOpen: 4, extraStaff: 1, horizonMin: 30, maxExtraCostCny: 10 },
      42,
    );
    expect(evalResult.ok).toBe(false);
    if (!evalResult.ok) expect(evalResult.why).toMatch(/时薪/);
  });

  it('调人支援降低等待（方案 C 优于现状 A：服务容量口径回归）', () => {
    const snapshot = peakSnapshot();
    const base = runCheckoutScenario(snapshot, { name: 'A 保持现状', lanesOpen: 4, extraStaff: 0, horizonMin: 30 }, 42);
    const redeploy = runCheckoutScenario(snapshot, { name: 'C 调 1 人支援', lanesOpen: 4, extraStaff: 1, horizonMin: 30 }, 42);
    expect(base.ok && redeploy.ok).toBe(true);
    if (base.ok && redeploy.ok) {
      expect(redeploy.result.metrics.avgWaitMin.mean).toBeLessThan(base.result.metrics.avgWaitMin.mean);
      expect(redeploy.result.metrics.maxBacklog.mean).toBeLessThan(base.result.metrics.maxBacklog.mean);
    }
  });

  it('时薪只影响成本记账，不改变仿真抽样（同 seed 指标完全一致）', () => {
    const snapshot = peakSnapshot();
    const withWage = runCheckoutScenario(
      snapshot,
      { name: 'x', lanesOpen: 4, extraStaff: 1, horizonMin: 30, staffWageCnyPerHour: 40 },
      42,
    );
    const withoutWage = runCheckoutScenario(snapshot, { name: 'x', lanesOpen: 4, extraStaff: 1, horizonMin: 30 }, 42);
    expect(withWage.ok && withoutWage.ok).toBe(true);
    if (withWage.ok && withoutWage.ok) {
      expect(withWage.result.metrics).toEqual(withoutWage.result.metrics);
      expect(withWage.result.queueTimeline).toEqual(withoutWage.result.queueTimeline);
      expect(withWage.result.extraCostCny).not.toBe(withoutWage.result.extraCostCny);
    }
  });

  it('拒绝超过通道总数的方案', () => {
    const snapshot = peakSnapshot(); // totalLanes = 4+4 = 8
    const evalResult = runCheckoutScenario(snapshot, { name: 'x', lanesOpen: 9, extraStaff: 0, horizonMin: 30 }, 42);
    expect(evalResult.ok).toBe(false);
    if (!evalResult.ok) expect(evalResult.why).toMatch(/超过现有通道总数/);
  });

  it('调人超过持收银资格人数被拒（岗位资格约束，AT-05）', () => {
    // 在岗 2 人，持收银资格仅 1 人
    const snapshot = projectTwinState(
      [
        makeSignal({ id: 'arr1', zoneId: 'zone-checkout', metric: 'checkout_arrivals_per_min', unit: '人/分钟', value: 6, observedAt: '2026-11-15T17:59:00Z' }),
        makeSignal({ id: 'svc1', zoneId: 'zone-checkout', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5, observedAt: '2026-11-15T17:59:00Z' }),
        makeSignal({ id: 'staff1', zoneId: 'zone-checkout', metric: METRICS.staffCount, unit: '人', value: 2, observedAt: '2026-11-15T17:59:00Z' }),
        makeSignal({ id: 'qual1', zoneId: 'zone-checkout', metric: METRICS.checkoutQualifiedStaff, unit: '人', value: 1, observedAt: '2026-11-15T17:59:00Z' }),
      ],
      testLayout,
      AT,
    );
    const evalResult = runCheckoutScenario(snapshot, { name: 'x', lanesOpen: 4, extraStaff: 2, horizonMin: 30 }, 42);
    expect(evalResult.ok).toBe(false);
    if (!evalResult.ok) {
      expect(evalResult.why).toMatch(/持收银资格的在岗人数 1/);
      expect(evalResult.why).toMatch(/岗位资格/);
    }
  });

  it('资格人数无观测时调人方案如实拒绝（UNKNOWN 不放行）', () => {
    const snapshot = projectTwinState(
      [
        makeSignal({ id: 'arr1', zoneId: 'zone-checkout', metric: 'checkout_arrivals_per_min', unit: '人/分钟', value: 6, observedAt: '2026-11-15T17:59:00Z' }),
        makeSignal({ id: 'svc1', zoneId: 'zone-checkout', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5, observedAt: '2026-11-15T17:59:00Z' }),
        makeSignal({ id: 'staff1', zoneId: 'zone-checkout', metric: METRICS.staffCount, unit: '人', value: 2, observedAt: '2026-11-15T17:59:00Z' }),
      ],
      testLayout,
      AT,
    );
    const evalResult = runCheckoutScenario(snapshot, { name: 'x', lanesOpen: 4, extraStaff: 1, horizonMin: 30 }, 42);
    expect(evalResult.ok).toBe(false);
    if (!evalResult.ok) expect(evalResult.why).toMatch(/checkout_qualified_staff_count（持收银资格的在岗人数）无可用观测/);
  });

  it('资格充足时调人通过，假设里登记资格口径（可审计）', () => {
    const snapshot = peakSnapshot(); // 在岗 2 人且 2 人持资格
    const evalResult = runCheckoutScenario(snapshot, { name: 'x', lanesOpen: 4, extraStaff: 2, horizonMin: 30 }, 42);
    expect(evalResult.ok).toBe(true);
    if (evalResult.ok) {
      expect(evalResult.result.assumptions['qualifiedStaffAvailable']).toBe(2);
      expect(evalResult.result.assumptions['serviceCapacity']).toBe(6);
    }
  });

  it('拒绝超过可用员工的调人方案；员工无观测也如实拒绝', () => {
    const snapshot = peakSnapshot(); // staff_count = 2
    const over = runCheckoutScenario(snapshot, { name: 'x', lanesOpen: 4, extraStaff: 3, horizonMin: 30 }, 42);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.why).toMatch(/超过可用员工数/);

    const noStaff = projectTwinState(
      [
        makeSignal({ id: 'arr1', zoneId: 'zone-checkout', metric: 'checkout_arrivals_per_min', unit: '人/分钟', value: 6, observedAt: '2026-11-15T17:59:00Z' }),
        makeSignal({ id: 'svc1', zoneId: 'zone-checkout', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5, observedAt: '2026-11-15T17:59:00Z' }),
      ],
      testLayout,
      AT,
    );
    const unknownStaff = runCheckoutScenario(noStaff, { name: 'x', lanesOpen: 4, extraStaff: 1, horizonMin: 30 }, 42);
    expect(unknownStaff.ok).toBe(false);
    if (!unknownStaff.ok) expect(unknownStaff.why).toMatch(/staff_count 无可用观测/);
  });

  it('基线读数缺失时拒绝仿真而不是编造到达率', () => {
    const snapshot = projectTwinState([], testLayout, AT);
    const evalResult = runCheckoutScenario(snapshot, baselineScenario, 42);
    expect(evalResult.ok).toBe(false);
    if (!evalResult.ok) {
      expect(evalResult.why).toMatch(/checkout_arrivals_per_min/);
      expect(evalResult.why).toMatch(/不能编造基线/);
    }
  });

  it('非法参数被约束校验拒绝（属性边界：数值非负）', () => {
    const snapshot = peakSnapshot();
    expect(runCheckoutScenario(snapshot, { ...baselineScenario, lanesOpen: 0 }, 42).ok).toBe(false);
    expect(runCheckoutScenario(snapshot, { ...baselineScenario, extraStaff: -1 }, 42).ok).toBe(false);
    expect(runCheckoutScenario(snapshot, { ...baselineScenario, horizonMin: 5 }, 42).ok).toBe(false);
    expect(runCheckoutScenario(snapshot, { ...baselineScenario, horizonMin: 200 }, 42).ok).toBe(false);
    expect(runCheckoutScenario(snapshot, { ...baselineScenario, arrivalRatePerMin: 0 }, 42).ok).toBe(false);
    expect(runCheckoutScenario(snapshot, { ...baselineScenario, lanesOpen: 4.5 }, 42).ok).toBe(false);
  });

  it('stale 基线读数不参与仿真（不用过期数据决策，AT-04）', () => {
    const snapshot = projectTwinState(
      [
        makeSignal({ id: 'arr-old', zoneId: 'zone-checkout', metric: 'checkout_arrivals_per_min', unit: '人/分钟', value: 6, observedAt: '2026-11-15T17:00:00Z' }),
        makeSignal({ id: 'svc1', zoneId: 'zone-checkout', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5, observedAt: '2026-11-15T17:59:00Z' }),
      ],
      testLayout,
      AT,
    );
    const evalResult = runCheckoutScenario(snapshot, baselineScenario, 42);
    expect(evalResult.ok).toBe(false);
    if (!evalResult.ok) expect(evalResult.why).toMatch(/checkout_arrivals_per_min/);
  });

  it('checkoutBaseline 如实列出缺失项与通道总数', () => {
    const full = checkoutBaseline(peakSnapshot());
    expect(full.ok).toBe(true);
    if (full.ok) {
      expect(full.baseline.totalLanes).toBe(8);
      expect(full.baseline.availableStaff).toBe(2);
      expect(full.baseline.qualifiedStaff).toBe(2);
      expect(full.baseline.arrivalRatePerMin).toBe(6);
      expect(full.baseline.initialQueueLength).toBe(5);
    }
  });

  it('时间线覆盖仿真窗口且长度非负', () => {
    const snapshot = peakSnapshot();
    const evalResult = runCheckoutScenario(snapshot, baselineScenario, 7);
    expect(evalResult.ok).toBe(true);
    if (evalResult.ok) {
      expect(evalResult.result.queueTimeline.length).toBeGreaterThan(0);
      for (const point of evalResult.result.queueTimeline) {
        expect(point.tMin).toBeGreaterThan(0);
        expect(point.tMin).toBeLessThanOrEqual(30);
        expect(point.queueLength).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('属性：任意越界通道数都被约束校验拒绝（fast-check）', () => {
    const snapshot = peakSnapshot(); // totalLanes = 8
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 500 }), (lanes) => {
        fc.pre(lanes < 1 || lanes > 8);
        const evalResult = runCheckoutScenario(snapshot, { name: 'p', lanesOpen: lanes, extraStaff: 0, horizonMin: 30 }, 42);
        return evalResult.ok === false;
      }),
      { numRuns: 200 },
    );
  });

  it('属性：合法方案的指标全部非负且有限（fast-check）', () => {
    const snapshot = peakSnapshot();
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 10, max: 120 }),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (lanes, staff, horizon, seed) => {
          const evalResult = runCheckoutScenario(snapshot, { name: 'p', lanesOpen: lanes, extraStaff: staff, horizonMin: horizon }, seed);
          if (!evalResult.ok) return false;
          const metrics = evalResult.result.metrics;
          const okStat = (s: { mean: number; std: number; min: number; max: number }): boolean =>
            [s.mean, s.std, s.min, s.max].every((v) => Number.isFinite(v) && v >= 0);
          return okStat(metrics.avgWaitMin) && okStat(metrics.p95WaitMin) && okStat(metrics.maxBacklog) && okStat(metrics.servedCount) && evalResult.result.extraStaffHours >= 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('属性：成本核算公式与预算约束对任意参数组合成立（fast-check）', () => {
    const snapshot = peakSnapshot(); // 在岗 2 人、2 人持资格
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }), // extraStaff（受在岗与资格约束）
        fc.integer({ min: 10, max: 120 }), // horizonMin
        fc.integer({ min: 0, max: 50 }), // 时薪（元/小时，合成教学假设）
        fc.integer({ min: 0, max: 100 }), // 成本预算（元）
        (staff, horizon, wage, budget) => {
          const evalResult = runCheckoutScenario(
            snapshot,
            { name: 'p', lanesOpen: 4, extraStaff: staff, horizonMin: horizon, staffWageCnyPerHour: wage, maxExtraCostCny: budget },
            42,
          );
          const cost = Math.round((((staff * horizon) / 60) * wage) * 100) / 100;
          if (cost > budget) return !evalResult.ok;
          if (!evalResult.ok) return false;
          return (
            evalResult.result.extraCostCny === cost &&
            evalResult.result.extraStaffHours === Math.round(((staff * horizon) / 60) * 100) / 100
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('属性：调人人数在资格内不减服务容量，等待不高于基线（fast-check）', () => {
    const snapshot = peakSnapshot(); // 在岗 2 人、2 人持资格
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (staff, seed) => {
          const base = runCheckoutScenario(snapshot, { name: 'base', lanesOpen: 4, extraStaff: 0, horizonMin: 30 }, seed);
          const more = runCheckoutScenario(snapshot, { name: 'more', lanesOpen: 4, extraStaff: staff, horizonMin: 30 }, seed);
          if (!base.ok || !more.ok) return false;
          // 共享 FIFO + 工作保守调度下，服务容量只增不减：期望等待不应升高。
          return more.result.metrics.avgWaitMin.mean <= base.result.metrics.avgWaitMin.mean + 0.5;
        },
      ),
      { numRuns: 60 },
    );
  });
});
