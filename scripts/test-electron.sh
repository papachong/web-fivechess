#!/bin/bash

# Electron 开发模式测试脚本
# 用法: bash scripts/test-electron.sh

set -e

echo "🚀 启动 Electron 开发模式..."
echo ""
echo "如果看到游戏窗口，说明应用正常工作"
echo "按 Ctrl+C 退出"
echo ""

cd "$(dirname "$0")/.."

# 启动开发版本
npm run electron:dev
