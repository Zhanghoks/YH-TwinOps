# 工单 8/12 · `yh-cart-stack` — 购物车叠放

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-cart-stack` |
| fixtureType | `OTHER` |
| 服务业务区 | 入口 |
| 尺寸目标 | 2.0 × 0.6 × 1.0 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-cart-stack.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
row of nested shopping carts pushed together, silver gray metal frames with dark gray plastic baskets, clean retail style, no logo, about 2 meters long and 1 meter tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 多辆购物车嵌套成排（可见车篮、扶手、车轮层次）
- 细金属杆结构允许适当简化（低面数路线，密集细杆易超面数预算）
- 生成预览图无品牌/文字
