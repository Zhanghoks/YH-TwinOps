import { describe, expect, it } from 'vitest';
import type { Fixture, StoreLayout } from '@yh/contracts';
import { auditStoreLayout } from './layoutAudit';
import { layout } from '../data';

const fixture = (id: string, x: number, z: number, extra: Partial<Fixture> = {}): Fixture => ({ fixtureId: id, zoneId: 'z', fixtureType: 'GONDOLA', assetId: 'generic', x, y: 0, z, rotationY: 0, widthM: 2, depthM: 1, heightM: 1.5, fixed: true, categoryIds: [], ...extra });
const store = (fixtures: Fixture[]): StoreLayout => ({ storeId: 'test', name: 'Test', synthetic: true, widthM: 20, depthM: 20, zones: [{ zoneId: 'z', name: 'Test', zoneType: 'GROCERY', polygonM: [[-10,-10],[10,-10],[10,10],[-10,10]] }], fixtures });

describe('read-only layout geometry audit', () => {
  it('reports current fixed baseline facts without modifying IDs or positions', () => {
    const before = JSON.stringify(layout);
    const report = auditStoreLayout(layout);
    expect(report.fixtureCount).toBe(150);
    expect(report.fixedCount).toBe(150);
    expect(report.movableCount).toBe(0);
    expect(report.doorIds).toEqual([]);
    expect(report.overlapPairs).toEqual([]);
    expect(report.outsideStoreIds).toEqual([]);
    expect(report.narrowGaps).toHaveLength(45);
    expect(report.outsideZoneFixtureIds.length).toBe(56);
    expect(report.narrowGaps).toContainEqual({ fixtureIds: ['F024', 'F044'], axis: 'x', gapM: .1 });
    expect(report.warningCodes).toContain('ALL_FIXTURES_FIXED');
    expect(report.warningCodes).toContain('NO_DOOR_METADATA');
    expect(report.warningCodes).toContain('GEOMETRY_ONLY_NOT_COMPLIANCE');
    expect(JSON.stringify(layout)).toBe(before);
  });

  it('reuses oriented footprint collision tests, rather than treating rotated AABBs as collisions', () => {
    const a = fixture('a', 0, 0, {widthM: 6, depthM: .3, rotationY: Math.PI / 4});
    const b = fixture('b', 0, 2, {widthM: 6, depthM: .3, rotationY: Math.PI / 4});
    expect(auditStoreLayout(store([a,b])).overlapPairs).toEqual([]);
    expect(auditStoreLayout(store([a,{...b,z:.1}])).overlapPairs).toEqual([['a','b']]);
    expect(auditStoreLayout(store([a,b])).warningCodes).toContain('OBLIQUE_GAPS_NOT_MEASURED');
  });

  it('distinguishes touching, gap and overlap and reports corners outside store', () => {
    const report = auditStoreLayout(store([fixture('a',0,0), fixture('b',2.5,0), fixture('c',9.5,0)]));
    expect(report.narrowGaps).toEqual([{fixtureIds:['a','b'],axis:'x',gapM:.5}]);
    expect(report.outsideStoreIds).toEqual(['c']);
    expect(report.outsideZoneFixtureIds).toEqual(['c']);
    const touching = auditStoreLayout(store([fixture('a',0,0),fixture('b',2,0)]));
    expect(touching.overlapPairs).toEqual([]);
    expect(touching.narrowGaps[0]?.gapM).toBe(0);
  });

  it('makes review thresholds explicit and rejects invalid values', () => {
    expect(auditStoreLayout(store([fixture('a',0,0),fixture('b',2.5,0)]), { gapReviewThresholdM: .4 }).narrowGaps).toEqual([]);
    for(const value of [0,-1,NaN,Infinity]) expect(()=>auditStoreLayout(store([]),{gapReviewThresholdM:value})).toThrow(RangeError);
  });
});
