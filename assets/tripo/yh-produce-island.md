# 工单 4/12 · `yh-produce-island` — 果蔬岛台

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-produce-island` |
| fixtureType | `PRODUCE_ISLAND` |
| 服务业务区 | 蔬果 |
| 尺寸目标 | 2.4 × 1.2 × 0.9 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-produce-island.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
supermarket produce display island with stepped sloped display shelves, light wood tone base with dark green accents, empty, clean modern retail style, no logo, about 2.4 meters wide and 0.9 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 阶梯/斜面展架造型（多层递减，不是平顶台）
- 矮台（≤ 0.9 m），四周环视造型（岛台而非靠墙柜）
- 生成预览图无品牌/文字
