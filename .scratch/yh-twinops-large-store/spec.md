Status: ready-for-agent

# Spec：YH-TwinOps 第四部分——大型门店数字孪生（与既有部分平行的独立新部分）

> 来源：yh_twinops_demo 独立原型（80m × 50m 永辉调改风格教学卖场，Three.js + Blender GLB + 确定性仿真）迁入本仓库，作为与 StoreX、StoreX-Chain 平行的新作品集部分。所有尺寸、库存、人物、货架坐标与模拟结果均为合成数据；空间分区以公开的郑州瀚海海尚店探店手绘为教学抽象参考。

## Problem Statement

YH 大型门店数字孪生原型目前游离在仓库之外（zip 包形态）：不参与版本管理、不进 monorepo 的安装与测试体系、与已入库的 Blender 生鲜区场景图相互分离；原型文档明确记录"尚未在真实浏览器完成 WebGL 端到端验证"。课程答辩需要的是一个可安装、可测试、可一键演示、证据链完整的正式部分，而不是一个未入库的散装 demo。

## Solution

在仓库新增一个顶层作品集部分（与 StoreX、StoreX-Chain 同级、同构的 workspace 成员），将原型的全部可运行源码、确定性仿真引擎、合成布局数据、GLB 与自绘平面图资产、文档与测试迁入；注册进根 workspaces；保留纯逻辑测试缝隙并全部通过；新增一条 Playwright 冒烟测试补上真实浏览器验证缺口；部分内同时收纳既有的 Blender 生鲜区场景图，形成完整的 YH 数字孪生部分。迁移后原 Storewright 部分行为零变化。

## User Stories

1. As a 课程演示者，I want 用一条命令安装并启动大型门店 3D 演示，so that 答辩现场能快速打开场景
2. As a 课程演示者，I want 鼠标拖拽旋转与滚轮缩放 3D 门店，so that 能自由展示卖场各个角度
3. As a 课程演示者，I want 点击门店分区查看业务对象数量与空间坐标，so that 能讲解"分区 ↔ 数据"的映射关系
4. As a 课程演示者，I want 在立体 / 俯视 / 分区图 / 热力图四种视图间切换，so that 能从不同尺度讲解布局与客流
5. As a 课程演示者，I want 输入经营目标并运行 Agent 主循环（解析 → 校验 → 配对仿真 → 排序），so that 完整演示"目标到方案"的决策链路
6. As a 课程演示者，I want 无 API Key、断网时全流程仍可运行，so that 演示现场不依赖网络与外部服务
7. As a 课程演示者，I want 界面明确显示"本地确定性工具编排，不等于已接入商用大模型"，so that 不夸大 AI 能力
8. As a 课程演示者，I want 切换三个候选布局方案且 3D 场景同步变化，so that 直观展示调改差异
9. As a 课程演示者，I want 查看同种子配对指标（平均路径 / 拥堵代理 / 陈列节数）与基线差值，so that 有证据地比较方案
10. As a 课程演示者，I want 顾客轨迹按时间轴回放，so that 能讲解高峰期动线与拥堵热点
11. As a 课程演示者，I want 审批动作只写入模拟环境并明确标注，so that 演示人机协同审批而不触碰任何真实业务
12. As a 课程演示者，I want 页面常驻"合成数据 / 非官方施工图"标记，so that 观众不会误认为永辉官方系统
13. As a 答辩评委，I want 看到数据来源登记（公开观察 vs 合成假设），so that 能区分事实与教学假设
14. As a 答辩评委，I want 指标旁标注"非真实销售预测"，so that 不会被夸大陈述误导
15. As a 维护者，I want 新部分注册进根 workspaces，so that 一条 npm 命令完成全仓安装
16. As a 维护者，I want 仿真引擎既有测试在迁移后全部继续通过，so that 逻辑行为被锁定、迁移零回归
17. As a 维护者，I want 补充布局契约断言（合成标记、分区数、设施对象数、面积），so that 后续改数据不会悄悄破坏语义
18. As a 维护者，I want 一条 Playwright 冒烟测试覆盖"加载 → 3D 就绪 → Agent 出 3 方案 → 视图切换"，so that 补上真实浏览器 WebGL 验证缺口
19. As a 维护者，I want GLB 模型与自绘平面图随部分入库并注明来源与合成性质，so that Blender→Three 资产路线可复现、可审计
20. As a 维护者，I want Blender 生鲜区场景图与大型门店演示收纳在同一部分目录，so that YH 场景资产统一管理
21. As a 维护者，I want 部分目录带 README（运行 / 测试 / 演示方式 / 数据声明），so that 团队成员能自助上手
22. As a 维护者，I want 迁移不改动 Storewright 既有模块的行为，so that 原 Demo 与 npm run check 保持通过
23. As a 教学代理（编码代理），I want AGENTS.md 的协作约束适用于新部分，so that 后续 Sprint 遵守同一套规则（纯函数先行、合成标记、回归）
24. As a 教学代理（编码代理），I want spec 存于本地议题跟踪器并标记 ready-for-agent，so that 后续 Sprint 有可追溯、可认领的任务源
25. As a 访客，I want 页面与文档标注"教学概念演示 / 非官方"，so that 不误认为这是永辉的数字孪生系统
26. As a 课程演示者，I want 可选的 LLM 目标解析端点默认关闭、走本地规则解释器，so that 演示稳定且不泄露凭证

## Implementation Decisions

- 新增顶层作品集部分目录，与 StoreX、StoreX-Chain 平行；部分内含：大型门店 3D 演示子目录（页面、3D 场景代码、仿真引擎）、合成布局数据、GLB 与平面图资产、测试、文档，以及既有 Blender 生鲜区场景图子目录（原样收纳）。
- 部分包声明镜像既有部分的约定：private、AGPL-3.0-only（demo 原为 UNLICENSED，入仓后统一）、ESM、engines node >= 22、repository.directory 指向部分目录；运行时依赖固定 three 0.170.0；注册进根 workspaces。
- 迁移保形：仿真引擎公开接口（由布局构造引擎，返回校验、仿真、候选生成三组能力）与布局数据契约（synthetic 标记、17 分区、150 设施对象、出入口与收银组、主通道 3.0m、中岛货架高度上限 1.6m、面积约 4000㎡）保持不变；确定性随机种子算法不变。
- 浏览器入口保留双版本：本地依赖版为默认推荐（离线可演示），CDN 版为备用；静态服务脚本随部分保留，可选 LLM 解析端点默认关闭（无凭证时走本地规则解释器，且 UI 明示）。
- UI 行为保持原样：四视图切换、点击分区、顾客轨迹回放（进度滑杆）、方案卡片与模拟审批；"当前：方案 X · N 个经营对象"状态与图例随方案同步。
- 新增一条浏览器冒烟测试，接入仓库现有 Playwright 配置；不修改既有 e2e 用例与其配置行为。
- 资产与许可：自绘平面图与自制 GLB 在部分 README 中标注"自制 + 合成"；页眉 YH 圆标为自制字样标识，非永辉官方徽标；数据来源登记沿用原型的证据文档（公开探店手绘为分区参考，其余为教学假设）。
- 平行部分公约：不修改 Storewright 上游模块行为；根 package.json 仅追加 workspace 成员一项。

## Testing Decisions

- 好测试只断言外部行为：通过仿真引擎公开返回值（校验结果、平均路径、拥堵代理、失败数、路径条数）判定，不测内部实现细节。
- 迁移的 5 项既有引擎测试（合成元数据、基线几何无碰撞、候选全部可走通且 miss=0、同种子同指标、不同布局不同结果）全部保留并必须继续通过——这是迁移正确性的锚。
- 在引擎缝隙上补少量契约断言：出入口/收银组存在、三个候选互不相同且均可通过校验。
- 新增一条 Playwright 冒烟（唯一新缝隙）：启动静态服务 → 页面加载 → 3D 场景就绪（对象数状态出现）→ 触发 Agent → 出现 3 张方案卡 → 视图切换生效；断言走用户可见状态，不碰 canvas 内部。
- 回归口径：根 `npm run check` 通过、既有两个部分（StoreX、StoreX-Chain）测试不受影响。
- 先例：仓库既有 e2e Playwright 规范；引擎测试先例即 demo 自带的 node:test 用例。

## Out of Scope

- 不并入 Storewright 模拟器应用：不创建第二个 3D Canvas、不改动 R3F 场景与 StoreConfig（独立平行部分是本次明确决策）
- 不实现真实 LLM 接入与凭证管理（可选端点保持默认关闭）
- 不做真实客流校准、行人动力学仿真、真实销售预测
- 不引入任何真实品牌资产（官方 Logo、新闻图片、未授权模型）
- 不做移动端适配与多语言
- 不做部署/运维自动化（保持本地静态服务即可）

## Further Notes

- 原型打包环境未做真实浏览器验证（其文档自述）；本会话已在真实浏览器预验证：渲染、150 对象加载、四视图、方案切换联动、热力图、轨迹回放均正常——冒烟测试把这层验证固化下来。
- 实测演示数据（方案 A 平均路径 211.8m 基线、方案 B -0.1m / 热点 21.3 / 陈列 148 节、方案 C -1.7m / 热点 22.3 / 陈列 150 节）可作为答辩素材，但按课程 SPEC 口径表述为"模拟下略有改善"，无置信区间不宣称确定改善；方案 B 减少陈列需复核容量。
- 若日后获得 GitHub 仓库写权限，可用 `gh issue create --body-file .scratch/yh-twinops-large-store/spec.md --label ready-for-agent` 一条命令发布到远程跟踪器。

## Comments

### 2026-11-14 · Sprint 1 实施完成（迁移 + 测试 + 冒烟）

- **修改文件**：新增 `YH-TwinOps/`（package.json / README.md / playwright.config.ts / e2e/large-store.spec.ts / large-store/** 共 19 个迁移文件）；根 `package.json` workspaces 追加 `"YH-TwinOps"`（仅此一项）。
- **关键适配**：`large-store/server.py` 重写为 monorepo 版——`translate_path` 把 `/node_modules/*` 透传到仓库根 node_modules（npm workspaces 提升安装），本地 import map 离线可用；`/api/agent/interpret` 端点保留（无凭证走本地规则）。仿真引擎 `makeSimulationEngine` 与 layout.json 契约零改动。
- **测试结果**：`npm test -w yh-twinops` 5/5 通过；根 `npm run check` 通过（typecheck + vitest 42 文件 / 383 测试，上游零回归）；`npm run test:e2e -w yh-twinops` 冒烟 1 passed（2.6s）——原型"浏览器 WebGL 未验证"缺口已补。
- **未完成项**：根 `build:site` 静态站点未纳入新部分；部分 e2e TS 不在根 typecheck 范围（由 Playwright 转译）；`export_glb.py` / `build_layout.py` 原样保留、未验证运行；未提交 git（等用户指示）。

### 2026-11-14 · 站点接入完成（作品集首页 + 子路径托管）

- **修改文件**：`scripts/build-site.mjs`（parts 增加 YH-TwinOps/large-store → site/yh-twinops；组装时把站点副本的 import map 从绝对路径改写为相对路径，并随包分发 three 的两个模块文件到 site/yh-twinops/node_modules/）；`scripts/site-landing.mjs`（标题、Part 4 卡片）；`e2e/static-server.mjs`（新增整站模式：`node e2e/static-server.mjs site 4188`，默认行为不变，不影响既有 e2e）；根 `package.json` 新增 `npm run site`。
- **验证**：`npm run build:site` 成功；`npm run site` 后首页 200（出现 Part 4 卡片）、/yh-twinops/index.local.html 200 且 3D 场景就绪（相对 import map + 随包 three + GLB 全部 200）；已实机截图验收。

### 2026-11-14 · 代码审查（双轴）后修复与偏离记录

- **偏离如实记录**：① 冒烟测试未接入根 Playwright 配置，而是独立的部分配置（YH-TwinOps/playwright.config.ts，端口 8797）——根配置的 webServer 依赖 Storewright 构建产物与 8799/4177 端口，无法复用；② `docs/yh-course/`（课程 SPEC 与 CODEX-PROMPTS）随 AGENTS.md 一并入库——CODEX-PROMPTS 本身规定的第一步；③ 根 package.json 的 `allowScripts` 字段是 npm 安装脚本审批的产物（本会话开始前已存在），随本次一并入库；④ `npm run site` 脚本与整站托管模式属于站点接入追加需求（见上一段记录）。
- **审查修复**：REUSE.toml 增加第四部分标注（代码 AGPL-3.0-only，文档与生成资产 CC BY 4.0）；COMPLIANCE.md 增补第 11 节（中性产品名 / 合成数据 / 自制素材 / 许可）；`npm run notices` 重新生成第三方声明；sim.test.mjs 补 2 项契约断言（出入口与收银/设施数量、改动候选彼此不同且不同于基线）；static-server 整站模式加固（路径分隔符校验 + decodeURIComponent 异常返回 400）；.gitignore 增加 .zcode/、*.blend1、Blender 日志/标记、test-results/。
- **判断题（记录不阻塞）**：目标解析规则在 server.py 与 app.js 各一份（离线回退的刻意独立）；simulation.js 的 candidates() 绑定 layout.json 具体行号（迁移保形，后续再抽参数）；large-store/assets/vision_concept.png 为原型自带素材、暂无页面引用。
