# Blender → GLB → Three.js，或直接 Three.js：实施说明

## 总体建议

对于“Agent 自动调改货架”，**业务对象必须由 `layout.json` 或 Storewright `StoreConfig` 驱动**。3D 模型只是一种可视化表现层，不能把几百个货架都烘焙进一张不可编辑的大网格，再让 LLM 直接改模型顶点。

| 内容 | 优先技术 | 原因 |
|---|---|---|
| 建筑底板、空间分区、货架坐标、颜色、热力图 | Three.js 程序化 | 可参数化、可撤销、自动验证 |
| 生鲜岛台、熟食档口、烘焙橱窗、冷柜、品牌导视 | Blender 建模 + GLB | 美术质量高且可复用 |
| 购物顾客运动 | Three.js / 按路径动画 | 独立于美术资源，受仿真状态驱动 |
| 面向业务的 Agent | 结构化工具 API | 先校验和仿真，再提出人工审批建议 |

## 路线 1：使用提供的 Blender 基础模型（更快做真实视觉效果）

1. 打开 Blender，执行 `File → Import → glTF 2.0 (.glb/.gltf)`。
2. 导入 `assets/yh-large-blockout.glb`，这是便于修改的低面数模型，约 310 个节点。另有 `yh-large-concept.glb`，含约 4,500 个商品体块，浏览与编辑更重。
3. 不必自行重新规划分区；先保留入口、三组收银、左侧水产/肉类/熟食服务带、中央蔬果、后方烘焙、右侧包装食品/洗化。
4. 选择一个代表性水果岛台并按照片改细节：木色底座、分格托盘、果蔬堆体、价签、陈列灯、logo 导视。再制作鱼台、鲜肉柜、烘焙柜、冷冻柜、标准货架和收银台，共 6–8 类可复用资产。
5. **建议按单一设备原型建模**，局部原点位于地面中央，真实单位 1 Blender Unit = 1m，命名例如 `fresh_island_v1`、`meat_counter_v1`、`gondola_1p6m`。
6. 对每个原型执行 `Ctrl+A → Apply Rotation & Scale`，清理不可见物体，简化重复商品，使用 PBR 材质，并确保材质、贴图与知识产权来源清楚。
7. `File → Export → glTF 2.0` 选择 `.glb`，将资产原型导出到 Web 项目的 `assets/models/`。Blender glTF 导出会做轴系转换，**不要在 Three.js 再盲目旋转 90°**；检查朝向后固定一套约定。

### Three.js 读取单个 GLB 资产

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('/assets/models/fresh_island_v1.glb');
const prototype = gltf.scene;

// 仍然由数据对象决定世界坐标，不在 GLB 中写死经营布局：
for (const f of layout.fixtures.filter(x => x.type === 'produce')) {
  const instance = prototype.clone(true);
  instance.name = f.id;
  instance.position.set(f.x, 0, f.z);
  instance.userData = { fixtureId: f.id, zoneId: f.zoneId };
  scene.add(instance);
}
```

若你使用 `GLTFLoader.loadAsync`，需要 HTTP 服务；不能直接双击 HTML 后在 `file://` 下依赖 `fetch` 加载。当前可运行原型通过 `python3 server.py` 启动。

### 美术组件建议的 LOD

- LOD0：主视角可见的大型水果岛台、熟食档口与收银设备：细节丰富，但贴图复用。
- LOD1：镜头较远时简化商品包装与几何层级。
- LOD2：鸟瞰全场时使用 InstancedMesh/简单色块，减少 draw calls。
- 不建议为 4,000㎡ 门店逐个独立导出每一瓶饮料、每一包零食。

## 路线 2：直接 Three.js（本包已经实现）

`app.js` 已提供可阅读的实现：

1. 读取 `layout.json`，以 `zoneId`、`fixture.id` 维持数据与 3D 对象的映射。
2. `buildFixtureVisual` 对不同类型设备创建不同几何，并按材质分组为 `THREE.InstancedMesh`。
3. 用 `makeLabel` 创建 `CanvasTexture` 导视牌；用叠加平面标记区位。
4. `makeSimulationEngine(layout)` 根据货架占地构建不可穿越网格，计算购物路径。
5. Agent 产生 `candidate.fixtures`，先 `validate(candidate)` 再 `simulate(candidate)`，通过 `buildFixtureVisual(candidate.fixtures)` 更新真实的 Three.js 货架状态。
6. `drawHeat` 以 InstancedMesh 颜色块显示模拟拥堵热点；`makeShoppers` 按仿真路径更新低面数顾客。

业务状态是真正的 source of truth，避免 `scene.children[n]` 等脆弱的按序号寻址。

## 如何衔接 Storewright 原始仓库（不建议直接全量替换）

仓库：https://github.com/Glacieerr/storewright

现有关键模块：

- `apps/simulator/src/scene/Scene.tsx` — 既有 R3F Canvas、场景模块挂载点。
- `apps/simulator/src/scene/Shelves.tsx` — InstancedMesh 货架。
- `apps/simulator/src/scene/Storefront.tsx` — 已有门店门头、CanvasTexture 招牌能力。
- `apps/simulator/src/scene/layout.ts` — `buildGeometry(StoreModel)` 映射。
- `apps/simulator/src/state/store.ts` — Zustand 布局草稿、撤销、更新、运行仿真。
- `packages/store-config/src/schema.ts` — `StoreConfig`、`RunConfig`，与本演示自定义 JSON **不是同一个 schema**。
- `packages/store-config/src/validate.ts` — 原有布置校验。
- `apps/simulator/src/sim/client.ts`、`worker.ts`、`protocol.ts` — Worker 异步仿真协议。

推荐循序集成：

1. **不修改** Storewright 原本 `Scene.tsx` 中的相机、地面、可编辑货架基础设施。
2. 新增 `apps/simulator/src/yonghui/yh-reference.json`（当前 `layout.json`），并在 `apps/simulator/src/yonghui/` 建立 `YonghuiStoreOverlay.tsx`、`YonghuiAssets.tsx`、`YonghuiAgentPanel.tsx`。
3. 使用单独的 `yhCourse` 模式切换展示，避免同时渲染原版货架与新分区而发生重叠。
4. 编写**显式适配器**：把本 demo 的 fixture / zone 转换成 Storewright `RunConfig`（只转换通道/货架类），为生鲜岛台、服务柜台新增 typed extension，而不是 `as unknown as StoreConfig` 强转。
5. 使用 Storewright `validateStoreConfig` 对整份结果进行校验。注意它还校验楼层、目录、货位可达性与后仓连接，所以无法简单只替换 `layout.runs` 而不处理关联实体。
6. 接入原有 `updateDraft` / `loadDraft` / `exitEdit` 实现审批后变更和撤销，保留原有 event-sourcing 事件追踪思路。
7. 若使用当前纯 JS 的 `simulation.js`，可先用 Web Worker 作为独立仿真通道，之后把购物顾客指标接回原 `Timeline`。**不要把原项目仅用于绘图的顾客路径误认为已具有真实购物行为经济学预测。**

### Agent 操作约束

- LLM 只产生结构化 `LayoutChange[]`，不直接调用 Three.js 修改 mesh。
- 应用布局变更前运行几何、业务、通道连通性和权限校验。
- 基线和候选固定同一购物篮、随机种子与需求时段后对比。
- 审批前只保留候选预览，不改变门店默认状态；审批后以结构化配置保存，并提供回滚。

## 可进一步提升的真实感

真实门店照片只能作为装修与业态氛围的视觉依据。还原具体门店的精确布局，需要取得官方 CAD/竣工图、门店管理授权及实际货架清单；本包并不具备这些资料。
