import { METRICS, parseStoreLayout, type StoreLayout, type TwinSignal } from './index';

/** 测试夹具工厂：合法的合成观测信号，供各包测试复用。 */
export function makeSignal(overrides: Partial<TwinSignal> = {}): TwinSignal {
  return {
    id: 'sig-001',
    storeId: 'store-yh-01',
    zoneId: 'zone-checkout',
    metric: METRICS.queueLength,
    unit: '人',
    value: 6,
    kind: 'OBSERVED',
    synthetic: true,
    sourceId: 'synthetic-counter-a',
    observedAt: '2026-11-15T10:00:00Z',
    ingestedAt: '2026-11-15T10:00:01Z',
    coverage: 1,
    evidenceIds: [],
    ...overrides,
  };
}

/** 三分区两设施的最小合成布局（收银 / 冷冻 / 蔬菜）。 */
export function makeTestLayout(): StoreLayout {
  return parseStoreLayout({
    storeId: 'store-yh-01',
    name: '合成教学卖场',
    synthetic: true,
    widthM: 100,
    depthM: 80,
    zones: [
      { zoneId: 'zone-checkout', name: '收银区', zoneType: 'CHECKOUT' },
      { zoneId: 'zone-frozen', name: '冷冻区', zoneType: 'FROZEN' },
      { zoneId: 'zone-produce', name: '蔬菜区', zoneType: 'PRODUCE' },
    ],
    fixtures: [
      {
        fixtureId: 'co-01',
        zoneId: 'zone-checkout',
        fixtureType: 'CHECKOUT',
        assetId: 'yh-checkout-counter',
        x: 10,
        y: 0,
        z: 5,
        rotationY: 0,
        widthM: 3.6,
        depthM: 1.2,
        heightM: 1.1,
        fixed: true,
        capacity: 2,
        categoryIds: [],
      },
      {
        fixtureId: 'fz-01',
        zoneId: 'zone-frozen',
        fixtureType: 'FREEZER',
        assetId: 'yh-freezer-chest',
        x: 20,
        y: 0,
        z: 30,
        rotationY: 0,
        widthM: 2.0,
        depthM: 1.1,
        heightM: 1.5,
        fixed: true,
        categoryIds: [],
      },
    ],
  });
}

export const TEST_AT = '2026-11-15T18:00:00Z';
