# 工单 3/12 · `yh-gondola-shelf` — 中岛货架

## 登记信息

| 字段 | 值 |
|---|---|
| assetId | `yh-gondola-shelf` |
| fixtureType | `GONDOLA` |
| 服务业务区 | 粮油/休闲/饮品/日化/家居 |
| 尺寸目标 | 1.2 × 0.7 × 1.6 m（宽×深×高，教学假设） |
| 输出文件 | `assets/tripo/yh-gondola-shelf.glb` |
| task_id | 生成后回填：`` |

> 备注：全店复用率最高的资产（InstancedMesh 数百实例），质量优先级最高；SPEC 参考口径「中间货架不高于 1.6 m」。

## 提示词（整段复制）

```text
supermarket gondola shelving unit, four shelves, light gray metal frame with pale wood shelf boards, empty shelves, modern retail store style, no logo, about 1.2 meters wide and 1.6 meters tall, realistic proportions
```

## 参数速查

- 模型 **P1**（低面数）｜ `face_limit = 20000` ｜ **标准贴图**
- 负面提示词：`logo, brand name, text, watermark`
- 输出 **GLB**；通用参数详见 [batch-001-README.md](batch-001-README.md)

## 验收要点（本资产特有）

- 四层空架、层板水平、双面或单面靠墙式均可
- 高 ≤ 1.6 m（不超高）；架体规整利于 InstancedMesh 平铺
- 生成预览图无品牌/文字
