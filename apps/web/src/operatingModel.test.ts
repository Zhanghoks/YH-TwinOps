import { describe, expect, it } from 'vitest';
import { METRICS, parseTwinSignal } from '@yh/contracts';
import { projectTwinState, sumMetricInWindow } from '@yh/twin-state';
import { layout } from './data';
import { OPERATING_HOURS, buildOperatingScenario, operatingSignals } from './operatingModel';

describe('deterministic synthetic operating days', () => {
  for (const day of ['weekday','weekend'] as const) {
    it(`${day} reconciles every hour and the day`, () => {
      for (const hour of OPERATING_HOURS) {
        const s = buildOperatingScenario(day,hour);
        const { current, daily, zones, checkouts } = s;
        expect(s).toEqual(buildOperatingScenario(day,hour));
        expect(s.synthetic).toBe(true);
        expect(s.series.map(r=>r.hour)).toEqual(OPERATING_HOURS);
        expect(current.transactions).toBeLessThanOrEqual(current.entrants);
        expect(current.conversion).toBe(current.transactions/current.entrants);
        expect(current.revenueCents).toBe(current.transactions*current.basketCents);
        expect(zones.reduce((n,z)=>n+z.occupancy,0)).toBe(current.occupancy);
        expect(zones.reduce((n,z)=>n+z.entrants,0)).toBe(current.entrants);
        expect(zones.every(z=>z.occupancy>=0)).toBe(true);
        expect(zones.reduce((n,z)=>n+z.revenueCents,0)).toBe(current.revenueCents);
        expect(checkouts.reduce((n,c)=>n+c.transactions,0)).toBe(current.transactions);
        for (const c of checkouts) {
          expect(c.arrivalRatePerMin).toBe(c.transactions/60);
          expect(c.capacityPerMin).toBeGreaterThan(c.arrivalRatePerMin);
          expect(c.lanesOpen).toBeLessThanOrEqual(8);
          expect(c.waitMin).toBeCloseTo(c.queueLength/c.arrivalRatePerMin,1);
          expect(zones.find(z=>z.zoneId===c.zoneId)?.occupancy).toBeGreaterThanOrEqual(c.queueLength);
        }
        for (const key of ['entrants','transactions','revenueCents'] as const) expect(daily[key]).toBe(s.series.reduce((n,row)=>n+row[key],0));
        expect(daily.basketCents).toBe(Math.round(daily.revenueCents/daily.transactions));
        expect(daily.conversion).toBe(daily.transactions/daily.entrants);
        expect(s.at).toBe(new Date(`${s.date}T${String(hour+1).padStart(2,'0')}:00:00+08:00`).toISOString());
      }
    });
  }
  it('makes distinct calibrated comparison profiles and meaningful SKU statuses',()=>{
    const weekday=buildOperatingScenario('weekday',18);
    const weekend=buildOperatingScenario('weekend',18);
    expect(weekday.daily.entrants).toBeGreaterThanOrEqual(3500);
    expect(weekday.daily.entrants).toBeLessThanOrEqual(4100);
    expect(weekend.daily.entrants).toBeGreaterThanOrEqual(4600);
    expect(weekend.daily.entrants).toBeLessThanOrEqual(5500);
    expect(weekend.daily.revenueCents).toBeGreaterThan(weekday.daily.revenueCents);
    expect(weekday.inventory.map(i=>i.status)).toContain('low');
    expect(weekend.inventory.map(i=>i.status)).toContain('out');
    expect(weekday.inventory.every(i=>i.onHand>=0 && (i.status==='normal'?i.suggestedOrder===0:i.suggestedOrder>0))).toBe(true);
    expect(()=>buildOperatingScenario('weekday',22)).toThrow(RangeError);
  });
  it('projects the same checkout queues and only counts completed incremental POS/counter bins',()=>{
    const s=buildOperatingScenario('weekend',18);
    const signals=operatingSignals(s);
    expect(new Set(signals.map(x=>x.id)).size).toBe(signals.length);
    expect(signals.every(x=>x.synthetic && x.observedAt<x.ingestedAt && x.ingestedAt<s.at)).toBe(true);
    expect(signals.every(x=>parseTwinSignal(x).storeId===layout.storeId)).toBe(true);
    expect(sumMetricInWindow(signals,METRICS.salesAmount,s.at,60).sum*100).toBeCloseTo(s.current.revenueCents,5);
    expect(Math.abs(sumMetricInWindow(signals,METRICS.salesAmount,s.at,15).sum*100-s.current.revenueCents/4)).toBeLessThanOrEqual(s.zones.length);
    expect(sumMetricInWindow(signals,METRICS.trafficCount,s.at,60).sum).toBe(s.current.entrants);
    expect(signals.some(x=>x.metric===METRICS.stockLevel)).toBe(false);
    const projected=projectTwinState(signals,layout,s.at);
    for (const c of s.checkouts) expect(projected.zones[c.zoneId]?.kpis[METRICS.queueLength]?.value).toBe(c.queueLength);
    expect(projected.alerts.some(a=>a.zoneId==='zone-checkout_n'&&a.severity==='CRITICAL')).toBe(true);
  });
});
