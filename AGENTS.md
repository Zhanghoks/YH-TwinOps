# YH-TwinOps 仓库协作约束

本文件用于放在 Storewright fork 仓库根目录，约束 Codex/Cursor 等代码代理。详见 `docs/yh-course/SPEC.md`。

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

## Agent skills

### Issue tracker

GitHub Issues：议题与 spec 发布到 `Zhanghoks/YH-TwinOps` 的 GitHub Issues；`gh` 命令必须显式 `-R Zhanghoks/YH-TwinOps`（origin 是上游 storewright，勿发错）。`.scratch/` 仅存历史归档。See `docs/agents/issue-tracker.md`.

### Triage labels

五个默认 triage 角色（needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix），以 GitHub issue label 记录。See `docs/agents/triage-labels.md`.

### Domain docs

单上下文：根 `GLOSSARY.md` + `docs/adr/`，一套术语服务整个 monorepo。See `docs/agents/domain.md`.

### UI SDK

工作台 UI 组件用 ui-sdk（`@ui-sdk/react` + `@ui-sdk/core`，仅 apps/web；React 19 已全仓就位）。用前先读 `node_modules/@ui-sdk/react/docs/llms.txt`（安装版本自带文档），按组件页的 Composition 组装；部件无样式，按 `data-slot`/`data-checked` 上皮。自建 ui-sdk 没有的组件时再查 `docs/core.md`。skill 已装：`.agents/skills/ui-sdk`。
