/**
 * 合成高峰信号（18:00 情景），按 layouts 分区类型生成。
 * 全部 synthetic: true、来源固定标注；教学锚点：收银 CRITICAL 拥堵、蔬果区数据盲区（UNKNOWN）、
 * 包装食品区 stale 过期。数值为教学假设，不是任何真实门店的观测。
 */
import { METRICS, type TwinSignal } from '@yh/contracts';
import { makeSignal } from '@yh/contracts/testing';
import { DEMO_AT, DEMO_STALE_T, DEMO_T0, layout } from './data';

const SOURCE = 'synthetic-peak-feed';
const SELLING_ZONE_TYPES = new Set(['PRODUCE', 'MEAT', 'SEAFOOD', 'DELI', 'BAKERY', 'GROCERY', 'BEVERAGE', 'HOUSEHOLD', 'DAIRY', 'FEATURED']);
const COLD_ZONE_TYPES = new Set(['FROZEN', 'DAIRY']);

/** 每区客流（人/窗口，教学假设）；UNKNOWN = 计数源离线盲区；STALE = 信号过期。 */
const TRAFFIC: Record<string, number | 'UNKNOWN' | 'STALE'> = {
  'zone-produce': 'UNKNOWN',
  'zone-packaged': 'STALE',
  'zone-seafood': 14,
  'zone-meat': 22,
  'zone-deli': 26,
  'zone-beverages': 46,
  'zone-featured': 38,
  'zone-bulk': 31,
  'zone-frozen': 28,
  'zone-bakery': 33,
  'zone-household': 41,
  'zone-daily': 35,
  'zone-checkout_n': 95,
  'zone-checkout_e': 47,
  'zone-checkout_s': 61,
  'zone-rest': 5,
  'zone-backroom': 6,
};

const SALES: Record<string, number> = {
  'zone-grocery-a': 1860,
  'zone-grocery-b': 1420,
  'zone-produce': 760,
  'zone-deli': 910,
  'zone-beverages': 1130,
  'zone-bakery': 640,
  'zone-meat': 880,
  'zone-daily': 520,
};

/** 主收银线：北出口收银（zone-checkout_n）承载高峰拥堵情景。 */
const MAIN_CHECKOUT = 'zone-checkout_n';

export function baselineSignals(): TwinSignal[] {
  const signals: TwinSignal[] = [];
  for (const zone of layout.zones) {
    const traffic = TRAFFIC[zone.zoneId] ?? 0;
    const base = { id: `syn-traffic-${zone.zoneId}`, zoneId: zone.zoneId, metric: METRICS.trafficCount, unit: '人' };
    if (traffic === 'UNKNOWN') {
      signals.push(makeSignal({ ...base, value: null, kind: 'UNKNOWN', sourceId: 'synthetic-counter-offline', observedAt: DEMO_T0 }));
    } else if (traffic === 'STALE') {
      signals.push(makeSignal({ ...base, value: 64, sourceId: SOURCE, observedAt: DEMO_STALE_T }));
    } else {
      signals.push(makeSignal({ ...base, value: traffic, sourceId: SOURCE, observedAt: DEMO_T0 }));
    }
    const sales = SALES[zone.zoneId];
    if (sales !== undefined || (SELLING_ZONE_TYPES.has(zone.zoneType) && SALES[zone.zoneId] === undefined)) {
      const fallback = 300 + ((zone.zoneId.length * 37) % 900);
      signals.push(
        makeSignal({
          id: `syn-sales-${zone.zoneId}`,
          zoneId: zone.zoneId,
          metric: METRICS.salesAmount,
          unit: '元',
          value: sales ?? fallback,
          sourceId: 'synthetic-pos',
          observedAt: DEMO_T0,
        }),
      );
    }
  }

  // 主收银区：高峰拥堵 CRITICAL 情景（queue 16 ≥ 15 阈值），带完整仿真基线与资格口径。
  // 每条信号 id 必须唯一：投影按 id 幂等去重，同 id 会被当成重复事件丢弃。
  const checkout = { zoneId: MAIN_CHECKOUT, sourceId: SOURCE, observedAt: DEMO_T0 };
  signals.push(
    makeSignal({ ...checkout, id: 'syn-checkout-queue', metric: METRICS.queueLength, unit: '人', value: 16 }),
    makeSignal({ ...checkout, id: 'syn-checkout-wait', metric: METRICS.queueWaitMin, unit: '分钟', value: 8.4 }),
    makeSignal({ ...checkout, id: 'syn-checkout-arr', metric: METRICS.checkoutArrivalsPerMin, unit: '人/分钟', value: 6 }),
    makeSignal({ ...checkout, id: 'syn-checkout-svc', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5 }),
    makeSignal({ ...checkout, id: 'syn-checkout-lanes', metric: METRICS.checkoutLanesOpen, unit: '条', value: 4 }),
    makeSignal({ ...checkout, id: 'syn-checkout-staff', metric: METRICS.staffCount, unit: '人', value: 4 }),
    makeSignal({ ...checkout, id: 'syn-checkout-qual', metric: METRICS.checkoutQualifiedStaff, unit: '人', value: 1 }),
  );

  // 冷链遥测
  signals.push(
    makeSignal({ id: 'syn-frozen-temp', zoneId: 'zone-frozen', metric: METRICS.equipmentTempC, unit: '°C', value: -18.2, sourceId: SOURCE, observedAt: DEMO_T0 }),
    makeSignal({ id: 'syn-daily-temp', zoneId: 'zone-daily', metric: METRICS.equipmentTempC, unit: '°C', value: 2.4, sourceId: SOURCE, observedAt: DEMO_T0 }),
    makeSignal({ id: 'syn-frozen-online', zoneId: 'zone-frozen', metric: METRICS.equipmentOnline, unit: '布尔', value: 1, sourceId: SOURCE, observedAt: DEMO_T0 }),
  );

  // 库存
  signals.push(
    makeSignal({ id: 'syn-stock-packaged', zoneId: 'zone-packaged', metric: METRICS.stockLevel, unit: '箱', value: 62, sourceId: SOURCE, observedAt: DEMO_T0 }),
  );

  return signals;
}

/** 注入事件（US-30 数据隔离演示）：返回带唯一 id 的新信号，只影响对应分区。 */
export function injectSignals(kind: 'produce-traffic' | 'checkout-arrivals', index: number): TwinSignal[] {
  if (kind === 'produce-traffic') {
    return [
      makeSignal({
        id: `inj-produce-${index}`,
        zoneId: 'zone-produce',
        metric: METRICS.trafficCount,
        unit: '人',
        value: 176,
        sourceId: 'synthetic-injected-counter',
        observedAt: DEMO_AT,
      }),
    ];
  }
  return [
    makeSignal({
      id: `inj-arrivals-${index}`,
      zoneId: MAIN_CHECKOUT,
      metric: METRICS.checkoutArrivalsPerMin,
      unit: '人/分钟',
      value: 9,
      sourceId: 'synthetic-injected-counter',
      observedAt: DEMO_AT,
    }),
  ];
}

export const INJECT_LABELS: Record<string, string> = {
  'produce-traffic': '注入蔬果区客流补采（176 人）',
  'checkout-arrivals': '注入收银区到达率激增（9 人/分钟）',
};
