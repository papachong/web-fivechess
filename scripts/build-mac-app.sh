#!/bin/bash

# Simple Mac App packaging script without electron-builder
# This creates a basic .app bundle from the built web files

set -e

WORKSPACE_DIR="/Users/mac/Library/Mobile Documents/com~apple~CloudDocs/Development/AI/web-fivechess"
DIST_DIR="$WORKSPACE_DIR/dist"
RELEASE_DIR="$WORKSPACE_DIR/release"
APP_DIR="$RELEASE_DIR/miu-fivechess.app"

echo "📦 打包 小miu仔五子棋 Mac 应用..."

# 创建 release 目录
mkdir -p "$RELEASE_DIR"

# 清理旧的 .app
rm -rf "$APP_DIR"

# 创建 .app 目录结构
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# 从 electron 模块复制主文件
ELECTRON_BIN=$(find "$WORKSPACE_DIR/node_modules/electron/dist" -name "Electron.app" -type d | head -1)

if [ -z "$ELECTRON_BIN" ]; then
    echo "❌ 找不到 Electron.app，请先运行 npm install"
    exit 1
fi

echo "✅ 找到 Electron 框架"

# 复制 Electron.app 的内容
cp -r "$ELECTRON_BIN/Contents/Frameworks" "$APP_DIR/Contents/" || true
cp -r "$ELECTRON_BIN/Contents/Resources" "$APP_DIR/Contents/" || true

# 创建主程序启动脚本
cat > "$APP_DIR/Contents/MacOS/miu-fivechess" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# 获取 Electron 框架路径
ELECTRON_FRAMEWORK="$APP_DIR/Contents/Frameworks/Electron Framework.framework"
ELECTRON_BIN="$ELECTRON_FRAMEWORK/Versions/A/Electron Framework"

# 启动应用
"$ELECTRON_BIN" "$APP_DIR/Contents/Resources/app" "$@"
EOF

chmod +x "$APP_DIR/Contents/MacOS/miu-fivechess"

# 创建 PkgInfo
echo "APPL????" > "$APP_DIR/Contents/PkgInfo"

# 创建 Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>miu-fivechess</string>
    <key>CFBundleIdentifier</key>
    <string>com.gallenmag.miufivechess</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>小miu仔五子棋</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# 复制应用文件
cp -r "$DIST_DIR" "$APP_DIR/Contents/Resources/app"

# 复制 Electron 主进程配置
cp "$WORKSPACE_DIR/electron/main.cjs" "$APP_DIR/Contents/Resources/app/" || true

echo "✅ Mac App 创建成功: $APP_DIR"
echo ""
echo "📝 Web 构建文件已打包到应用中"
echo ""
echo "要运行应用，执行:"
echo "  open \"$APP_DIR\""
