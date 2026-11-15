# 工单 9/12 · `yh-wayfinding-sign` — 导视牌

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-wayfinding-sign` |
| fixtureType | `OTHER` |
| 服务业务区 | 入口/疏散通道 |
| 尺寸目标 | 0.8 × 0.4 × 2.2 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-wayfinding-sign.glb` |
| task_id | 生成后回填：`` |

## 提示词（整段复制）

```text
freestanding wayfinding sign totem, slim brushed metal stand with blank white rectangular panel, double sided, modern retail style, no text, no logo, about 2.2 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- **面板必须空白无文字**（文字由 Three.js 侧按业务区动态绘制，模型里带字反而错）——验收时重点检查
- 细高立式造型（高约 2.2 m，细于宽）
- 双面板结构可辨认
