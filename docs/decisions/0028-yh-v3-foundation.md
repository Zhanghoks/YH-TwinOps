# 决策记录 0028 · YH-TwinOps v3 基础：四缝包、中文第一语言与 GitHub Issues

> 状态：完成（2026-11-15）
> 背景：课程项目完成方向调整（ADR-000，见 issue [Zhanghoks/YH-TwinOps#1](https://github.com/Zhanghoks/YH-TwinOps/issues/1) 与 Sprint 0 将入库的 `docs/PRD.md`）：业务主线从"货架布局优化"转为"门店高峰运营状态的可观测性与干预决策"。本记录登记 v3 基础（feat/yh-v3-foundation 首个提交）引入的四项决定。

## 1. 决定

| 项目 | 以前 | 现在 |
|---|---|---|
| 新孪生后端包 | 只有 Storewright 的 `packages/*`（作业核心） | 新增 `packages/contracts`、`packages/twin-state`、`packages/simulation`、`packages/agent`（`@yh/*`），实现 spec 的 S1 投影缝、S2 收银仿真缝、S3 Agent 工具缝；与旧布局引擎（`YH-TwinOps/large-store/simulation.js`）并列共存，后者不作主线 |
| 包内文案语言 | CONTRIBUTING 规定 `packages/*` 不写中文字符串字面量（拒绝是代码，在应用里翻译） | **`@yh/*` 四包以中文为第一语言**（店长问答、告警 reason、schema 报错），偏离 `apps/simulator` 的 i18n 扫描（测试中以注释注明，同 `yard`/`overlap-audit` 先例）；Storewright 作业核心包的规则不变 |
| YH 产品面 UI 语言 | CONTRIBUTING 要求 UI 字符串走 `t()` 翻译流程 | **`apps/web`（YH 工作台）同样中文第一语言**：用户是中国门店店长，spec 明确"移动端适配与多语言"出范围（PRD §13）；不走 `apps/simulator` 的 i18n 扫描（那是 `@storewright/simulator` 的测试口径） |
| 议题追踪器 | 本地 Markdown：`.scratch/<feature>/` + `Status:` 行 | **GitHub Issues**（`Zhanghoks/YH-TwinOps`），所有 `gh` 命令显式 `-R`（origin 是上游 storewright，fork 场景 gh 默认选错仓库）；spec 迁移为 issue #1；`.scratch/` 仅存历史归档；约定见 `docs/agents/issue-tracker.md` |
| 资产登记 | — | `assets/` 共享资产库：AI 生成资产（如 Tripo 3D）必须登记来源/提示词/任务 ID/许可并标 `aiGenerated: true`，candidate → approved 门禁（AGENTS.md「生成候选必须先校验」）；REUSE.toml 按 CC BY 4.0 标注 |

## 2. 要注意的

- **pi harness 作为 Agent 的 LLM 后端**：使用 `@earendil-works/pi-ai`（MIT）统一多 provider；无凭证/断网时默认走本地规则解释器（离线可演示），LLM 端点仅由服务端环境变量启用，凭证不进浏览器。
- **S2 已知简化**（2026-11-15 更新：资格/成本约束已补齐）：初版只校验通道总数与可用人数；现新增 `checkout_qualified_staff_count`（持收银资格人数）岗位资格约束与 `staffWageCnyPerHour`/`maxExtraCostCny` 成本/预算约束，违反即拒绝（AT-05），并修复 `extraStaff` 未计入服务容量的缺陷（每名调配人手折算 1 条服务通道）。结果仍一律表述为"模拟情景"。
- **测试接缝**已与维护者确认：S1/S2/S3 为纯函数缝（55 项测试含 fast-check 属性测试），S4 浏览器 E2E 沿用既有 Playwright 惯例，属后续 Sprint。

## 3. 改了哪些文件

- 新增 `packages/contracts|twin-state|simulation|agent`（含测试）；`apps/simulator/src/i18n/i18n.test.ts` 排除 `@yh/*` 四包；`assets/README.md`、`assets/registry.json`；`REUSE.toml` 增 `assets/**` 标注；`AGENTS.md` 与 `docs/agents/issue-tracker.md` 更新追踪器约定；`.scratch/yh-v3-foundation/spec.md` 改为 issue #1 指针。
