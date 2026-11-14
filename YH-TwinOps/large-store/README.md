# YH TwinOps：永辉调改门店大型数字孪生（教学概念演示）

这是**独立的、可运行源码**，不是永辉的官方系统，也不是永辉门店的精确复刻。其空间分区以公开的郑州瀚海海尚店探店手绘图为依据进行教学抽象；**所有尺寸、库存、人物、货架坐标和模拟结果均为合成数据**。

## 1. 提供哪些成果？

- `index.html`：Three.js 浏览器演示（CDN 导入 Three.js，联网即可）。
- `index.local.html`：本地安装 Three.js 后不依赖 CDN 的版本。
- `app.js`：Three.js 3D 门店、点击分区、顾客动画、热力图、布局方案切换与审批 UI。
- `simulation.js`：独立可测试的确定性网格寻路、碰撞校验、顾客动线仿真、3 套布局策略。
- `layout.json`：80m × 50m、17 区、150 个陈列/设施对象、3 组共 24 个模拟收银位；**教学假设**。
- `assets/floorplan.png / .svg`：按公开手绘图的品类关系重新绘制的分区示意。
- `assets/yh-large-blockout.glb`：可导入 Blender 的低面数块体模型（约 310 个节点）。
- `assets/yh-large-concept.glb`：含商品体块的细节版本（约 4,500 个节点）。
- `server.py`：静态文件 + 可选 LLM 经营目标解析 API。默认不需要 API Key。
- `export_glb.py` / `build_layout.py`：从数据生成 Blender 模型与平面图，便于改造。
- `docs/BLENDER_TO_THREE.md`：两条 3D 开发技术路线及与 Storewright 的集成思路。
- `docs/AGENT_MVP.md`：智能体工具定义、交互状态、评价公式、验收要求。
- `docs/EVIDENCE.md`：真实资料、推断与合成参数的区别。

## 2. 如何运行？

### 方案 A：最快启动（需要能访问 CDN）

```bash
cd yh_twinops_demo
python3 server.py
# 在浏览器打开 http://127.0.0.1:8766
```

`server.py` 同时提供一个可选 LLM 解释端点。没有配置模型时会使用明确标注的本地规则解释器。浏览器通过 CDN 载入 Three.js；网络受限制时使用下方本地方式。

### 方案 B：本地 Three.js（推荐）

需 Node.js 18+，联网安装一次依赖后即可离线运行前端：

```bash
cd yh_twinops_demo
npm install
python3 server.py
# 浏览器打开 http://127.0.0.1:8766/index.local.html
```

### 可选连接兼容 Chat Completions 的模型接口

```bash
export LLM_BASE_URL="https://<your-api-host>/v1"
export LLM_MODEL="<your-chat-model>"
export LLM_API_KEY="<your-secret>"
python3 server.py
```

API Key 仅在本地 `server.py` 环境变量中使用，绝不能写入前端代码。模型仅解析目标和权重，无法直接调用企业数据库或跳过布局验证。未配置时功能仍可操作，但不能声称已使用真实大模型。**本项目没有连接永辉的任何生产系统。**

## 3. 可以演示的交互

1. 查看三维虚拟门店，鼠标拖拽旋转、滚轮缩放。
2. 点击门店分区，查看合成业务对象数量与空间坐标。
3. 切换俯视、立体、二维分区图及客流热力。
4. 输入经营目标并运行 Agent 流程，执行布局校验、顾客路径模拟、指标比较。
5. 切换候选方案，3D 货架随之改变，回放顾客运动。
6. 审批某方案（浏览器模拟行为，不提交真实采购和改造任务）。

顾客每次使用同样的合成购物任务与随机种子来做配对对比，路径长度与热度由布局中不可穿越的货架几何和最短路计算得出，不是 LLM 猜测。当前“拥堵”是路径共用量代理指标，**不是经真实顾客测量校准的行人动力学模型**。

## 4. 已验证内容 / 尚未验证内容

已运行 `node --check`、`npm test`（5 项纯逻辑测试）、GLB 反序列化检查、门店布局碰撞测试。测试覆盖候选合法性、可达性、模拟结果复现以及布局变化影响指标。

**尚未在当前执行环境完成真实浏览器 WebGL 端到端验证**：容器对本地浏览器访问实施了限制。因此需按第 2 节在实际浏览器中验证光照、性能、镜头和点击交互；不要将本原型描述为已通过全端测试或已部署。

## 5. 与 Storewright 的关系

本仓库是一个**独立的教学概念原型**；它没有直接复制 Storewright 的源码。逻辑架构参照其公开分层方式，但重新编写了可编辑分区、简单仿真与 UI。

如果要把这些功能合并到 Storewright，应注意原仓库代码使用 **AGPL-3.0**，文档通常采用 CC BY 4.0。遵守许可证，列明修改，并区分开源上游已有功能与本项目原创增量。实际集成步骤参见 `docs/BLENDER_TO_THREE.md`。

## 6. 数据来源

公开观察手绘与文章：https://www.sohu.com/a/838464583_484228  
公开的永辉门店经营面积（瀚海海尚店超过 3000㎡）：https://www.ccfa.org.cn/portal/cn/xiangxi.jsp?id=445814&type=2  
永辉上市公司关于调改通道、货架高度与分区目标的公告资料：https://money.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?id=12585224&stockid=601933

参见 `docs/EVIDENCE.md` 区分资料与假设。
