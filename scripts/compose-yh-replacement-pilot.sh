#!/usr/bin/env bash
# Compose actual Blender output. Requires ImageMagick, jq and Noto Sans CJK.
set -euo pipefail
cd "${1:?Pass the render directory}"
font=${YH_PREVIEW_FONT:-/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc}
bold=${YH_PREVIEW_FONT_BOLD:-/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc}
mapfile -t rows < <(jq -r '.rows[] | [.fixtureId,.label,.existingMerchandiseCount,.scaledMerchandiseCount, ((1-.minimumScale)*1000|round/10)] | @tsv' fixture-pilot.json)
height=$((185 + ${#rows[@]} * 447))
args=(-size "1880x${height}" xc:'#edf1f3')
for index in "${!rows[@]}"; do
  IFS=$'\t' read -r id label count scaled shrink <<<"${rows[$index]}"
  top=$((183 + index * 447))
  bottom=$((top + 390))
  cap=$((top - 25))
  args+=(-fill '#ffffff' -draw "roundrectangle 32,${top} 932,${bottom} 12,12 roundrectangle 948,${top} 1848,${bottom} 12,12"
    "${id}-before.png" -geometry "+32+${top}" -composite "${id}-after.png" -geometry "+948+${top}" -composite
    -font "$bold" -pointsize 26 -fill '#152a34' -annotate "+32+${cap}" "$id $label  /  原设施" -annotate "+948+${cap}" "$id $label  /  试换后"
    -font "$font" -pointsize 20 -fill '#405963' -annotate "+1270+${cap}" "保留 ${count} 件；${scaled} 件等比缩小，最多 ${shrink}%")
done
footer=$((height - 28))
magick "${args[@]}" \
  -font "$bold" -pointsize 40 -fill '#152a34' -annotate +32+58 'YH-TwinOps  /  代表设施可逆试换' \
  -font "$font" -pointsize 22 -fill '#405963' -annotate +32+97 '每行前后同视角、同倍率 · 应用模型离线渲染，非整店网页截图' \
  -annotate "+32+${footer}" '商品是合成陈列模型，不代表门店库存。F107 使用单组 2,300 mm 参数架，并非 2,400 mm 标准架。' \
  -strip yh-replacement-pilot-comparison.png

magick -size 1880x622 xc:'#edf1f3' \
  -fill '#ffffff' -draw 'roundrectangle 32,161 932,551 12,12 roundrectangle 948,161 1848,551 12,12' \
  F050-detail-closed.png -geometry +32+161 -composite F050-detail-glass-hidden.png -geometry +948+161 -composite \
  -font "$bold" -pointsize 40 -fill '#152a34' -annotate +32+58 'YH-TwinOps  /  F050 冷冻岛柜内部核验' \
  -font "$font" -pointsize 22 -fill '#405963' -annotate +32+97 '同一个新模型、同一局部视角。保留正常闭盖版本，右侧仅临时隐藏玻璃。' \
  -font "$bold" -pointsize 26 -fill '#152a34' -annotate +32+139 '闭盖状态  /  局部' -annotate +948+139 '移除玻璃的检查视图  /  局部' \
  -font "$font" -pointsize 21 -fill '#405963' -annotate +32+587 '右图不是开盖动画，不影响应用模型。仅为核对空柜内胆和重新挂载的冷冻包装位置。' \
  -strip yh-replacement-pilot-freezer-detail.png
