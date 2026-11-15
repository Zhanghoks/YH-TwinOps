# Tripo 资产批次 001 · 总纲（12 个门店设施 GLB）

> 状态：待生成（2026-11-15）。每个资产的设计工单是独立文件 `assets/tripo/<assetId>.md`，本文件只放批次级通用信息。
> 生成者：维护者自主在 Tripo 生成后回传；代理负责校验 → 登记 `assets/registry.json`（candidate）→ 视觉验收 → approved。
> 教学压测假设尺寸，非真实门店测量；不得使用真实品牌 Logo 或未授权素材（AGENTS.md 约束）。

## 资产清单

| # | 工单 | assetId | fixtureType | 服务业务区 | 中文名 | 尺寸目标（宽×深×高） |
|---|---|---|---|---|---|---|
| 1 | [yh-checkout-counter.md](yh-checkout-counter.md) | `yh-checkout-counter` | CHECKOUT | 收银 | 收银台 | 3.6 × 1.2 × 1.1 m |
| 2 | [yh-freezer-upright.md](yh-freezer-upright.md) | `yh-freezer-upright` | FREEZER | 冷冻、奶制品 | 立式冷冻柜 | 2.0 × 0.9 × 2.0 m |
| 3 | [yh-gondola-shelf.md](yh-gondola-shelf.md) | `yh-gondola-shelf` | GONDOLA | 粮油/休闲/饮品/日化/家居 | 中岛货架 | 1.2 × 0.7 × 1.6 m |
| 4 | [yh-produce-island.md](yh-produce-island.md) | `yh-produce-island` | PRODUCE_ISLAND | 蔬果 | 果蔬岛台 | 2.4 × 1.2 × 0.9 m |
| 5 | [yh-deli-counter.md](yh-deli-counter.md) | `yh-deli-counter` | DELI_COUNTER | 肉类/水产/熟食 | 冷藏展示柜台 | 2.4 × 1.0 × 1.4 m |
| 6 | [yh-bakery-case.md](yh-bakery-case.md) | `yh-bakery-case` | DELI_COUNTER | 烘焙 | 烘焙展示柜 | 1.8 × 0.8 × 1.4 m |
| 7 | [yh-service-desk.md](yh-service-desk.md) | `yh-service-desk` | OTHER | 服务台 | 服务台 | 2.4 × 0.9 × 1.1 m |
| 8 | [yh-cart-stack.md](yh-cart-stack.md) | `yh-cart-stack` | OTHER | 入口 | 购物车叠放 | 2.0 × 0.6 × 1.0 m |
| 9 | [yh-wayfinding-sign.md](yh-wayfinding-sign.md) | `yh-wayfinding-sign` | OTHER | 入口/疏散通道 | 导视牌 | 0.8 × 0.4 × 2.2 m |
| 10 | [yh-exit-door.md](yh-exit-door.md) | `yh-exit-door` | DOOR | 后仓/收货/冷库/员工区/疏散 | 双开门 | 1.8 × 0.15 × 2.1 m |
| 11 | [yh-pallet-stack.md](yh-pallet-stack.md) | `yh-pallet-stack` | OTHER | 收货/后仓/冷库 | 托盘纸箱堆 | 1.2 × 1.0 × 1.5 m |
| 12 | [yh-staff-cabinet.md](yh-staff-cabinet.md) | `yh-staff-cabinet` | OTHER | 员工区 | 员工储物柜 | 1.0 × 0.5 × 1.8 m |

## 通用生成参数（12 个资产一致，工单文件中不再重复论证）

| 参数 | 值 | 说明 |
|---|---|---|
| 模型 | **P1**（低面数路线） | 网页控制台选「P1 / 低面数」；CLI 为 `--model tripo-p1` |
| 面数预算 | `face_limit = 20000` | Three.js/WebGL 直接可用；CLI `-p face_limit=20000` |
| 贴图 | 标准贴图（约 20 积分/个） | 不选 8K/高清加成 |
| 负面提示词 | `logo, brand name, text, watermark` | 网页版有负面提示词栏就填；没有则提示词内已含 no logo |
| 输出格式 | GLB | Tripo 原生输出，无需转换 |
| 命名 | `<assetId>.glb` | 如 `yh-checkout-counter.glb`，放 `assets/tripo/` |
| 轴向 | Y 轴向上，原点底部中心 | Tripo GLB 默认 Y-up；原点位置由代理验收时检查 |

成本参考：12 个 × 约 20 积分 ≈ **240 积分**（1 积分 = ¥0.07，以控制台实际计费为准）。

## 代理验收标准（回传后逐条执行）

1. **面数** ≤ 20,000 三角面（解析 GLB accessor 求和）
2. **包围盒常识合理**：与工单尺寸目标偏差在 ±30% 内即可——`StoreLayout` 的 fixture 尺寸才是唯一事实源，Three.js 加载时按 fixture 尺寸归一化缩放（spec US-15：资产换皮不改业务 ID）；严重失真（如门 5 米宽）如实记录并退回
3. **无品牌/文字标识**：对照预览图人工检查
4. **Y-up、底部中心原点**：不满足则在登记 notes 记录偏差与加载侧补偿方式
5. 通过 → 登记 `registry.json` 为 `candidate`（`aiGenerated: true` + 工具/提示词/任务 ID/日期）；维护者视觉验收后置 `approved`，未通过的候选保留 `rejected` 与原因

## 回传方式（二选一）

- **方式 A（推荐，最省事）**：用与 ZCode MCP 授权相同的 Tripo 账号生成，生成完成后把 **12 个 task_id** 发代理（网页控制台任务记录里可见）。代理用 MCP 拉取下载链接、下载 GLB 到 `assets/tripo/`、跑验收、登记。
- **方式 B**：在 Tripo 网页导出 GLB，按 `<assetId>.glb` 命名放进一个目录（如 `~/Downloads/yh-batch-001/`），把路径发代理；**task_id 若能看到请一并提供**（登记台账需要任务 ID 做来源追溯；确实没有则登记时注明"自主生成、任务 ID 未提供"）。

> 提示：Tripo 结果链接约 5 分钟过期，所以发 task_id 或文件，不要发链接本身。
