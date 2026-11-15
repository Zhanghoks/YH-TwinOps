# 工单 1/12 · `yh-checkout-counter` — 收银台

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-checkout-counter` |
| fixtureType | `CHECKOUT` |
| 服务业务区 | 收银区 |
| 尺寸目标 | 3.6 × 1.2 × 1.1 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-checkout-counter.glb` |
| task_id | 生成后回填：`` |

> 备注：布局数据与仿真测试夹具已按此 assetId 引用，是三方案仿真 demo 的核心设施；全批最长设施（3.6 m）。

## 提示词（整段复制）

```text
modern supermarket checkout counter with conveyor belt, cashier terminal and card reader, light gray and white laminate and brushed metal materials, clean retail style, empty, no logo, about 3.6 meters wide, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 传送带、收银终端、读卡器结构可辨认（不要求精确机械细节）
- 宽度显著大于深度（长条形台面，不是方形岛台）
- 生成预览图无品牌/文字
