import { METRICS, type TwinSignal } from '@yh/contracts';
import { layout } from './data';

export type OperatingDay = 'weekday' | 'weekend';
export const OPERATING_HOURS = Array.from({ length: 14 }, (_, i) => i + 8);
export interface OperatingKpis {
  entrants: number; transactions: number; conversion: number; basketCents: number; revenueCents: number;
}
export interface OperatingHour extends OperatingKpis { hour: number; occupancy: number; averageDwellMin: number }
export interface OperatingZone { zoneId: string; name: string; occupancy: number; averageDwellMin: number; revenueCents: number; entrants: number }
export interface OperatingCheckout {
  zoneId: string; name: string; transactions: number; queueLength: number; waitMin: number;
  arrivalRatePerMin: number; serviceRatePerLane: number; lanesOpen: number; capacityPerMin: number;
}
export interface OperatingInventory {
  sku: string; name: string; zoneId: string; onHand: number; reorderPoint: number;
  suggestedOrder: number; status: 'normal' | 'low' | 'out'; unit: string;
}
export interface OperatingScenario {
  day: OperatingDay; hour: number; date: string; timezone: string; at: string; synthetic: true; provenance: string;
  series: OperatingHour[]; current: OperatingHour; daily: OperatingKpis; zones: OperatingZone[];
  checkouts: OperatingCheckout[]; inventory: OperatingInventory[];
}
const ENTRANTS: Record<OperatingDay, readonly number[]> = {
  weekday: [104,150,188,225,278,204,174,199,273,405,539,467,331,175],
  weekend: [139,205,275,365,418,342,319,341,385,489,579,529,387,203],
};
const DATES = { weekday: '2026-11-13', weekend: '2026-11-15' };
// Illustrative allocation only: the four fresh/prepared departments total 45.4 parts of 100.
// This is a model grouping, not an assertion about the issuer's reporting taxonomy or zone-level sales.
const SHARES: Record<string, readonly [number, number, number]> = {
  'zone-produce': [19,16.4,7.4], 'zone-meat':[7,12,4.2], 'zone-seafood':[4,7,3.8],
  'zone-deli':[7,10,4.5], 'zone-bakery':[6,7,3.4], 'zone-beverages':[8,7,3.5],
  'zone-featured':[5,5,3.2], 'zone-bulk':[5,5,3.6], 'zone-frozen':[5,5,3.1],
  'zone-packaged':[15,12.6,6.3], 'zone-household':[8,6,5.2], 'zone-daily':[9,7,4.1],
  'zone-rest':[2,0,5], 'zone-backroom':[0,0,0],
};
const INVENTORY = [
  ['DEMO-P01','精品番茄 500g','zone-produce',104,8,31,64,'盒'],
  ['DEMO-D01','鲜牛奶 950mL','zone-daily',96,6,22,48,'瓶'],
  ['DEMO-B01','原味吐司 400g','zone-bakery',59,5,16,36,'袋'],
  ['DEMO-G01','茉莉香米 5kg','zone-packaged',114,3,18,44,'袋'],
  ['DEMO-F01','速冻水饺 500g','zone-frozen',82,5,18,42,'袋'],
] as const;
const round = (n: number, precision = 2) => Number(n.toFixed(precision));
function allocate(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map(w => total * w / sum);
  const result = exact.map(Math.floor);
  const ranks = exact.map((v, i) => ({ i, fraction: v - result[i]! })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  ranks.slice(0, total - result.reduce((a, b) => a + b, 0)).forEach(({i}) => { result[i]! += 1; });
  return result;
}
function kpis(entrants: number, transactions: number, revenueCents: number): OperatingKpis {
  return { entrants, transactions, revenueCents, conversion: entrants ? transactions / entrants : 0, basketCents: transactions ? Math.round(revenueCents / transactions) : 0 };
}
function hourRow(day: OperatingDay, hour: number): OperatingHour {
  const entrants = ENTRANTS[day][hour - 8]!;
  const weekend = day === 'weekend';
  const transactions = Math.round(entrants * (.708 + (hour >= 16 && hour <= 20 ? .014 : 0) + (weekend ? .015 : 0) + ((hour * 7) % 5) * .006));
  const averageDwellMin = 24 + (weekend ? 5 : 0) + (hour >= 16 && hour <= 20 ? 4 : 0);
  const basket = 8200 + (weekend ? 710 : 0) + (hour >= 16 && hour <= 20 ? 380 : 0) + ((hour * 127) % 740);
  return { ...kpis(entrants, transactions, transactions * basket), hour, occupancy: Math.round(entrants * averageDwellMin / 60), averageDwellMin };
}
export function inventoryAtBusinessMinutes(day: OperatingDay, elapsed: number, index: number): OperatingInventory {
  const [sku, name, zoneId, opening, rate, reorderPoint, target, unit] = INVENTORY[index]!;
  const onHand = Math.max(0, opening - Math.round((elapsed / 60) * rate * (day === 'weekend' ? 1.18 : 1)));
  return { sku,name,zoneId,onHand,reorderPoint,unit,status:onHand === 0 ? 'out' : onHand <= reorderPoint ? 'low' : 'normal', suggestedOrder:onHand <= reorderPoint ? target-onHand : 0 };
}
export function buildOperatingScenario(day: OperatingDay, hour: number): OperatingScenario {
  if ((day !== 'weekday' && day !== 'weekend') || !OPERATING_HOURS.includes(hour)) throw new RangeError('Expected weekday/weekend and a business hour from 08 to 21');
  const date = DATES[day], timezone = 'Asia/Shanghai (UTC+08:00)';
  // Hour denotes the start of [hour, hour + 1); as-of denotes its completed end.
  const at = new Date(`${date}T${String(hour+1).padStart(2,'0')}:00:00+08:00`).toISOString();
  const series = OPERATING_HOURS.map(h => hourRow(day, h));
  const current = series[hour - 8]!;
  const total = (key: 'entrants' | 'transactions' | 'revenueCents') => series.reduce((v, row) => v + row[key], 0);
  const daily = kpis(total('entrants'), total('transactions'), total('revenueCents'));
  const checkoutZones = layout.zones.filter(z => z.zoneType === 'CHECKOUT');
  const distribution = allocate(current.transactions, [49, 27, 24]);
  const checkouts = checkoutZones.map((z, i): OperatingCheckout => {
    const transactions = distribution[i]!;
    const serviceRatePerLane = [1.2,1.25,1.15][i]!;
    const arrivalRatePerMin = transactions / 60;
    const lanesOpen = Math.max(1, Math.ceil(arrivalRatePerMin / (serviceRatePerLane * .83)));
    const capacityPerMin = round(lanesOpen * serviceRatePerLane);
    const queueLength = Math.round(Math.max(0, arrivalRatePerMin * (1 + (i === 0 && hour >= 17 && hour <= 19 ? 4 : 0)) - (i ? .4 : 0)));
    return { zoneId:z.zoneId, name:z.name, transactions, queueLength, waitMin: arrivalRatePerMin > 0 ? round(queueLength / arrivalRatePerMin, 1) : 0, arrivalRatePerMin, serviceRatePerLane, lanesOpen, capacityPerMin };
  });
  const nonCheckout = layout.zones.filter(z => z.zoneType !== 'CHECKOUT');
  const checkoutOccupancy = checkouts.map(c => c.queueLength + Math.ceil(c.arrivalRatePerMin / c.serviceRatePerLane));
  const people = allocate(current.occupancy - checkoutOccupancy.reduce((a,b)=>a+b,0), nonCheckout.map(z => SHARES[z.zoneId]?.[0] ?? 0));
  const traffic = allocate(current.entrants, nonCheckout.map(z => SHARES[z.zoneId]?.[0] ?? 0));
  const sales = allocate(current.revenueCents, nonCheckout.map(z => SHARES[z.zoneId]?.[1] ?? 0));
  const zones = nonCheckout.map((z, i): OperatingZone => ({zoneId:z.zoneId, name:z.name, occupancy:people[i]!, entrants:traffic[i]!, averageDwellMin:SHARES[z.zoneId]?.[2] ?? 0,revenueCents:sales[i]!}));
  checkouts.forEach((c,i)=>zones.push({zoneId:c.zoneId,name:c.name,occupancy:checkoutOccupancy[i]!,entrants:0,averageDwellMin:round(c.waitMin+1/c.serviceRatePerLane,1),revenueCents:0}));
  const inventory = INVENTORY.map((_, i) => inventoryAtBusinessMinutes(day, (hour + 1 - 8) * 60, i));
  return {day,hour,date,timezone,at,synthetic:true,provenance:'确定性教学假设 · 非永辉实测 · 非实时 · 3D 人物不计入运营指标',series,current,daily,zones,checkouts,inventory};
}

/** App adapter: 15-minute incremental POS/counter signals sum to the selected hour;
 * manual zone occupancy is an hourly mean estimate, NOT an additive traffic metric. */
export function operatingSignals(scenario: OperatingScenario): TwinSignal[] {
  const source = 'synthetic-teaching-operations-v1';
  const signals: TwinSignal[] = [];
  const add = (zoneId: string, metric: string, unit: string, value: number, minutesBeforeEnd = 1) => {
    const observedAt = new Date(Date.parse(scenario.at) - minutesBeforeEnd * 60_000).toISOString();
    signals.push({ id:`${source}-${scenario.day}-${scenario.hour}-${zoneId}-${metric}-${minutesBeforeEnd}`, storeId:layout.storeId, zoneId, metric,unit,value,kind:'OBSERVED',synthetic:true,sourceId:source,observedAt,ingestedAt:new Date(Date.parse(observedAt)+1000).toISOString(),coverage:1,evidenceIds:[] });
  };
  for (const z of scenario.zones) {
    if (z.entrants) allocate(z.entrants,[23,24,25,28]).forEach((v,i)=>add(z.zoneId,METRICS.trafficCount,'人/15分钟（主分区进店分配）',v,46-i*15));
    if (z.revenueCents) allocate(z.revenueCents,[1,1,1,1]).forEach((v,i)=>add(z.zoneId,METRICS.salesAmount,'元/15分钟（小时均分）',v/100,46-i*15));
  }
  for (const c of scenario.checkouts) {
    add(c.zoneId,METRICS.queueLength,'人',c.queueLength);
    add(c.zoneId,METRICS.queueWaitMin,'分钟',c.waitMin);
    add(c.zoneId,METRICS.checkoutArrivalsPerMin,'人/分钟',c.arrivalRatePerMin);
    add(c.zoneId,METRICS.checkoutServiceRate,'人/分钟/通道',c.serviceRatePerLane);
    add(c.zoneId,METRICS.checkoutLanesOpen,'条',c.lanesOpen);
    add(c.zoneId,METRICS.staffCount,'人',c.lanesOpen);
    add(c.zoneId,METRICS.checkoutQualifiedStaff,'人',c.zoneId === 'zone-checkout_n' ? 1 : 0);
  }
  // SKU inventory stays on the dashboard; the legacy stockLevel contract is zone-wide.
  add('zone-frozen',METRICS.equipmentOnline,'布尔',1);
  add('zone-frozen',METRICS.equipmentTempC,'°C',-18.2);
  add('zone-daily',METRICS.equipmentTempC,'°C',2.4);
  return signals;
}
