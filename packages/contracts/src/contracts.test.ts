import { describe, expect, it } from 'vitest';
import {
  isTwinSignal,
  parseStoreLayout,
  parseTwinSignal,
  twinSignalSchema,
} from './index';
import { makeSignal } from './testing';

describe('twinSignalSchema', () => {
  it('接受合法的 OBSERVED 合成观测信号', () => {
    const signal = parseTwinSignal(makeSignal());
    expect(signal.id).toBe('sig-001');
    expect(isTwinSignal(makeSignal())).toBe(true);
  });

  it('UNKNOWN 信号不许填假数', () => {
    expect(() => parseTwinSignal(makeSignal({ kind: 'UNKNOWN', value: 42 }))).toThrow(/不许填假数/);
    expect(parseTwinSignal(makeSignal({ kind: 'UNKNOWN', value: null })).value).toBeNull();
  });

  it('非 UNKNOWN 信号必须有数值', () => {
    expect(() => parseTwinSignal(makeSignal({ value: null }))).toThrow(/必须有数值/);
  });

  it('ESTIMATED 必须带 confidence，SIMULATED 必须带 scenarioId 与 modelVersion', () => {
    expect(() => parseTwinSignal(makeSignal({ kind: 'ESTIMATED' }))).toThrow(/confidence/);
    expect(() =>
      parseTwinSignal(
        makeSignal({ kind: 'ESTIMATED', confidence: 0.7, modelVersion: 'est-0.1' }),
      ),
    ).not.toThrow();
    expect(() => parseTwinSignal(makeSignal({ kind: 'SIMULATED' }))).toThrow(/scenarioId/);
    expect(() =>
      parseTwinSignal(makeSignal({ kind: 'SIMULATED', scenarioId: 'sc-1', modelVersion: 'sim-0.1' })),
    ).not.toThrow();
  });

  it('拒绝非法时间戳与越界 coverage', () => {
    expect(() => parseTwinSignal(makeSignal({ observedAt: '不是时间' }))).toThrow();
    expect(() => parseTwinSignal(makeSignal({ coverage: 1.5 }))).toThrow();
    expect(twinSignalSchema.safeParse(makeSignal({ coverage: 0 })).success).toBe(true);
  });
});

describe('storeLayoutSchema', () => {
  const zone = { zoneId: 'zone-checkout', name: '收银区', zoneType: 'CHECKOUT' } as const;

  it('接受引用一致且 synthetic 的合成布局', () => {
    const layout = parseStoreLayout({
      storeId: 'store-yh-01',
      name: '合成教学卖场',
      synthetic: true,
      widthM: 100,
      depthM: 80,
      zones: [zone],
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
      ],
    });
    expect(layout.fixtures).toHaveLength(1);
  });

  it('v3 布局必须是合成标记', () => {
    expect(() =>
      parseStoreLayout({
        storeId: 'store-yh-01',
        name: '假真实布局',
        synthetic: false,
        widthM: 100,
        depthM: 80,
        zones: [zone],
        fixtures: [],
      }),
    ).toThrow(/synthetic/);
  });

  it('拒绝设施指向不存在的分区与重复 ID', () => {
    const base = {
      storeId: 'store-yh-01',
      name: 'x',
      synthetic: true,
      widthM: 10,
      depthM: 10,
    };
    expect(() =>
      parseStoreLayout({
        ...base,
        zones: [zone],
        fixtures: [
          {
            fixtureId: 'co-01',
            zoneId: 'zone-nope',
            fixtureType: 'CHECKOUT',
            assetId: 'a',
            x: 0,
            y: 0,
            z: 0,
            rotationY: 0,
            widthM: 1,
            depthM: 1,
            heightM: 1,
            fixed: true,
            categoryIds: [],
          },
        ],
      }),
    ).toThrow(/不存在的分区/);
    expect(() =>
      parseStoreLayout({ ...base, zones: [zone, { ...zone, name: '收银区2' }], fixtures: [] }),
    ).toThrow(/分区 ID 重复/);
  });
});
