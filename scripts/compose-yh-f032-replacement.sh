#!/usr/bin/env bash
# Compose true app geometry rendered by Blender. Requires ImageMagick and Noto Sans CJK.
set -euo pipefail
cd "${1:?Pass the render directory}"
font=${YH_PREVIEW_FONT:-/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc}
bold=${YH_PREVIEW_FONT_BOLD:-/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc}
count=$(jq -r .existingMerchandiseCount f032-replacement.json)
magick -size 1880x1530 xc:'#edf1f3' \
  -fill '#ffffff' -draw 'roundrectangle 32,161 932,551 12,12 roundrectangle 948,161 1848,551 12,12 roundrectangle 32,602 932,992 12,12 roundrectangle 948,602 1848,992 12,12 roundrectangle 32,1043 932,1433 12,12' \
  before-front.png -geometry +32+161 -composite \
  after-front.png -geometry +948+161 -composite \
  before-angle.png -geometry +32+602 -composite \
  after-angle.png -geometry +948+602 -composite \
  empty-angle.png -geometry +32+1043 -composite \
  -font "$bold" -pointsize 40 -fill '#152a34' -annotate +32+59 'YH-TwinOps  /  F032 双面货架试换' \
  -font "$font" -pointsize 22 -fill '#405963' -annotate +32+98 '同位置、同视角、同倍率 · 应用实际几何离线渲染，非整店网页截图' \
  -font "$bold" -pointsize 26 -fill '#152a34' \
  -annotate +32+141 '替换前  /  正视' -annotate +948+141 '替换后  /  正视' \
  -annotate +32+582 '替换前  /  斜视' -annotate +948+582 '替换后  /  斜视' \
  -annotate +32+1023 '试换后  /  隐藏商品' -annotate +995+1190 '三组标准架，商品独立挂载' \
  -font "$font" -pointsize 22 -fill '#405963' \
  -annotate +995+1242 '单组 2,400 宽 × 1,000 深 × 1,600 高 mm' \
  -annotate +995+1282 "保留原 $count 件示意商品，按新架层位重新挂载" \
  -annotate +995+1322 '其中 42 件受层高限制等比缩小约 5.5%，其余保持尺寸' \
  -annotate +995+1362 '原架保留，可切回；未替换其他设施' \
  -annotate +32+1488 '此板只展示目标 F032 单体。商品为合成陈列模型，不代表实际门店库存。' \
  -strip yh-f032-before-after.png
