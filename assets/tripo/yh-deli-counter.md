# 工单 5/12 · `yh-deli-counter` — 冷藏展示柜台

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-deli-counter` |
| fixtureType | `DELI_COUNTER` |
| 服务业务区 | 肉类/水产/熟食 |
| 尺寸目标 | 2.4 × 1.0 × 1.4 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-deli-counter.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
supermarket refrigerated deli display counter with curved glass front, stainless steel base cabinet, empty white display trays, clean modern retail style, no logo, about 2.4 meters wide and 1.4 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 前脸为玻璃展示面（弧形或斜面）+ 不锈钢底座
- 后侧应有服务操作面（柜台进深方向不对称可接受）
- 生成预览图无品牌/文字
