# 小miu仔五子棋 - 跨平台打包指南

## 📦 项目结构

```
web-fivechess/
├── electron/          # Electron 桌面端配置
│   └── main.js
├── capacitor.config.json  # Capacitor 移动端配置
├── ios/              # iOS 项目 (运行 cap add ios 后生成)
├── android/          # Android 项目 (运行 cap add android 后生成)
└── release/          # 打包输出目录
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

## 🖥️ 桌面应用 (Mac/Windows) - Electron

### 开发调试
```bash
npm run electron:dev
```

### 打包 Mac 应用
```bash
npm run electron:build:mac
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

## 🍎 iOS 发布流程

1. 运行 `npm run cap:sync`
2. 运行 `npm run cap:open:ios`
3. 在 Xcode 中:
   - 选择 Team (Apple Developer 账号)
   - 设置 Bundle Identifier
   - 选择真机或模拟器运行测试
   - Product → Archive 打包上架

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

- `icon.png` - 512x512 PNG (通用)
- `icon.icns` - Mac 图标
- `icon.ico` - Windows 图标

iOS/Android 图标在各自的原生项目中配置。

---

## 🔧 常见问题

### Q: Electron 打包失败?
```bash
# 如果遇到网络问题，使用自定义打包脚本
bash scripts/build-mac-app.sh

# 清理缓存重试
rm -rf node_modules release
npm install
npm run electron:build
```

### 打包状态
**✅ Mac 版本 (v1.0.0)**
- 📦 DMG 文件: `public/downloads/miu-fivechess-mac.dmg`
- 📁 .app 目录: `release/miu-fivechess.app`
- 📝 可通过下载按钮直接下载

### Q: Capacitor 同步失败?
```bash
# 确保先构建 Web 版本
npm run build
npm run cap:sync
```

### Q: iOS 签名问题?
- 确保在 Xcode 中登录 Apple Developer 账号
- 检查 Bundle Identifier 是否唯一

---

## 📄 许可证

MIT © 2025 GallenMa
