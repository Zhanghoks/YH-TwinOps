# 编码 Agent 执行指南

> 配套文档：[YH-TwinOps-SPEC-v2.md](./YH-TwinOps-SPEC-v2.md)。本文件可单独复制到仓库 docs/yh-course/CODEX-PROMPTS.md。
> 不要一次性提交全部 Prompt；先在原 Storewright fork 中安装依赖并锁定提交。每阶段要求输出文件 diff、测试结果和未完成项。

## 本地准备

```bash
git clone https://github.com/Glacieerr/storewright.git
cd storewright
git switch -c feat/yh-twinops 1554726c7d084b75eca33fc5f99660e3749ad475
node --version    # 22+
npm ci
npm run check
npm run dev
```

把完整 SPEC 文件放在 `docs/yh-course/SPEC.md` 后，再依次复制下面 Prompt A 到 Prompt F 给编码 Agent。仓库版本如不同，先重新审计。

# YH-TwinOps — Codex / Cursor 分阶段实施提示词

> 原则：不要一次让编码 Agent “把整个项目做完”。每个任务都必须**先读取指定上游文件、记录实际接口、只完成本 Sprint、运行检查、截图或回归报告、提交有界改动**。将本 SPEC 放到 fork 仓库的 `docs/yh-course/SPEC.md`，提示词只引用此文件。可配一个精简 `AGENTS.md` 强调不得伪造实验结果。

### Prompt A — 审计上游并冻结基线

```text
你现在是 TypeScript/React Three Fiber 工程负责人。先不要写任何新功能。
完整阅读 docs/yh-course/SPEC.md 的 0、1、3、16、18、27 节。
检查 apps/simulator/src/scene/Scene.tsx、Shelves.tsx、layout.ts，
apps/simulator/src/state/store.ts、ui/DataPane.tsx，
packages/store-config/src/{schema,editing,validate,model}.ts，
apps/simulator/src/sim/{worker,client,protocol}.ts。

执行 node -v、npm ci、npm run check、npm run dev（若环境无法启动浏览器则明确记录）。
输出：1）上游真实能力清单；2）本项目新增功能和会修改的文件；
3）可能的类型/版本冲突；4）基线测试结果；5）建议的最小集成点。
禁止虚构路径/接口，不修改上游通用代码，不开始编码 Agent。
```

### Prompt B — 只生成 Three.js 永辉教学门店场景

```text
只实施 SPEC 17–21 节（Sprint 1），不要实现 Agent/仿真。
基于 Storewright 唯一已有 Canvas，通过 Scene.tsx 增加 YHVisualOverlay。
实现：YHSceneManifest、程序化水果岛台、区域中文吊牌、主题灯光、
价签/商品代表几何、点击货架映射真实 run_id 和 categoryIds。
画面参考公开永辉调改店：深灰色天花、暖色重点射灯、开放主通道、
低矮中岛、生鲜与烘焙分区，但禁止下载未授权商标/新闻照片当贴图。
基线 StoreConfig 必须先通过 validateStoreConfig；
保留原版相机、原 Shelves InstancedMesh、场景时间轴与撤销功能。

请逐文件实施并在完成后运行 npm run check。
验收：正确出现门店、可点击货架，退出场景不泄漏 CanvasTexture；
场景不存在 2 个 Canvas，不得添加无业务 ID 的“可移动货架”。
保存全景、近景、选中货架 3 张截图并说明未完成项。
```

### Prompt C — 只开发顾客路径与拥堵模型

```text
只实施 SPEC 20、22、26 中 ShopperSim 的部分。
新增 packages/yh-shopper-sim（作为 npm workspace），
使用 StoreModel.path/distance 获取路径，品类位置取自有效 RunConfig。
使用两份合成输入的明确 category_id 映射，生成固定种子的购物清单。
计算平均行走距离、P90 行走距离、拥堵人分钟、完成率、轨迹与热图。
基线与候选必须共用顾客到达/购物清单/seed，并可复现。

请给出 10 个以上自动化测试，至少覆盖：
相同输入同结果、品类位置变化导致路径变化、不可达品类、
高峰到店时间、相同随机种子，以及纯视觉改动不改变 KPI。
注意：现有 scene/crowd.ts 只用于画面，不能直接当仿真指标。
输出真实测试结果，不得编造任何改进幅度。
```

### Prompt D — 开发工具调用式 Layout Agent

```text
只实施 SPEC 23、24、26 的 Agent 部分。
新增 packages/yh-layout-agent：目标解析、约束、候选生成、
复用 moveRuns/rotateRun/validateStoreConfig、对比评分和可观察 tool trace。
Agent 必须实现 get_store_state/get_layout_constraints/
propose_layout_candidates/validate_layout/simulate_shopper_flows/
rank_candidates/draft_work_order 至少 7 个真实工具。
先提供零 API Key 的中文规则解析路径，再考虑可选 LLM。
LLM 永远不能修改 StoreConfig 或虚构数值。
同种子实验应复现；不合法候选不可排名；所有方案变差可建议不调整。
只返回可复核的文件 diff、类型检查结果与单测结果。
```

### Prompt E — 集成 UI、3D 预览和人工审批

```text
只实施 SPEC 16、21.5–21.6、24、25、26 的集成部分。
新增 DataTab='yh-agent' 和 lazy YHAgentPanel；
把任务输入、目标确认、ToolTrace、候选比较和审批放在现有右侧数据区。
用 YHLayoutPreview 画 ghost before/after；不允许在审批之前修改 useApp.config。
新增独立 optimization.worker.ts，不侵入旧的 sim.worker 消息协议。
批准时校验 baseHash/审批角色/有效性，然后通过
enterEdit→loadDraft→exitEdit(true) 提交**模拟**布局。
支持拒绝、过期状态、重试、撤销与导出模拟任务单。

请实现 8 条 E2E 核心用例并运行上游 npm run check。
至少输出 4 张新功能截图和自动化结果；不得宣称接入永辉真实 ERP。
```

### Prompt F — 生成课程材料（所有结论必须可审计）

```text
根据 docs/yh-course/SPEC.md 第 1、2、5、9、10、11、12、13、27 节，
整理期末作业材料：
1）约1500字的调研报告，区分公开事实与未验证假设；
2）业务架构、数据架构、应用架构、技术架构四张图与文字解释；
3）3000–5000字企业数字化落地方案，包含系统集成、组织适配、
安全/技术/实施/运营风险与具体治理措施；
4）3–5分钟真实操作视频的分镜；
5）15–20分钟答辩 PPT 大纲与三人分工。

仅允许引用 docs/yh-course/source-register.md 中有来源的企业事实；
不得把 Storewright 自带模拟数据或本组合成实验写成永辉真实 KPI；
引用必须标明上游与原创贡献，并附每个实验的可复现参数。
```

## 全局约束（建议放到仓库 AGENTS.md）

```text
- 只在当前 storewright fork 修改，先读 SPEC，再读实际文件，不猜路径。
- 保持 AGPL-3.0 源码署名、许可义务；不得把上游功能冒充原创。
- 不创建第二个 3D Canvas，复用 R3F 场景和 StoreConfig。
- 先写纯函数与测试，再做 UI/场景联动。
- 生成候选必须先校验，不得修改 approved 之前的基线。
- 模拟/合成数据必须清楚标记；没有数据就不编造效果。
- 无 LLM Key / 断网情况下核心演示必须运行。
- 每个 Sprint 完成时报告修改文件、关键 API、测试结果与未完成项。
- 严禁绕过类型系统（any / ts-ignore）以掩盖错误。
- 不得把真实品牌 Logo、新闻图片或未授权 GLB 资产直接放入源码。
- 不触及 Storewright 原有不相关模块的行为，必须回归原有 Demo。
```

---

