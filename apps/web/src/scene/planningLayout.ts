import { parseStoreLayout, type Fixture, type StoreLayout } from '@yh/contracts';

const MIN_GAP_M = 1;
export interface Bounds { x0: number; x1: number; z0: number; z1: number }
export interface PlanningValidation { issues: string[]; minimumGapM: number | null }
export interface ReferenceRegion { code: string; label: string; zoneIds: string[]; bounds: Bounds }
interface FixtureGeometry { x: number; z: number; rotationY: number; widthM: number; depthM: number; heightM: number }
export interface PlanningChange { fixtureId: string; from: FixtureGeometry; to: FixtureGeometry }
export interface PlanningReport {
  valid: true;
  fixtureCount: number;
  movedFixtureCount: number;
  dimensionChangedFixtureCount: number;
  minimumGapM: number | null;
  referenceRegions: ReferenceRegion[];
  departmentBounds: { zoneId: string; bounds: Bounds }[];
  changes: PlanningChange[];
  notes: string[];
}

function rectangle(x0: number, x1: number, z0: number, z1: number): Bounds { return { x0, x1, z0, z1 }; }
/** Manually interpreted anchors from the user-supplied concept image, not surveyed boundaries. */
const REFERENCE_REGIONS: ReferenceRegion[] = [
  { code: 'F01', label: '果蔬区', zoneIds: ['zone-produce'], bounds: rectangle(-62,-29,4,32) },
  { code: 'F02', label: '客服 / 入口', zoneIds: ['zone-rest'], bounds: rectangle(-62,-10,34,48) },
  { code: 'F03', label: '水产区', zoneIds: ['zone-seafood'], bounds: rectangle(-62,-44,-30,-13) },
  { code: 'F04', label: '鲜肉区', zoneIds: ['zone-meat'], bounds: rectangle(-43,-25,-30,-13) },
  { code: 'F05', label: '熟食 / 现制区', zoneIds: ['zone-deli'], bounds: rectangle(-62,-27,-10,2) },
  { code: 'F06', label: '冷冻冷藏区', zoneIds: ['zone-frozen'], bounds: rectangle(-23,28,-31,-13) },
  { code: 'F07', label: '烘焙区', zoneIds: ['zone-bakery'], bounds: rectangle(31,43,-30,-13) },
  { code: 'F08', label: '乳品日配区', zoneIds: ['zone-daily'], bounds: rectangle(46,62,-30,-8) },
  { code: 'F09', label: '食品百货区', zoneIds: ['zone-packaged','zone-bulk','zone-featured'], bounds: rectangle(-23,30,-12,29) },
  { code: 'F10', label: '酒水饮料区', zoneIds: ['zone-beverages'], bounds: rectangle(-28,-3,15,29) },
  { code: 'F11', label: '日化家居区', zoneIds: ['zone-household'], bounds: rectangle(33,61,-5,29) },
  { code: 'F12', label: '收银区', zoneIds: ['zone-checkout_n','zone-checkout_e','zone-checkout_s'], bounds: rectangle(-5,61,34,46) },
  { code: 'BACK', label: '后仓 / 收货及加工冷库服务带', zoneIds: ['zone-backroom'], bounds: rectangle(-62,62,-49,-32) },
];

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

interface Grid { bounds: Bounds; columns: number; widthM: number; depthM: number }
/** Sparse representative fixtures, not a claim that the image contains exactly these 150 objects. */
const GRIDS: Record<string, Grid> = {
  'zone-seafood': { bounds: rectangle(-62,-44,-30,-13), columns: 2, widthM: 6, depthM: 2.5 },
  'zone-meat': { bounds: rectangle(-43,-25,-30,-13), columns: 2, widthM: 7, depthM: 2.5 },
  'zone-deli': { bounds: rectangle(-62,-27,-10,2), columns: 3, widthM: 8, depthM: 2.5 },
  'zone-produce': { bounds: rectangle(-62,-29,4,32), columns: 3, widthM: 7, depthM: 3 },
  'zone-frozen': { bounds: rectangle(-23,28,-31,-13), columns: 6, widthM: 6.5, depthM: 2.3 },
  'zone-bakery': { bounds: rectangle(31,43,-30,-13), columns: 2, widthM: 3.8, depthM: 1.5 },
  'zone-daily': { bounds: rectangle(46,62,-30,-8), columns: 1, widthM: 11, depthM: 2.8 },
  'zone-packaged': { bounds: rectangle(-23,30,-12,10), columns: 6, widthM: 6.6, depthM: 1.4 },
  'zone-bulk': { bounds: rectangle(1,30,13,24), columns: 3, widthM: 7, depthM: 1.4 },
  'zone-featured': { bounds: rectangle(1,30,26,29), columns: 3, widthM: 7, depthM: 1.4 },
  'zone-beverages': { bounds: rectangle(-28,-3,15,29), columns: 6, widthM: 2, depthM: 10 },
  'zone-household': { bounds: rectangle(33,61,-5,29), columns: 3, widthM: 7, depthM: 1.6 },
  // Deliberately reserved footprints coordinated with separate architectural decorations.
  'zone-backroom': { bounds: rectangle(-14,12,-43,-37), columns: 4, widthM: 5.2, depthM: 6 },
  'zone-rest': { bounds: rectangle(-44,-35,44,45), columns: 3, widthM: 2, depthM: .8 },
};
function geometry(f: Fixture): FixtureGeometry {
  return { x: f.x, z: f.z, rotationY: f.rotationY, widthM: f.widthM, depthM: f.depthM, heightM: f.heightM };
}
function enclosing(boxes: Bounds[]): Bounds {
  return { x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)), z0: Math.min(...boxes.map((b) => b.z0)), z1: Math.max(...boxes.map((b) => b.z1)) };
}

/** Independent image-aligned approximation. Does not overwrite approved store dimensions or stock. */
export function generatePlanningLayout(source: StoreLayout): { layout: StoreLayout; report: PlanningReport } {
  const input = parseStoreLayout(source);
  const placements = new Map<string, Fixture>();
  const checkoutZones = REFERENCE_REGIONS.find((r) => r.code === 'F12')!.zoneIds;
  const checkouts = input.fixtures.filter((f) => checkoutZones.includes(f.zoneId));
  if (checkouts.length !== 24) throw new Error('图示候选要求保留 24 台收银设施');
  checkouts.forEach((f, i) => {
    const group = Math.floor(i / 12), lane = i % 12;
    placements.set(f.fixtureId, { ...f, x: -2 + group * 33 + lane * 2.5 + .75, z: 39.75, widthM: 1.5, depthM: 5.5, rotationY: 0, categoryIds: [...f.categoryIds] });
  });
  for (const zone of input.zones) {
    if (checkoutZones.includes(zone.zoneId)) continue;
    const members = input.fixtures.filter((f) => f.zoneId === zone.zoneId);
    if (members.length === 0) continue;
    const grid = GRIDS[zone.zoneId];
    if (!grid) throw new Error(`${zone.zoneId} 无图片锚点，未生成候选`);
    const { bounds: b, columns, widthM, depthM } = grid;
    const rows = Math.ceil(members.length / columns);
    const cellW = (b.x1-b.x0) / columns, cellD = (b.z1-b.z0) / rows;
    if (widthM > cellW || depthM > cellD) throw new Error(`${zone.zoneId} 设施数量超出图示候选容量`);
    members.forEach((f, i) => placements.set(f.fixtureId, {
      ...f, x: b.x0 + (i % columns + .5) * cellW, z: b.z0 + (Math.floor(i / columns) + .5) * cellD,
      widthM, depthM, rotationY: 0, categoryIds: [...f.categoryIds],
    }));
  }
  const fixtures = input.fixtures.map((f) => {
    const placed = placements.get(f.fixtureId);
    if (!placed) throw new Error(`${f.fixtureId} 未找到图示候选位置`);
    return placed;
  });
  const departmentBounds: PlanningReport['departmentBounds'] = [];
  const zones = input.zones.map((zone) => {
    const boxes = fixtures.filter((f) => f.zoneId === zone.zoneId).map(bounds);
    if (!boxes.length) return { ...zone, polygonM: zone.polygonM?.map(([x,z]) => [x,z] as [number,number]) };
    const b = enclosing(boxes);
    departmentBounds.push({ zoneId: zone.zoneId, bounds: b });
    const pad = .15;
    return { ...zone, polygonM: [[b.x0-pad,b.z0-pad],[b.x1+pad,b.z0-pad],[b.x1+pad,b.z1+pad],[b.x0-pad,b.z1+pad]] as [number,number][] };
  });
  const layout = parseStoreLayout({ ...input, name: `${input.name} · 图片对齐候选（非实测）`, widthM: 130, depthM: 100, fixtures, zones });
  const validation = validatePlanningLayout(layout);
  if (validation.issues.length) throw new Error(`图示候选校验失败：${validation.issues.slice(0,5).join('；')}`);
  const changes = fixtures.flatMap((f,i) => {
    const original = input.fixtures[i]!;
    const from = geometry(original), to = geometry(f);
    return JSON.stringify(from) === JSON.stringify(to) ? [] : [{ fixtureId: f.fixtureId, from, to }];
  });
  return { layout, report: {
    valid: true, fixtureCount: fixtures.length,
    movedFixtureCount: changes.filter((c) => c.from.x !== c.to.x || c.from.z !== c.to.z || c.from.rotationY !== c.to.rotationY).length,
    dimensionChangedFixtureCount: changes.filter((c) => c.from.widthM !== c.to.widthM || c.from.depthM !== c.to.depthM || c.from.heightM !== c.to.heightM).length,
    minimumGapM: validation.minimumGapM, changes, departmentBounds,
    referenceRegions: REFERENCE_REGIONS.map((r) => ({ ...r, zoneIds: [...r.zoneIds], bounds: { ...r.bounds } })),
    notes: [
      '按用户提供的概念布局图手工近似推定，非实测、非官方施工图；130×100m 沿用图上约数，北向为负 z。',
      '仅为独立图片对齐候选，未修改基线；150 个原设施 ID、17 个原部门 ID 及业务元数据保留。',
      '候选设施尺寸及位置按图推定，完整尺寸差异列于 changes；原高度保留，fixed 设施移动仅供预览，需人工复核。',
      'F09 食品百货包含原 packaged/bulk/featured；F02 客服入口包含原 rest，未新建经营类别。',
      '24 台收银南侧靠右单横排，两组各 12 台，台长南北向；客服入口在南侧左方，仅为空间假设。',
      '图片小字、准确货架数量、商品、门窗、消防疏散、加工冷库内部接驳无法可靠辨认；150 个代表设施并非逐件复刻图中物体。',
      '区域锚点为粗略语义范围，F09 外包范围与西南酒水范围部分交叠，但其实际设施分开布置；zone polygons 依实际设施包围区更新。',
      '验证边界、设施包围盒及至少 1m 几何间距；未验证消防、排队、顾客路径、冷链或经营效果，不再套用旧中央贯通通道假设。',
    ],
  } };
}
