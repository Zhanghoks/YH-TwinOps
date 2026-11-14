# YH TwinOps：永辉调改风格大型门店数字孪生（教学概念 · 独立作品集部分）

与 StoreX、StoreX-Chain 平行的独立部分。包含三块内容：

- **`large-store/`**：80m × 50m（约 4,000 ㎡）合成大型卖场的 3D 数字孪生演示——Three.js 门店、点击分区查看对象、四视图（立体/俯视/分区图/热力图）、确定性布局调改 Agent（目标解析 → 布局校验 → 同种子配对顾客仿真 → 方案排序）、模拟审批。技术细节见 [large-store/README.md](./large-store/README.md)，Agent 工具契约与验收要求见 [large-store/docs/AGENT_MVP.md](./large-store/docs/AGENT_MVP.md)。
- **`scene-map/`**：24m × 18m 生鲜区试点门店的 Blender 场景图（12 条货架通道 R01–R12、4 类商品），参数与再生方式见 [scene-map/README.md](./scene-map/README.md)。
- **`e2e/`**：真实浏览器冒烟测试（加载 → 3D 就绪 → Agent 出 3 方案 → 方案切换 → 热力图），补上原型打包时缺失的 WebGL 端到端验证。

## 运行

```bash
# 仓库根安装一次（three 提升安装到根 node_modules）
npm install

# 启动演示（默认端口 8766，可用 PORT 环境变量修改）
npm run dev -w yh-twinops
# 浏览器打开 http://127.0.0.1:8766/index.local.html   ← 本地 three，离线推荐
#              http://127.0.0.1:8766/index.html        ← CDN 版备用
```

交互：鼠标拖拽旋转 · 滚轮缩放 · 点击分区查看商品陈列 · 方案切换后场景同步变化。

可选 LLM 目标解析（不配置则用本地规则解释器，界面会如实标注）：

```bash
export LLM_BASE_URL="https://<your-api-host>/v1"
export LLM_MODEL="<your-chat-model>"
export LLM_API_KEY="<your-secret>"
npm run dev -w yh-twinops
```

## 测试

```bash
npm test -w yh-twinops          # 仿真引擎 5 项确定性测试（node --test，无浏览器依赖）
npm run test:e2e -w yh-twinops  # Playwright 冒烟（本机用已装 Chrome；CI 设 PW_SOFTWARE_GL=1）
```

## 数据声明（重要）

全部尺寸、库存、人物、货架坐标与模拟结果均为**合成数据**；空间分区以公开的郑州瀚海海尚店探店手绘为教学抽象参考——非官方、非测绘数据。证据登记见 [large-store/docs/EVIDENCE.md](./large-store/docs/EVIDENCE.md)。页面常驻"合成数据 / 非官方施工图"标记；模拟指标（平均路径、拥堵代理等）不得被表述为真实销售或客流结论。

## 许可

AGPL-3.0-only（与仓库一致；原型入仓前为 UNLICENSED，统一后追溯）。页眉 YH 圆标为自制字样标识，非永辉官方徽标；GLB 模型与平面图均为自制资产。原型与 Storewright 上游的关系说明见 [large-store/README.md](./large-store/README.md) 第 5 节。
