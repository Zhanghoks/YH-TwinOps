# 工单 10/12 · `yh-exit-door` — 双开门

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-exit-door` |
| fixtureType | `DOOR` |
| 服务业务区 | 后仓/收货/冷库/员工区/疏散通道 |
| 尺寸目标 | 1.8 × 0.15 × 2.1 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-exit-door.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
clean utility double swing door, light gray steel door leaves with round porthole windows and push plates, gray frame, modern facility style, no logo, about 1.8 meters wide and 2.1 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 双扇平开门 + 圆窗/推板；厚度极薄（~0.15 m，全批最薄，防失真成柜体）
- 宽 1.8 m、高 2.1 m 通行尺度
- 生成预览图无品牌/文字（不得出现安全出口绿标人形——门贴由前端处理）
