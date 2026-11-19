#!/usr/bin/env bash
# Assemble already-rendered Blender frames. Requires ImageMagick + Noto Sans CJK.
set -euo pipefail
directory=${1:?Usage: bash scripts/compose-yh-shelf-preview.sh OUTPUT_DIRECTORY}
cd "$directory"
font=${YH_PREVIEW_FONT:-/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc}
large=${YH_PREVIEW_FONT_BOLD:-/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc}
magick -size 1512x1469 xc:'#eef0ed' \
  grocery-empty.png -geometry 720x615+28+146 -composite \
  grocery-stocked.png -geometry 720x615+764+146 -composite \
  household-empty.png -geometry 720x615+28+812 -composite \
  household-stocked.png -geometry 720x615+764+812 -composite \
  -font "$large" -fill '#172b29' -pointsize 38 -annotate +28+54 'YH-TwinOps  /  货架与商品分层' \
  -font "$font" -fill '#516763' -pointsize 19 -annotate +28+88 '同一货架、同一视角  ·  应用几何导出  /  Blender 离线渲染，非网页截图' \
  -font "$large" -fill '#172b29' -pointsize 21 \
  -annotate +28+134 '09  食品货架  /  空架' -annotate +764+134 '09  食品货架  /  上货' \
  -annotate +28+800 '11  日化货架  /  空架' -annotate +764+800 '11  日化货架  /  上货' \
  -font "$font" -fill '#516763' -pointsize 17 -annotate +28+1453 '教学陈列模型  ·  商品图形为示意，不对应真实品牌或库存' \
  -strip yh-shelf-comparison.png
