# 工单 11/12 · `yh-pallet-stack` — 托盘纸箱堆

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-pallet-stack` |
| fixtureType | `OTHER` |
| 服务业务区 | 收货/后仓/冷库 |
| 尺寸目标 | 1.2 × 1.0 × 1.5 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-pallet-stack.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
wooden pallet stacked with plain brown cardboard boxes in a neat square stack, warehouse style, no logo, about 1.2 meters wide and 1.5 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 底部木托盘（可见托盘板条）+ 上方整齐纸箱堆
- 纸箱为**无字通用牛皮纸色**（不做具体商品包装）
- 生成预览图无品牌/文字
