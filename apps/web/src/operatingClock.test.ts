import { describe, expect, it } from 'vitest';
import { createAgentTools } from '@yh/agent/tools';
import { projectTwinState, sumMetricInWindow } from '@yh/twin-state';
import { layout } from './data';
import { METRICS } from '@yh/contracts';
import { buildLiveOperatingScenario, liveOperatingSignals } from './operatingClock';
import { buildOperatingScenario } from './operatingModel';

describe('Beijing minute operating simulation', () => {
  const at = (iso: string) => buildLiveOperatingScenario(new Date(iso));
  const weekday = buildOperatingScenario('weekday', 21);
  it('uses Beijing midnight, switches day type and resets the previous day', () => {
    const friday = at('2026-11-20T15:59:59Z');
    const saturday = at('2026-11-20T16:00:00Z');
    expect(friday).toMatchObject({date:'2026-11-20', day:'weekday', minuteOfDay:1439, status:'closed'});
    expect(saturday).toMatchObject({date:'2026-11-21', day:'weekend', minuteOfDay:0, status:'preopen'});
    expect(friday.cumulative).toEqual(weekday.daily);
    expect(saturday.cumulative).toEqual({entrants:0, transactions:0, revenueCents:0, basketCents:0, conversion:0});
    expect(saturday.actualSeries).toHaveLength(0);
    expect(liveOperatingSignals(saturday)).toEqual([]);
  });
  it('separates preopening, exact opening, active, and completed-day snapshots', () => {
    expect(at('2026-11-20T07:59:59+08:00')).toMatchObject({status:'preopen',hour:8,elapsedMinutes:0,completedHours:0});
    expect(at('2026-11-20T08:00:00+08:00')).toMatchObject({status:'open',hour:8,elapsedMinutes:0,completedHours:0});
    expect(at('2026-11-20T08:01:00+08:00').actualSeries).toHaveLength(1);
    const closing = at('2026-11-20T22:00:00+08:00');
    expect(closing).toMatchObject({status:'closed',hour:21,elapsedMinutes:60,completedHours:14});
    expect(closing.actualSeries).toEqual(weekday.series);
    expect(closing.checkouts.every(c => c.queueLength === 0 && c.lanesOpen === 0)).toBe(true);
    expect(closing.zones.every(z => z.occupancy === 0)).toBe(true);
    expect(closing.inventory).toEqual(weekday.inventory);
  });
  it('reconciles counts and cents at every minute, with no late or early attribution', () => {
    const start = Date.parse('2026-11-20T08:00:00+08:00');
    let previous = buildLiveOperatingScenario(new Date(start));
    for (let m = 1; m <= 840; m++) {
      const snapshot = buildLiveOperatingScenario(new Date(start + m * 60_000));
      expect(snapshot.zones.reduce((n,r)=>n+r.entrants,0)).toBe(snapshot.current.entrants);
      expect(snapshot.zones.reduce((n,r)=>n+r.occupancy,0)).toBe(snapshot.current.occupancy);
      expect(snapshot.zones.reduce((n,r)=>n+r.revenueCents,0)).toBe(snapshot.current.revenueCents);
      expect(snapshot.checkouts.reduce((n,r)=>n+r.transactions,0)).toBe(snapshot.current.transactions);
      expect(snapshot.cumulative.entrants).toBeGreaterThanOrEqual(previous.cumulative.entrants);
      expect(snapshot.cumulative.transactions).toBeGreaterThanOrEqual(previous.cumulative.transactions);
      expect(snapshot.cumulative.revenueCents).toBeGreaterThanOrEqual(previous.cumulative.revenueCents);
      expect(snapshot.actualSeries.every(r=>r.hour<=snapshot.hour)).toBe(true);
      previous = snapshot;
    }
    expect(at('2026-11-20T18:00:00+08:00').current.occupancy).toBeGreaterThan(0);
    expect(at('2026-11-20T18:03:00+08:00')).toEqual(at('2026-11-20T18:03:59+08:00'));
  });
  it('emits stable simulated increment samples only for elapsed minutes', () => {
    const snapshot = at('2026-11-21T08:17:00+08:00');
    const signals = liveOperatingSignals(snapshot);
    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) {
      expect(signal).toMatchObject({kind:'SIMULATED', synthetic:true});
      expect(Date.parse(signal.observedAt)).toBeLessThan(Date.parse(snapshot.at));
      expect(Date.parse(signal.ingestedAt)).toBeLessThanOrEqual(Date.parse(snapshot.at));
    }
    const sum = (metric: string) => signals.filter(s=>s.metric===metric).reduce((n,s)=>n+(s.value ?? 0),0);
    expect(sum(METRICS.trafficCount)).toBe(snapshot.current.entrants);
    expect(Math.round(100 * sum(METRICS.salesAmount))).toBe(snapshot.current.revenueCents);
    const next = new Map(liveOperatingSignals(at('2026-11-21T08:18:00+08:00')).map(s=>[s.id,s]));
    for (const signal of signals.filter(s=>[METRICS.trafficCount,METRICS.salesAmount].some(metric=>metric===s.metric))) expect(next.get(signal.id)).toEqual(signal);
    expect(liveOperatingSignals(at('2026-11-21T23:01:00+08:00'))).toEqual([]);
  });
  it('projects synthetic minute signals into the existing twin and Agent tools', () => {
    const snapshot = at('2026-11-21T18:41:00+08:00');
    const signals = liveOperatingSignals(snapshot);
    const projected = projectTwinState(signals,layout,snapshot.at);
    const tools = createAgentTools({snapshot:projected,signals});
    for (const checkout of snapshot.checkouts) {
      expect(projected.zones[checkout.zoneId]?.kpis[METRICS.queueLength]).toMatchObject({kind:'SIMULATED',value:checkout.queueLength});
    }
    const traffic = sumMetricInWindow(signals,METRICS.trafficCount,snapshot.at,60);
    const sales = sumMetricInWindow(signals,METRICS.salesAmount,snapshot.at,60);
    const earlier = at('2026-11-21T17:41:00+08:00');
    expect(traffic.sum).toBe(snapshot.cumulative.entrants-earlier.cumulative.entrants);
    expect(Math.round(sales.sum*100)).toBe(snapshot.cumulative.revenueCents-earlier.cumulative.revenueCents);
    expect(tools.query_traffic({windowMin:15})).toMatchObject({status:'OK'});
    expect(tools.get_store_overview()).toMatchObject({status:'OK',data:{atTime:snapshot.at}});
  });

});
