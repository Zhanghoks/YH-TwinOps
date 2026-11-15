# 工单 2/12 · `yh-freezer-upright` — 立式冷冻柜

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-freezer-upright` |
| fixtureType | `FREEZER` |
| 服务业务区 | 冷冻、奶制品 |
| 尺寸目标 | 2.0 × 0.9 × 2.0 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-freezer-upright.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
upright supermarket freezer cabinet with glass doors, stainless steel frame, interior shelves with plain generic frozen food boxes, cool white interior LED light, modern retail style, no logo, about 2 meters wide and 2 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 玻璃门可见内部搁架与商品盒（无字的通用盒子）
- 高约 2 m、明显立式（不是卧式岛柜）
- 门体透光/半透明效果允许近似；无品牌贴标
