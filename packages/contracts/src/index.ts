import { z } from 'zod';

/**
 * YH-TwinOps v3 共享契约（PRD §5.2 / §6.2）。
 *
 * 信号分级是整个系统的强制词汇：OBSERVED 来自数据源的观测，ESTIMATED 是算法推断，
 * SIMULATED 是情景推演，UNKNOWN 表示未覆盖/离线/过期。synthetic 维度独立于 kind：
 * 合成数据可以走 OBSERVED 的处理链路，但来源永远标明"合成观测"。
 */

export const SIGNAL_KINDS = ['OBSERVED', 'ESTIMATED', 'SIMULATED', 'UNKNOWN'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const SIGNAL_DOMAINS = ['POS', 'TRAFFIC', 'QUEUE', 'STOCK', 'EQUIPMENT', 'STAFF', 'INCIDENT'] as const;
export type SignalDomain = (typeof SIGNAL_DOMAINS)[number];

export const ALERT_SEVERITIES = ['INFO', 'WARNING', 'CRITICAL', 'UNKNOWN'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** 全店 KPI 的标准指标名。适配器必须映射到这些键，投影与 Agent 按键聚合。 */
export const METRICS = {
  salesAmount: 'sales_amount',
  trafficCount: 'traffic_count',
  queueLength: 'queue_length',
  queueWaitMin: 'queue_wait_min',
  checkoutServiceRate: 'checkout_service_rate_per_lane_per_min',
  checkoutArrivalsPerMin: 'checkout_arrivals_per_min',
  checkoutLanesOpen: 'checkout_lanes_open',
  stockLevel: 'stock_level',
  equipmentTempC: 'equipment_temp_c',
  equipmentOnline: 'equipment_online',
  staffCount: 'staff_count',
  /** 持收银操作资格的在岗人数（岗位资格约束的数据来源，AT-05）。 */
  checkoutQualifiedStaff: 'checkout_qualified_staff_count',
} as const;
export type MetricKey = (typeof METRICS)[keyof typeof METRICS];

const isoTimestamp = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: '必须是可解析的 ISO 时间戳' });

const inUnitInterval = z.number().min(0).max(1);

/**
 * 孪生信号：一切进入系统的观测/估计/模拟值的唯一载体。
 * UNKNOWN 不许填假数（value 必为 null）；SIMULATED 必须可追溯到情景与模型版本；
 * ESTIMATED 必须给出可解释的置信度。
 */
export const twinSignalSchema = z
  .object({
    id: z.string().min(1),
    storeId: z.string().min(1),
    zoneId: z.string().min(1).optional(),
    fixtureId: z.string().min(1).optional(),
    domain: z.enum(SIGNAL_DOMAINS).optional(),
    metric: z.string().min(1),
    unit: z.string().min(1),
    value: z.number().finite().nullable(),
    kind: z.enum(SIGNAL_KINDS),
    synthetic: z.boolean(),
    sourceId: z.string().min(1),
    observedAt: isoTimestamp,
    ingestedAt: isoTimestamp,
    validUntil: isoTimestamp.optional(),
    coverage: inUnitInterval,
    confidence: inUnitInterval.optional(),
    modelVersion: z.string().min(1).optional(),
    scenarioId: z.string().min(1).optional(),
    evidenceIds: z.array(z.string()).default([]),
  })
  .superRefine((signal, ctx) => {
    if (signal.kind === 'UNKNOWN' && signal.value !== null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'UNKNOWN 信号不许填假数，value 必须为 null' });
    }
    if (signal.kind !== 'UNKNOWN' && signal.value === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: '非 UNKNOWN 信号必须有数值' });
    }
    if (signal.kind === 'SIMULATED' && (!signal.scenarioId || !signal.modelVersion)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scenarioId'], message: 'SIMULATED 信号必须带 scenarioId 与 modelVersion' });
    }
    if (signal.kind === 'ESTIMATED' && signal.confidence === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confidence'], message: 'ESTIMATED 信号必须带 confidence（可解释方法）' });
    }
  });

export type TwinSignal = z.infer<typeof twinSignalSchema>;

export function parseTwinSignal(input: unknown): TwinSignal {
  return twinSignalSchema.parse(input);
}

export function isTwinSignal(input: unknown): input is TwinSignal {
  return twinSignalSchema.safeParse(input).success;
}

/** 业务区类型（PRD §6.1 的业态清单，教学压测词汇）。 */
export const ZONE_TYPES = [
  'ENTRANCE',
  'PRODUCE',
  'MEAT',
  'SEAFOOD',
  'DELI',
  'BAKERY',
  'DAIRY',
  'FROZEN',
  'BEVERAGE',
  'GROCERY',
  'SNACKS',
  'HOUSEHOLD',
  'CHECKOUT',
  'SERVICE',
  'BACKROOM',
  'RECEIVING',
  'COLDROOM',
  'STAFF',
  'EGRESS',
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export const FIXTURE_TYPES = ['GONDOLA', 'PRODUCE_ISLAND', 'DELI_COUNTER', 'FREEZER', 'CHECKOUT', 'DOOR', 'OTHER'] as const;
export type FixtureType = (typeof FIXTURE_TYPES)[number];

export const zoneSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(1),
  zoneType: z.enum(ZONE_TYPES),
  polygonM: z.array(z.tuple([z.number(), z.number()])).min(3).optional(),
});

export const fixtureSchema = z.object({
  fixtureId: z.string().min(1),
  zoneId: z.string().min(1),
  fixtureType: z.enum(FIXTURE_TYPES),
  assetId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  rotationY: z.number(),
  widthM: z.number().positive(),
  depthM: z.number().positive(),
  heightM: z.number().positive(),
  fixed: z.boolean(),
  capacity: z.number().int().nonnegative().optional(),
  categoryIds: z.array(z.string()).default([]),
});

export type Zone = z.infer<typeof zoneSchema>;
export type Fixture = z.infer<typeof fixtureSchema>;

/**
 * 门店布局唯一事实源。v3 的布局全部是合成教学数据，synthetic 必须为 true，
 * 尺寸为教学压测假设而非真实门店测量。
 */
export const storeLayoutSchema = z
  .object({
    storeId: z.string().min(1),
    name: z.string().min(1),
    synthetic: z.boolean(),
    widthM: z.number().positive(),
    depthM: z.number().positive(),
    zones: z.array(zoneSchema).min(1),
    fixtures: z.array(fixtureSchema),
  })
  .superRefine((layout, ctx) => {
    if (!layout.synthetic) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['synthetic'], message: 'v3 布局必须是合成教学数据（synthetic: true）' });
    }
    const zoneIds = new Set<string>();
    for (const zone of layout.zones) {
      if (zoneIds.has(zone.zoneId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['zones'], message: `分区 ID 重复：${zone.zoneId}` });
      }
      zoneIds.add(zone.zoneId);
    }
    const fixtureIds = new Set<string>();
    for (const fixture of layout.fixtures) {
      if (fixtureIds.has(fixture.fixtureId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixtures'], message: `设施 ID 重复：${fixture.fixtureId}` });
      }
      fixtureIds.add(fixture.fixtureId);
      if (!zoneIds.has(fixture.zoneId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixtures'], message: `设施 ${fixture.fixtureId} 指向不存在的分区 ${fixture.zoneId}` });
      }
    }
  });

export type StoreLayout = z.infer<typeof storeLayoutSchema>;

export function parseStoreLayout(input: unknown): StoreLayout {
  return storeLayoutSchema.parse(input);
}

/** 单条 KPI 读数：投影后某分区/设施某指标的最新可用值。scope 标明口径：分区级聚合还是单个设施。 */
export const kpiReadingSchema = z.object({
  metric: z.string().min(1),
  unit: z.string().min(1),
  value: z.number().nullable(),
  kind: z.enum(SIGNAL_KINDS),
  synthetic: z.boolean(),
  sourceId: z.string().min(1),
  observedAt: isoTimestamp,
  freshnessMin: z.number().nonnegative().nullable(),
  stale: z.boolean(),
  staleReason: z.enum(['stale', 'expired', 'no-data', 'offline']).nullable(),
  /** 过期/离线时保留的最后一次可用值，仅供追溯，不参与决策。 */
  lastValue: z.number().nullable(),
  confidence: inUnitInterval.nullable(),
  coverage: inUnitInterval,
  scope: z.enum(['zone', 'fixture']),
  evidenceIds: z.array(z.string()),
});
export type KpiReading = z.infer<typeof kpiReadingSchema>;

/** 只有 decision-usable 的读数才能进入告警、Agent 数值与仿真基线。 */
export function isDecisionUsable(reading: KpiReading | undefined): reading is KpiReading & { value: number } {
  return reading !== undefined && reading.kind !== 'UNKNOWN' && !reading.stale && reading.value !== null;
}

export const alertSchema = z.object({
  alertId: z.string().min(1),
  severity: z.enum(ALERT_SEVERITIES),
  zoneId: z.string().min(1),
  metric: z.string().min(1),
  rule: z.string().min(1),
  reason: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
  raisedAt: isoTimestamp,
  suggestedRole: z.string().min(1),
});
export type Alert = z.infer<typeof alertSchema>;

export const zoneCoverageSchema = z.object({
  totalSignals: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(),
  unknownCount: z.number().int().nonnegative(),
  lastObservedAt: isoTimestamp.nullable(),
  freshnessMin: z.number().nonnegative().nullable(),
});
export type ZoneCoverage = z.infer<typeof zoneCoverageSchema>;

export const zoneStateSchema = z.object({
  zoneId: z.string().min(1),
  zoneType: z.enum(ZONE_TYPES),
  kpis: z.record(z.string(), kpiReadingSchema),
  fixtures: z.record(
    z.string(),
    z.object({
      fixtureId: z.string().min(1),
      fixtureType: z.enum(FIXTURE_TYPES),
      capacity: z.number().int().nonnegative().nullable(),
      kpis: z.record(z.string(), kpiReadingSchema),
    }),
  ),
  coverage: zoneCoverageSchema,
});
export type ZoneState = z.infer<typeof zoneStateSchema>;

export const twinSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  storeId: z.string().min(1),
  atTime: isoTimestamp,
  zones: z.record(z.string(), zoneStateSchema),
  alerts: z.array(alertSchema),
  coverage: z.object({
    totalSignals: z.number().int().nonnegative(),
    dedupedSignals: z.number().int().nonnegative(),
    ignoredFutureSignals: z.number().int().nonnegative(),
    syntheticSignals: z.number().int().nonnegative(),
    sources: z.array(z.string()),
    storeLastObservedAt: isoTimestamp.nullable(),
    storeFreshnessMin: z.number().nonnegative().nullable(),
    staleCount: z.number().int().nonnegative(),
    unknownCount: z.number().int().nonnegative(),
  }),
});
export type TwinSnapshot = z.infer<typeof twinSnapshotSchema>;
