/** 布局加载与校验：data/store-yh-01.layout.json 是唯一事实源（spec US-15），启动即校验。 */
import { parseStoreLayout, type StoreLayout } from '@yh/contracts';
import layoutJson from '../../../data/store-yh-01.layout.json';

export const layout: StoreLayout = parseStoreLayout(layoutJson);

/** 演示基准时刻：18:00 高峰（教学情景，非真实时刻）。 */
export const DEMO_AT = '2026-11-15T18:00:00Z';
export const DEMO_T0 = '2026-11-15T17:59:00Z';
export const DEMO_STALE_T = '2026-11-15T17:00:00Z';
