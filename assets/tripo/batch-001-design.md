# Tripo 资产批次 001 · 生成工单（12 个门店设施 GLB）

> 状态：待生成（2026-11-15）。本文件是批次 001 的完整生成工单：提示词、参数、验收标准与回传方式。
> 生成者：维护者自主在 Tripo 生成后回传；代理负责校验 → 登记 `assets/registry.json`（candidate）→ 视觉验收 → approved。
> 教学压测假设尺寸，非真实门店测量；不得使用真实品牌 Logo 或未授权素材（AGENTS.md 约束）。

## 一、通用生成参数（12 个资产一致）

| 参数 | 值 | 说明 |
|---|---|---|
| 模型 | **P1**（低面数路线） | 网页控制台选「P1 / 低面数」；CLI 为 `--model tripo-p1` |
| 面数预算 | `face_limit = 20000` | Three.js/WebGL 直接可用；CLI `-p face_limit=20000` |
| 贴图 | 标准贴图（约 20 积分/个） | 不选 8K/高清加成 |
| 负面提示词 | `logo, brand name, text, watermark` | 网页版有负面提示词栏就填；没有则提示词内已含 no logo |
| 输出格式 | GLB | Tripo 原生输出，无需转换 |
| 命名 | `<assetId>.glb` | 如 `yh-checkout-counter.glb` |
| 轴向 | Y 轴向上，原点底部中心 | Tripo GLB 默认 Y-up；原点位置由代理验收时检查 |

成本参考：12 个 × 约 20 积分 ≈ **240 积分**（1 积分 = ¥0.07，以控制台实际计费为准）。

## 二、逐资产工单

### 1. `yh-checkout-counter` — 收银台
- fixtureType：`CHECKOUT`；服务区：收银区
- 尺寸目标：3.6 × 1.2 × 1.1 m（宽×深×高）
- 备注：带传送带与收银终端；测试夹具与布局已按此 assetId 引用

```text
modern supermarket checkout counter with conveyor belt, cashier terminal and card reader, light gray and white laminate and brushed metal materials, clean retail style, empty, no logo, about 3.6 meters wide, realistic proportions
```

### 2. `yh-freezer-upright` — 立式冷冻柜
- fixtureType：`FREEZER`；服务区：冷冻、奶制品
- 尺寸目标：2.0 × 0.9 × 2.0 m

```text
upright supermarket freezer cabinet with glass doors, stainless steel frame, interior shelves with plain generic frozen food boxes, cool white interior LED light, modern retail style, no logo, about 2 meters wide and 2 meters tall, realistic proportions
```

### 3. `yh-gondola-shelf` — 中岛货架
- fixtureType：`GONDOLA`；服务区：粮油/休闲/饮品/日化/家居（InstancedMesh 高频复用）
- 尺寸目标：1.2 × 0.7 × 1.6 m（中间货架不高于 1.6 m，SPEC §16.1 参考口径）

```text
supermarket gondola shelving unit, four shelves, light gray metal frame with pale wood shelf boards, empty shelves, modern retail store style, no logo, about 1.2 meters wide and 1.6 meters tall, realistic proportions
```

### 4. `yh-produce-island` — 果蔬岛台
- fixtureType：`PRODUCE_ISLAND`；服务区：蔬果
- 尺寸目标：2.4 × 1.2 × 0.9 m

```text
supermarket produce display island with stepped sloped display shelves, light wood tone base with dark green accents, empty, clean modern retail style, no logo, about 2.4 meters wide and 0.9 meters tall, realistic proportions
```

### 5. `yh-deli-counter` — 冷藏展示柜台
- fixtureType：`DELI_COUNTER`；服务区：肉类/水产/熟食
- 尺寸目标：2.4 × 1.0 × 1.4 m

```text
supermarket refrigerated deli display counter with curved glass front, stainless steel base cabinet, empty white display trays, clean modern retail style, no logo, about 2.4 meters wide and 1.4 meters tall, realistic proportions
```

### 6. `yh-bakery-case` — 烘焙展示柜
- fixtureType：`DELI_COUNTER`；服务区：烘焙
- 尺寸目标：1.8 × 0.8 × 1.4 m

```text
bakery display cabinet with angled glass front and light wooden frame, two empty shelves, warm modern bakery style, no logo, about 1.8 meters wide and 1.4 meters tall, realistic proportions
```

### 7. `yh-service-desk` — 服务台
- fixtureType：`OTHER`；服务区：服务台
- 尺寸目标：2.4 × 0.9 × 1.1 m

```text
supermarket customer service desk, low modern counter with light gray laminate top and white panel front, no logo, about 2.4 meters wide and 1.1 meters tall, realistic proportions
```

### 8. `yh-cart-stack` — 购物车叠放
- fixtureType：`OTHER`；服务区：入口
- 尺寸目标：2.0 × 0.6 × 1.0 m（一排叠推的购物车）

```text
row of nested shopping carts pushed together, silver gray metal frames with dark gray plastic baskets, clean retail style, no logo, about 2 meters long and 1 meter tall, realistic proportions
```

### 9. `yh-wayfinding-sign` — 导视牌
- fixtureType：`OTHER`；服务区：入口/疏散通道
- 尺寸目标：0.8 × 0.4 × 2.2 m（立式牌）

```text
freestanding wayfinding sign totem, slim brushed metal stand with blank white rectangular panel, double sided, modern retail style, no text, no logo, about 2.2 meters tall, realistic proportions
```

### 10. `yh-exit-door` — 双开门
- fixtureType：`DOOR`；服务区：后仓/收货/冷库/员工区/疏散通道
- 尺寸目标：1.8 × 0.15 × 2.1 m

```text
clean utility double swing door, light gray steel door leaves with round porthole windows and push plates, gray frame, modern facility style, no logo, about 1.8 meters wide and 2.1 meters tall, realistic proportions
```

### 11. `yh-pallet-stack` — 托盘纸箱堆
- fixtureType：`OTHER`；服务区：收货/后仓/冷库
- 尺寸目标：1.2 × 1.0 × 1.5 m

```text
wooden pallet stacked with plain brown cardboard boxes in a neat square stack, warehouse style, no logo, about 1.2 meters wide and 1.5 meters tall, realistic proportions
```

### 12. `yh-staff-cabinet` — 员工储物柜
- fixtureType：`OTHER`；服务区：员工区
- 尺寸目标：1.0 × 0.5 × 1.8 m

```text
metal employee locker cabinet with two doors and ventilation slots, light gray powder coated steel, modern utility style, no logo, about 1 meter wide and 1.8 meters tall, realistic proportions
```

## 三、代理验收标准（回传后逐条执行）

1. **面数** ≤ 20,000 三角面（解析 GLB accessor 求和）
2. **包围盒常识合理**：与尺寸目标偏差在 ±30% 内即可——`StoreLayout` 的 fixture 尺寸才是唯一事实源，Three.js 加载时按 fixture 尺寸归一化缩放（spec US-15：资产换皮不改业务 ID）；严重失真（如门 5 米宽）如实记录并退回
3. **无品牌/文字标识**：对照预览图人工检查
4. **Y-up、底部中心原点**：不满足则在登记 notes 记录偏差与加载侧补偿方式
5. 通过 → 登记 `registry.json` 为 `candidate`（`aiGenerated: true` + 工具/提示词/任务 ID/日期）；维护者视觉验收后置 `approved`，未通过的候选保留 `rejected` 与原因

## 四、回传方式（二选一）

- **方式 A（推荐，最省事）**：用与 ZCode MCP 授权相同的 Tripo 账号生成，生成完成后把 **12 个 task_id** 发我（网页控制台任务记录里可见）。我用 MCP 拉取下载链接、下载 GLB 到 `assets/tripo/`、跑验收、登记。
- **方式 B**：在 Tripo 网页导出 GLB，按 `<assetId>.glb` 命名放进一个目录（如 `~/Downloads/yh-batch-001/`），把路径发我；**task_id 若能看到请一并提供**（登记台账需要任务 ID 做来源追溯；确实没有则登记时注明"自主生成、任务 ID 未提供"）。

> 提示：Tripo 结果链接约 5 分钟过期，所以发 task_id 或文件，不要发链接本身。
