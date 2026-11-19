import { METRICS, type TwinSignal } from '@yh/contracts';
import { layout } from './data';
import { buildOperatingScenario, inventoryAtBusinessMinutes, type OperatingDay, type OperatingHour, type OperatingKpis, type OperatingScenario } from './operatingModel';

export interface LiveOperatingScenario extends OperatingScenario {
  mode: 'live';
  status: 'preopen' | 'open' | 'closed';
  minuteOfDay: number;
  elapsedMinutes: number;
  completedHours: number;
  forecastDaily: OperatingKpis;
  cumulative: OperatingKpis;
  actualSeries: OperatingHour[];
}
const MINUTE = 60_000;
const OPEN = 8 * 60;
const CLOSE = 22 * 60;
const MODEL = 'synthetic-teaching-clock-v1';
const DAY_REFS = new Map<OperatingDay, OperatingScenario[]>();

function rows(day: OperatingDay): OperatingScenario[] {
  const cached = DAY_REFS.get(day);
  if (cached) return cached;
  const result = Array.from({length: 14}, (_, i) => buildOperatingScenario(day, i + 8));
  DAY_REFS.set(day, result);
  return result;
}

function kpis(entrants: number, transactions: number, revenueCents: number): OperatingKpis {
  return { entrants, transactions, revenueCents, conversion: entrants ? transactions / entrants : 0, basketCents: transactions ? Math.round(revenueCents / transactions) : 0 };
}

// A fixed number of integer observations per elapsed minute; no resampling when the UI refreshes.
function partial(full: OperatingHour, minute: number): OperatingHour {
  if (minute === 60) return full;
  const entrants = Math.floor(full.entrants * minute / 60);
  const transactions = Math.floor(full.transactions * minute / 60);
  return { ...full, ...kpis(entrants, transactions, transactions * full.basketCents),
    occupancy: Math.round(full.occupancy * Math.min(1, minute / full.averageDwellMin)) };
}

// Order each department's N increments across its full-hour quota. Taking a prefix then
// guarantees monotonic department counts and exact agreement at the end of the hour.
const plans = new WeakMap<number[], number[]>();
function apportionedPrefix(total: number, quotas: number[]) {
  let schedule = plans.get(quotas);
  if (!schedule) {
    schedule = quotas.flatMap((n, index) => Array.from({length: n}, (_, j) => ({index, rank: (j + .5) / n})))
      .sort((a, b) => a.rank - b.rank || a.index - b.index).map(item => item.index);
    plans.set(quotas, schedule);
  }
  const result = quotas.map(() => 0);
  for (const index of schedule.slice(0, total)) result[index]!++;
  return result;
}

const quotaCache = new WeakMap<OperatingScenario, { traffic:number[]; receipts:number[] }>();
function quotasFor(base: OperatingScenario) {
  const cached = quotaCache.get(base);
  if (cached) return cached;
  const result = {traffic:base.zones.map(z => z.entrants), receipts:base.checkouts.map(c => c.transactions)};
  quotaCache.set(base, result);
  return result;
}

function salesPrefix(base: OperatingScenario, cents: number) {
  const full = base.current.revenueCents;
  let distributed = 0;
  let quotas = 0;
  // Difference of cumulative weighted targets conserves cents, including the final cent.
  return base.zones.map(zone => {
    quotas += zone.revenueCents;
    const next = Math.floor(quotas * cents / full);
    const result = next - distributed;
    distributed = next;
    return result;
  });
}

export function buildLiveOperatingScenario(now: Date): LiveOperatingScenario {
  const timestamp = Math.floor(now.getTime() / MINUTE) * MINUTE;
  const china = new Date(timestamp + 8 * 60 * MINUTE);
  const date = china.toISOString().slice(0, 10);
  const weekday = china.getUTCDay();
  const day = weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
  const minuteOfDay = china.getUTCHours() * 60 + china.getUTCMinutes();
  const elapsed = Math.max(0, Math.min(CLOSE - OPEN, minuteOfDay - OPEN));
  const status = minuteOfDay < OPEN ? 'preopen' : minuteOfDay >= CLOSE ? 'closed' : 'open';
  const completedHours = Math.floor(elapsed / 60);
  const base = rows(day)[Math.min(13, completedHours)]!;
  const elapsedMinutes = status === 'closed' ? 60 : elapsed % 60;
  const hourToDate = partial(base.current, elapsedMinutes);
  // Approximate concurrent occupancy by arrivals during the active hour's dwell window.
  // Carry preceding-hour arrivals across the tick so the store does not empty at :00.
  const previous = completedHours > 0 ? rows(day)[completedHours - 1] : undefined;
  const dwell = base.current.averageDwellMin;
  const occupancy = status === 'open'
    ? hourToDate.entrants - partial(base.current, Math.max(0, elapsedMinutes - dwell)).entrants
      + (previous && elapsedMinutes < dwell
        ? previous.current.entrants - partial(previous.current, 60 + elapsedMinutes - dwell).entrants : 0)
    : 0;
  const current = { ...hourToDate, occupancy };
  const actualSeries = base.series.slice(0, completedHours);
  if (status === 'open' && elapsedMinutes > 0) actualSeries.push(current);
  const cumulative = kpis(actualSeries.reduce((s, r) => s+r.entrants, 0), actualSeries.reduce((s, r) => s+r.transactions, 0), actualSeries.reduce((s, r) => s+r.revenueCents, 0));
  const quotas = quotasFor(base);
  const traffic = apportionedPrefix(current.entrants, quotas.traffic);
  const sales = salesPrefix(base, current.revenueCents);
  const receipts = apportionedPrefix(current.transactions, quotas.receipts);
  const ramp = Math.min(1, elapsedMinutes / dwell);
  const checkouts = base.checkouts.map((row, i) => {
    const prior = previous?.checkouts[i];
    const arrivalRatePerMin = status === 'open' ? (prior?.arrivalRatePerMin ?? 0) * (1 - ramp) + row.arrivalRatePerMin * ramp : 0;
    const queueLength = status === 'open' ? Math.round((prior?.queueLength ?? 0) * (1 - ramp) + row.queueLength * ramp) : 0;
    const lanesOpen = status === 'open' ? row.lanesOpen : 0;
    return { ...row, transactions:receipts[i]!, arrivalRatePerMin, queueLength, lanesOpen,
      waitMin: arrivalRatePerMin ? Number((queueLength / arrivalRatePerMin).toFixed(1)) : 0,
      capacityPerMin:status === 'open' ? row.capacityPerMin : 0 };
  });
  const checkoutPeople = checkouts.map(row => Math.min(occupancy, row.queueLength + Math.ceil(row.arrivalRatePerMin / row.serviceRatePerLane)));
  const checkoutPeopleTotal = checkoutPeople.reduce((a,b) => a+b, 0);
  // At low volumes a rounded checkout estimate is bounded by total concurrent occupancy.
  const allowedCheckoutPeople = Math.min(occupancy, checkoutPeopleTotal);
  const retailPeople = occupancy - allowedCheckoutPeople;
  const retailBase = base.zones.filter(z => !checkouts.some(c => z.zoneId === c.zoneId)).reduce((a,z) => a+z.occupancy, 0);
  let weights = 0, assigned = 0, queueWeights = 0, queueAssigned = 0;
  const zones = base.zones.map((zone, i) => {
    const checkoutIndex = checkouts.findIndex(row => row.zoneId === zone.zoneId);
    let people: number;
    if (checkoutIndex < 0) {
      weights += zone.occupancy;
      const next = Math.round(weights * retailPeople / retailBase);
      people = next - assigned;
      assigned = next;
    } else {
      queueWeights += checkoutPeople[checkoutIndex]!;
      const next = checkoutPeopleTotal ? Math.round(queueWeights * allowedCheckoutPeople / checkoutPeopleTotal) : 0;
      people = next - queueAssigned;
      queueAssigned = next;
    }
    return { ...zone, occupancy:people, entrants:traffic[i]!, revenueCents:sales[i]! };
  });
  return {
    ...base, date, at:new Date(timestamp).toISOString(), mode:'live', status, minuteOfDay, elapsedMinutes, completedHours,
    current, actualSeries, cumulative, forecastDaily:base.daily, zones, checkouts,
    // Use shared model parameters: see opening and per-minute in operatingModel.
    inventory:base.inventory.map((_, i) => inventoryAtBusinessMinutes(day, elapsed, i)),
  };
}


/** Minute increments are stable across refreshes. Include only the most recent simulated hour, never a future row. */
export function liveOperatingSignals(scenario: LiveOperatingScenario): TwinSignal[] {
  const asOf = Date.parse(scenario.at);
  const start = Date.parse(`${scenario.date}T08:00:00+08:00`);
  const end = Math.min(asOf, start + (CLOSE - OPEN) * MINUTE);
  const signals: TwinSignal[] = [];
  const add = (zoneId: string, metric: string, unit: string, value: number, at: number) => {
    signals.push({id:`${MODEL}-${at}-${zoneId}-${metric}`, storeId:layout.storeId, zoneId,metric,unit,value,
      kind:'SIMULATED',synthetic:true,sourceId:MODEL,scenarioId:`${MODEL}-${scenario.date}`,modelVersion:MODEL,
      observedAt:new Date(at - 1000).toISOString(),ingestedAt:new Date(at).toISOString(),coverage:1,evidenceIds:[]});
  };
  for (let stamp = Math.max(start + MINUTE, asOf - 59 * MINUTE); stamp <= end; stamp += MINUTE) {
    const elapsed = (stamp - start) / MINUTE - 1;
    const base = rows(scenario.day)[Math.floor(elapsed / 60)]!;
    const minute = elapsed % 60 + 1;
    const a = partial(base.current, minute - 1), b = partial(base.current, minute);
    const quota = quotasFor(base).traffic;
    const beforeTraffic = apportionedPrefix(a.entrants, quota), afterTraffic = apportionedPrefix(b.entrants, quota);
    const beforeSales = salesPrefix(base, a.revenueCents), afterSales = salesPrefix(base, b.revenueCents);
    base.zones.forEach((zone, i) => {
      if (zone.entrants) add(zone.zoneId,METRICS.trafficCount,'人/分钟（主分区进店分配）',afterTraffic[i]! - beforeTraffic[i]!,stamp);
      if (zone.revenueCents) add(zone.zoneId,METRICS.salesAmount,'元/分钟',(afterSales[i]! - beforeSales[i]!) / 100,stamp);
    });
  }
  if (scenario.status === 'open' && asOf > start) for (const c of scenario.checkouts) {
    add(c.zoneId,METRICS.queueLength,'人',c.queueLength,asOf);
    add(c.zoneId,METRICS.queueWaitMin,'分钟',c.waitMin,asOf);
    add(c.zoneId,METRICS.checkoutArrivalsPerMin,'人/分钟',c.arrivalRatePerMin,asOf);
    add(c.zoneId,METRICS.checkoutServiceRate,'人/分钟/通道',c.serviceRatePerLane,asOf);
    add(c.zoneId,METRICS.checkoutLanesOpen,'条',c.lanesOpen,asOf);
    add(c.zoneId,METRICS.staffCount,'人',c.lanesOpen,asOf);
    add(c.zoneId,METRICS.checkoutQualifiedStaff,'人',c.zoneId === 'zone-checkout_n' ? 1 : 0,asOf);
  }
  return signals;
}
