import { describe, expect, it } from 'vitest';
import { METRICS, type TwinSignal } from '@yh/contracts';
import { makeSignal, makeTestLayout, TEST_AT as AT } from '@yh/contracts/testing';
import { DEFAULT_STALE_AFTER_MIN, projectTwinState, sumMetricInWindow } from './index';

const testLayout = makeTestLayout();

describe('projectTwinState（S1 缝）', () => {
  it('把最新观测投影到对应分区的 KPI（AT-02）', () => {
    const snapshot = projectTwinState(
      [
        makeSignal({ id: 'q1', observedAt: '2026-11-15T17:58:00Z', value: 4 }),
        makeSignal({ id: 'q2', observedAt: '2026-11-15T17:59:30Z', value: 9 }),
      ],
      testLayout,
      AT,
    );
    const reading = snapshot.zones['zone-checkout']?.kpis[METRICS.queueLength];
    expect(reading?.value).toBe(9);
    expect(reading?.kind).toBe('OBSERVED');
    expect(reading?.synthetic).toBe(true);
    expect(reading?.stale).toBe(false);
    expect(reading?.evidenceIds).toContain('q2');
  });

  it('注入只影响对应分区，不污染其他分区（AT-02 数据隔离）', () => {
    const snapshot = projectTwinState(
      [makeSignal({ id: 'q1', zoneId: 'zone-checkout', value: 9, observedAt: '2026-11-15T17:59:00Z' })],
      testLayout,
      AT,
    );
    expect(snapshot.zones['zone-checkout']?.kpis[METRICS.queueLength]?.value).toBe(9);
    expect(snapshot.zones['zone-produce']?.kpis[METRICS.queueLength]).toBeUndefined();
    expect(snapshot.zones['zone-frozen']?.kpis[METRICS.queueLength]).toBeUndefined();
  });

  it('同 id 重复注入幂等，不产生双份状态', () => {
    const a = projectTwinState([makeSignal({ id: 'q1', value: 9, observedAt: '2026-11-15T17:59:00Z' })], testLayout, AT);
    const b = projectTwinState(
      [
        makeSignal({ id: 'q1', value: 9, observedAt: '2026-11-15T17:59:00Z' }),
        makeSignal({ id: 'q1', value: 9, observedAt: '2026-11-15T17:59:00Z' }),
      ],
      testLayout,
      AT,
    );
    expect(b.coverage.dedupedSignals).toBe(1);
    expect(b.zones).toEqual(a.zones);
    expect(b.alerts).toEqual(a.alerts);
    expect(b.snapshotId).toBe(a.snapshotId);
  });

  it('乱序事件按 observedAt 取最新', () => {
    const snapshot = projectTwinState(
      [
        makeSignal({ id: 'late', observedAt: '2026-11-15T17:59:30Z', value: 9, ingestedAt: '2026-11-15T18:00:05Z' }),
        makeSignal({ id: 'early', observedAt: '2026-11-15T17:58:00Z', value: 4, ingestedAt: '2026-11-15T18:00:01Z' }),
      ],
      testLayout,
      AT,
    );
    expect(snapshot.zones['zone-checkout']?.kpis[METRICS.queueLength]?.value).toBe(9);
  });

  it('超过新鲜度阈值的信号降级为 UNKNOWN，主值清空、lastValue 留痕（AT-04）', () => {
    const snapshot = projectTwinState(
      [makeSignal({ id: 'old', observedAt: '2026-11-15T17:00:00Z', value: 9 })],
      testLayout,
      AT,
    );
    const reading = snapshot.zones['zone-checkout']?.kpis[METRICS.queueLength];
    expect(reading?.kind).toBe('UNKNOWN');
    expect(reading?.stale).toBe(true);
    expect(reading?.staleReason).toBe('stale');
    expect(reading?.value).toBeNull();
    expect(reading?.lastValue).toBe(9);
    expect(reading?.observedAt).toBe('2026-11-15T17:00:00Z');
  });

  it('validUntil 过期同样降级', () => {
    const snapshot = projectTwinState(
      [makeSignal({ id: 'expired', observedAt: '2026-11-15T17:59:00Z', value: 3, validUntil: '2026-11-15T17:59:30Z' })],
      testLayout,
      AT,
    );
    const reading = snapshot.zones['zone-checkout']?.kpis[METRICS.queueLength];
    expect(reading?.stale).toBe(true);
    expect(reading?.staleReason).toBe('expired');
    expect(reading?.value).toBeNull();
  });

  it('UNKNOWN 输入保持 UNKNOWN 且无值（AT-03：不能声称没人）', () => {
    const snapshot = projectTwinState(
      [makeSignal({ id: 'gap', kind: 'UNKNOWN', value: null })],
      testLayout,
      AT,
    );
    const reading = snapshot.zones['zone-checkout']?.kpis[METRICS.queueLength];
    expect(reading?.kind).toBe('UNKNOWN');
    expect(reading?.value).toBeNull();
    expect(reading?.staleReason).toBe('no-data');
  });

  it('阈值触达产生告警且带证据 ID；未触达不产生', () => {
    const base = [makeSignal({ id: 'q1', observedAt: '2026-11-15T17:59:00Z', value: 9 })];
    const warns = projectTwinState(base, testLayout, AT).alerts;
    expect(warns).toHaveLength(1);
    expect(warns[0]?.severity).toBe('WARNING');
    expect(warns[0]?.evidenceIds).toContain('q1');

    const critical = projectTwinState(
      [makeSignal({ id: 'q1', observedAt: '2026-11-15T17:59:00Z', value: 20 })],
      testLayout,
      AT,
    ).alerts;
    expect(critical[0]?.severity).toBe('CRITICAL');

    const quiet = projectTwinState(
      [makeSignal({ id: 'q1', observedAt: '2026-11-15T17:59:00Z', value: 3 })],
      testLayout,
      AT,
    ).alerts;
    expect(quiet).toHaveLength(0);
  });

  it('stale 读数不参与告警（不用过期数据决策，AT-04）', () => {
    const snapshot = projectTwinState(
      [makeSignal({ id: 'old', observedAt: '2026-11-15T17:00:00Z', value: 20 })],
      testLayout,
      AT,
    );
    expect(snapshot.alerts).toHaveLength(0);
  });

  it('冷链区域设备离线是 CRITICAL', () => {
    const snapshot = projectTwinState(
      [
        makeSignal({
          id: 'eq1',
          zoneId: 'zone-frozen',
          fixtureId: 'fz-01',
          metric: METRICS.equipmentOnline,
          unit: '布尔',
          value: 0,
          observedAt: '2026-11-15T17:59:00Z',
        }),
      ],
      testLayout,
      AT,
    );
    expect(snapshot.alerts).toHaveLength(1);
    expect(snapshot.alerts[0]?.severity).toBe('CRITICAL');
    expect(snapshot.alerts[0]?.zoneId).toBe('zone-frozen');
  });

  it('缺货风险：库存 0 且近 15 分钟有销售才告警', () => {
    const stockZero = makeSignal({
      id: 'stock1',
      zoneId: 'zone-produce',
      metric: METRICS.stockLevel,
      unit: '件',
      value: 0,
      observedAt: '2026-11-15T17:58:00Z',
    });
    const withSales = projectTwinState(
      [
        stockZero,
        makeSignal({
          id: 'sale1',
          zoneId: 'zone-produce',
          metric: METRICS.salesAmount,
          unit: '元',
          value: 120,
          observedAt: '2026-11-15T17:57:00Z',
        }),
      ],
      testLayout,
      AT,
    );
    expect(withSales.alerts.some((a) => a.rule.includes('stock_level'))).toBe(true);

    const withoutSales = projectTwinState([stockZero], testLayout, AT);
    expect(withoutSales.alerts).toHaveLength(0);
  });

  it('快照 ID 确定性：同输入同 ID，不同输入不同 ID', () => {
    const s1 = projectTwinState([makeSignal({ id: 'q1', value: 9 })], testLayout, AT);
    const s2 = projectTwinState([makeSignal({ id: 'q1', value: 9 })], testLayout, AT);
    const s3 = projectTwinState([makeSignal({ id: 'q1', value: 10 })], testLayout, AT);
    expect(s1.snapshotId).toBe(s2.snapshotId);
    expect(s1.snapshotId).not.toBe(s3.snapshotId);
  });

  it('未来时间戳的信号被忽略并计数', () => {
    const snapshot = projectTwinState(
      [makeSignal({ id: 'future', observedAt: '2026-11-15T18:05:00Z', value: 1 })],
      testLayout,
      AT,
    );
    expect(snapshot.coverage.ignoredFutureSignals).toBe(1);
    expect(snapshot.zones['zone-checkout']?.kpis[METRICS.queueLength]).toBeUndefined();
  });

  it('非法信号（UNKNOWN 带假数）在校验阶段抛出', () => {
    expect(() =>
      projectTwinState(
        [makeSignal({ id: 'bad', kind: 'UNKNOWN', value: 99 })],
        testLayout,
        AT,
      ),
    ).toThrow();
  });

  it('默认新鲜度阈值 10 分钟', () => {
    expect(DEFAULT_STALE_AFTER_MIN).toBe(10);
  });

  it('sumMetricInWindow 只累加窗口内的可用信号', () => {
    const signals: TwinSignal[] = [
      makeSignal({ id: 'a', zoneId: 'zone-produce', metric: METRICS.salesAmount, unit: '元', value: 100, observedAt: '2026-11-15T17:50:00Z' }),
      makeSignal({ id: 'b', zoneId: 'zone-produce', metric: METRICS.salesAmount, unit: '元', value: 50, observedAt: '2026-11-15T17:56:00Z' }),
      makeSignal({ id: 'c', zoneId: 'zone-produce', metric: METRICS.salesAmount, unit: '元', value: 70, observedAt: '2026-11-15T17:20:00Z' }),
    ];
    const { sum, evidenceIds } = sumMetricInWindow(signals, METRICS.salesAmount, AT, 15, { zoneId: 'zone-produce' });
    expect(sum).toBe(150);
    expect(evidenceIds).toEqual(['a', 'b']);
  });
});
