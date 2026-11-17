# Full-store procedural detail pass

This is an original visual skin over `data/store-yh-01.layout.json`, not a measured reconstruction of a Yonghui branch. The layout, fixture IDs, collision envelopes, signals, agent logic, approved GLBs and approval baseline are unchanged.

## What changed

- The operations workbench now starts with **精细模型**. **原始外壳** retains the registry-approved GLB, and **白膜** remains available for geometry inspection. Model presentation is independent of metric overlays.
- Generic product packs and price rails on double-sided gondolas; wooden produce crates with fruit; refrigerated shelves, glass doors and handles; checkout belts, scanners and payment terminals; deli trays and display glass; door frames and service counters.
- Cutaway store envelope, tiled floor and restrained wall fascia add scale without a roof hiding operations. These visual additions do not claim measured architectural dimensions or operational capacity.
- 全店视角 / 俯视布局 / hide-label controls. Selecting any instanced part resolves to its original fixture ID.
- At most 12 geometry/material instance batches for fixtures; bounded detail counts; demand rendering and DPR capped at 1.5. This is a rendering strategy, not a measured FPS claim.
- No downloaded GLB, brand logo, third-party texture, live inventory claim, or second Canvas.

## Run

```sh
npm ci
npm run web
# optional approval API
npm run api
```

Use the workbench at http://localhost:5174, not the older simulator started by the root `dev` script.

## Tests and review

- Pure geometry tests check deterministic generation, no input mutation, positive/finite dimensions, all seven fixture types, and every part staying inside its fixture envelope.
- The full teaching layout is checked against a bounded instance budget.
- UI tests exercise model mode round-trips, repeated camera resets, label toggles and accessible control naming. These use a mocked Scene, not a WebGL renderer.
- Root TypeScript config now excludes `apps/web/**` because that app already has its own DOM-enabled typecheck in the aggregate command. Previously the root Node-only check included browser test setup and failed on DOM globals.

## Remaining acceptance work

The initial sandbox-launched Chromium could not create Unix sockets; the app-managed Chrome also reported WebGL disabled. A later cloud-only acceptance run installed the official Mozilla Firefox binary and used its default sandbox/rendering configuration. No unsafe graphics flags, sandbox disabling, Mac access or production deployment were used.

Verified in the running production build:
- The detailed 3D store actually renders in Firefox. Full-store, top-down and close-up screenshots were captured and delivered.
- Overview/top-view reset, zoom and hiding zone labels work.
- Clicking a detailed shelf highlights it and shows its original fixture ID `F049` and GONDOLA metadata in the operations panel.
- A WebGL initialization failure now remains inside a scene error boundary; operations and alerts remain usable (also covered by a regression test).
- The detail floor and base ground plane were coplanar. The base plane is now lowered in detail mode; the rebuilt close-up was inspected. Thin floor joints still alias at distance and need further visual polish.

Visual judgment: this is an improved procedural low-poly operations model, **not a photorealistic store**. Repeated fixtures/products, overly uniform dark shelf tops, sparse lighting/signage and default label overlap remain visible. GPU/FPS measurements, all fixture picking variants and the full acceptance matrix below are still not verified. Continue review before merging:

1. Inspect full-store and close-up views in detail, original shell and white modes.
2. Click shelf products, produce, checkout and freezer parts; confirm facility details retain original IDs.
3. Change all data overlays; verify unknown/stale labels remain honest.
4. Repeatedly reset/top-view, hide/show labels, and resize the Agent split pane. Confirm exactly one Canvas and usable controls at 1280px and 1440px widths.
5. Run the existing YH approval E2E flow and visually review shadows/glass on the target machine.

This pass is deliberately a draft until that visual acceptance is complete. Fine asset art direction, ceiling services, walk-through camera, measured store capture and real sensor/POS ingestion are not implemented here.

## Reference-driven iteration (cloud Firefox)

The owner supplied a rendered supermarket cockpit reference. This is an art-direction reference, not evidence for its displayed sales, visitor counts, measured area, or brand permission. The runnable teaching layout remains 80 × 50 m and its data remains synthetic.

- Open gondola top spines and narrow freezer headers replace full-depth dark lids. Generic cartons, bottles and jars vary deterministically; produce colors/placement are less uniform. Fixture geometry remains inside the existing envelopes (17,907 parts, seven material/primitive batches).
- A tested, bounded perimeter generator adds a generic red fascia, partial glazing, window frames, exterior planting and rear luminaires. All architectural parts remain outside the operating floor; no new interior collision objects or second Canvas.
- Compact readable wayfinding removes redundant raw IDs. The clipped world-space teaching caption is now a fixed overlay with layout dimensions.
- The first actual Firefox screenshot exposed an obscured rear light strip and an overly thin fascia. A second build moves the wall behind the light strip and enlarges the fascia, then repeats screenshot review. The updated shelf `F086` was clicked, highlighted and linked to its original semantic metadata.
- Validation: full `npm run check` passed 481 root tests and 3 web tests. After the small second-pass architecture adjustment, 16 geometry/architecture tests, web typecheck and web build passed.

Still visibly short of the reference: no photoreal scanned/PBR assets, category-specific merchandising diversity, populated shopping simulation, believable ceiling services, detailed entrance plaza or measured shop capture. The scene remains a simplified procedural model. No invented live KPIs or fake heatmap population were added just to imitate the image. Screenshot review is not an FPS benchmark or full acceptance of every mode/fixture.

## 第三轮：品类细节、入口与独立规划候选

- 原始布局不变。饮料、包装食品、洗化、散称具有不同的商品形状与配色；当前装饰共 16,857 个实例、7 个批次，不是真实 SKU/库存。
- 入口增加外部铺装、低花池、购物车围栏和专用入口视角；默认光照调整为温暖中性。不是实测建筑复原。
- “布局检查”可在原型基线与独立规划候选之间切换，默认仍是基线。候选重排全部 150 个设施，保留 ID、尺寸、fixed 标记及业务元数据，同步 17 个部门的语义 polygon，并禁用基线 GLB 外壳以防错位。
- 候选预留中央 4m 几何带，收银移至前场，两侧按部门组织。它探索性移动了原型 fixed 设施，尚未批准，不修改源布局或部署资产。
- 几何检查：基线/候选均无实体重叠、无越店界；小于 1m 的正交近邻间隙 45→0 对；超出所属分区的设施 56→0 个；候选包围盒最小间距 1.2m。近邻间隙不是通道净宽，分区调整也不代表业务收益。
- 入口位置是假设；未做导航连通性、消防、无障碍、服务排队和人流收益验证。现有合成信号按保留 ID 展示，不是候选布局的仿真结果。切换布局会清空选中设施并关闭数据叠加，底部始终标注候选属性。
- 云端 Firefox 原生浏览器实际检查入口视角和候选俯视渲染，未操作 Mac。候选主通道与前场明显比基线清楚，但右前部留白较大、收银朝向和真实工作流仍需下一轮细化。材质和重复商品仍属低多边形程序模型，并非参考图那样的照片级场景。
- 验证：全量 typecheck；根测试 497/497；Web 测试 3/3，包含候选/基线可逆切换、ID 保留、基线外壳禁用；生产构建通过。构建仍有大 chunk 警告（约 1.55MB / gzip453KB），未宣称帧率验收完成。

## 第四轮：前场组织与轻量材质

- 独立候选后场移至右后侧，距后墙 1m；洗化和日配调整至右前，休息区移至前场外侧。三组收银各为 2 排×4 台，尚未模拟排队方向或收银服务流程。
- 保留中央 4m，新增全宽横向衔接带 z=[14,17]（3m）。遍历全部150设施验证无 footprint 侵占；最小设施间距仍1.2m。淡绿色只是候选规划叠加，不是实测或已施工的地面标线。
- 共享64×64程序化纹理增加木纹、金属粗糙度、抽象包装带、果蔬细微表面；不增加几何批次或实例数量。使用mipmap，卸载释放GPU纹理；没有外部品牌或SKU贴图。
- 云端Firefox实际观察俯视及放大三维视图：后场位置、收银组团及十字衔接清晰；表面改进偏细微，远景主要仍由几何与配色决定。右侧仍保留较大缓冲空地，不能据此声称面积利用最优或拥堵改善。
- 本轮全量检查：根504项、Web3项通过，typecheck和生产构建通过；仍有大chunk警告（约1.554MB/gzip455KB）。

## 新分布图对齐：130×100m 独立候选

以用户上传的《永辉超市数字孪生旗舰店布局(1).png》为新构图依据，替代此前自由探索的候选；默认80×50m原型和源JSON/GLB保持不变。参考图自述概念图/非官方施工图，不是实测门店。

逐区对照约定：北为−z，南为+z，左西右东。
- F01果蔬：西南；F02客服/入口：南侧偏左，购物车在西南角。
- F03水产、F04鲜肉：西北并列；F05熟食/现制：其南侧、西中部。
- F06冷冻冷藏：中北横向；F07烘焙、F08乳品日配：东北侧。
- F09食品百货：中部横向排架，原散称/精选语义ID保留在该图面分区中；F10酒水饮料：中南偏左、长轴南北；F11日化家居：东侧中下部。
- F12收银：南侧偏右单横排24台，分12+12两组，台体长轴南北。原收银业务区ID不改，图面总分区只标F12，不捏造合并后的指标。
- 北侧后勤带：西北4个通用卸货车位、后仓架、中东加工间、东北两个冷库，以开放低墙表达。后勤装饰会避开经营设施footprint，不创造库存/车辆业务记录。

150设施ID、17部门ID、类型和业务元数据保留，全部平面尺寸均按图近似推定，原高度保留；report.changes记录前后位置、尺寸、方向。参考区界由图像手工解释，实际设施仍是代表性数量，尚未逐件复制图中所有货架、墙门、机电、人物或品牌包装。不应称为像素级或施工级复刻。

图上12区面积明细合计15,000㎡，与其卖场约11,000㎡、总计约13,000㎡不一致。本候选沿用图上约130×100m外框和相对关系，不将面积明细当可靠测量值；UI说明此差异。旧中央4m/横向3m十字通道被移除，因为不是新参考图的要求。

验证：0实体重叠、0越界、0超所属语义分区、最小设施间距1m；后勤装饰与150设施逐项OBB审查通过。全量typecheck、根509项、Web3项通过；构建通过。实际Firefox俯视发现初版两个冷库标签重叠、取景偏远，已缩短标签并调整相机再次验收。通道可达、真实收银流程、消防及商业效果仍未验证。

首次进入参考候选还发现F01标签漏显，手动隐藏再显示可恢复。已改为相机稳定后挂载参考DOM标签，并提供标签层级缺省值；Firefox整页刷新后首次进入候选，F01–F12均显示，不再需要手动切换。保留按需渲染，不新增常驻动画循环。

## Reference alignment density pass (2026-11-17)

The supplied 130×100 m concept drawing was compared directly with the previous Firefox top view. The previous pass got the macro-department positions right but was visibly too sparse. This pass keeps the original 150 operational fixture IDs and 17 zone IDs. It does not change the baseline or assert a surveyed reconstruction.

| Area | Observed previous mismatch | This pass | Remaining difference |
| --- | --- | --- | --- |
| F01 produce | Repetitive 3-column grid versus irregular islands and perimeter produce | Position retained | Diagonal islands and perimeter produce still need tracing |
| F02 service / entry | Thin one-sided desk and sparse carts | U-shaped service desk, entrance side glazing, 60 nested cart representations | Cart count is illustrative, not an exact image count; door details are inferred |
| F03 seafood / F04 meat | Uniform rows lacked perimeter counters | Disconnected U-shaped perimeter counters plus islands | Reference bevels/angled ends remain simplified |
| F05 deli | Sparse regular islands | Position retained | Perimeter counters and staggered cooking islands remain simplified |
| F06 frozen | Two sparse horizontal rows | Four long rear counters, four horizontal and four vertical islands | Exact door/bay count not traced |
| F07 bakery | Repetitive small islands | Position retained | Reference baking perimeter and clustered tables still simplified |
| F08 dairy | Only three horizontal counters | Seven horizontal plus one east vertical counter | Five are visual-only, not operational fixtures |
| F09 food | Upper six sparse rows and three short lower columns | Fourteen rows with mixed lengths; 69 visible shelves, lower-left cutout for F10 | 27 visual-only shelves; boundaries and counts are image-inferred, not an exact inventory |
| F10 drinks | North-south rows already present | Six rows retained | Endcaps, bottle pattern and exact segmentation remain simplified |
| F11 household | Thirteen sparse shelves | Thirty visible shelves in ten rows | 17 visual-only; appliance silhouettes still generic |
| F12 checkouts | Twenty-four correctly placed but simple | Two groups of twelve retained | Queue rails and full accessory/number-sign detail remain incomplete |
| Northern back-of-house | Only sparse small racks and four giant business cabinets | Four trucks retained, 14 racks in two rows around preserved business cabinets | Centre cabinets retain their semantic type; internal room details inferred |

`buildReferenceDisplayFixtures` creates 49 isolated visual fixture skins with `reference-display-` IDs, no categories and no capacity. These are never appended to StoreLayout, snapshot, inventory, simulator or selection. They share existing instancing batches. Clicking them stops propagation without selecting an object behind them. The review panel discloses their decorative status. Combined business and display geometry is checked for store bounds and at least 1 m pairwise clearance; this is not an accessibility, fire-code or actual customer-path certification.

The user also reported the store looking too small. The physical envelope remains 130×100 m, matching the supplied approximate dimensions. A reversible “专注模型 / 返回工作台” view hides rather than unmounts the assistant. Responsive top-camera fitting uses the actual canvas size, reserves UI margins, and re-fits when the split/window changes, avoiding clipping on tall/narrow canvases. It does not scale business geometry or fabricate additional area.

Validation for this pass: `npm run check` passed (55 root test files / 512 tests plus 3 web tests), web production build passed; bundle-size warning remains. Actual cloud Firefox showed the full candidate in the normal split, then a larger full-width focused view, and restored the split without losing the candidate. The first resize attempt exposed side cropping, which was fixed by the responsive fitting above before final capture. The final 1364×1024 Firefox screenshot was saved on 2026-11-17 at 00:28:30 UTC. All F01–F12 labels and store boundaries are visible. Increased middle/east shelf density is visible; left-side produce/deli/bakery still look more repetitive and sparse than the source. No photorealistic or exact-quantity reconstruction is claimed. No frame-rate/performance benchmark was run.
