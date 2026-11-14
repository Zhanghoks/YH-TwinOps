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

本地 Markdown：议题与 spec 存放在仓库 `.scratch/<feature>/` 目录，一个特性一个目录。See `docs/agents/issue-tracker.md`.

### Triage labels

五个默认 triage 角色（needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix），在议题文件顶部以 `Status:` 行记录。See `docs/agents/triage-labels.md`.

### Domain docs

单上下文：根 `GLOSSARY.md` + `docs/adr/`，一套术语服务整个 monorepo。See `docs/agents/domain.md`.
