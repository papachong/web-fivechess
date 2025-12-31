# 头像优化指南

## 已修复的问题

✅ **路径问题已修复**：头像路径从相对路径 `./avatars/` 改为绝对路径 `/avatars/`，确保在所有环境下都能正确加载。

✅ **图片质量优化**：`drawImageOnCanvas` 函数已启用高质量图片平滑处理：
- `ctx.imageSmoothingEnabled = true`
- `ctx.imageSmoothingQuality = 'high'`

✅ **错误日志**：添加了 `console.error` 以便调试加载失败的情况。

## 将 SVG 转换为 PNG（推荐）

为获得更好的保真度和兼容性，建议将 SVG 头像转换为 PNG 格式：

### 方法一：使用在线工具
1. 访问 https://convertio.co/zh/svg-png/ 或 https://www.aconvert.com/cn/image/svg-to-png/
2. 上传 `public/avatars/` 中的 SVG 文件
3. 设置输出尺寸为 **256x256** 或 **512x512** （推荐）
4. 下载转换后的 PNG 文件

### 方法二：使用 ImageMagick（命令行）
```bash
cd public/avatars
for file in *.svg; do
  convert -density 300 -background none "$file" -resize 256x256 "${file%.svg}.png"
done
```

### 方法三：使用 Inkscape（命令行）
```bash
cd public/avatars
for file in *.svg; do
  inkscape "$file" --export-type=png --export-width=256 --export-height=256
done
```

### 方法四：使用 Node.js 脚本
创建 `scripts/convert-avatars.js`：
```javascript
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const avatarDir = path.join(__dirname, '../public/avatars')
const files = fs.readdirSync(avatarDir).filter(f => f.endsWith('.svg'))

files.forEach(async (file) => {
  const svgPath = path.join(avatarDir, file)
  const pngPath = path.join(avatarDir, file.replace('.svg', '.png'))
  
  await sharp(svgPath)
    .resize(256, 256)
    .png({ quality: 100 })
    .toFile(pngPath)
  
  console.log(`✓ ${file} → ${file.replace('.svg', '.png')}`)
})
```

运行：
```bash
npm install sharp
node scripts/convert-avatars.js
```

## 更新代码以使用 PNG

转换完成后，修改 `src/main.ts` 中的头像路径：

```typescript
const cartoonAvatars: { name: string; src: string; isChessPiece?: boolean }[] = [
  {
    name: '黑棋子',
    src: '/avatars/black-piece.png',  // 改为 .png
    isChessPiece: true
  },
  {
    name: '白棋子',
    src: '/avatars/white-piece.png',  // 改为 .png
    isChessPiece: true
  },
  {
    name: '朱迪·兔',
    src: '/avatars/judy.png'  // 改为 .png
  },
  // ... 其他头像
]
```

## 推荐的 PNG 规格

- **尺寸**：256x256 或 512x512 像素
- **格式**：PNG-24（带透明通道）
- **背景**：透明
- **质量**：100%（无损压缩）

## 验证修复

1. 清除浏览器缓存
2. 重启开发服务器：`npm run dev`
3. 点击玩家头像右下角的编辑按钮
4. 选择任意头像
5. 确认头像正确显示

如仍有问题，请检查浏览器控制台的错误日志。
