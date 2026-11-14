# 门店调改 Agent MVP — 实施与验证标准

## 目标
店长用自然语言描述经营目标，Agent 在**模拟**门店中提出几套合法的陈列改动，运行一致条件下的顾客路径实验，显示布局变化、拥堵代理指标、步行距离与陈列损失，最终交人工批准。

## 工具契约（当前原型对应的调用逻辑）

| 工具 | 参数 | 返回 | 原型位置 |
|---|---|---|---|
| `get_layout` | `storeId` | 版本化经营分区、货架坐标 | `layout.json` |
| `parse_goal` | 用户文字 | 目标权重、理由、解析模式 | `server.py:/api/agent/interpret` 或本地规则 |
| `generate_candidates` | `goal`, `baseLayout` | 基线 + 2 个结构化方案 | `simulation.js:candidates` |
| `validate_candidate` | `fixtures` | 是否碰撞/越界 | `simulation.js:validate` |
| `simulate_shoppers` | `fixtures`,`seed`,`basketTasks` | 路径、拥堵代理、到达与可达性 | `simulation.js:simulate` |
| `compare_candidates` | 结果与权重 | 配对指标比较、方案排序 | `app.js:runAgent` |
| `approve_plan` | `candidateId`, `reason` | 模拟状态标记（不写入生产 ERP） | `app.js:approve` |

模型能输出目标权重，但**没有执行 `moveFixture` 的任意代码权限**。当前候选方案来自白名单策略，未来可扩展参数化 `moveFixture` / `rotateFixture` / `removeFixture` / `allocateZone`，每步必须校验。

## 当前仿真具体计算

- 网格：80 × 50 米区域，1 米分辨率（边界有效格点为 79 × 49）。
- 障碍：按合成货架的真实平面包围盒加小量缓冲栅格化。
- 购物篮：68 条固定种子的合成多品类购物任务；每人从入口出发，访问其目标类别，选择最近可达的收银出口。
- 路径：四邻域 BFS 单位权最短路径（对固定栅格等价于 A* 的最短路线长度）。
- `avgDist`：每位顾客的平均路径格点数量，近似米数。
- `congestion`：根据多人访问同一格点的超额流量计算的**代理指数**。没有时间离散到达与碰撞避让，因此不能称其为真实“拥堵等待秒数”。
- 综合评分：`avgDist*walkingWeight + congestion*congestionWeight + removedFixtures*displayLossPenalty`。这些是可解释教学权重，不是永辉真实经济效益函数。
- 安全：不准生成越界、货架相交或不可达的方案。批准操作仅更改模拟前端状态。

## 课程 MVP 验收（P0）

1. 在浏览器中能查看整场三维门店，并能定位业务分区。
2. 运行 Agent，能显示至少 3 套实际不同的候选数据配置与指标。
3. 同一输入与随机种子重复运行，得到一致的路线长度和拥堵代理指标。
4. 候选中不出现货架重叠、越界、关键位置不可达。
5. 切换方案后视觉货架布局发生变化，热点与移动顾客路径也使用该方案数据。
6. 每个结果清楚标明“模拟 / 合成数据”，不得声称已真实部署永辉。
7. 人工审批不能绕过布局校验和模拟审查。审批操作可被日志记录；当前浏览器版仅做 UI 记录，生产持久化待接入。

## 下一版本（P1）

- 支持任意合法货架平移/旋转、非矩形店面边界、通道净宽与消防疏散规范校验。
- 按购物清单转移概率与结账容量运行离散事件客流仿真，经过实测校准后才能评价等待时间。
- 货架库存与 POS 数据按 `sku_id / fixture_id / timestamp` 关联；对照试点或真实访谈验证。
- 方案变更经过门店主管审批后持久化为 `LayoutPlan`, `ApprovalEvent`, `SimulationRun`，含审计与回滚。
- 真实 LLM tool-calling agent（只传受限 JSON schema 的操作；所有工具在服务端验证与执行）。

## 多种失败情况

- 不可达目标：返回 `UNREACHABLE`，不能用假结果替代。
- 货架重叠：返回 `COLLISION` 并给出 ID。
- API Key 不存在或模型失败：降级到本地解释器；界面须显示模式。
- 浏览器无法访问 Three.js CDN：使用本地安装模式，不隐藏加载错误。

## 与作业评分的对应

- 15 分调研：真实公开资料与合成假设分开、门店调改流程识别。
- 30 分 EA + MVP：业务、数据、应用、技术四层架构；3D + Agent 演示。
- 35 分落地：POS/ERP 对接、资产主数据治理、角色权限、阶段路线图、模型校准、组织培训和风险应对。
- 20 分展示：15–20 分钟 PPT 与 3–5 分钟操作视频。
