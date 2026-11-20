#!/usr/bin/env bash
# Compose the actual GLB render frames. Requires ImageMagick and Noto Sans CJK.
set -euo pipefail
cd "${1:?Pass the render directory}"
font=${YH_PREVIEW_FONT:-/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc}
bold=${YH_PREVIEW_FONT_BOLD:-/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc}
for kind in island upright open; do
  case "$kind" in
    island)
      title='01  玻璃滑盖卧式冰柜'; widthheight='2,502 mm 宽 × 833 mm 高'; depth='853 mm 深'; plan='2,502 × 853 mm'
      note='滑盖、导轨、内胆与分隔板独立建模。下方单独展示内腔。';;
    upright)
      title='02  立式双玻璃门冷柜'; widthheight='1,350 mm 宽 × 2,035 mm 高'; depth='908 mm 深'; plan='1,350 × 908 mm'
      note='双玻璃门、把手、层架与进风格栅独立建模；玻璃后可见空层架。';;
    open)
      title='03  多层开放风幕柜'; widthheight='2,580 mm 宽 × 2,090 mm 高'; depth='915 mm 深'; plan='2,580 × 915 mm'
      note='开放前脸；层架、出风口和回风格栅独立建模。';;
  esac
  magick -size 1344x1396 xc:'#edf1f3' \
    -fill '#ffffff' -draw 'roundrectangle 32,153 656,697 12,12 roundrectangle 688,153 1312,697 12,12 roundrectangle 32,766 656,1310 12,12 roundrectangle 688,766 1312,1310 12,12' \
    "$kind-front.png" -geometry +32+153 -composite \
    "$kind-side.png" -geometry +688+153 -composite \
    "$kind-top.png" -geometry +32+766 -composite \
    "$kind-perspective.png" -geometry +688+766 -composite \
    -font "$bold" -pointsize 36 -fill '#152a34' -annotate +32+57 "YH-TwinOps  /  $title" \
    -font "$font" -pointsize 19 -fill '#405963' -annotate +32+92 '空柜模型 · 正视、侧视、俯视同一比例 · 应用网格离线渲染，非网页截图' \
    -font "$bold" -pointsize 23 -fill '#152a34' -annotate +32+137 '正视图' -annotate +688+137 '右视图' -annotate +32+750 '俯视图' -annotate +688+750 '透视图' \
    -font "$font" -pointsize 18 -fill '#405963' -annotate +143+137 "$widthheight" -annotate +800+137 "$depth" -annotate +143+750 "$plan" \
    -annotate +32+1348 "$note" -annotate +32+1374 '不含商品。厂家公开数据仅用于校准外尺寸，内部结构为建模假设。' \
    -strip "yh-$kind-refrigeration-views.png"
  if [[ "$kind" == island ]]; then
    magick -size 1344x375 xc:'#edf1f3' \
      -fill '#ffffff' -draw 'roundrectangle 32,54 656,351 12,12 roundrectangle 688,54 1312,351 12,12' \
      \( island-lid-detail.png -resize 624x297 \) -geometry +32+72 -composite \
      \( island-interior.png -resize 624x297 \) -geometry +688+72 -composite \
      -font "$bold" -fill '#152a34' -pointsize 22 -annotate +32+33 '闭盖高俯角' -annotate +688+33 '内腔结构' \
      -font "$font" -fill '#405963' -pointsize 18 -annotate +174+33 '同一玻璃滑盖保留关闭' \
      -annotate +809+33 '同一 GLB 隐藏滑盖，非开盖动画' \
      miff:- | magick "yh-$kind-refrigeration-views.png" - -append -strip "yh-$kind-refrigeration-views.png"
  fi
done
