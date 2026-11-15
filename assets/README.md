# assets/ — YH-TwinOps v3 共享 3D 资产库

本目录存放 v3 全店数字孪生使用的 GLB 资产与登记台账。所有资产均为**合成教学资产**：
尺寸为教学压测假设（非真实门店测量），不含任何真实品牌 Logo、新闻图片或未授权素材。

## 目录约定

```text
assets/
├── README.md          本规范
├── registry.json      资产登记台账（唯一事实源）
└── tripo/             Tripo 3D 生成的 GLB 资产
```

## 登记规范（强制）

每个进入仓库的资产必须在 `registry.json` 登记，字段包括：

- `assetId`：与 `StoreLayout` 的 `fixture.assetId` 绑定的唯一 ID（`yh-*` 前缀）
- `file`：仓库内路径（GLB，统一 Y 轴向上、原点在底部中心、尺寸真实米制）
- `fixtureType`：绑定的设施类型（GONDOLA / PRODUCE_ISLAND / DELI_COUNTER / FREEZER / CHECKOUT / DOOR / OTHER）
- `source`：**来源登记**——生成工具（如 tripo-3d）、模型版本、task id 列表、完整提示词、生成日期。
  AI 生成资产必须标明 `"aiGenerated": true`，不得冒充手工制作
- `license`：SPDX 标识与说明（生成资产按 Tripo 服务条款归使用者所有，仓库内统一按 CC-BY-4.0 标注，见 REUSE.toml）
- `status`：`candidate` → `approved`。
  **只有 approved 资产可被布局引用**；生成候选必须先校验（尺寸/面数/材质），approved 之前的基线不得修改（AGENTS.md 约束）

## Tripo 生成流程

1. `tripo_plan` 先出计费链路草稿，确认额度后再生成
2. 低面数路线：`face_limit ≤ 20000`（自动选 P1 模型），Three.js/WebGL 直接用 GLB
3. 生成完成后校验：面数预算、包围盒尺寸与 `fixtureType` 常识一致、无品牌标识
4. 下载到 `assets/tripo/`、登记为 `candidate`，视觉验收通过后置为 `approved`
5. 结果 URL 约 5 分钟过期；以本地文件与登记台账为准

## 诚实性

- 预览渲染图与实物 GLB 的差异如实记录在登记条目的 `notes`
- 无法通过校验的候选保留 `status: rejected` 与失败原因，不静默删除
