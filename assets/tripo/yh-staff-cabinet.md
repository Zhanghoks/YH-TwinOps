# 工单 12/12 · `yh-staff-cabinet` — 员工储物柜

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-staff-cabinet` |
| fixtureType | `OTHER` |
| 服务业务区 | 员工区 |
| 尺寸目标 | 1.0 × 0.5 × 1.8 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-staff-cabinet.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
metal employee locker cabinet with two doors and ventilation slots, light gray powder coated steel, modern utility style, no logo, about 1 meter wide and 1.8 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 双门立柜 + 门上通气孔条
- 浅灰钢制质感（与货架的木层板、烘焙柜的暖色区分）
- 生成预览图无品牌/文字
