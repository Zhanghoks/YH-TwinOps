/**
 * 把 YH-TwinOps/large-store/layout.json（教学概念店原始布局，GLB 即按它导出）
 * 转换为 contracts 的 StoreLayout（data/store-yh-01.layout.json）。
 *
 * 来源与诚实性：
 * - 原始布局：基于公开报道的永辉瀚海海尚门店调改观察草图的教学重绘（合成解释，非实测竣工图），
 *   reference 见 https://www.sohu.com/a/838464583_484228（仅作公开报道引用，不含任何品牌素材）。
 * - 尺寸为教学假设；设施 150 个为教学压测数量，非真实设备数。
 * - GLB 节点名以设施 id 为前缀（F001__…），因此工作台的点击拾取与该模型天然对齐。
 *
 * 用法：node data/convert-legacy-layout.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const legacy = JSON.parse(readFileSync(join(ROOT, 'YH-TwinOps/large-store/layout.json'), 'utf8'));

/** 分区 id → contracts ZONE_TYPES。 */
const ZONE_TYPE_MAP = {
  seafood: 'SEAFOOD',
  meat: 'MEAT',
  deli: 'DELI',
  produce: 'PRODUCE',
  beverages: 'BEVERAGE',
  featured: 'FEATURED',
  bulk: 'GROCERY',
  frozen: 'FROZEN',
  bakery: 'BAKERY',
  packaged: 'GROCERY',
  household: 'HOUSEHOLD',
  daily: 'DAIRY',
  rest: 'STAFF',
  backroom: 'BACKROOM',
  checkout_n: 'CHECKOUT',
  checkout_e: 'CHECKOUT',
  checkout_s: 'CHECKOUT',
};

/** 设施类型 → contracts FIXTURE_TYPES 与 assetId（资产库批次 001 的绑定口径）。 */
const FIXTURE_TYPE_MAP = {
  gondola: { fixtureType: 'GONDOLA', assetId: 'yh-gondola-shelf' },
  bulk: { fixtureType: 'GONDOLA', assetId: 'yh-gondola-shelf' },
  service: { fixtureType: 'DELI_COUNTER', assetId: 'yh-deli-counter' },
  bakery: { fixtureType: 'DELI_COUNTER', assetId: 'yh-bakery-case' },
  produce: { fixtureType: 'PRODUCE_ISLAND', assetId: 'yh-produce-island' },
  fridge: { fixtureType: 'FREEZER', assetId: 'yh-freezer-upright' },
  freezer: { fixtureType: 'FREEZER', assetId: 'yh-freezer-upright' },
  checkout: { fixtureType: 'CHECKOUT', assetId: 'yh-checkout-counter' },
  bench: { fixtureType: 'OTHER', assetId: 'yh-service-desk' },
  storage: { fixtureType: 'OTHER', assetId: 'yh-pallet-stack' },
};

const zones = legacy.zones.map((z) => {
  const zoneType = ZONE_TYPE_MAP[z.id];
  if (zoneType === undefined) throw new Error(`未知分区 id：${z.id}（需在 ZONE_TYPE_MAP 登记）`);
  return {
    zoneId: `zone-${z.id}`,
    name: z.name,
    zoneType,
    polygonM: [
      [z.x - z.w / 2, z.z - z.d / 2],
      [z.x + z.w / 2, z.z - z.d / 2],
      [z.x + z.w / 2, z.z + z.d / 2],
      [z.x - z.w / 2, z.z + z.d / 2],
    ],
  };
});

const fixtures = legacy.fixtures.map((f) => {
  const mapped = FIXTURE_TYPE_MAP[f.type];
  if (mapped === undefined) throw new Error(`未知设施类型：${f.type}（${f.id}）`);
  return {
    fixtureId: f.id,
    zoneId: `zone-${f.zoneId}`,
    fixtureType: mapped.fixtureType,
    assetId: mapped.assetId,
    x: f.x,
    y: 0,
    z: f.z,
    rotationY: f.rotation ?? 0,
    widthM: f.w,
    depthM: f.d,
    heightM: f.height,
    fixed: true,
    ...(f.type === 'checkout' ? { capacity: 1 } : {}),
    categoryIds: [],
  };
});

const layout = {
  storeId: 'store-yh-01',
  name: '永辉瀚海海尚调改逻辑参考（教学概念店）',
  synthetic: true,
  widthM: legacy.width,
  depthM: legacy.depth,
  zones,
  fixtures,
};

writeFileSync(join(HERE, 'store-yh-01.layout.json'), `${JSON.stringify(layout, null, 2)}\n`);
console.log(`已从 legacy layout 转换：${zones.length} 分区，${fixtures.length} 设施，${legacy.width}×${legacy.depth} m`);
