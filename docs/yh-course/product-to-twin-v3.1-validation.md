# v3.1 商品目录 → F077 单格 → 数字孪生 → Agent

审计基线：`e3313264c186015cac87ab32b6094719b38bd143`。实现边界与用例见 [v3.1 规格](spec-product-to-twin-v3.1.md)。

## 数据来源与运行边界

- **陈列**：16 个内置示意 SKU 和 596 个原有试点位置均来自项目现有商品目录和布局工厂。这是确定的**教学陈列事实**，不是对永辉实体门店的观测。`authority-data.json` 固定原 596 组关联及布局授权，可用 `node --import tsx scripts/export-yh-merchandising-authority.ts` 重建并比较。合法覆盖只改变一个已核验的 F077 `placementId` 所对应的 SKU，`fixtureId/sourceSlotId` 不变。
- **商品**：本机 SKU 和陈列分开保存。本机商品沿用已有原创模型模板的尺寸和适用温区；录入不会自动上架。只接受 130×100 密集教学场景的已核验货位；80×50 原型没有这批陈列上下文。`SEED` 和 `USER_SANDBOX` 始终区分。
- **库存**：库存必须来自独立的合成观测，包含门店、SKU、设施、观测时间、接收时间和来源。演示来源为 `synthetic-stock-fixture`，示例读数 7 件，有效期 5 分钟。无有效读数为 `UNKNOWN`，既不代表零，也不从 3D 模型数、销售量或试摆换算。会话观测不持久化。
- **Agent**：两个工具均为只读。在线（不配置 LLM 的 Fastify 规则服务）和断线（浏览器规则）共用事实投影。服务端不信任浏览器声明；对照基线、货位边界及模板约束重新验证。没有 POS/ERP 接入、实际库存写入、生产审批或实体执行。未调用外部 LLM。
- **范围**：不做全店批量替换，不更改 F029/F050/F074/F107 当前模型；F077 的既有同款铺满与单格试摆互斥。保持一个店景 WebGL 画布，商品目录继续使用现有 SVG 预览。单格从对应的明细控件选择，不提供批处理或 3D 单商品点击。
- **许可**：新增功能按仓库 AGPL-3.0-only 分发；没有新增第三方依赖、贴图、品牌图标或重新授权的资产。保留 Storewright 与 Beautiful UI 既有许可和 [第三方声明](../../THIRD_PARTY_NOTICES.md)。

## 回退

在「商品目录 → 试摆到货位」点「撤回单格试摆」即可恢复原 SKU 与位置；不会删除本机商品目录。损坏/不兼容的数据安全回退到基线；也可仅删除浏览器键 `yh-twinops:placement-overrides:v1`，不触碰全站存储。刷新只恢复已应用的试摆，不会延长合成库存观测。PR 未合并时关闭 PR、删除功能分支即可；将来若经批准合并，则在新 PR 撤销对应合并/功能提交，不重写 `main`。

## AT-01–16 证据

| 用例 | 证据与检查 |
| --- | --- |
| AT-01 | `merchandisingAdapter.test.ts` 将全部 596 个陈列关联逐项与原工厂对比；16 个 SKU；无观测时读数为空。 |
| AT-02 | 适配器用 `YH-LOCAL-001` 验证不自动陈列；浏览器通过「新增商品」保存本机 SKU，在目录中显示 SVG 模型。 |
| AT-03 | 通过真实 `sourceSlotId` 试摆；适配器断言只改变一个 SKU。近/远档位几何测试校验原挂点与其余陈列不变；云端 Firefox 观测到单格实景替换。 |
| AT-04 | 纯函数/适配器验证非法货位、越界尺寸、错误温区；Web 组件检查拒绝状态；实际 Firefox 拒绝冷藏鲜奶试摆到常温 F077，保留原 SKU，应用按钮不可用。 |
| AT-05 | 既有同款填充单元测试、互斥组件测试、实际批绘几何拒绝；Firefox 实测已有同款铺满提示先撤回、阻止单格；撤回同款后恢复单格入口。 |
| AT-06 | 设施详情从当前布局取位置，商品目录、设施面板和 Agent 对比有效 SKU、F077 及同一货位。商品页面不新增 WebGL 画布。 |
| AT-07 | 适配器验证 80×50 及偏移/旋转不符的设施无权沿用 130×100 陈列。云端 Firefox 实测 130×100 → 80×50 → 130×100；80×50 不继承试摆上下文，试摆不可用。 |
| AT-08 | API 和浏览器工具对照 F077 来源、真实试点关系和 `USER_SANDBOX`；两个工具名可在证据面板看到。 |
| AT-09 | 纯函数、规则、API 和 Firefox 手工验收验证没有证据时返回 `UNKNOWN`，未知与实际读数 0 分开。 |
| AT-10 | 注入一条合成观测，只更新目标 SKU/设施；规则、API 和实际 Firefox 详情及问答验证来源与数量：合成读数 7，未接入实际库存。 |
| AT-11 | 纯函数、规则和 API 检查观测按事件及接收时序去重，忽略未来读数，过期不恢复较老读数且保留时间及证据。 |
| AT-12 | 实测在浏览器已加载时，仅让回环代理的 API 返回 HTTP 503；同一 F077/SKU 在两侧均为 UNKNOWN，浏览器明确标注离线。离线组合问句保留两个只读工具和 160 条陈列证据；API 测试另逐项对比有效与过期库存。 |
| AT-13 | API 测试省去可选上下文，接受旧格式并在商品问答返回 `UNKNOWN`；同样编入浏览器脚本。 |
| AT-14 | 应用/撤回后逐项比对原 596 陈列；组件、存储、几何核对互斥与回退；实际 Firefox 同机位撤回，恢复原 SKU 和 596 个陈列。 |
| AT-15 | 严格 DTO/授权清单与 API 注入测试拒绝超预算、伪造范围/库存来源、额外几何或恶意字段；无商品服务端写接口。 |
| AT-16 | 根回归覆盖原收银仿真、审批、三视图及填充；保留单一店景 Canvas；云端 Firefox 观察到全店、俯视、入口、收银方案对比和审批面板；切换目录/看板后返回原相机。自动化旧工作台浏览器用例未进入测试正文，详见下方。 |

## 实际测试

- `VITEST_MAX_THREADS=3 VITEST_MIN_THREADS=1 npm run check`：全仓 TypeScript、根测试 **803/803**（96 文件）、Web 组件 **36/36**（14 文件）。
- `npm run build -w @yh/web`：通过。Vite 的大 chunk 提示仍存在；未做性能 SLA、实机 GPU 矩阵或跨浏览器承诺。
- `npm ci --dry-run --offline --ignore-scripts --no-audit --no-fund`：在隔离的 manifest 快照验证 lockfile，无新增外部依赖。这不是一次干净的联网安装；用于构建的是现有本地依赖及本分支工作区包。
- 生产 Web bundle `index-exwYga04.js` SHA-256: `b0eae31165f4254011d0a01e877b95e23e876811717a424a24a83568e21ff21f`。
- 原陈列权限清单 SHA-256: `30ee27f607d5a82ebd1eac982a6999b8d305a337875ea2761dbf09dac0e0e007`。

### 浏览器验收记录

候选生产 bundle 已在 macOS 上用 Chrome/Playwright 真实启动，检测到 WebGL2 绘图缓冲区 828×867。已观察到本机 SKU 录入、合法 F077 挂点预览、实际 Fastify `/api/agent/ask` HTTP 200、正确的 SKU/格位和两个工具，以及无库存观测时的 `UNKNOWN`。首次完整运行未通过测试脚本的模板选择及工具面板遮挡断言；后续已修正测试脚本，但复跑截图权限超时，未运行修订版。**这不是浏览器 E2E 通过记录。** 以下云端原生 Firefox 记录单独列出后来实际补验的项目；不将两轮混记为完整 Playwright 通过。

用户随后指定只在助手的云端电脑验收，不再使用 Mac。用同一生产 bundle 在隔离的云环境启动真实规则 API，`/api/health` 返回 `rules-local`；另复跑 32 个相关自动化测试，全部通过。云端 Chromium 启动被环境的 Unix socket 限制阻断，内建云浏览器也无法连接到执行环境的回环地址；当时可启动的无头 Firefox 能截图，但拒绝创建 WebGL2 上下文。此限制仅描述早期路径；下文另有云端原生 Firefox 的实际 WebGL2 证据。

另在云端实际 Firefox（不含 WebGL2）人工等效复现：录入 `YH-LOCAL-CLOUD-001`，F077 `0-1-0`（模块 1 正面第 1 格第 1 层）从 `YH-DEMO-004` 示意饼干盒临时改为示意罐；详情显示新 SKU 和 `UNKNOWN`。真实规则 API HTTP 200，返回同一货位、`USER_SANDBOX` 和 `UNKNOWN`；撤回后目录仍为 596 个陈列。目录和 Agent 截图属于实际功能证据，不是 3D 画面验收。

### 无 WebGL 时的可用性修复

云端 Firefox 复现：WebGL2 初始化失败时旧版只显示错误提示；同时一次常规 F077 双工具问答正文长达 17,324 字符，包含 160 条逐项引用。修复后渲染失败自动降级为同一布局的 SVG 平面图，设施选择仍驱动右侧详情；保留重试 3D 按钮。Agent 优先显示试摆、新 SKU 与未知库存，完整证据在轨迹中展开，不把陈列当库存。

云端真实浏览器复跑生产 Web bundle `index-CVrseZKz.js`（SHA-256 `bd6d5ee0e9b04ee80b89d6a414f735065a53be9677c8a26362e78c7771b22497`）和当前 Fastify：二维定位 F077、查看经营看板、录入 SKU、试摆 `0-1-0`、实际 API HTTP 200、两工具和 160 条证据保留、正文降为 509 字符、撤回恢复 596 位，均已观察。此处的二维截图不证明 WebGL 3D 视觉效果。

此次修复回归：`npm run check` 通过（TypeScript、804 项根测试、38 项 Web 组件测试）；生产构建通过。


### 云端原生 Firefox：真实 WebGL2 与试摆

- 在助手云桌面的原生 Firefox 实测，不使用用户 Mac。独立 WebGL2 像素探针通过：软件渲染器 llvmpipe，绘制并读回 RGBA `[255, 64, 0, 255]`。实际应用使用 `d1c6a6193b6892c82ea0ea4f70b0e27d04a00f01` 的生产 Web bundle（上述 `index-CVrseZKz.js`）和真实 Fastify 规则服务。实际整店画面曾观察到约 15–18 FPS，只记录当时运行情况，不作性能承诺。
- 从商品目录新增示意金属罐 `YH-LOCAL-CLOUD-001`，预览 F077 `0-1-0`：原模板 `YH-DEMO-004` 示意饼干盒，规格从 125×220×85 mm 改为 76×120×76 mm。应用后在真实 3D 场景定位同一格，右侧显示新 SKU、`USER_SANDBOX` 与 `UNKNOWN`；F077 的 160 个陈列格是摆放位置，不是库存。以同一机位撤回后，原 SKU 恢复，目录恢复 596 个陈列。
- 实际切换 130×100 → 80×50 → 130×100，80×50 不沿用密集版的试摆授权，试摆不可用；回到密集场景后恢复相应上下文。另对种子 SKU `YH-DEMO-004` 注入合成库存观测，详情与真实规则 API 问答显示 `OBSERVED`、7 件、来源 `synthetic-stock-fixture`、证据 ID `teaching-stock-1` 和 UTC 观测时间。不是实体库存。
- 截图使用原有节能画质、相同货架机位；顾客随时间移动。另测低负载配置：在节能画质基础上关闭体积云、暂停车流和顾客动画，验收仍保留货架、商品与视角切换；暂停后 FPS 不可比，未宣称提高帧率。以下是实际浏览器画面： [整店](evidence/v3.1-firefox/01-store.jpg)、[原纸盒／撤回恢复](evidence/v3.1-firefox/02-f077-original-restored.jpg)、[试摆后的金属罐](evidence/v3.1-firefox/03-f077-applied.jpg)。
- 此节记录实际完成的操作，不代表完整 Playwright 套件或所有浏览器通过。云执行环境实跑 `npx playwright test -c playwright.yh.config.ts --reporter=line`：3 个测试（Product-to-Twin offline、Product-to-Twin real rules API、白膜工作台全链路）均未进入测试正文，统一报 `browserType.launch: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`。自动化 Chromium 通道未验收；上面列明以原生 Firefox 手工验证的实际结果。
