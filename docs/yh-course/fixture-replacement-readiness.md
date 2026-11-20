# 固定尺寸新资产替换准备审计

当前仅规划，不修改场景、不替换原商品、不改业务 ID。默认所有点位 keep-legacy。

工厂现有8种：靠墙架、双面架、岛柜、立式冷冻柜、风幕柜、果蔬台、服务柜、收银台。靠墙架无可靠墙面/方向元数据，当前不自动匹配。海鲜、散粮等不假定等同现有新柜。

**高度口径：旧 heightM 是教学代理几何参数，不是实测柜高或建筑限高。height-too-small 仅表示不能在“完全保留旧包络”的迁移规则下自动通过，不表示物理上无法放置。须明确审查并更新包络/商品层位才能解锁，不能偷偷放宽。**

## 规则与边界

- 依据真实工厂 defaults 固定毫米尺寸，不缩放、不移动、不改变方向；并排模块居中放置且共用原设备组 ID。
- 宽度填充不足75%或深度不足60%列 group-footprint-underfilled，不能用单个小柜冒充整组。
- 完整高度和足迹不得超过旧包络；通道按旧包络外侧检验，不能把柜组内部剩余空间误当外部通道。
- 双面架/果蔬两侧、服务柜/收银顾客及操作侧均验1–1.2m；立柜正面保守1.35m。单正面需 verifiedPositiveFronts 显式确认。
- 净空仅检查现有业务/装饰设施及门店外边界，未注册墙/建筑/门扇仍需后续核验，非安全规范认证。
- geometryCandidate仅为空组件试排候选，不是正式激活。旧商品依赖原层板/内腔高度，全部仍须商品重新挂载和支撑/碰撞验证，不能去掉商品。

## 后续所需映射

1. 原设备组 → 新模块数量、共用ID与选择边界。
2. 原商品 → 新mount ID/层/湾/面、底锚点、尺寸、倾斜角；保留商品身份/数量，验证支撑、头顶和壳体净空。
3. 原经营类型 → 柜体用途、温区/服务/收银角色，不以外观推断设备能力。
4. 原rotation → 新+Z服务面，柜门铰链与完整开启扫掠/操作员净空；纳入建筑障碍。
5. 逐点回退映射与交互选择、业务数据关联检查。

API: planFixtureReplacements(layout, decorations = [], verifiedPositiveFronts = new Set())。输出fixtureId/source/asset/status/reasons/geometryCandidate/transform/assetSizeM/clearanceM/preview。preview只含empty-geometry-only、moduleOffsetsX及宽深填充比例。

## 密集130×100

点位205；geometryCandidate 0；实际激活0。原因可重叠：

```json
{
  "unsupported-category": 41,
  "height-too-small": 144,
  "front-unverified": 45,
  "product-remount-required": 164,
  "group-footprint-underfilled": 49,
  "footprint-too-small": 26
}
```

| 点位 | 新型号 | 并排模块数 | 宽/深覆盖 | 几何候选 | 拒绝/待验证原因 |
|---|---|---:|---|---|---|
| F001 | 无匹配 | 0 | — | 否 | unsupported-category |
| F002 | 无匹配 | 0 | — | 否 | unsupported-category |
| F003 | 无匹配 | 0 | — | 否 | unsupported-category |
| F004 | 无匹配 | 0 | — | 否 | unsupported-category |
| F005 | 无匹配 | 0 | — | 否 | unsupported-category |
| F006 | 无匹配 | 0 | — | 否 | unsupported-category |
| F007 | retail-service | 7 | 91% / 60% | 否 | height-too-small, front-unverified, product-remount-required |
| F008 | retail-service | 5 | 98% / 60% | 否 | height-too-small, front-unverified, product-remount-required |
| F009 | retail-service | 7 | 91% / 60% | 否 | height-too-small, front-unverified, product-remount-required |
| F010 | retail-service | 4 | 87% / 49% | 否 | height-too-small, group-footprint-underfilled, front-unverified, product-remount-required |
| F011 | retail-service | 4 | 98% / 68% | 否 | height-too-small, front-unverified, product-remount-required |
| F012 | retail-service | 6 | 98% / 68% | 否 | height-too-small, front-unverified, product-remount-required |
| F013 | retail-service | 7 | 98% / 68% | 否 | height-too-small, front-unverified, product-remount-required |
| F014 | retail-service | 4 | 87% / 60% | 否 | height-too-small, front-unverified, product-remount-required |
| F015 | retail-service | 4 | 98% / 68% | 否 | height-too-small, front-unverified, product-remount-required |
| F016 | retail-service | 3 | 84% / 68% | 否 | height-too-small, front-unverified, product-remount-required |
| F017 | retail-produce | 5 | 87% / 33% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F018 | retail-produce | 6 | 94% / 33% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F019 | retail-produce | 4 | 94% / 33% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F020 | retail-produce | 5 | 92% / 30% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F021 | retail-produce | 6 | 99% / 30% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F022 | retail-produce | 3 | 76% / 30% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F023 | retail-produce | 5 | 87% / 33% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F024 | retail-produce | 6 | 94% / 33% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F025 | retail-produce | 4 | 94% / 33% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F026 | retail-produce | 5 | 92% / 45% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F027 | retail-produce | 6 | 99% / 45% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F028 | retail-produce | 3 | 76% / 45% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F029 | retail-produce | 4 | 81% / 73% | 否 | height-too-small, product-remount-required |
| F030 | retail-produce | 4 | 81% / 73% | 否 | height-too-small, product-remount-required |
| F031 | retail-produce | 4 | 81% / 73% | 否 | height-too-small, product-remount-required |
| F032 | shelf-gondola | 3 | 95% / 83% | 否 | height-too-small, product-remount-required |
| F033 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| F034 | shelf-gondola | 1 | 92% / 83% | 否 | height-too-small, product-remount-required |
| F035 | 无匹配 | 0 | — | 否 | unsupported-category |
| F036 | 无匹配 | 0 | — | 否 | unsupported-category |
| F037 | 无匹配 | 0 | — | 否 | unsupported-category |
| F038 | 无匹配 | 0 | — | 否 | unsupported-category |
| F039 | 无匹配 | 0 | — | 否 | unsupported-category |
| F040 | 无匹配 | 0 | — | 否 | unsupported-category |
| F041 | 无匹配 | 0 | — | 否 | unsupported-category |
| F042 | 无匹配 | 0 | — | 否 | unsupported-category |
| F043 | 无匹配 | 0 | — | 否 | unsupported-category |
| F044 | 无匹配 | 0 | — | 否 | unsupported-category |
| F045 | 无匹配 | 0 | — | 否 | unsupported-category |
| F046 | 无匹配 | 0 | — | 否 | unsupported-category |
| F047 | 无匹配 | 0 | — | 否 | unsupported-category |
| F048 | 无匹配 | 0 | — | 否 | unsupported-category |
| F049 | 无匹配 | 0 | — | 否 | unsupported-category |
| F050 | cooling-island | 4 | 91% / 43% | 否 | group-footprint-underfilled, product-remount-required |
| F051 | cooling-island | 4 | 91% / 43% | 否 | group-footprint-underfilled, product-remount-required |
| F052 | cooling-island | 4 | 91% / 43% | 否 | group-footprint-underfilled, product-remount-required |
| F053 | cooling-island | 4 | 91% / 43% | 否 | group-footprint-underfilled, product-remount-required |
| F054 | cooling-island | 3 | 94% / 53% | 否 | group-footprint-underfilled, product-remount-required |
| F055 | cooling-island | 3 | 94% / 53% | 否 | group-footprint-underfilled, product-remount-required |
| F056 | cooling-island | 3 | 94% / 53% | 否 | group-footprint-underfilled, product-remount-required |
| F057 | cooling-island | 3 | 94% / 53% | 否 | group-footprint-underfilled, product-remount-required |
| F058 | cooling-island | 3 | 94% / 53% | 否 | group-footprint-underfilled, product-remount-required |
| F059 | cooling-island | 3 | 94% / 53% | 否 | group-footprint-underfilled, product-remount-required |
| F060 | cooling-island | 3 | 94% / 53% | 否 | group-footprint-underfilled, product-remount-required |
| F061 | cooling-island | 3 | 94% / 53% | 否 | group-footprint-underfilled, product-remount-required |
| F062 | 无匹配 | 0 | — | 否 | unsupported-category |
| F063 | 无匹配 | 0 | — | 否 | unsupported-category |
| F064 | 无匹配 | 0 | — | 否 | unsupported-category |
| F065 | 无匹配 | 0 | — | 否 | unsupported-category |
| F066 | 无匹配 | 0 | — | 否 | unsupported-category |
| F067 | 无匹配 | 0 | — | 否 | unsupported-category |
| F068 | 无匹配 | 0 | — | 否 | unsupported-category |
| F069 | 无匹配 | 0 | — | 否 | unsupported-category |
| F070 | 无匹配 | 0 | — | 否 | unsupported-category |
| F071 | 无匹配 | 0 | — | 否 | unsupported-category |
| F072 | 无匹配 | 0 | — | 否 | unsupported-category |
| F073 | 无匹配 | 0 | — | 否 | unsupported-category |
| F074 | cooling-open | 4 | 94% / 65% | 否 | front-unverified, product-remount-required |
| F075 | cooling-open | 4 | 94% / 65% | 否 | front-unverified, product-remount-required |
| F076 | cooling-open | 4 | 94% / 65% | 否 | front-unverified, product-remount-required |
| F077 | shelf-gondola | 2 | 100% / 83% | 否 | height-too-small, product-remount-required |
| F078 | shelf-gondola | 3 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F079 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F080 | shelf-gondola | 1 | 55% / 83% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F081 | shelf-gondola | 3 | 84% / 83% | 否 | height-too-small, product-remount-required |
| F082 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| F083 | shelf-gondola | 2 | 100% / 83% | 否 | height-too-small, product-remount-required |
| F084 | shelf-gondola | 3 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F085 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F086 | shelf-gondola | 1 | 55% / 83% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F087 | shelf-gondola | 3 | 84% / 83% | 否 | height-too-small, product-remount-required |
| F088 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| F089 | shelf-gondola | 2 | 100% / 83% | 否 | height-too-small, product-remount-required |
| F090 | shelf-gondola | 3 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F091 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F092 | shelf-gondola | 1 | 55% / 83% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F093 | shelf-gondola | 3 | 84% / 83% | 否 | height-too-small, product-remount-required |
| F094 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| F095 | shelf-gondola | 2 | 100% / 83% | 否 | height-too-small, product-remount-required |
| F096 | shelf-gondola | 3 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F097 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F098 | shelf-gondola | 1 | 55% / 83% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F099 | shelf-gondola | 3 | 84% / 83% | 否 | height-too-small, product-remount-required |
| F100 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| F101 | shelf-gondola | 2 | 100% / 83% | 否 | height-too-small, product-remount-required |
| F102 | shelf-gondola | 3 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F103 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| F104 | shelf-gondola | 3 | 95% / 83% | 否 | height-too-small, product-remount-required |
| F105 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| F106 | shelf-gondola | 1 | 92% / 83% | 否 | height-too-small, product-remount-required |
| F107 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F108 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| F109 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F110 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F111 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F112 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F113 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| F114 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F115 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F116 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F117 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F118 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| F119 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| F120 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F121 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F122 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F123 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F124 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F125 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F126 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F127 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F128 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F129 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F130 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F131 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F132 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F133 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F134 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F135 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F136 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F137 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F138 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F139 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F140 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F141 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F142 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F143 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F144 | 无匹配 | 0 | — | 否 | unsupported-category |
| F145 | 无匹配 | 0 | — | 否 | unsupported-category |
| F146 | 无匹配 | 0 | — | 否 | unsupported-category |
| F147 | 无匹配 | 0 | — | 否 | unsupported-category |
| F148 | 无匹配 | 0 | — | 否 | unsupported-category |
| F149 | 无匹配 | 0 | — | 否 | unsupported-category |
| F150 | 无匹配 | 0 | — | 否 | unsupported-category |
| reference-display-zone-packaged-0 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-1 | shelf-gondola | 3 | 90% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-2 | shelf-gondola | 1 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-3 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-4 | shelf-gondola | 3 | 95% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-5 | shelf-gondola | 1 | 92% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-6 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-7 | shelf-gondola | 3 | 90% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-8 | shelf-gondola | 1 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-9 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-10 | shelf-gondola | 3 | 95% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-11 | shelf-gondola | 1 | 92% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-12 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-13 | shelf-gondola | 3 | 90% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-14 | shelf-gondola | 1 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-15 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-16 | shelf-gondola | 3 | 95% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-17 | shelf-gondola | 1 | 92% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-18 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-19 | shelf-gondola | 3 | 90% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-20 | shelf-gondola | 1 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-21 | shelf-gondola | 2 | 86% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-22 | shelf-gondola | 3 | 95% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-23 | shelf-gondola | 1 | 92% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-24 | shelf-gondola | 2 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-25 | shelf-gondola | 3 | 90% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-packaged-26 | shelf-gondola | 1 | 80% / 83% | 否 | height-too-small, product-remount-required |
| reference-display-zone-household-27 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-28 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-29 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| reference-display-zone-household-30 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-31 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| reference-display-zone-household-32 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-33 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| reference-display-zone-household-34 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-35 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-36 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| reference-display-zone-household-37 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-38 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| reference-display-zone-household-39 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-40 | shelf-gondola | 2 | 77% / 67% | 否 | height-too-small, product-remount-required |
| reference-display-zone-household-41 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-42 | shelf-gondola | 2 | 69% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-household-43 | shelf-gondola | 2 | 73% / 67% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| reference-display-zone-daily-44 | cooling-open | 4 | 94% / 65% | 否 | front-unverified, product-remount-required |
| reference-display-zone-daily-45 | cooling-open | 4 | 94% / 65% | 否 | front-unverified, product-remount-required |
| reference-display-zone-daily-46 | cooling-open | 4 | 94% / 65% | 否 | front-unverified, product-remount-required |
| reference-display-zone-daily-47 | cooling-open | 4 | 94% / 65% | 否 | front-unverified, product-remount-required |
| reference-display-zone-daily-48 | cooling-open | 7 | 90% / 65% | 否 | front-unverified, product-remount-required |
| reference-display-zone-produce-49 | retail-produce | 8 | 98% / 145% | 否 | footprint-too-small, height-too-small, product-remount-required |
| reference-display-zone-produce-50 | retail-produce | 6 | 92% / 145% | 否 | footprint-too-small, height-too-small, product-remount-required |
| reference-display-zone-deli-51 | retail-service | 2 | 78% / 60% | 否 | height-too-small, front-unverified, product-remount-required |
| reference-display-zone-deli-52 | retail-service | 2 | 78% / 68% | 否 | height-too-small, front-unverified, product-remount-required |
| reference-display-zone-seafood-53 | 无匹配 | 0 | — | 否 | unsupported-category |
| reference-display-zone-meat-54 | retail-service | 5 | 98% / 68% | 否 | height-too-small, front-unverified, product-remount-required |

## 原型80×50

点位150；geometryCandidate 12；实际激活0。原因可重叠：

```json
{
  "unsupported-category": 40,
  "height-too-small": 95,
  "group-footprint-underfilled": 47,
  "front-unverified": 37,
  "operation-clearance-blocked": 10,
  "product-remount-required": 110,
  "footprint-too-small": 19
}
```

| 点位 | 新型号 | 并排模块数 | 宽/深覆盖 | 几何候选 | 拒绝/待验证原因 |
|---|---|---:|---|---|---|
| F001 | 无匹配 | 0 | — | 否 | unsupported-category |
| F002 | 无匹配 | 0 | — | 否 | unsupported-category |
| F003 | 无匹配 | 0 | — | 否 | unsupported-category |
| F004 | 无匹配 | 0 | — | 否 | unsupported-category |
| F005 | 无匹配 | 0 | — | 否 | unsupported-category |
| F006 | 无匹配 | 0 | — | 否 | unsupported-category |
| F007 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F008 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F009 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F010 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F011 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F012 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F013 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F014 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F015 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F016 | retail-service | 1 | 59% / 48% | 否 | height-too-small, group-footprint-underfilled, front-unverified, operation-clearance-blocked, product-remount-required |
| F017 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F018 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F019 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F020 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F021 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F022 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F023 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F024 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F025 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F026 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F027 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F028 | retail-produce | 3 | 89% / 52% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F029 | retail-produce | 4 | 94% / 66% | 否 | height-too-small, product-remount-required |
| F030 | retail-produce | 4 | 94% / 66% | 否 | height-too-small, product-remount-required |
| F031 | retail-produce | 4 | 94% / 66% | 否 | height-too-small, product-remount-required |
| F032 | shelf-gondola | 1 | 77% / 74% | 否 | height-too-small, product-remount-required |
| F033 | shelf-gondola | 1 | 77% / 74% | 否 | height-too-small, product-remount-required |
| F034 | shelf-gondola | 1 | 77% / 74% | 否 | height-too-small, product-remount-required |
| F035 | 无匹配 | 0 | — | 否 | unsupported-category |
| F036 | 无匹配 | 0 | — | 否 | unsupported-category |
| F037 | 无匹配 | 0 | — | 否 | unsupported-category |
| F038 | 无匹配 | 0 | — | 否 | unsupported-category |
| F039 | 无匹配 | 0 | — | 否 | unsupported-category |
| F040 | 无匹配 | 0 | — | 否 | unsupported-category |
| F041 | 无匹配 | 0 | — | 否 | unsupported-category |
| F042 | 无匹配 | 0 | — | 否 | unsupported-category |
| F043 | 无匹配 | 0 | — | 否 | unsupported-category |
| F044 | 无匹配 | 0 | — | 否 | unsupported-category |
| F045 | 无匹配 | 0 | — | 否 | unsupported-category |
| F046 | 无匹配 | 0 | — | 否 | unsupported-category |
| F047 | 无匹配 | 0 | — | 否 | unsupported-category |
| F048 | 无匹配 | 0 | — | 否 | unsupported-category |
| F049 | 无匹配 | 0 | — | 否 | unsupported-category |
| F050 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F051 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F052 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F053 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F054 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F055 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F056 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F057 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F058 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F059 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F060 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F061 | cooling-island | 1 | 76% / 61% | 是，空试排 | product-remount-required |
| F062 | 无匹配 | 0 | — | 否 | unsupported-category |
| F063 | 无匹配 | 0 | — | 否 | unsupported-category |
| F064 | 无匹配 | 0 | — | 否 | unsupported-category |
| F065 | 无匹配 | 0 | — | 否 | unsupported-category |
| F066 | 无匹配 | 0 | — | 否 | unsupported-category |
| F067 | 无匹配 | 0 | — | 否 | unsupported-category |
| F068 | 无匹配 | 0 | — | 否 | unsupported-category |
| F069 | 无匹配 | 0 | — | 否 | unsupported-category |
| F070 | 无匹配 | 0 | — | 否 | unsupported-category |
| F071 | 无匹配 | 0 | — | 否 | unsupported-category |
| F072 | 无匹配 | 0 | — | 否 | unsupported-category |
| F073 | 无匹配 | 0 | — | 否 | unsupported-category |
| F074 | cooling-open | 0 | — | 否 | footprint-too-small, front-unverified, product-remount-required |
| F075 | cooling-open | 0 | — | 否 | footprint-too-small, front-unverified, product-remount-required |
| F076 | cooling-open | 0 | — | 否 | footprint-too-small, front-unverified, product-remount-required |
| F077 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F078 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F079 | shelf-gondola | 1 | 68% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F080 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F081 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F082 | shelf-gondola | 1 | 68% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F083 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F084 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F085 | shelf-gondola | 1 | 68% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F086 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F087 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F088 | shelf-gondola | 1 | 68% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F089 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F090 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F091 | shelf-gondola | 1 | 68% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F092 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F093 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F094 | shelf-gondola | 1 | 68% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F095 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F096 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F097 | shelf-gondola | 1 | 68% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F098 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F099 | shelf-gondola | 2 | 98% / 100% | 否 | height-too-small, product-remount-required |
| F100 | shelf-gondola | 1 | 68% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F101 | shelf-gondola | 1 | 51% / 95% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F102 | shelf-gondola | 1 | 51% / 95% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F103 | shelf-gondola | 1 | 81% / 95% | 否 | height-too-small, product-remount-required |
| F104 | shelf-gondola | 1 | 51% / 95% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F105 | shelf-gondola | 1 | 51% / 95% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F106 | shelf-gondola | 1 | 81% / 95% | 否 | height-too-small, product-remount-required |
| F107 | shelf-gondola | 1 | 71% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F108 | shelf-gondola | 1 | 71% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F109 | shelf-gondola | 1 | 71% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F110 | shelf-gondola | 1 | 71% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F111 | shelf-gondola | 1 | 71% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F112 | shelf-gondola | 1 | 71% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F113 | shelf-gondola | 1 | 71% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F114 | shelf-gondola | 1 | 71% / 100% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F115 | shelf-gondola | 1 | 65% / 91% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F116 | shelf-gondola | 1 | 65% / 91% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F117 | shelf-gondola | 1 | 65% / 91% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F118 | shelf-gondola | 1 | 65% / 91% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F119 | shelf-gondola | 1 | 65% / 91% | 否 | height-too-small, group-footprint-underfilled, product-remount-required |
| F120 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F121 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F122 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F123 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F124 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F125 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F126 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F127 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F128 | retail-checkout | 1 | 96% / 93% | 否 | height-too-small, front-unverified, product-remount-required |
| F129 | retail-checkout | 1 | 96% / 93% | 否 | height-too-small, front-unverified, product-remount-required |
| F130 | retail-checkout | 1 | 96% / 93% | 否 | height-too-small, front-unverified, product-remount-required |
| F131 | retail-checkout | 1 | 96% / 93% | 否 | height-too-small, front-unverified, product-remount-required |
| F132 | retail-checkout | 1 | 96% / 93% | 否 | height-too-small, front-unverified, product-remount-required |
| F133 | retail-checkout | 1 | 96% / 93% | 否 | height-too-small, front-unverified, product-remount-required |
| F134 | retail-checkout | 1 | 96% / 93% | 否 | height-too-small, front-unverified, product-remount-required |
| F135 | retail-checkout | 1 | 96% / 93% | 否 | height-too-small, front-unverified, product-remount-required |
| F136 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F137 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F138 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F139 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F140 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F141 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F142 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F143 | retail-checkout | 0 | — | 否 | footprint-too-small, height-too-small, front-unverified, product-remount-required |
| F144 | 无匹配 | 0 | — | 否 | unsupported-category |
| F145 | 无匹配 | 0 | — | 否 | unsupported-category |
| F146 | 无匹配 | 0 | — | 否 | unsupported-category |
| F147 | 无匹配 | 0 | — | 否 | unsupported-category |
| F148 | 无匹配 | 0 | — | 否 | unsupported-category |
| F149 | 无匹配 | 0 | — | 否 | unsupported-category |
| F150 | 无匹配 | 0 | — | 否 | unsupported-category |

## 品类组与典型阻碍

### dense

无匹配：41点位；retail-service：13点位；retail-produce：17点位；shelf-gondola：90点位；cooling-island：12点位；cooling-open：8点位；retail-checkout：24点位。

### baseline

无匹配：40点位；retail-service：10点位；retail-produce：15点位；shelf-gondola：46点位；cooling-island：12点位；cooling-open：3点位；retail-checkout：24点位。

密集典型：F007服务柜须复核代理高度和正面/操作面；F017果蔬台须按设备组规划双向排布并核对高度，不用单柜填大岛；F032双面架需确认层高包络并重新挂载商品；F050岛柜可放入但深度填充不足，需设备组模块方案；F074风幕柜须验证正面并映射冷藏商品mount；F120收银台本地长宽/高度不匹配，不能擅自转90度或缩放，需明确设备方向与收银流线；F001水产不自动替代为普通服务柜。

原型12个几何候选仍仅空组件试排准备，全部因商品挂接未验证保持旧版，不提供导致商品消失的强制开关。
