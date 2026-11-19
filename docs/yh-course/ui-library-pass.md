# Agent UI 开源组件方案

2026-11-18。仅修改 Agent 面板，不改门店几何或业务规则。

## 选型

- 沿用仓库约束的 UI SDK `@ui-sdk/react` / `@ui-sdk/core` 0.1.0-beta.5，Apache-2.0。Button、Field、Textarea、ScrollArea、Collapsible 保留原有键盘、标签及 agent 操作接口。官方 https://github.com/vercel-labs/ui 与 https://github.com/vercel-labs/ui/blob/main/LICENSE 。它是无样式交互库，不能指望安装后自动变美。
- 新增 `lucide-react` 1.75.0，ISC；命名导入图标，避免整体图标集合进入 bundle。官方 https://lucide.dev/guide/react 与 https://github.com/lucide-icons/lucide/blob/main/LICENSE 。原始许可证保存在 `docs/licenses/lucide-react-LICENSE`。
- 考察 shadcn/ui 的源码分发方案，但本轮不并行引入第二套交互基础，避免违背 AGENTS 的 ui-sdk 约束及重复实现无障碍行为。

## 实施

统一低饱和绿、墨色文本、轻边框、间距与字号；重设计欢迎区与四项任务卡；统一 Lucide 图标；把来源、时间、置信度拆成可扫读证据卡；压缩状态说明；把输入和发送动作整合为单个 composer。保留合成教学、离线规则、不执行门店操作提示，以及原有请求、降级、证据折叠、中文输入法行为。

## 验证

Web 类型检查、5 项 Web 测试、生产构建通过。实际 Firefox 桌面验证空态、预设提问及证据展开；768×900 响应式预览确认输入区能滚动到达。生产 bundle 仍有既有体积警告，本轮未做 3D 拆包。

`npm run notices` 在现有依赖树 `npm ls --omit=dev --all --json --long` 非零退出处失败，未改写原有总声明文件；新增 Lucide 完整许可已单独保留。未提交或推送。
