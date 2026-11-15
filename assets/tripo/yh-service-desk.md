# 工单 7/12 · `yh-service-desk` — 服务台

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-service-desk` |
| fixtureType | `OTHER` |
| 服务业务区 | 服务台 |
| 尺寸目标 | 2.4 × 0.9 × 1.1 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-service-desk.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
supermarket customer service desk, low modern counter with light gray laminate top and white panel front, no logo, about 2.4 meters wide and 1.1 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 简洁低柜台（无传送带——与收银台区分；无玻璃展示面——与熟食柜区分）
- 台面高度适中（约 1.1 m，可站人办理业务）
- 生成预览图无品牌/文字
