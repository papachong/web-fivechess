#!/bin/bash

# 应用图标生成脚本
# 依赖: ImageMagick, iconutil (macOS)
# 用法: bash scripts/generate-icons.sh

set -e

echo "🎨 生成应用图标..."

SOURCE_ICON="public/icon.svg"
OUTPUT_DIR="public"

# 检查源图标是否存在
if [ ! -f "$SOURCE_ICON" ]; then
  echo "❌ 错误: 找不到源图标文件 $SOURCE_ICON"
  exit 1
fi

# 检查 ImageMagick
if ! command -v convert &> /dev/null; then
  echo "❌ 错误: ImageMagick 未安装"
  echo "请运行: brew install imagemagick"
  exit 1
fi

# 生成 PNG 格式（中间格式）
echo "生成 PNG 版本..."
convert -background none "$SOURCE_ICON" -size 512x512 "$OUTPUT_DIR/icon-512.png"
convert -background none "$SOURCE_ICON" -size 256x256 "$OUTPUT_DIR/icon-256.png"

# 生成 Mac ICNS 格式
echo "生成 Mac ICNS 格式..."
mkdir -p icon.iconset

# 生成各种尺寸的 PNG
for size in 16 32 64 128 256 512; do
  convert "$OUTPUT_DIR/icon-512.png" -resize "${size}x${size}" "icon.iconset/icon_${size}x${size}.png"
  # 为视网膜屏幕生成双倍版本
  if [ "$size" -lt 512 ]; then
    double=$((size * 2))
    convert "$OUTPUT_DIR/icon-512.png" -resize "${double}x${double}" "icon.iconset/icon_${size}x${size}@2x.png"
  fi
done

# 转换为 ICNS
iconutil -c icns -o "$OUTPUT_DIR/icon.icns" icon.iconset

# 生成 Windows ICO 格式
echo "生成 Windows ICO 格式..."
convert "$OUTPUT_DIR/icon-256.png" "$OUTPUT_DIR/icon.ico"

# 清理临时文件
rm -rf icon.iconset
rm -f "$OUTPUT_DIR/icon-512.png" "$OUTPUT_DIR/icon-256.png"

echo "✅ 图标生成完成！"
echo ""
echo "生成的文件:"
echo "  - $OUTPUT_DIR/icon.icns (Mac)"
echo "  - $OUTPUT_DIR/icon.ico (Windows)"
echo ""
echo "💡 提示: 如果需要更改应用图标，编辑 $SOURCE_ICON 后重新运行此脚本"
