# 工单 6/12 · `yh-bakery-case` — 烘焙展示柜

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-bakery-case` |
| fixtureType | `DELI_COUNTER` |
| 服务业务区 | 烘焙 |
| 尺寸目标 | 1.8 × 0.8 × 1.4 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-bakery-case.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
bakery display cabinet with angled glass front and light wooden frame, two empty shelves, warm modern bakery style, no logo, about 1.8 meters wide and 1.4 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 斜面玻璃 + 浅木框（与 #5 不锈钢风格明显区分）
- 两层展示搁架、暖色调
- 生成预览图无品牌/文字
