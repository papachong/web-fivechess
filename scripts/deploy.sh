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

# 清理本地压缩包
echo -e "\n${YELLOW}清理本地临时文件...${NC}"
rm -f "$ZIP_FILE"
echo -e "${GREEN}✓ 清理完成${NC}"

# 完成
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   ✓ 发布成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "访问地址: http://${REMOTE_HOST}/fivechess/"
