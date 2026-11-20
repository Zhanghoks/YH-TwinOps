#!/usr/bin/env bash
# Compose the actual GLB render frames. Requires ImageMagick and Noto Sans CJK.
set -euo pipefail
cd "${1:?Pass the render directory}"
font=${YH_PREVIEW_FONT:-/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc}
bold=${YH_PREVIEW_FONT_BOLD:-/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc}
for kind in produce service checkout; do
  IFS=$'\t' read -r width height depth < <(jq -r --arg id "$kind" '.models[]|select(.id==$id)|.sizeMm|@tsv' retail-dimensions.json)
  widthheight="$width mm 宽 × $height mm 高"; depthLabel="$depth mm 深"; plan="$width × $depth mm"
  case "$kind" in
    produce)
      title='01  果蔬陈列岛台'
      note='空岛台，陈列区域供独立商品模型填充。';;
    service)
      title='02  玻璃服务柜'
      note='正面为顾客侧；透明玻璃、空内胆与柜体分开建模。';;
    checkout)
      title='03  人工收银通道'
      note='顾客侧 +Z，收银员侧 −Z；台面高 860 mm，含 POS 屏全高 1,150 mm。'
      plan="$plan  /  顾客侧在下";;
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
    -font "$font" -pointsize 18 -fill '#405963' -annotate +143+137 "$widthheight" -annotate +800+137 "$depthLabel" -annotate +143+750 "$plan" \
    -annotate +32+1348 "$note" -annotate +32+1374 '外尺寸为建模参考，内部结构为原创建模；不代表制造图或实测门店。' \
    -strip "yh-$kind-retail-views.png"
  if [[ "$kind" == checkout ]]; then
    magick -size 1344x462 xc:'#edf1f3' \
      -fill '#ffffff' -draw 'roundrectangle 32,54 1312,438 12,12' \
      \( checkout-operator.png -resize 620x380 \) -geometry +190+56 -composite \
      -font "$bold" -fill '#152a34' -pointsize 22 -annotate +32+33 '收银员侧' \
      -font "$font" -fill '#405963' -pointsize 19 -annotate +825+194 '与顾客侧相反（−Z）' \
      -annotate +825+232 '从操作侧查看实际模型' \
      miff:- | magick "yh-$kind-retail-views.png" - -append -strip "yh-$kind-retail-views.png"
  fi
done
