# 果蔬、鲜食服务、人工收银空组件

本批为未来替换旧组件准备的可复用空模型，不是永久独立于场景的概念图。独立检视24–26与GLB导出使用同一工厂，先验证资产，再按原设备组尺寸、方向、商品挂载和操作净空决定能否替换。不改变原业务ID或擅自移动布局。

## 尺度来源与原创边界

- 果蔬双面台：1220×1450×940 mm。参考[Woodarts P10产品册](https://www.woodarts.ca/uploads/1/2/0/2/120293253/produce_table_collection_feb_2022.pdf)48英寸宽、56英寸基底深、37英寸高及10°台面。整毫米值和含护边总深为本次设计，不是厂家逐部件复刻。
- 鲜食服务柜：1955×1086×1290 mm。参考[Bromic DD1875CG-NR](https://www.bromicrefrigeration.com.au/wp-content/uploads/2023/08/DD1875CG-NR_SPEC_0524.pdf)外包尺寸。玻璃、托盘和后操作口为原创建模，不是制冷工程内部图。
- 人工收银台：2500×1120×1150 mm（含终端）；台面860 mm。参考[ITAB ALCO](https://itab.com/products-and-services/products/retail-technology/belted-checkout-solutions/alco-checkouts)2500–3550 mm长度范围、1120 mm深、860 mm台面。本次取最短机身，终端全高1150 mm为设计值，不能把台面高误称全高。

均非永辉实测；无品牌照片贴图，无食品或人物，不表示制冷/输送设备物理仿真。商品由独立挂点另行填充，收银工作区域标识不代表真实排队容量。

## 交付与验证

`retailFixture.ts`为参数/结构源，`retailFixtureThree.ts`为Three网格工厂。成品可离线导出，输出位置由导出时指定。预览为同源GLB离线渲染，非应用WebGL截图。

本轮最终验证：11项零件/外包/挂点测试、5项替换审计测试；完整`npm run check`根626项/74文件、Web14项/7文件与类型检查全部通过，Web生产构建通过。构建仍有既有单包体积提示。服务柜前饰板共面已修复，收银下部为三段独立底座与退进脚线，均已重新导出、渲染目检。

替换准备见[点位清单](./fixture-replacement-readiness.md)及同名JSON/CSV。当前所有点位仍keep-legacy；不因空柜资产就擅自抹掉原商品或缩减整组设备。下一步须按设备组参数做兼容变体，映射商品挂点与服务朝向，再逐点启用可回退替换。
