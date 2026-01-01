# 小miu仔五子棋 - Gomoku Game

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.19+-green)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.0+-purple)](https://vitejs.dev/)
[![Pixi.js](https://img.shields.io/badge/Pixi.js-7.4.2-blue)](https://pixijs.com/)

一款高性能、多平台的五子棋游戏，采用 **Pixi.js** 高性能渲染引擎，支持 Web、macOS、Windows、iOS 和 Android 平台。

## 🎮 核心功能

### 游戏玩法
- **15×15 棋盘** 精准网格，支持快速落子
- **五子连珠即胜** 支持行、列、两条对角线五连判定
- **悔棋功能** 支持任意步数回退
- **游戏保存** 本地存档，随时继续对局
- **排行榜系统** 记录每个玩家的胜负数据

### 视觉效果
- **Pixi.js 高性能渲染** 60fps 流畅体验
- **拟真棋子效果**
  - 黑棋：黑曜石质感，带微弱光晕
  - 白棋：羊脂白玉质感，高光闪烁
- **动画反馈**
  - 棋子落子动画（缩放+透明度过渡）
  - 胜利棋子脉冲高亮
  - 最后一步棋标记
  - 鼠标悬停预览
- **绚丽烟花特效** 游戏结束时全屏绽放（不被弹窗遮挡）

### 主题系统
内置 6 套精美主题：
| 主题 | 风格 | 棋盘色 | 线条色 | 适用场景 |
|------|------|--------|--------|---------|
| **深色** | 沉浸式暗黑，科技感蓝线 | `#2d3748` | `#60a5fa` | 夜间游戏，护眼模式 |
| **浅色** | 经典木纹风格 | `#f0e6d2` | `#8b7355` | 日间游戏 |
| **护眼绿** | 护眼主题，柔和色调 | `#c7d9a8` | `#5f7a38` | 长时间游戏 |
| **中国风** | 古韵棕色，传统美感 | `#e6b380` | `#5d4037` | 文化体验 |
| **水墨雅韵** | 极简宣纸风，黑白灰 | `#f0f0f0` | `#1a1a1a` | 高雅品味 |
| **高对比度** | 无障碍高对比 | `#ffff00` | `#000000` | 视障用户 |

### UI 体验
- **疯狂动物城风格** 玩家头像与卡通 UI 设计
- **玻璃拟态设计** 现代化侧边栏与控制面板
- **响应式布局** 完美适配桌面、平板、手机
- **音效反馈** 落子声、胜利音乐（可关闭）
- **流畅过渡动画** 所有 UI 交互都有视觉反馈

---

## 🚀 快速开始

### Web 版本

#### 开发环境
```bash
# 安装依赖
npm install

# 启动开发服务器（热更新）
npm run dev

# 访问 http://localhost:5173
```

#### 生产构建
```bash
# 构建优化版本
npm run build

# 本地预览
npm run preview

# 访问 http://localhost:4173
```

### 桌面应用 (Mac/Windows)

#### Mac 应用打包
```bash
# 不签名打包（快速）
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build:mac

# 输出：release/*.dmg 和 release/*.zip
```

#### Windows 应用打包
```bash
npm run electron:build:win

# 输出：release/*.exe
```

### 移动应用 (iOS/Android)

#### iOS（需要 Mac + Xcode）
```bash
npm run build
npm run cap:sync
npm run cap:open:ios

# 在 Xcode 中 Product > Archive，然后上传到 App Store
```

#### Android（需要 Android Studio）
```bash
npm run build
npm run cap:sync
npm run cap:open:android

# 在 Android Studio 中 Build > Generate Signed Bundle/APK
```

---

## 📋 项目结构

```
web-fivechess/
├── src/
│   ├── main.ts              # 核心游戏逻辑与 Pixi.js 渲染
│   ├── style.css            # 全局样式与主题定义
│   └── counter.ts           # 工具函数
├── public/
│   ├── icon.svg             # 应用图标源文件
│   ├── icon.icns            # Mac 应用图标
│   ├── icon.ico             # Windows 应用图标
│   └── downloads/           # 应用下载目录
├── electron/                # Electron 桌面配置
│   ├── main.cjs
│   └── preload.cjs
├── capacitor.config.json    # Capacitor 移动配置
├── ios/                     # iOS 项目（自动生成）
├── android/                 # Android 项目（自动生成）
├── vite.config.js           # Vite 构建配置
├── tailwind.config.js       # Tailwind CSS 配置
├── tsconfig.json            # TypeScript 配置
├── package.json
└── dist/                    # 构建产物（部署用）
```

---

## 🏗️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vite** | 7.3.0 | 前端构建工具 |
| **TypeScript** | 5.x | 类型安全开发 |
| **Pixi.js** | 7.4.2 | 2D 图形渲染（棋盘和棋子） |
| **Tailwind CSS** | 3.x | UI 样式与主题管理 |
| **Capacitor** | 6.x | iOS/Android 跨平台桥接 |
| **Electron** | 30.x | 桌面应用框架 |
| **Node.js** | 20.19+ | 开发环境 |

---

## 🎨 代码架构

### 核心模块

#### 1. `FireworksOverlay` 类
```typescript
// 独立的全屏烟花效果层
- spawnFireworks(x, y, count) // 触发烟花爆炸
- 使用 Pixi.js Graphics 渲染
- z-index: 9999 确保在所有 UI 上方
```

#### 2. `PixiBoardRenderer` 类
```typescript
// Pixi.js 棋盘渲染引擎
- renderState(state) // 渲染游戏状态
- setHover(position) // 处理鼠标悬停
- updateTheme() // 实时切换主题
```

#### 3. 游戏状态管理
```typescript
interface GameState {
  board: Player[][]              // 15×15 棋盘数组
  current: Player                // 当前玩家
  winner: Player | 0             // 胜者或平局
  lastMove: { r, c } | null      // 上一步位置
  winningPieces: Array<{r, c}>   // 胜利棋子坐标
  history: Array<...>            // 历史记录（悔棋用）
}
```

#### 4. 主题系统
```typescript
// src/style.css 中定义
:root                            // 默认深色主题
:root.light-theme               // 浅色
:root.nature-theme              // 护眼绿
:root.traditional-theme         // 中国风
:root.ink-theme                 // 水墨雅韵（新增）
:root.highcontrast-theme        // 高对比度
```

---

## 🌐 部署指南

### Web 版本

#### Vercel（推荐）
```bash
npm install -g vercel
vercel --prod
```

#### Netlify
```bash
npm install -g netlify-cli
netlify init
netlify deploy --prod
```

#### 自有服务器（Nginx）
```bash
# 1. 构建
npm run build

# 2. 上传 dist/ 到服务器
scp -r dist/* user@server:/var/www/html/

# 3. Nginx 配置示例
# /etc/nginx/sites-available/fivechess
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存 1 年
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

sudo systemctl restart nginx
```

#### Docker 部署
```bash
docker build -t miu-fivechess .
docker run -d -p 80:80 miu-fivechess
```

### 桌面应用

#### macOS
1. 从 [GitHub Releases](https://github.com/papachong/web-fivechess/releases) 下载 `.dmg` 文件
2. 双击打开，拖拽应用到 Applications 文件夹
3. 从 Launchpad 或 Applications 启动

#### Windows
1. 从 [GitHub Releases](https://github.com/papachong/web-fivechess/releases) 下载 `.exe` 文件
2. 双击运行安装程序
3. 从开始菜单启动

### 移动应用

#### iOS
- 在 App Store 搜索 "小miu仔五子棋" 直接安装
- 或通过 TestFlight 测试版体验

#### Android
- 在 Google Play Store 搜索 "小miu仔五子棋" 安装
- 或手动下载 `.apk` 文件安装

---

## 🔧 开发指南

### 构建新功能

1. **修改游戏逻辑** → `src/main.ts` 中的 `checkWinner()` 或 `handlePlace()`
2. **调整视觉效果** → `src/style.css` 或 `PixiBoardRenderer` 类
3. **新增主题** → 在 `src/style.css` 中添加 `:root.new-theme { ... }`
4. **测试** → `npm run dev` 热更新测试

### 常见问题

#### Q: 烟花被弹窗遮挡怎么办？
**A**: 已通过 `FireworksOverlay` 独立层解决，z-index 设置为 9999

#### Q: 如何修改棋盘尺寸？
**A**: 修改 `src/main.ts` 的常量：
```typescript
const boardSize = 15  // 改为 19 等其他值
const grid = 36       // 改为其他网格大小
```

#### Q: Electron 打包失败？
**A**: 
```bash
rm -rf node_modules release
npm install
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build:mac
```

#### Q: iOS 签名错误？
**A**: 在 Xcode 中确保：
1. 已登录 Apple Developer 账号
2. Bundle ID 唯一（`com.gallenma.fivechess`）
3. Team 已选择

---

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| 初始加载时间 | < 2s（Web） |
| 帧率 | 60 FPS |
| 棋盘渲染耗时 | < 5ms |
| 烟花粒子数 | 360+ 个并发 |
| 包大小 | 526 KB（未压缩） |
| Gzip 大小 | 157 KB（压缩后） |

---

## 🤝 贡献指南

欢迎 Fork 和 Pull Request！

### 开发流程
1. Fork 此仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 使用 TypeScript 进行类型检查
- 代码注释采用中文或英文（保持一致）
- 遵循 Prettier 格式化规范

---

## 📝 更新日志

### v1.0.0 - 2025-01-01（当前）
✅ **新增**
- Pixi.js 高性能渲染引擎
- 6 套主题系统（新增水墨雅韵主题）
- 全屏烟花特效（不被弹窗遮挡）
- 响应式玻璃拟态 UI
- 完整的多平台支持

✨ **改进**
- 优化棋子渲染质感（黑曜石/羊脂玉）
- 改进深色主题护眼效果
- 增强棋盘线条辨识度

🐛 **修复**
- 修复烟花被游戏结束弹窗遮挡的问题
- 优化鼠标位置与棋盘坐标映射精度

---

## 📄 许可证

MIT License © 2024-2025 [Ruhoo AI](https://ruhooai.com/)

本项目源代码采用 MIT 许可证，详见 [LICENSE](./LICENSE) 文件。

---

## 🙏 致谢

感谢所有贡献者和玩家的支持！

- [Pixi.js](https://pixijs.com/) - 强大的 2D 渲染库
- [Vite](https://vitejs.dev/) - 闪电般的前端构建工具
- [Tailwind CSS](https://tailwindcss.com/) - 原子化 CSS 框架
- [Capacitor](https://capacitorjs.com/) - 跨平台移动应用框架

---

## 📞 联系方式

- 🌐 官网：[https://ruhooai.com/](https://ruhooai.com/)
- 📧 邮箱：contact@ruhooai.com
- 💬 反馈：[GitHub Issues](https://github.com/papachong/web-fivechess/issues)
- 🐦 关注：[@ruhoowww](https://weibo.com/u/ruhoowww)

---

## 🎯 未来规划

- [ ] 多人在线对战（WebSocket）
- [ ] AI 对手（机器学习）
- [ ] 棋局重放系统
- [ ] 竞技排名系统
- [ ] 社交分享功能
- [ ] 国际化支持（多语言）
