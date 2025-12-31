# 棋子设计优化建议

以下是几种不同风格的棋子渲染方案，您可以根据喜好选择一种进行应用。

## 1. 增强拟真风格 (Enhanced Realistic)
这种风格在现有基础上增强了光影效果，使棋子看起来更有立体感和质感。黑棋像黑曜石，白棋像白玉。

```typescript
function drawPieceRealistic(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, player: 1 | 2) {
  // 1. 投影 (Shadow) - 更柔和自然的投影
  const shadowGradient = ctx.createRadialGradient(x + 3, y + 3, 2, x + 3, y + 3, radius + 2)
  shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)')
  shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = shadowGradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  
  // 2. 主体 (Main Body)
  const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, radius/10, x, y, radius)
  
  if (player === 1) {
    // 黑棋 - 黑曜石质感
    gradient.addColorStop(0, '#666666')   // 高光点周围
    gradient.addColorStop(0.2, '#202020') // 过渡
    gradient.addColorStop(0.5, '#000000') // 主体黑
    gradient.addColorStop(1, '#000000')   // 边缘
  } else {
    // 白棋 - 羊脂白玉质感
    gradient.addColorStop(0, '#ffffff')   // 高光中心
    gradient.addColorStop(0.3, '#f0f0f0') // 亮部
    gradient.addColorStop(0.8, '#dcdcdc') // 暗部
    gradient.addColorStop(1, '#c0c0c0')   // 边缘阴影
  }
  
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  
  // 3. 顶部高光 (Specular Highlight) - 增加光泽感
  const highlightGrad = ctx.createRadialGradient(x - radius/3, y - radius/3, 1, x - radius/3, y - radius/3, radius/2)
  highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)')
  highlightGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.1)')
  highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = highlightGrad
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  // 4. 边缘反光 (Rim Light) - 增加体积感
  if (player === 1) {
      const rimGrad = ctx.createRadialGradient(x, y, radius - 2, x, y, radius)
      rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
      rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.15)')
      ctx.fillStyle = rimGrad
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
  }
}
```

## 2. 琉璃/水晶风格 (Glass/Crystal)
这种风格强调通透感和反光，看起来像彩色玻璃或水晶。

```typescript
function drawPieceGlass(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, player: 1 | 2) {
  // 1. 投影
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // 2. 主体
  const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius)
  if (player === 1) {
    // 深色水晶
    gradient.addColorStop(0, 'rgba(80, 80, 100, 0.9)')
    gradient.addColorStop(0.5, 'rgba(30, 30, 40, 0.95)')
    gradient.addColorStop(1, 'rgba(10, 10, 20, 1)')
  } else {
    // 浅色水晶
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    gradient.addColorStop(0.5, 'rgba(240, 240, 255, 0.9)')
    gradient.addColorStop(1, 'rgba(200, 200, 220, 0.9)')
  }
  
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  
  // 重置阴影以免影响后续绘制
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // 3. 强烈的高光 (Sharp Highlight)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse(x - radius/3, y - radius/3, radius/4, radius/6, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
  
  // 4. 底部反光 (Bottom Reflection)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.8, 0.5 * Math.PI, 2.5 * Math.PI); // 简化的底部反光形状
  // 实际可能需要更复杂的路径绘制月牙形
  ctx.fill();
}
```

## 3. 扁平极简风格 (Flat Minimalist)
适合现代UI，色彩纯净，无复杂渐变，清晰易读。

```typescript
function drawPieceFlat(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, player: 1 | 2) {
  // 1. 简单的圆形投影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
  ctx.fill();

  // 2. 纯色主体
  ctx.fillStyle = player === 1 ? '#2c3e50' : '#ecf0f1';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // 3. 描边 (可选，增加清晰度)
  ctx.strokeStyle = player === 1 ? '#1a252f' : '#bdc3c7';
  ctx.lineWidth = 2;
  ctx.stroke();
}
```

## 4. 霓虹/发光风格 (Neon Glow)
适合暗色主题，科技感强。

```typescript
function drawPieceNeon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, player: 1 | 2) {
  // 1. 外发光 (Outer Glow)
  const glowColor = player === 1 ? '#00ffcc' : '#ff00ff'; // 黑棋青光，白棋紫光
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 15;
  
  // 2. 主体
  ctx.fillStyle = player === 1 ? '#000000' : '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
  ctx.fill();
  
  // 3. 内部光环
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // 重置阴影
  ctx.shadowBlur = 0;
}
```

## 建议
推荐使用 **方案1 (增强拟真风格)** 作为默认优化，因为它最符合五子棋的传统审美，同时提升了视觉质感。如果您希望游戏看起来更现代或更具科技感，可以尝试其他方案。
