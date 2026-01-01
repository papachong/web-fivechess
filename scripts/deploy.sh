#!/bin/bash

# 五子棋自动发布脚本
# 用法: ./scripts/deploy.sh

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
REMOTE_HOST="47.97.155.226"
REMOTE_USER="root"
REMOTE_DIR="/opt/ruhoowww"
REMOTE_DIST_DIR="/opt/ruhoowww/dist/fivechess"
REMOTE_DOWNLOADS_DIR="/opt/ruhoowww/public/downloads"
ZIP_FILE="fivechess.zip"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   五子棋项目自动发布${NC}"
echo -e "${GREEN}========================================${NC}"

# 步骤 1: 构建项目
echo -e "\n${YELLOW}[1/4] 开始构建项目...${NC}"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}❌ 构建失败：dist 目录不存在${NC}"
  exit 1
fi

echo -e "${GREEN}✓ 构建完成${NC}"

# 步骤 2: 压缩 dist 目录
echo -e "\n${YELLOW}[2/4] 压缩 dist 目录为 ${ZIP_FILE}...${NC}"

# 删除旧的压缩包（如果存在）
rm -f "$ZIP_FILE"

# 压缩 dist 目录
cd dist
zip -r "../$ZIP_FILE" . > /dev/null
cd ..

if [ ! -f "$ZIP_FILE" ]; then
  echo -e "${RED}❌ 压缩失败：${ZIP_FILE} 不存在${NC}"
  exit 1
fi

ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo -e "${GREEN}✓ 压缩完成 (大小: ${ZIP_SIZE})${NC}"

# 步骤 3: 上传到服务器
echo -e "\n${YELLOW}[3/4] 上传 ${ZIP_FILE} 到服务器...${NC}"

scp "$ZIP_FILE" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ 上传失败${NC}"
  exit 1
fi

echo -e "${GREEN}✓ 上传完成${NC}"

# 步骤 4: 在服务器上解压
echo -e "\n${YELLOW}[4/4] 在服务器上解压...${NC}"

ssh "${REMOTE_USER}@${REMOTE_HOST}" << EOF
  set -e
  
  # 创建目标目录（如果不存在）
  mkdir -p "${REMOTE_DIST_DIR}"
  
  # 清空目标目录
  rm -rf "${REMOTE_DIST_DIR}"/*
  
  # 解压文件（-o 自动覆盖，-q 安静模式）
  unzip -o -q "${REMOTE_DIR}/${ZIP_FILE}" -d "${REMOTE_DIST_DIR}"
  
  # 修改文件权限：目录 755，文件 644
  find "${REMOTE_DIST_DIR}" -type d -exec chmod 755 {} \;
  find "${REMOTE_DIST_DIR}" -type f -exec chmod 644 {} \;
  
  # 删除上传的压缩包
  rm -f "${REMOTE_DIR}/${ZIP_FILE}"
  
  echo "解压完成，文件已部署到 ${REMOTE_DIST_DIR}"
  echo "文件权限已调整（目录755，文件644）"
EOF

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ 服务器端解压失败${NC}"
  exit 1
fi

echo -e "${GREEN}✓ 解压完成${NC}"

# 步骤 5: 使用 rsync 推送 release 安装包到服务器 downloads 目录
echo -e "\n${YELLOW}[5/7] 打包应用文件...${NC}"

# 检查 release 目录是否存在
if [ ! -d "release" ]; then
  echo -e "${YELLOW}⚠ 警告：release 目录不存在，跳过安装包推送${NC}"
else
  # 本地临时目录用于存放待推送的文件
  TEMP_UPLOAD_DIR="release-uploads"
  CACHE_DIR="release/cache"
  rm -rf "$TEMP_UPLOAD_DIR"
  mkdir -p "$TEMP_UPLOAD_DIR"
  mkdir -p "$CACHE_DIR"
  
  # 压缩 Mac DMG 文件为 zip
  if ls release/*.dmg 1> /dev/null 2>&1; then
    for dmg_file in release/*.dmg; do
      if [ -f "$dmg_file" ]; then
        target_zip="$CACHE_DIR/miu-fivechess-mac.dmg.zip"
        
        if [ ! -f "$target_zip" ] || [ "$dmg_file" -nt "$target_zip" ]; then
          echo "压缩 Mac 应用包..."
          zip -j "$target_zip" "$dmg_file" > /dev/null 2>&1
          if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Mac 应用包已压缩: miu-fivechess-mac.dmg.zip${NC}"
          else
            echo -e "${YELLOW}⚠ 警告：压缩 Mac 应用包失败${NC}"
          fi
        else
          echo -e "${GREEN}✓ Mac 应用包未更新，使用缓存${NC}"
        fi
        
        cp "$target_zip" "$TEMP_UPLOAD_DIR/" 2>/dev/null
      fi
    done
  fi
  
  # 压缩 Windows EXE 文件为 zip
  if ls release/*.exe 1> /dev/null 2>&1; then
    for exe_file in release/*.exe; do
      if [ -f "$exe_file" ]; then
        target_zip="$CACHE_DIR/miu-fivechess-win.exe.zip"
        
        if [ ! -f "$target_zip" ] || [ "$exe_file" -nt "$target_zip" ]; then
          echo "压缩 Windows 应用包..."
          zip -j "$target_zip" "$exe_file" > /dev/null 2>&1
          if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Windows 应用包已压缩: miu-fivechess-win.exe.zip${NC}"
          else
            echo -e "${YELLOW}⚠ 警告：压缩 Windows 应用包失败${NC}"
          fi
        else
          echo -e "${GREEN}✓ Windows 应用包未更新，使用缓存${NC}"
        fi
        
        cp "$target_zip" "$TEMP_UPLOAD_DIR/" 2>/dev/null
      fi
    done
  fi
  
  # 复制 IPA 文件（如果存在）
  if ls release/*.ipa 1> /dev/null 2>&1; then
    cp release/*.ipa "$TEMP_UPLOAD_DIR/miu-fivechess.ipa" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ iOS 应用包: miu-fivechess.ipa${NC}"
    fi
  fi
  
  # 复制 APK 文件（如果存在）
  if ls release/*.apk 1> /dev/null 2>&1; then
    cp release/*.apk "$TEMP_UPLOAD_DIR/miu-fivechess.apk" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ Android 应用包: miu-fivechess.apk${NC}"
    fi
  fi
  
  # 步骤 6: 推送应用包到服务器
  echo -e "\n${YELLOW}[6/7] 推送应用包到服务器...${NC}"
  
  echo "检查服务器下载目录..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" mkdir -p "${REMOTE_DOWNLOADS_DIR}"
  
  if [ $? -eq 0 ]; then
    # 检查本地是否有文件要推送
    if [ -n "$(ls -A "$TEMP_UPLOAD_DIR" 2>/dev/null)" ]; then
      echo "使用 rsync 推送应用包..."
      rsync -avz \
        --delete \
        "$TEMP_UPLOAD_DIR/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DOWNLOADS_DIR}/"
      
      if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 应用包推送完成${NC}"
        
        # 在服务器上设置正确的文件权限
        ssh "${REMOTE_USER}@${REMOTE_HOST}" << PERMEOF
          chmod 644 "${REMOTE_DOWNLOADS_DIR}"/*.zip 2>/dev/null || true
          chmod 644 "${REMOTE_DOWNLOADS_DIR}"/*.ipa 2>/dev/null || true
          chmod 644 "${REMOTE_DOWNLOADS_DIR}"/*.apk 2>/dev/null || true
          ls -lh "${REMOTE_DOWNLOADS_DIR}"/ 2>/dev/null | tail -n +2
PERMEOF
        echo -e "${GREEN}✓ 文件权限已调整${NC}"
      else
        echo -e "${YELLOW}⚠ 警告：rsync 推送失败，继续其他步骤${NC}"
      fi
    else
      echo -e "${YELLOW}⚠ 警告：没有要推送的应用文件${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ 警告：无法创建服务器下载目录，跳过应用包推送${NC}"
  fi
  
  # 清理本地临时目录
  rm -rf "$TEMP_UPLOAD_DIR"
fi

# 清理本地压缩包
echo -e "\n${YELLOW}[7/7] 清理本地临时文件...${NC}"
rm -f "$ZIP_FILE"
echo -e "${GREEN}✓ 清理完成${NC}"

# 完成
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   ✓ 发布成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Web 版本访问地址: http://${REMOTE_HOST}/fivechess/"
echo -e "下载中心访问地址: http://${REMOTE_HOST}/fivechess/downloads/"
echo -e "\n📦 已部署内容："
echo -e "  ✓ Web 应用：${REMOTE_DIST_DIR}"
echo -e "  ✓ 应用安装包："
echo -e "    - miu-fivechess-mac.dmg.zip"
echo -e "    - miu-fivechess-win.exe.zip"
echo -e "    - miu-fivechess.ipa"
echo -e "    - miu-fivechess.apk"
