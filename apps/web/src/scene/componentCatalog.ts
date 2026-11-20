import type { DetailFixtureShape } from './detailGeometry';
export const COMPONENT_SAMPLES = [
  { id: 'fruit', name: '01 水果中岛', type: 'PRODUCE_ISLAND', zone: 'zone-produce', size: [2.8, 1.6, .85] },
  { id: 'vegetable', name: '02 蔬菜阶梯架', type: 'PRODUCE_ISLAND', zone: 'zone-produce', size: [2.4, .9, 1.55] },
  { id: 'seafood', name: '03 水产柜台', type: 'DELI_COUNTER', zone: 'zone-seafood', size: [3.6, 1.2, 1.2] },
  { id: 'meat', name: '04 鲜肉服务柜', type: 'DELI_COUNTER', zone: 'zone-meat', size: [4.2, 1.2, 1.2] },
  { id: 'deli', name: '05 熟食柜', type: 'DELI_COUNTER', zone: 'zone-deli', size: [3.6, 1.2, 1.35] },
  { id: 'bakery', name: '06 烘焙多层柜', type: 'DELI_COUNTER', zone: 'zone-bakery', size: [3, 1.2, 1.5] },
  { id: 'dairy', name: '07 乳品开放柜', type: 'FREEZER', zone: 'zone-dairy', size: [3.75, .9, 2] },
  { id: 'frozen', name: '08 冷冻玻璃门柜', type: 'FREEZER', zone: 'zone-frozen', size: [3.75, .9, 2] },
  { id: 'grocery', name: '09 标准食品货架', type: 'GONDOLA', zone: 'zone-packaged', size: [1.2, .45, 1.6] },
  { id: 'beverage', name: '10 饮料货架', type: 'GONDOLA', zone: 'zone-beverages', size: [1.2, .45, 1.6] },
  { id: 'household', name: '11 日化货架', type: 'GONDOLA', zone: 'zone-household', size: [1.2, .45, 1.8] },
  { id: 'service', name: '12 客服台', type: 'OTHER', zone: 'design-only', size: [3.6, .8, 1.1] },
  { id: 'gate', name: '13 入口闸机', type: 'DOOR', zone: 'design-only', size: [1.8, .9, 1.2] },
  { id: 'checkout', name: '14 收银通道', type: 'CHECKOUT', zone: 'zone-checkout', size: [3.6, 1.2, 1.3] },
  { id: 'selfcheckout', name: '15 自助收银', type: 'OTHER', zone: 'design-only', size: [1, .7, 1.6] },
  { id: 'cart', name: '16 购物车区', type: 'OTHER', zone: 'design-only', size: [3.2, 1.2, 1.1] },
  { id: 'coldDoor', name: '17 冷库门', type: 'DOOR', zone: 'design-only', size: [2, .12, 2.4] },
  { id: 'dock', name: '18 装卸收货月台', type: 'OTHER', zone: 'design-only', size: [3, 2.5, 3.6] },
  { id: 'dimensioned-wall', name: '19 定尺靠墙空架', type: 'OTHER', zone: 'design-only', size: [2.4, .47, 2.2] },
  { id: 'dimensioned-gondola', name: '20 定尺双面空架', type: 'OTHER', zone: 'design-only', size: [2.4, 1, 1.6] },
  { id: 'refrigeration-island', name: '21 滑盖冷冻岛柜', type: 'OTHER', zone: 'design-only', size: [2.502, .853, .833] },
  { id: 'refrigeration-upright', name: '22 玻璃门冷冻柜', type: 'OTHER', zone: 'design-only', size: [1.350, .908, 2.035] },
  { id: 'refrigeration-open', name: '23 多层冷藏风幕柜', type: 'OTHER', zone: 'design-only', size: [2.580, .915, 2.090] },
  { id: 'retail-produce', name: '24 双面果蔬空台', type: 'OTHER', zone: 'design-only', size: [1.220, 1.450, .940] },
  { id: 'retail-service', name: '25 鲜食玻璃服务柜', type: 'OTHER', zone: 'design-only', size: [1.955, 1.086, 1.290] },
  { id: 'retail-checkout', name: '26 人工收银工作台', type: 'OTHER', zone: 'design-only', size: [2.500, 1.120, 1.150] },
] as const;
export type ComponentSampleId = typeof COMPONENT_SAMPLES[number]['id'];
/** Isolated design samples never enter StoreLayout or the business selection store. */
export function buildComponentSample(id: ComponentSampleId): DetailFixtureShape {
  const s = COMPONENT_SAMPLES.find(s => s.id === id)!;
  return { fixtureId: `design-sample-${id}`, fixtureType: s.type, zoneId: s.zone,
    widthM: s.size[0], depthM: s.size[1], heightM: s.size[2], x: 0, y: 0, z: 0, rotationY: 0,
    designVariant: id === 'vegetable' || id === 'service' || id === 'gate' || id === 'selfcheckout' || id === 'cart' || id === 'coldDoor' || id === 'dock' ? id : undefined };
}
