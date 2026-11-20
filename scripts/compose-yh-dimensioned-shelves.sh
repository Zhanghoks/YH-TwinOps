#!/usr/bin/env bash
# Compose four Blender views for each rack. Requires ImageMagick and Noto Sans CJK.
set -euo pipefail
cd "${1:?Pass the render directory}"
font=${YH_PREVIEW_FONT:-/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc}
bold=${YH_PREVIEW_FONT_BOLD:-/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc}
for kind in wall island; do
  if [[ "$kind" == wall ]]; then
    title='01  单面靠墙货架'
    widthheight='2,400 mm 宽  ×  2,200 mm 高'
    depth='470 mm 深  /  单面陈列'
    plan='2,400 × 470 mm  /  含背板'
    levels='层板顶标高  150 / 530 / 910 / 1,290 / 1,670 mm'
    note='层距 380 mm；5 层，底层占一层。上部横梁不是层板。'
  else
    title='02  双面中岛货架'
    widthheight='2,400 mm 宽  ×  1,600 mm 高'
    depth='1,000 mm 深  /  两面各 450 mm'
    plan='2,400 × 1,000 mm  /  100 mm 中脊'
    levels='层板顶标高  200 / 500 / 800 / 1,100 / 1,400 mm'
    note='两个开间、每面 5 层。层距 300 mm，按指定标高，不沿用参考图 350 mm 标注。'
  fi
  magick -size 1344x1404 xc:'#edf0f2' \
    -fill '#ffffff' -draw 'roundrectangle 32,153 656,697 12,12 roundrectangle 688,153 1312,697 12,12 roundrectangle 32,766 656,1310 12,12 roundrectangle 688,766 1312,1310 12,12' \
    "$kind-front.png" -geometry +32+153 -composite \
    "$kind-side.png" -geometry +688+153 -composite \
    "$kind-top.png" -geometry +32+766 -composite \
    "$kind-perspective.png" -geometry +688+766 -composite \
    -font "$bold" -pointsize 36 -fill '#152931' -annotate +32+57 "YH-TwinOps  /  $title" \
    -font "$font" -pointsize 19 -fill '#3f5660' -annotate +32+92 '空架模型 · 正视、侧视、俯视同一比例 · 应用网格离线渲染，非网页截图' \
    -font "$bold" -pointsize 23 -fill '#152931' -annotate +32+137 '正视图' -annotate +688+137 '右视图' -annotate +32+750 '俯视图' -annotate +688+750 '透视图' \
    -font "$font" -pointsize 18 -fill '#3f5660' -annotate +143+137 "$widthheight" -annotate +800+137 "$depth" -annotate +143+750 "$plan" \
    -annotate +32+1352 "$levels" -annotate +32+1380 "$note" \
    -strip "yh-$kind-three-views.png"
done
