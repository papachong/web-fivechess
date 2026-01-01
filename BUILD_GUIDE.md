# 小miu仔五子棋 - 跨平台打包详细指南

> 📖 本指南用于 **进阶开发者** 和 **打包维护者**。
> 如果只是想快速体验游戏，请参考 [README.md](./README.md) 中的"快速开始"部分。

## 📦 项目结构

```
web-fivechess/
├── src/                    # TypeScript 源代码
│   ├── main.ts            # 核心游戏逻辑与 Pixi.js 渲染
│   ├── style.css          # 全局样式与主题定义
│   └── counter.ts         # 工具函数
├── public/                # 静态资源
│   ├── icon.svg           # 应用图标源 (512x512+)
│   ├── icon.icns          # Mac 应用图标
│   ├── icon.ico           # Windows 应用图标
│   └── downloads/         # 应用下载目录
├── electron/              # Electron 桌面端配置
│   ├── main.cjs          # Electron 主进程
│   └── preload.cjs       # 预加载脚本
├── capacitor.config.json  # Capacitor 移动端配置
├── ios/                   # iOS 项目 (运行 cap add ios 后生成)
├── android/               # Android 项目 (运行 cap add android 后生成)
├── release/               # 打包输出目录
├── vite.config.js         # Vite 构建配置
├── tailwind.config.js     # Tailwind CSS 配置
├── tsconfig.json          # TypeScript 配置
└── dist/                  # 生产构建输出
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 构建 Web 版本
```bash
npm run build
```

---

## 🌐 Web 版本部署

### 本地开发
```bash
# 启动开发服务器（支持热更新）
npm run dev

# 访问 http://localhost:5173
```

### 构建生产版本
```bash
# 构建优化后的生产版本
npm run build

# 输出目录: dist/
# 包含：
#   - index.html
#   - assets/（CSS, JS, 图片等）
```

### 本地预览生产版本
```bash
# 预览构建后的生产版本
npm run preview

# 访问 http://localhost:4173
```

### 部署到 GitHub Pages

1. **方式一：使用 GitHub Actions（推荐）**

创建 `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build
        run: npm run build
        
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

2. **方式二：手动部署**
```bash
# 构建
npm run build

# 部署到 gh-pages 分支
npm install -g gh-pages
gh-pages -d dist

# 在 GitHub 仓库设置中启用 GitHub Pages (选择 gh-pages 分支)
```

### 部署到 Vercel

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod

# 或者：连接 GitHub 仓库后自动部署
# 访问 https://vercel.com 连接仓库
```

在 `vercel.json` 中配置（可选）:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### 部署到 Netlify

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 初始化并部署
netlify init
netlify deploy --prod

# 构建设置：
# Build command: npm run build
# Publish directory: dist
```

或使用 `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 部署到自己的服务器

```bash
# 1. 构建项目
npm run build

# 2. 上传 dist/ 目录到服务器
scp -r dist/* user@your-server:/var/www/html/

# 3. 配置 Nginx（示例）
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 缓存静态资源
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# 4. 重启 Nginx
sudo nginx -t
sudo systemctl restart nginx
```

### 使用 Docker 部署

创建 `Dockerfile`:
```dockerfile
# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

创建 `nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

构建和运行：
```bash
# 构建镜像
docker build -t miu-fivechess .

# 运行容器
docker run -d -p 8080:80 miu-fivechess

# 访问 http://localhost:8080
```

### 性能优化建议

- ✅ 启用 Gzip/Brotli 压缩
- ✅ 配置 CDN 加速静态资源
- ✅ 设置合理的缓存策略
- ✅ 使用 HTTPS（Let's Encrypt 免费证书）
- ✅ 配置 Service Worker（PWA）

---

## 🖥️ 桌面应用 (Mac/Windows) - Electron

### 环境准备
应用图标需要预先生成。如果是首次打包，需要：

```bash
# 1. 安装 ImageMagick（用于图标转换）
brew install imagemagick

# 2. 生成应用图标（从 SVG 转换为 ICNS 和 ICO）
npm run generate:icons

# 生成的文件：
#   - public/icon.icns (Mac 应用图标)
#   - public/icon.ico (Windows 应用图标)
```

### 开发调试
```bash
npm run electron:dev
```

### 打包 Mac 应用（不签名）
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build:mac
```
输出: `release/` 目录下的 `.dmg` 和 `.zip` 文件

**或使用自定义打包脚本（网络环境受限时）:**
```bash
bash scripts/build-mac-app.sh
hdiutil create -volname "小miu仔五子棋" -srcfolder release -ov -format UDZO release/miu-fivechess.dmg
```

### 打包 Windows 应用
```bash
npm run electron:build:win
```
输出: `release/` 目录下的 `.exe` 安装程序

### 同时打包所有桌面平台
```bash
npm run electron:build
```

---

## 📱 移动应用 (iOS/Android) - Capacitor

### 初始化 Capacitor (首次)
```bash
npm run cap:init
```

### 添加 iOS 平台 (需要 Mac + Xcode)
```bash
npm run cap:add:ios
```

### 添加 Android 平台 (需要 Android Studio)
```bash
npm run cap:add:android
```

### 同步 Web 代码到原生项目
```bash
npm run cap:sync
```

### 打开 iOS 项目 (用 Xcode 打包)
```bash
npm run cap:open:ios
```

### 打开 Android 项目 (用 Android Studio 打包)
```bash
npm run cap:open:android
```

---

## 🍎 iOS 发布流程（支持 iPhone & iPad）

### 环境准备
```bash
npm install
npm run build
npm run cap:sync
cd ios/App
brew install ruby@3.2
sudo gem install cocoapods
pod install  # 如需重新安装 CocoaPods 依赖
open App.xcworkspace  # 务必用 xcworkspace 打开，不要用 xcodeproj
```

### 配置步骤
1. 在 Xcode 中打开 App target
2. **General 标签**:
   - 验证 "Supported Destinations" 包含 iPhone 和 iPad
   - Deployment Target: iOS 13.0+
   - 检查 Bundle Identifier (`com.gallenma.fivechess`)

3. **Signing & Capabilities 标签**:
   - 选择 Team (Apple Developer 账号)
   - 启用自动签名或手动配置 Provisioning Profile
   
4. **Build Settings 验证**:
   - Product Name: `小miu仔五子棋`
   - Version Number: 1.0.0（根据发布版本修改）
   - Build Number: 1（每次发布递增）

### 本地测试
```bash
# 连接 iPhone/iPad 或启动模拟器
# Xcode 中：Product → Run (⌘R)
# 验证：
#  ✅ iPhone 上正常运行
#  ✅ iPad 上正常运行（竖屏/横屏）
#  ✅ UI 适配各屏幕尺寸
```

### App Store 发布
1. **生成 Archive**:
   - Product → Archive
   - 等待构建完成

2. **上传**:
   - Archive 窗口 → "Distribute App"
   - 选择 "App Store Connect"
   - 按向导完成上传

3. **App Store Connect 配置**:
   - 填写应用描述、关键词、隐私政策
   - **可用平台**：同时勾选 iPhone 和 iPad
   - 准备应用图标 (1024×1024 PNG)
   - 准备截图（iPhone 和 iPad 各需）
   - 提交审核

### 常见问题
- **CocoaPods 错误**: 运行 `pod install` 并用 `.xcworkspace` 打开
- **签名问题**: 确保 Team 已选择且 Bundle ID 唯一
- **iPad 适配**: 已在 Info.plist 中配置，支持竖屏和横屏

---

## 🤖 Android 发布流程

1. 运行 `npm run cap:sync`
2. 运行 `npm run cap:open:android`
3. 在 Android Studio 中:
   - Build → Generate Signed Bundle/APK
   - 创建或选择 Keystore
   - 选择 Release 版本
   - 生成 AAB (用于 Google Play) 或 APK

---

## 📋 系统要求

| 平台 | 要求 |
|------|------|
| **Mac App** | macOS 10.13+ |
| **Windows App** | Windows 10+ |
| **iOS** | Xcode 15+, macOS, iOS 13+ |
| **Android** | Android Studio, JDK 17+, Android 5.1+ |

---

## 🎨 应用图标

需要准备以下图标文件放在 `public/` 目录:

### 源图标
- `public/icon.svg` - 源 SVG 图标（512x512+ 推荐）

### 生成图标
使用 `npm run generate:icons` 自动转换：

- `public/icon.icns` - Mac 应用图标（Electron/macOS）
- `public/icon.ico` - Windows 应用图标（Electron/Windows）

### 自定义图标
1. 编辑 `public/icon.svg`（确保 viewBox 正确）
2. 运行 `npm run generate:icons` 重新生成
3. 重新打包应用

**依赖：** ImageMagick
```bash
brew install imagemagick
```

iOS/Android 图标在各自的原生项目中配置。

---

## 🔧 常见问题与故障排除

### Electron 打包问题

#### Q1: `npm run electron:build` 因网络超时失败
```bash
# 解决方案 1：使用国内 CDN（快速）
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build:mac

# 解决方案 2：使用自定义脚本
bash scripts/build-mac-app.sh
```

#### Q2: Mac 应用签名错误
```bash
# 不签名打包（用于个人测试）
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build:mac

# 使用证书签名（用于发布）
npm run electron:build:mac  # 需提前配置 Developer ID 证书
```

#### Q3: Windows 代码签名问题
```bash
# 不签名打包（用于个人测试）
npm run electron:build:win
```

### Capacitor 问题

#### Q1: `npm run cap:sync` 失败
```bash
# 确保先构建 Web 版本
npm run build
npm run cap:sync  # 再次尝试
```

#### Q2: iOS CocoaPods 依赖报错
```bash
cd ios/App
rm -rf Pods Podfile.lock
pod install
cd ../../
```

#### Q3: Android 构建缓慢
```bash
# 使用本地 Gradle 缓存
cd android
./gradlew build --offline
```

---

## 📄 许可证

MIT License © 2024-2025 [Ruhoo AI](https://ruhooai.com/)
