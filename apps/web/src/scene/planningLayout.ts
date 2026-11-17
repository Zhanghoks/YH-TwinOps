import { parseStoreLayout, type Fixture, type StoreLayout } from '@yh/contracts';

/** Geometric planning hypotheses only, NOT fire-code / customer-flow certification. */
const AISLE_M = 4;
const FIXTURE_GAP_M = 1.2;
const ZONE_GAP_M = 2;
const CROSS_AISLE_M = 3;
const MIN_GAP_M = .3;
const EDGE_M = 1;

interface Bounds { x0: number; x1: number; z0: number; z1: number }
export interface PlanningValidation { issues: string[]; minimumGapM: number | null }
export interface PlanningChange {
  fixtureId: string;
  from: { x: number; z: number; rotationY: number };
  to: { x: number; z: number; rotationY: number };
}
export interface PlanningReport {
  valid: true;
  fixtureCount: number;
  movedFixtureCount: number;
  minimumGapM: number | null;
  centralAisleWidthM: number;
  crossAisle: { z0: number; z1: number; widthM: number };
  departmentBounds: { zoneId: string; bounds: Bounds }[];
  changes: PlanningChange[];
  notes: string[];
}

function bounds(f: Fixture): Bounds {
  const c = Math.abs(Math.cos(f.rotationY)), s = Math.abs(Math.sin(f.rotationY));
  const w = c * f.widthM + s * f.depthM, d = s * f.widthM + c * f.depthM;
  return { x0: f.x - w / 2, x1: f.x + w / 2, z0: f.z - d / 2, z1: f.z + d / 2 };
}

/** Conservative axis-aligned clearances. No path finding, access-door or fire-code claim. */
export function validatePlanningLayout(layout: StoreLayout): PlanningValidation {
  const issues: string[] = [];
  const boxes = layout.fixtures.map(bounds);
  let minimumGapM = Infinity;
  boxes.forEach((b, i) => {
    const f = layout.fixtures[i];
    if (f === undefined) return;
    if (![b.x0, b.x1, b.z0, b.z1].every(Number.isFinite)) issues.push(`${f.fixtureId} 非有限几何`);
    if (b.x0 < -layout.widthM / 2 - 1e-8 || b.x1 > layout.widthM / 2 + 1e-8 || b.z0 < -layout.depthM / 2 - 1e-8 || b.z1 > layout.depthM / 2 + 1e-8) issues.push(`${f.fixtureId} 超出门店边界`);
    if (b.x0 < AISLE_M / 2 - 1e-8 && b.x1 > -AISLE_M / 2 + 1e-8) issues.push(`${f.fixtureId} 占用中央主通道`);
    for (let j = i + 1; j < boxes.length; j++) {
      const other = boxes[j];
      if (other === undefined) continue;
      const dx = Math.max(0, b.x0 - other.x1, other.x0 - b.x1);
      const dz = Math.max(0, b.z0 - other.z1, other.z0 - b.z1);
      const gap = Math.hypot(dx, dz);
      minimumGapM = Math.min(minimumGapM, gap);
      if (gap < MIN_GAP_M - 1e-8) issues.push(`${f.fixtureId}/${layout.fixtures[j]?.fixtureId ?? j} 间距不足 ${MIN_GAP_M}m`);
    }
  });
  return { issues, minimumGapM: Number.isFinite(minimumGapM) ? Math.round(minimumGapM * 1000) / 1000 : null };
}

interface PackedZone { fixtures: Fixture[]; depthM: number }
/** Stable shelf-packing within one department. Preserves every fixture's dimensions and metadata. */
function packZone(fixtures: Fixture[], x0: number, z0: number, widthM: number, maxPerRow = Infinity): PackedZone {
  let x = 0, z = 0, rowDepth = 0, rowCount = 0;
  const placed: Fixture[] = [];
  for (const f of fixtures) {
    if (f.widthM > widthM + 1e-8) throw new Error(`${f.fixtureId} 宽度无法放入候选部门列；未生成候选`);
    if (x > 0 && (x + f.widthM > widthM + 1e-8 || rowCount >= maxPerRow)) { x = 0; z += rowDepth + FIXTURE_GAP_M; rowDepth = 0; rowCount = 0; }
    placed.push({ ...f, x: x0 + x + f.widthM / 2, z: z0 + z + f.depthM / 2, rotationY: 0, categoryIds: [...f.categoryIds] });
    x += f.widthM + FIXTURE_GAP_M;
    rowCount++;
    rowDepth = Math.max(rowDepth, f.depthM);
  }
  return { fixtures: placed, depthM: fixtures.length === 0 ? 0 : z + rowDepth };
}

/**
 * An independent, validated teaching candidate. This does NOT update approved layout or assets.
 * Existing fixed flags describe the prototype baseline: their exploratory moves are retained
 * in the diff and require human review before any implementation outside this preview.
 */
export function generatePlanningLayout(source: StoreLayout): { layout: StoreLayout; report: PlanningReport } {
  const input = parseStoreLayout(source);
  const wing = (input.widthM - EDGE_M * 2 - AISLE_M) / 2;
  const columnWidth = (wing - ZONE_GAP_M) / 2;
  if (columnWidth <= 0 || input.depthM < 20) throw new Error('门店尺寸不足以建立独立规划候选');
  const columns = [-input.widthM / 2 + EDGE_M, -AISLE_M / 2 - columnWidth, AISLE_M / 2, input.widthM / 2 - EDGE_M - columnWidth];
  const backZ = -input.depthM / 2 + EDGE_M;
  const frontZ = input.depthM / 2 - 8;
  const retailLimit = frontZ - CROSS_AISLE_M;
  // Anchor convenience retail before the cross-aisle, leaving open space rather than filling it.
  const frontRetail: Record<string, { column: number; startZ: number }> = {
    'zone-household': { column: 3, startZ: retailLimit - 11 },
    'zone-daily': { column: 2, startZ: retailLimit - 4 },
  };
  const columnLimits = columns.map(() => retailLimit);
  for (const [id, anchor] of Object.entries(frontRetail)) {
    if (input.fixtures.some((f) => f.zoneId === id)) columnLimits[anchor.column] = anchor.startZ - ZONE_GAP_M;
  }
  const nextZ = columns.map(() => backZ);
  // Keep fresh-food departments together, with ambient retail to the east; no brands inferred.
  const preferred: Record<string, number> = {
    'zone-seafood': 0, 'zone-meat': 0, 'zone-deli': 0, 'zone-bakery': 0,
    'zone-produce': 1, 'zone-bulk': 1, 'zone-featured': 1,
    'zone-packaged': 2, 'zone-household': 3,
    'zone-frozen': 3, 'zone-beverages': 3, 'zone-daily': 3, 'zone-backroom': 3,
  };
  const front: Record<string, number> = { 'zone-checkout_n': 0, 'zone-checkout_s': 1, 'zone-checkout_e': 2, 'zone-rest': 3 };
  const placements = new Map<string, Fixture>();
  // Reserve the rear service department first, independently of source zone ordering.
  const orderedZones = [...input.zones].sort((a, b) => Number(b.zoneId === 'zone-backroom') - Number(a.zoneId === 'zone-backroom'));
  for (const zone of orderedZones) {
    const members = input.fixtures.filter((f) => f.zoneId === zone.zoneId);
    if (members.length === 0) continue;
    const frontColumn = front[zone.zoneId];
    const preferredColumn = preferred[zone.zoneId];
    const retailAnchor = frontRetail[zone.zoneId];
    const candidateColumns = frontColumn !== undefined ? [frontColumn]
      : retailAnchor !== undefined ? [retailAnchor.column]
      : zone.zoneId === 'zone-backroom' ? [3]
      : [...new Set([...(preferredColumn === undefined ? [] : [preferredColumn]), ...[0, 1, 2, 3].sort((a, b) => (nextZ[a] ?? 0) - (nextZ[b] ?? 0))])];
    let chosen: { packed: PackedZone; column: number; startZ: number } | undefined;
    for (const column of candidateColumns) {
      const x0 = columns[column];
      if (x0 === undefined) continue;
      const isRest = zone.zoneId === 'zone-rest';
      const isCheckout = zone.zoneId.startsWith('zone-checkout_');
      const startZ = isRest ? frontZ + 4 : frontColumn !== undefined ? frontZ : retailAnchor?.startZ ?? nextZ[column] ?? backZ;
      const packed = packZone(members, x0, startZ, columnWidth, isCheckout ? 4 : Infinity);
      if (frontColumn !== undefined) {
        const usedWidth = Math.max(...packed.fixtures.map((f) => f.x + f.widthM / 2)) - x0;
        // Balanced checkout banks; rest seats sit against the outer edge, away from queue space.
        const offset = isRest ? columnWidth - usedWidth : (columnWidth - usedWidth) / 2;
        for (const f of packed.fixtures) f.x += offset;
      }
      const limit = frontColumn !== undefined ? input.depthM / 2 - EDGE_M : retailAnchor !== undefined ? retailLimit : columnLimits[column] ?? retailLimit;
      if (startZ + packed.depthM <= limit + 1e-8) { chosen = { packed, column, startZ }; break; }
    }
    if (chosen === undefined) throw new Error(`${zone.zoneId} 无法在保留设施尺寸和通道约束下排布；未生成候选`);
    for (const f of chosen.packed.fixtures) placements.set(f.fixtureId, f);
    if (frontColumn === undefined && retailAnchor === undefined) nextZ[chosen.column] = chosen.startZ + chosen.packed.depthM + ZONE_GAP_M;
  }
  const fixtures = input.fixtures.map((f) => {
    const placed = placements.get(f.fixtureId);
    if (placed === undefined) throw new Error(`${f.fixtureId} 未找到候选位置`);
    return placed;
  });
  const zones = input.zones.map((zone) => {
    const boxes = fixtures.filter((f) => f.zoneId === zone.zoneId).map(bounds);
    if (boxes.length === 0) return { ...zone, polygonM: zone.polygonM?.map(([x, z]) => [x, z] as [number, number]) };
    const x0 = Math.min(...boxes.map((b) => b.x0)) - .15, x1 = Math.max(...boxes.map((b) => b.x1)) + .15;
    const z0 = Math.min(...boxes.map((b) => b.z0)) - .15, z1 = Math.max(...boxes.map((b) => b.z1)) + .15;
    return { ...zone, polygonM: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as [number, number][] };
  });
  const layout = parseStoreLayout({ ...input, name: `${input.name} · 独立规划候选（未审批）`, fixtures, zones });
  const validation = validatePlanningLayout(layout);
  if (validation.issues.length > 0) throw new Error(`候选校验失败：${validation.issues.slice(0, 5).join('；')}`);
  // The cross-store connection is a geometric reservation, not an egress certification.
  if (fixtures.some((f) => { const b = bounds(f); return b.z1 > retailLimit + 1e-8 && b.z0 < frontZ - 1e-8; })) {
    throw new Error('候选占用前场横向衔接带；未生成候选');
  }
  const departmentBounds = zones.flatMap((zone) => {
    const boxes = fixtures.filter((f) => f.zoneId === zone.zoneId).map(bounds);
    return boxes.length === 0 ? [] : [{ zoneId: zone.zoneId, bounds: {
      x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)),
      z0: Math.min(...boxes.map((b) => b.z0)), z1: Math.max(...boxes.map((b) => b.z1)),
    } }];
  });
  const changes = fixtures.flatMap((f, i) => {
    const old = input.fixtures[i];
    if (old === undefined || (old.x === f.x && old.z === f.z && old.rotationY === f.rotationY)) return [];
    return [{ fixtureId: f.fixtureId, from: { x: old.x, z: old.z, rotationY: old.rotationY }, to: { x: f.x, z: f.z, rotationY: f.rotationY } }];
  });
  return { layout, report: {
    valid: true, fixtureCount: fixtures.length, movedFixtureCount: changes.length,
    minimumGapM: validation.minimumGapM, centralAisleWidthM: AISLE_M, changes,
    crossAisle: { z0: retailLimit, z1: frontZ, widthM: CROSS_AISLE_M }, departmentBounds,
    notes: [
      '独立合成规划候选：未替换基线、未审批、未实施。',
      '保留设施 ID、部门 ID、尺寸和业务元数据；fixed 原型设施的候选位置也有调整，需人工复核。',
      '中央 4m 纵向通道贯穿门店并连接前场；部门内目标间距 1.2m，任意设施最低几何间距校验 0.3m。',
      '仅验证平面边界与保守包围盒间距；未验证消防、门窗、机电/冷链接驳、顾客寻路或营业改善。',
      '后场置于右后侧距墙 1m；日配/洗化分布在右前零售区，收银采用每排最多 4 台的双排组团，休息区在右前外侧。',
      '零售与收银间保留横贯门店的 3m 空白衔接带；仍需核查真实排队、后场出入、门窗与各部门面积，不宣称最优布局或拥堵改善。',
    ],
  } };
}
