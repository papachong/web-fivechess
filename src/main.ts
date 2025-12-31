import './style.css'

type Player = 0 | 1 | 2

interface GameState {
  board: Player[][]
  current: Player
  winner: Player
  lastMove: { r: number; c: number } | null
  winningPieces: Array<{ r: number; c: number }> | null
  history: Array<{ board: Player[][]; current: Player }>
}

interface PlayerRecord {
  name: string
  score: number
  wins: number
  losses: number
  draws: number
}

interface Settings {
  soundEnabled: boolean
  theme: 'dark' | 'light' | 'nature' | 'traditional' | 'highcontrast'
  pieceStyle: 'realistic' | 'glass' | 'flat' | 'neon'
  player1Name: string
  player2Name: string
  player1Avatar: string // base64 image
  player2Avatar: string // base64 image
  nameHistory: string[]
  playerRecords: Map<string, PlayerRecord>
}

interface Save {
  name: string
  timestamp: number
  state: GameState
}

const boardSize = 15
const grid = 36
const margin = 44
const infoBar = 15
const width = boardSize * grid + margin * 2
const height = boardSize * grid + margin * 2 + infoBar

type FireworkParticle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  ttl: number
  color: string
  trail: Array<{ x: number; y: number }>
}

const fireworkPalette = ['#f43f5e', '#f97316', '#facc15', '#4ade80', '#34d399', '#38bdf8', '#818cf8', '#c084fc']

let animatingPieces: Map<string, number> = new Map()
let settings: Settings = { 
  soundEnabled: true, 
  theme: 'nature', 
  pieceStyle: 'realistic',
  player1Name: '西门鸡翅', 
  player2Name: '孤独牛排',
  player1Avatar: '',
  player2Avatar: '',
  nameHistory: ['西门鸡翅', '孤独牛排'],
  playerRecords: new Map()
}
let hoverPosition: { r: number; c: number } | null = null
let winAnimationTime = 0
let fireworks: FireworkParticle[] = []

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem('fivechess-settings')
  if (saved) {
    try {
      const loaded = JSON.parse(saved)
      // If avatars are empty in loaded settings, use the defaults
      if (!loaded.player1Avatar) delete loaded.player1Avatar
      if (!loaded.player2Avatar) delete loaded.player2Avatar
      settings = { ...settings, ...loaded }
      // Convert playerRecords to Map if needed
      if (loaded.playerRecords && typeof loaded.playerRecords === 'object') {
        settings.playerRecords = new Map(Object.entries(loaded.playerRecords))
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }
  // Ensure nameHistory is always an array
  if (!Array.isArray(settings.nameHistory)) {
    settings.nameHistory = []
  }
  // Ensure initial names are in history
  if (!settings.nameHistory.includes(settings.player1Name)) {
    settings.nameHistory.unshift(settings.player1Name)
  }
  if (!settings.nameHistory.includes(settings.player2Name)) {
    settings.nameHistory.unshift(settings.player2Name)
  }
  applyTheme()
}

function applyTheme() {
  const root = document.documentElement
  
  // Remove all theme classes
  root.classList.remove('light-theme', 'nature-theme', 'traditional-theme', 'highcontrast-theme')
  
  switch(settings.theme) {
    case 'light':
      root.style.setProperty('--board-bg', '#f0e6d2')
      root.style.setProperty('--board-line', '#8b7355')
      root.style.setProperty('--panel-bg', '#f5f5f5')
      root.style.setProperty('--text-color', '#1f2937')
      root.classList.add('light-theme')
      break
    case 'nature':
      root.style.setProperty('--board-bg', '#c7d9a8')
      root.style.setProperty('--board-line', '#6b8c3a')
      root.style.setProperty('--panel-bg', '#f0f4e8')
      root.style.setProperty('--text-color', '#2d5016')
      root.classList.add('nature-theme')
      break
    case 'traditional':
      root.style.setProperty('--board-bg', '#d4a574')
      root.style.setProperty('--board-line', '#8b6f47')
      root.style.setProperty('--panel-bg', '#2c1810')
      root.style.setProperty('--text-color', '#f0e6d2')
      root.classList.add('traditional-theme')
      break
    case 'highcontrast':
      root.style.setProperty('--board-bg', '#ffff00')
      root.style.setProperty('--board-line', '#000000')
      root.style.setProperty('--panel-bg', '#000000')
      root.style.setProperty('--text-color', '#ffff00')
      root.classList.add('highcontrast-theme')
      break
    default: // 'dark'
      root.style.setProperty('--board-bg', '#e6cfa7')
      root.style.setProperty('--board-line', '#111827')
      root.style.setProperty('--panel-bg', '#0b1221')
      root.style.setProperty('--text-color', '#e5e7eb')
  }
}

// Initialize or get player record
function getPlayerRecord(playerName: string): PlayerRecord {
  if (!settings.playerRecords.has(playerName)) {
    settings.playerRecords.set(playerName, {
      name: playerName,
      score: 0,
      wins: 0,
      losses: 0,
      draws: 0
    })
  }
  return settings.playerRecords.get(playerName)!
}

// Update player record after game
function updatePlayerRecord(playerName: string, result: 'win' | 'loss' | 'draw') {
  const record = getPlayerRecord(playerName)
  if (result === 'win') {
    record.wins++
    record.score += 10
  } else if (result === 'loss') {
    record.losses++
    record.score += 0
  } else if (result === 'draw') {
    record.draws++
    record.score += 3
  }
  // Save settings
  const settingsToSave = {
    ...settings,
    playerRecords: Object.fromEntries(settings.playerRecords)
  }
  localStorage.setItem('fivechess-settings', JSON.stringify(settingsToSave))
}

// Create fireworks effect
function createFireworks(x: number, y: number, count: number = 36) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.5 - 0.25)
    const speed = 1.6 + Math.random() * 4.2
    const ttl = 1.8 + Math.random() * 0.9
    fireworks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: ttl,
      ttl,
      color: fireworkPalette[Math.floor(Math.random() * fireworkPalette.length)],
      trail: []
    })
  }
}

// Update and draw fireworks
function drawFireworks(ctx: CanvasRenderingContext2D) {
  if (!fireworks.length) return
  const toRemove: number[] = []
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < fireworks.length; i++) {
    const particle = fireworks[i]
    particle.trail.unshift({ x: particle.x, y: particle.y })
    if (particle.trail.length > 7) {
      particle.trail.pop()
    }

    particle.x += particle.vx
    particle.y += particle.vy
    particle.vy += 0.05
    particle.life -= 0.016

    const progress = particle.life / particle.ttl
    if (progress <= 0) {
      toRemove.push(i)
      continue
    }

    const { r, g, b } = hexToRgb(particle.color)
    ctx.globalAlpha = Math.max(progress, 0)

    // Draw trailing light streak
    if (particle.trail.length > 1) {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.7, progress + 0.2)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(particle.trail[0].x, particle.trail[0].y)
      for (let t = 1; t < particle.trail.length; t++) {
        ctx.lineTo(particle.trail[t].x, particle.trail[t].y)
      }
      ctx.stroke()
    }

    // Draw glowing core
    const radius = 2 + (1 - progress) * 3
    const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius * 3)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, radius * 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  for (let i = toRemove.length - 1; i >= 0; i--) {
    fireworks.splice(toRemove[i], 1)
  }
}

function hexToRgb(hex: string) {
  let normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    normalized = normalized.split('').map((c) => c + c).join('')
  }
  const bigint = parseInt(normalized, 16)
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  }
}

const celebrationColors = ['#f97316', '#facc15', '#a3e635', '#34d399', '#60a5fa', '#c084fc']
type CelebrationRoutine = (winnerName: string) => void

function triggerConfettiBurst() {
  const existing = document.querySelector<HTMLDivElement>('#confetti-layer')
  if (existing) {
    existing.remove()
  }
  const layer = document.createElement('div')
  layer.id = 'confetti-layer'
  layer.className = 'confetti-layer'
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('span')
    piece.className = 'confetti-piece'
    piece.style.left = `${Math.random() * 100}%`
    piece.style.animationDelay = `${Math.random() * 0.4}s`
    piece.style.backgroundColor = celebrationColors[i % celebrationColors.length]
    piece.style.width = `${6 + Math.random() * 6}px`
    piece.style.height = `${10 + Math.random() * 10}px`
    piece.style.transform = `rotate(${Math.random() * 360}deg)`
    layer.appendChild(piece)
  }
  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 4500)
}

function showChampionBanner(winnerName: string) {
  let banner = document.querySelector<HTMLDivElement>('#champion-banner')
  if (!banner) {
    banner = document.createElement('div')
    banner.id = 'champion-banner'
    banner.className = 'champion-banner'
    document.body.appendChild(banner)
  }
  banner.textContent = `🏆 ${winnerName} 获胜！`
  banner.classList.remove('banner-hide')
  banner.classList.add('banner-show')
  setTimeout(() => {
    banner?.classList.add('banner-hide')
    setTimeout(() => banner?.remove(), 600)
  }, 3800)
}

function triggerSpotlightBurst() {
  const existing = document.querySelector<HTMLDivElement>('#spotlight-overlay')
  if (existing) {
    existing.remove()
  }
  const overlay = document.createElement('div')
  overlay.id = 'spotlight-overlay'
  overlay.className = 'spotlight-overlay'
  document.body.appendChild(overlay)
  setTimeout(() => overlay.remove(), 3200)
}

function launchFireworkShow() {
  const bursts = 4 + Math.floor(Math.random() * 3)
  for (let i = 0; i < bursts; i++) {
    setTimeout(() => {
      const x = margin + Math.random() * (width - margin * 2)
      const y = margin + Math.random() * (height - margin * 2)
      createFireworks(x, y, 45 + Math.floor(Math.random() * 30))
    }, i * 350)
  }
}

const celebrationRoutines: CelebrationRoutine[] = [
  () => launchFireworkShow(),
  () => triggerConfettiBurst(),
  (winnerName) => showChampionBanner(winnerName),
  () => triggerSpotlightBurst()
]

function runRandomCelebrations(winnerName: string) {
  const pool = [...celebrationRoutines]
  const count = Math.min(pool.length, 2 + Math.floor(Math.random() * 2))
  for (let i = 0; i < count; i++) {
    const choiceIndex = Math.floor(Math.random() * pool.length)
    const routine = pool.splice(choiceIndex, 1)[0]
    routine(winnerName)
  }
}

function playSound(type: 'black' | 'white') {
  if (!settings.soundEnabled) return
  // Create simple sine wave tone
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const freq = type === 'black' ? 392 : 523
  const duration = 0.12
  
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  osc.frequency.value = freq
  osc.type = 'sine'
  
  gain.gain.setValueAtTime(0.3, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
  
  osc.connect(gain)
  gain.connect(audioContext.destination)
  
  osc.start(audioContext.currentTime)
  osc.stop(audioContext.currentTime + duration)
}

function showSuccessNotification(message: string) {
  // Create notification container if it doesn't exist
  let notifContainer = document.querySelector('#notification-container') as HTMLDivElement
  if (!notifContainer) {
    notifContainer = document.createElement('div')
    notifContainer.id = 'notification-container'
    notifContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 100;
      pointer-events: none;
    `
    document.body.appendChild(notifContainer)
  }
  
  // Create notification element
  const notif = document.createElement('div')
  notif.style.cssText = `
    background: rgba(255, 255, 255, 0.15);
    color: #1f2937;
    padding: 20px 30px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(10px);
    animation: slideIn 0.3s ease-out;
    border: 1px solid rgba(255, 255, 255, 0.2);
  `
  
  // Add checkmark icon
  const checkmark = document.createElement('span')
  checkmark.innerHTML = '✓'
  checkmark.style.cssText = `
    font-size: 24px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #22c55e;
  `
  
  const text = document.createElement('span')
  text.textContent = message
  
  notif.appendChild(checkmark)
  notif.appendChild(text)
  notifContainer.appendChild(notif)
  
  // Add animation keyframes if not already present
  if (!document.querySelector('style[data-notification]')) {
    const style = document.createElement('style')
    style.setAttribute('data-notification', 'true')
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-20px);
        }
      }
    `
    document.head.appendChild(style)
  }
  
  // Auto-remove after 2 seconds
  setTimeout(() => {
    notif.style.animation = 'slideOut 0.3s ease-out'
    setTimeout(() => {
      notif.remove()
    }, 300)
  }, 2000)
}

function createInitialState(): GameState {
  return {
    board: Array.from({ length: boardSize }, () => Array<Player>(boardSize).fill(0 as Player)),
    current: 1,
    winner: 0,
    lastMove: null,
    winningPieces: null,
    history: [],
  }
}

function checkWin(board: Player[][], r: number, c: number): Array<{ r: number; c: number }> | null {
  const player = board[r][c]
  if (!player) return null
  
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const
  
  for (const [dr, dc] of dirs) {
    let winningPieces = [{ r, c }]
    
    // Check forward
    let x = r + dr
    let y = c + dc
    while (x >= 0 && x < boardSize && y >= 0 && y < boardSize && board[x][y] === player) {
      winningPieces.push({ r: x, c: y })
      x += dr
      y += dc
    }
    
    // Check backward
    x = r - dr
    y = c - dc
    while (x >= 0 && x < boardSize && y >= 0 && y < boardSize && board[x][y] === player) {
      winningPieces.unshift({ r: x, c: y })
      x -= dr
      y -= dc
    }
    
    if (winningPieces.length >= 5) {
      return winningPieces.slice(0, 5)
    }
  }
  return null
}

function getThemeColors() {
  switch(settings.theme) {
    case 'light':
      return { boardBg: '#f0e6d2', boardLine: '#8b7355', panelBg: '#f5f5f5' }
    case 'nature':
      return { boardBg: '#c7d9a8', boardLine: '#6b8c3a', panelBg: '#f0f4e8' }
    case 'traditional':
      return { boardBg: '#d4a574', boardLine: '#8b6f47', panelBg: '#2c1810' }
    case 'highcontrast':
      return { boardBg: '#ffff00', boardLine: '#000000', panelBg: '#000000' }
    default: // 'dark'
      return { boardBg: '#e6cfa7', boardLine: '#111827', panelBg: '#0b1221' }
  }
}

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

function drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, player: 1 | 2) {
  drawPieceRealistic(ctx, x, y, radius, player)
}

function drawBoard(ctx: CanvasRenderingContext2D, state: GameState) {
  const colors = getThemeColors()
  ctx.clearRect(0, 0, width, height)

  // panel background
  ctx.fillStyle = colors.panelBg
  ctx.fillRect(0, 0, width, height)

  // board background
  ctx.fillStyle = colors.boardBg
  ctx.strokeStyle = colors.boardLine
  ctx.lineWidth = 3
  ctx.fillRect(margin, margin, boardSize * grid, boardSize * grid)
  ctx.strokeRect(margin, margin, boardSize * grid, boardSize * grid)

  // grid lines
  ctx.strokeStyle = colors.boardLine
  ctx.lineWidth = 2
  for (let i = 0; i < boardSize; i++) {
    const x = margin + i * grid
    ctx.beginPath()
    ctx.moveTo(x, margin)
    ctx.lineTo(x, margin + boardSize * grid)
    ctx.stroke()

    const y = margin + i * grid
    ctx.beginPath()
    ctx.moveTo(margin, y)
    ctx.lineTo(margin + boardSize * grid, y)
    ctx.stroke()
  }

  // star points
  const stars = [
    [3, 3],
    [3, 11],
    [11, 3],
    [11, 11],
    [7, 7],
  ]
  ctx.fillStyle = colors.boardLine
  for (const [r, c] of stars) {
    const x = margin + c * grid
    const y = margin + r * grid
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Draw hover shadow effect
  if (hoverPosition && state.board[hoverPosition.r][hoverPosition.c] === 0 && !state.winner) {
    const { r, c } = hoverPosition
    const x = margin + c * grid
    const y = margin + r * grid
    const radius = grid * 0.42
    
    // Shadow circle for empty position
    ctx.fillStyle = state.current === 1 ? 'rgba(44, 62, 80, 0.5)' : 'rgba(255, 255, 255, 0.4)'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  // pieces with enhanced styling
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = state.board[r][c]
      if (p === 0) continue
      const x = margin + c * grid
      const y = margin + r * grid
      const radius = grid * 0.42
      
      // Get animation progress if piece is being placed
      const key = `${r}-${c}`
      const progress = animatingPieces.get(key) || 1
      const animRadius = radius * progress
      
      // Draw piece with enhanced shadow
      const shadowOffsetX = 3
      const shadowOffsetY = 3
      const shadowGradient = ctx.createRadialGradient(x + shadowOffsetX, y + shadowOffsetY, 2, x + shadowOffsetX, y + shadowOffsetY, animRadius)
      shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)')
      shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = shadowGradient
      ctx.beginPath()
      ctx.arc(x, y, animRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Main piece gradient with better depth
      const gradient = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, animRadius)
      if (p === 1) {
        // Black piece
        gradient.addColorStop(0, '#4a5f7f')
        gradient.addColorStop(0.4, '#2c3e50')
        gradient.addColorStop(0.9, '#1a252f')
        gradient.addColorStop(1, '#0f1419')
      } else {
        // White piece
        gradient.addColorStop(0, '#ffffff')
        gradient.addColorStop(0.3, '#f5f5f5')
        gradient.addColorStop(0.7, '#e8e8e8')
        gradient.addColorStop(1, '#d0d0d0')
      }
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, animRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Enhanced highlight on white pieces
      if (p === 2) {
        const highlightGrad = ctx.createRadialGradient(x - 7, y - 7, 1, x, y, animRadius * 0.8)
        highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
        highlightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)')
        highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
        ctx.fillStyle = highlightGrad
        ctx.beginPath()
        ctx.arc(x, y, animRadius, 0, Math.PI * 2)
        ctx.fill()
      }
      
      // Inner dark shading for black pieces
      if (p === 1) {
        const innerShade = ctx.createRadialGradient(x + 4, y + 4, 0, x, y, animRadius)
        innerShade.addColorStop(0, 'rgba(0, 0, 0, 0)')
        innerShade.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)')
        innerShade.addColorStop(1, 'rgba(0, 0, 0, 0.3)')
        ctx.fillStyle = innerShade
        ctx.beginPath()
        ctx.arc(x, y, animRadius, 0, Math.PI * 2)
        ctx.fill()
      }
      
      // 3D Border effect
      ctx.strokeStyle = p === 1 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(150, 150, 150, 0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, animRadius, 0, Math.PI * 2)
      ctx.stroke()
      
      // Inner highlight edge
      const edgeGrad = ctx.createLinearGradient(x - animRadius, y - animRadius, x + animRadius, y + animRadius)
      edgeGrad.addColorStop(0, p === 1 ? 'rgba(100, 120, 140, 0.4)' : 'rgba(255, 255, 255, 0.3)')
      edgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
      ctx.strokeStyle = edgeGrad
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, animRadius - 1, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // highlight last move
  if (state.lastMove) {
    const { r, c } = state.lastMove
    const x = margin + c * grid
    const y = margin + r * grid
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, grid * 0.48, 0, Math.PI * 2)
    ctx.stroke()

    // Center marker for last move (red dot)
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(x, y, grid * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }

  // highlight winning pieces with animation
  if (state.winningPieces && state.winningPieces.length > 0) {
    const pulseIntensity = 0.5 + 0.5 * Math.sin(winAnimationTime * 0.1)
    
    for (const { r, c } of state.winningPieces) {
      const x = margin + c * grid
      const y = margin + r * grid
      const radius = grid * 0.42
      
      // Glowing halo effect
      const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.3)
      glowGrad.addColorStop(0, `rgba(34, 197, 94, ${0.6 * pulseIntensity})`)
      glowGrad.addColorStop(0.5, `rgba(34, 197, 94, ${0.2 * pulseIntensity})`)
      glowGrad.addColorStop(1, 'rgba(34, 197, 94, 0)')
      
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(x, y, radius * 1.3, 0, Math.PI * 2)
      ctx.fill()
      
      // Bright border
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.8 * pulseIntensity})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Draw fireworks effect
  drawFireworks(ctx)

  // info bar - removed next player indicator from here
  ctx.fillStyle = colors.panelBg
  ctx.fillRect(0, height - infoBar, width, infoBar)
}

function run() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div class="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div class="w-full max-w-2xl mx-auto relative">
        <!-- Menu Overlay -->
        <div id="menu-overlay" class="fixed inset-0 bg-transparent opacity-0 invisible transition-all duration-300 z-20"></div>

        <!-- Dropdown Menu -->
        <div id="menu-panel" class="absolute hidden bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-40 w-48 py-2 menu-dropdown" style="top: 100%; left: 0; margin-top: 4px;">
          <nav class="flex flex-col">
            <button id="menu-save" class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              保存游戏
            </button>
            <button id="menu-load" class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              加载游戏
            </button>
            <div class="border-t border-slate-600 my-1"></div>
            <button id="menu-settings" class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              设置
            </button>
            <div class="border-t border-slate-600 my-1"></div>
            <button id="menu-exit" class="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 transition text-left">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              退出游戏
            </button>
          </nav>
        </div>

        <!-- Settings Panel -->
        <div id="settings-panel" class="hidden fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-white">设置</h2>
              <button id="settings-close" class="p-2 rounded hover:bg-slate-700 transition text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-semibold text-gray-300 mb-2">音效</label>
                <div class="flex items-center gap-3">
                  <input type="checkbox" id="sound-toggle" class="w-4 h-4" checked>
                  <label for="sound-toggle" class="text-sm text-gray-300">启用落子音效</label>
                </div>
              </div>
              <div>
                <label class="block text-sm font-semibold text-gray-300 mb-2">主题</label>
                <select id="theme-select" class="w-full px-3 py-2 bg-slate-700 text-white rounded-lg">
                  <option value="dark">深色</option>
                  <option value="light">浅色</option>
                  <option value="nature">护眼绿</option>
                  <option value="traditional">中国风</option>
                  <option value="highcontrast">高对比度</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Load Game Panel -->
        <div id="load-panel" class="hidden fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl max-h-96 overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-white">加载游戏</h2>
              <button id="load-close" class="p-2 rounded hover:bg-slate-700 transition text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div id="saves-list" class="space-y-2"></div>
          </div>
        </div>

        <!-- Leaderboard Panel -->
        <div id="leaderboard-panel" class="hidden fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-96 overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-white">玩家排行榜</h2>
              <button id="leaderboard-close" class="p-2 rounded hover:bg-slate-700 transition text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="space-y-2">
              <div class="grid grid-cols-5 gap-2 text-sm text-gray-300 font-semibold border-b border-slate-600 pb-2">
                <div>排名</div>
                <div>玩家</div>
                <div>积分</div>
                <div>胜负</div>
                <div>和局</div>
              </div>
              <div id="leaderboard-list" class="space-y-1"></div>
            </div>
          </div>
        </div>

        <!-- Game End Panel -->
        <div id="game-end-panel" class="hidden fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-2xl p-12 max-w-md w-full shadow-2xl text-center">
            <h2 id="game-end-title" class="text-4xl font-bold text-cyan-400 mb-8">恭喜！</h2>
            <p id="game-end-message" class="text-white text-xl mb-8">赢了！</p>
            <div class="flex gap-4">
              <button id="game-end-restart" class="flex-1 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-bold transition">
                重新游戏
              </button>
              <button id="game-end-menu" class="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition">
                返回菜单
              </button>
            </div>
          </div>
        </div>

        <!-- Top Control Bar with Menu, Undo, and Sound Toggle -->
        <div class="flex items-center justify-between gap-4 mb-6">
          <!-- Left Section: Menu and Leaderboard -->
          <div class="flex items-center gap-3">
            <!-- Menu Button Container -->
            <div class="relative" id="menu-container">
              <button id="menu-toggle" class="p-3 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition shadow-lg flex items-center justify-center" title="菜单" aria-label="菜单">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            
            <!-- Leaderboard Button -->
            <button id="leaderboard-toggle" class="p-3 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition shadow-lg flex items-center justify-center" title="排行榜" aria-label="排行榜">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21h18M5 21v-8h4v8M9 21v-12h6v12M15 21v-6h4v6" />
              </svg>
            </button>
          </div>
          
          <div class="flex-1"></div>
          
          <!-- Right Section: Reset, Undo, Sound, Download -->
          <div class="flex items-center gap-3">
            <!-- Reset Button -->
            <button id="top-reset" class="p-3 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition shadow-lg flex items-center justify-center" title="重新开始" aria-label="重新开始">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            <!-- Undo Button -->
            <button id="top-undo" class="p-3 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition shadow-lg flex items-center justify-center" title="悔棋" aria-label="悔棋">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            
            <!-- Sound Toggle Button - Icon Only with Hover Effect -->
            <button id="top-sound" class="p-3 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition shadow-lg flex items-center justify-center sound-icon-btn" title="音效">
              <svg class="w-5 h-5 sound-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0113 2.343v17.314a1 1 0 01-1.707.707L5.586 15z" />
              </svg>
            </button>
            
            <!-- Download Button Container - Icon Only -->
            <div class="relative" id="download-container">
              <button id="download-toggle" class="p-3 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition shadow-lg flex items-center justify-center" title="下载">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <!-- Download Dropdown -->
              <div id="download-dropdown" class="hidden absolute bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 w-56 py-2 menu-dropdown" style="top: 100%; right: 0; margin-top: 4px;">
                <div class="px-3 py-2 text-xs text-gray-400 border-b border-slate-600">选择平台下载</div>
                <a href="./downloads/miu-fivechess-mac.dmg" download class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  macOS (DMG)
                </a>
                <a href="./downloads/miu-fivechess-win.exe" download class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 12V6.75l6-1.32v6.48L3 12zm6.74.08l8.26-.87V5.31l-8.26 1.09v5.68zM3 13l6 .09v6.81l-6-1.09V13zm6.74.09l8.26.91v6.5l-8.26-1.12V13.09z"/>
                  </svg>
                  Windows (EXE)
                </a>
                <div class="border-t border-slate-600 my-1"></div>
                <a href="./downloads/miu-fivechess.ipa" download class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z"/>
                  </svg>
                  iOS (IPA)
                </a>
                <a href="./downloads/miu-fivechess.apk" download class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-1.4-.59-2.96-.92-4.47-.92s-3.07.33-4.47.92L5.65 5.67c-.19-.29-.54-.38-.84-.22-.3.16-.42.54-.26.85L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
                  </svg>
                  Android (APK)
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Players Info Bar -->
        <div class="flex items-center justify-between gap-2 sm:gap-4 mb-6 px-2 sm:px-4">
          <!-- Player 1 -->
          <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div class="relative group flex-shrink-0">
              <div id="player1-piece" class="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg cursor-pointer bg-slate-800 flex items-center justify-center overflow-hidden">
                <canvas width="48" height="48" class="w-full h-full"></canvas>
              </div>
              <div class="absolute bottom-0 right-0 bg-cyan-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer" onclick="document.getElementById('player1-avatar-dropdown-btn').click()">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 19.5a1 1 0 010 2H5a4 4 0 01-4-4V7a4 4 0 014-4h14a4 4 0 014 4v10.5a1 1 0 110-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10.5a2 2 0 002 2h7z" /></svg>
              </div>
              <!-- Avatar dropdown -->
              <div id="player1-avatar-dropdown" class="hidden absolute mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-50 p-2 grid grid-cols-3 gap-2 w-48 avatar-dropdown" style="top: 100%; left: 50%; transform: translateX(-50%);">
                <!-- Will be populated with avatar options -->
              </div>
              <button id="player1-avatar-dropdown-btn" class="hidden" onclick="toggleAvatarDropdown(1)"></button>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <div class="text-xs text-gray-400 whitespace-nowrap">黑棋</div>
                <svg id="player1-next-indicator" class="w-4 h-4 hidden indicator-light flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Outer glow -->
                  <circle cx="12" cy="12" r="11" stroke="#FBBF24" stroke-width="1" opacity="0.3" class="indicator-glow" />
                  <!-- Light bulb body -->
                  <circle cx="12" cy="12" r="8" fill="#FBBF24" class="indicator-core" />
                  <!-- Inner bright core -->
                  <circle cx="12" cy="12" r="5" fill="#FCD34D" class="indicator-bright" />
                </svg>
              </div>
              <div class="relative">
                <div class="flex gap-1">
                  <input id="player1-name" type="text" class="flex-1 min-w-0 px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 hover:border-slate-500 focus:border-cyan-400 focus:outline-none text-sm font-semibold truncate" placeholder="输入玩家名字" value="西门鸡翅" />
                  <button id="player1-dropdown-btn" class="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-xs flex-shrink-0">▼</button>
                </div>
                <div id="player1-dropdown" class="hidden absolute top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                  <!-- Options will be populated here -->
                </div>
              </div>
            </div>
          </div>
          
          <!-- VS indicator -->
          <div class="text-center flex-shrink-0">
            <div class="text-xl sm:text-2xl text-cyan-400 font-bold">VS</div>
          </div>
          
          <!-- Player 2 -->
          <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 flex-row-reverse">
            <div class="relative group flex-shrink-0">
              <div id="player2-piece" class="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg cursor-pointer bg-slate-800 flex items-center justify-center overflow-hidden">
                <canvas width="48" height="48" class="w-full h-full"></canvas>
              </div>
              <div class="absolute bottom-0 left-0 bg-cyan-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer" onclick="document.getElementById('player2-avatar-dropdown-btn').click()">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 19.5a1 1 0 010 2H5a4 4 0 01-4-4V7a4 4 0 014-4h14a4 4 0 014 4v10.5a1 1 0 110-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10.5a2 2 0 002 2h7z" /></svg>
              </div>
              <!-- Avatar dropdown -->
              <div id="player2-avatar-dropdown" class="hidden absolute mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-50 p-2 grid grid-cols-3 gap-2 w-48 avatar-dropdown" style="top: 100%; left: 50%; transform: translateX(-50%);">
                <!-- Will be populated with avatar options -->
              </div>
              <button id="player2-avatar-dropdown-btn" class="hidden" onclick="toggleAvatarDropdown(2)"></button>
            </div>
            <div class="flex-1 min-w-0 text-right">
              <div class="flex items-center justify-end gap-2 mb-1">
                <svg id="player2-next-indicator" class="w-4 h-4 hidden indicator-light flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Outer glow -->
                  <circle cx="12" cy="12" r="11" stroke="#FBBF24" stroke-width="1" opacity="0.3" class="indicator-glow" />
                  <!-- Light bulb body -->
                  <circle cx="12" cy="12" r="8" fill="#FBBF24" class="indicator-core" />
                  <!-- Inner bright core -->
                  <circle cx="12" cy="12" r="5" fill="#FCD34D" class="indicator-bright" />
                </svg>
                <div class="text-xs text-gray-400 whitespace-nowrap">白棋</div>
              </div>
              <div class="relative">
                <div class="flex gap-1 flex-row-reverse">
                  <input id="player2-name" type="text" class="flex-1 min-w-0 px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 hover:border-slate-500 focus:border-cyan-400 focus:outline-none text-sm font-semibold text-right truncate" placeholder="输入玩家名字" value="孤独牛排" />
                  <button id="player2-dropdown-btn" class="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded transition text-xs flex-shrink-0">▼</button>
                </div>
                <div id="player2-dropdown" class="hidden absolute top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                  <!-- Options will be populated here -->
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Canvas -->
        <div class="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
          <canvas id="board" width="${width}" height="${height}" class="w-full h-auto block bg-slate-900"></canvas>
        </div>

        <!-- Footer Information -->
        <div class="mt-8 text-center text-xs text-gray-400 border-t border-slate-700 pt-6 space-y-3">
          <!-- Company -->
          <div class="flex items-center justify-center gap-2">
            <span>儒虎智能科技（北京）有限公司</span>
          </div>
          <!-- ICP and Police Registration -->
          <div class="space-y-1">
            <div class="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 flex-wrap">
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-cyan-400 transition duration-200">京ICP备2025154066号-1</a>
              <span class="hidden sm:inline text-gray-600">|</span>
              <div class="flex items-center gap-1">
                <a href="https://beian.mps.gov.cn/#/query/webSearch?code=11011402055127" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-cyan-400 transition duration-200">京公网备11011402055127号</a>
                <img src="./police-badge.png" alt="京公网安备" class="h-3 sm:h-4">
              </div>
            </div>
            <div class="text-gray-500">Copyright © 2024-2025 Ruhoo AI. All Rights Reserved. 儒虎智能科技 版权所有</div>
          </div>
        </div>
      </div>
    </div>
  `

  const canvas = document.querySelector<HTMLCanvasElement>('#board')!
  const ctx = canvas.getContext('2d')!
  let state = createInitialState()
  let menuOpen = false

  // Load from localStorage
  const saved = localStorage.getItem('fivechess-state')
  if (saved) {
    try {
      state = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load state:', e)
    }
  }

  const redraw = () => drawBoard(ctx, state)
  redraw()

  // Draw player pieces in info bar
  function drawPlayerPieces() {
    const p1Container = document.querySelector<HTMLDivElement>('#player1-piece')!
    const p2Container = document.querySelector<HTMLDivElement>('#player2-piece')!
    
    const p1Canvas = p1Container.querySelector('canvas')!
    const p2Canvas = p2Container.querySelector('canvas')!
    
    const ctx1 = p1Canvas.getContext('2d')!
    const ctx2 = p2Canvas.getContext('2d')!
    
    // Clear canvases
    ctx1.clearRect(0, 0, 48, 48)
    ctx2.clearRect(0, 0, 48, 48)
    
    // Helper function to display avatar as img or draw piece on canvas
    const displayAvatar = (container: HTMLDivElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, avatarSrc: string | null, playerNum: 1 | 2) => {
      // Remove any existing img elements
      const existingImg = container.querySelector('img')
      if (existingImg) {
        existingImg.remove()
      }
      
      if (avatarSrc) {
        // Hide canvas and show image
        canvas.style.display = 'none'
        const img = document.createElement('img')
        img.src = avatarSrc
        img.className = 'w-full h-full object-cover'
        img.alt = `Player ${playerNum} avatar`
        img.onerror = () => {
          // Fallback to drawing piece on canvas if image fails
          img.remove()
          canvas.style.display = 'block'
          drawPiece(ctx, 24, 24, 20, playerNum)
        }
        container.appendChild(img)
      } else {
        // Show canvas and draw piece
        canvas.style.display = 'block'
        drawPiece(ctx, 24, 24, 20, playerNum)
      }
    }
    
    // Display player 1 avatar or piece
    displayAvatar(p1Container, p1Canvas, ctx1, settings.player1Avatar, 1)
    
    // Display player 2 avatar or piece
    displayAvatar(p2Container, p2Canvas, ctx2, settings.player2Avatar, 2)
  }

  // Show game end panel
  // Check if board is full (draw condition)
  function isBoardFull(): boolean {
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (state.board[r][c] === 0) {
          return false
        }
      }
    }
    return true
  }

  function showGameEndPanel(winner: Player | 'draw') {
    const panel = document.querySelector<HTMLDivElement>('#game-end-panel')!
    const title = document.querySelector<HTMLHeadingElement>('#game-end-title')!
    const message = document.querySelector<HTMLParagraphElement>('#game-end-message')!
    
    if (winner === 'draw') {
      title.textContent = '平局'
      message.textContent = '棋盘已满，游戏结束！'
      // Update scores for draw
      updatePlayerRecord(settings.player1Name, 'draw')
      updatePlayerRecord(settings.player2Name, 'draw')
    } else {
      const winnerName = winner === 1 ? settings.player1Name : settings.player2Name
      const loserName = winner === 1 ? settings.player2Name : settings.player1Name
      title.textContent = '恭喜！'
      message.textContent = `${winnerName}赢了！`
      // Update scores for win/loss
      updatePlayerRecord(winnerName, 'win')
      updatePlayerRecord(loserName, 'loss')
      runRandomCelebrations(winnerName)
    }
    
    // Show panel
    panel.classList.remove('hidden')
  }

  // Helper function to get grid position from mouse event
  function getGridPosition(evt: MouseEvent): { r: number; c: number } | null {
    const rect = canvas.getBoundingClientRect()
    // Calculate scaled coordinates (canvas drawn size vs actual size)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (evt.clientX - rect.left) * scaleX
    const y = (evt.clientY - rect.top) * scaleY
    const c = Math.round((x - margin) / grid)
    const r = Math.round((y - margin) / grid)
    
    if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
      return { r, c }
    }
    return null
  }

  // Menu handlers
  const menuToggle = document.querySelector<HTMLButtonElement>('#menu-toggle')!
  const menuPanel = document.querySelector<HTMLDivElement>('#menu-panel')!
  const menuOverlay = document.querySelector<HTMLDivElement>('#menu-overlay')!
  const menuContainer = document.querySelector<HTMLDivElement>('#menu-container')!

  // Initialize sound button state
  const soundBtn = document.querySelector<HTMLButtonElement>('#top-sound')!
  if (!settings.soundEnabled) {
    soundBtn.classList.add('sound-disabled')
  }

  // Move menu panel into menu container for proper positioning
  menuContainer.appendChild(menuPanel)

  function toggleMenu() {
    menuOpen = !menuOpen
    if (menuOpen) {
      menuPanel.classList.remove('hidden')
      menuOverlay.classList.remove('opacity-0', 'invisible')
    } else {
      menuPanel.classList.add('hidden')
      menuOverlay.classList.add('opacity-0', 'invisible')
    }
  }

  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleMenu()
  })
  menuOverlay.addEventListener('click', toggleMenu)
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (menuOpen && !menuContainer.contains(e.target as Node)) {
      toggleMenu()
    }
  })

  // Download dropdown handlers
  const downloadToggle = document.querySelector<HTMLButtonElement>('#download-toggle')!
  const downloadDropdown = document.querySelector<HTMLDivElement>('#download-dropdown')!
  const downloadContainer = document.querySelector<HTMLDivElement>('#download-container')!
  let downloadOpen = false

  function toggleDownload() {
    downloadOpen = !downloadOpen
    if (downloadOpen) {
      downloadDropdown.classList.remove('hidden')
    } else {
      downloadDropdown.classList.add('hidden')
    }
  }

  downloadToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleDownload()
  })

  // Close download dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (downloadOpen && !downloadContainer.contains(e.target as Node)) {
      toggleDownload()
    }
  })

  // Canvas click handler with animation
  function handlePlace(evt: MouseEvent) {
    if (state.winner) return
    const pos = getGridPosition(evt)
    if (!pos) return
    const { r: row, c: col } = pos
    if (state.board[row][col] !== 0) return

    // Save to history for undo
    state.history.push({
      board: state.board.map(row => [...row]),
      current: state.current,
    })

    state.board[row][col] = state.current
    state.lastMove = { r: row, c: col }
    
    playSound(state.current === 1 ? 'black' : 'white')
    
    // Check for winning condition and get winning pieces
    const winningPieces = checkWin(state.board, row, col)
    if (winningPieces) {
      state.winner = state.current
      state.winningPieces = winningPieces
      winAnimationTime = 0
      // Show game end panel after animation completes
      setTimeout(() => {
        showGameEndPanel(state.winner)
      }, 400)
    } else if (isBoardFull()) {
      // Check if board is full (draw condition)
      state.winner = 0 // Mark game as ended with 0 (draw)
      // Show game end panel for draw
      setTimeout(() => {
        showGameEndPanel('draw')
      }, 400)
    } else {
      state.current = state.current === 1 ? 2 : 1
    }
    localStorage.setItem('fivechess-state', JSON.stringify(state))
    animatePiece()
  }

  // Animation loop for piece placement
  function animatePiece() {
    let hasAnimations = false
    for (const [key, progress] of animatingPieces.entries()) {
      const newProgress = progress + 0.12
      if (newProgress >= 1) {
        animatingPieces.delete(key)
      } else {
        animatingPieces.set(key, newProgress)
        hasAnimations = true
      }
    }
    
    // Update win animation time if there's a winner
    if (state.winner && state.winningPieces && state.winningPieces.length > 0) {
      winAnimationTime++
      hasAnimations = true
    } else if (!state.winner) {
      // Update animation for next player piece
      winAnimationTime++
      hasAnimations = true
    }
    
    // Check if there are fireworks to animate
    if (fireworks.length > 0) {
      hasAnimations = true
    }
    
    redraw()
    drawPlayerPieces()
    updateNextPlayerIndicator()
    if (hasAnimations) {
      requestAnimationFrame(animatePiece)
    }
  }
  
  // Update next player indicator
  function updateNextPlayerIndicator() {
    const player1Indicator = document.querySelector<HTMLDivElement>('#player1-next-indicator')
    const player2Indicator = document.querySelector<HTMLDivElement>('#player2-next-indicator')
    
    if (!player1Indicator || !player2Indicator) return
    
    if (state.winner) {
      // Hide both indicators when game is over
      player1Indicator.classList.add('hidden')
      player2Indicator.classList.add('hidden')
    } else {
      // Show indicator for current player
      if (state.current === 1) {
        player1Indicator.classList.remove('hidden')
        player2Indicator.classList.add('hidden')
      } else {
        player1Indicator.classList.add('hidden')
        player2Indicator.classList.remove('hidden')
      }
    }
  }

  // Menu item handlers
  document.querySelector('#menu-reset')?.addEventListener('click', () => {
    state = createInitialState()
    localStorage.removeItem('fivechess-state')
    redraw()
    toggleMenu()
  })

  // Top reset button
  document.querySelector('#top-reset')?.addEventListener('click', () => {
    state = createInitialState()
    localStorage.removeItem('fivechess-state')
    redraw()
  })

  document.querySelector('#menu-save')?.addEventListener('click', () => {
    // Generate default name from current time
    const now = new Date()
    const defaultName = now.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    // Prompt user for save name
    const saveName = prompt('请输入保存名称:', defaultName)
    if (saveName === null) return // User cancelled
    
    const saves = JSON.parse(localStorage.getItem('fivechess-saves') || '[]') as Save[]
    saves.push({ name: saveName || defaultName, timestamp: Date.now(), state })
    localStorage.setItem('fivechess-saves', JSON.stringify(saves))
    
    // Show success notification
    showSuccessNotification('游戏已保存')
    toggleMenu()
  })

  document.querySelector('#menu-load')?.addEventListener('click', () => {
    toggleMenu()
    showLoadPanel()
  })

  document.querySelector('#menu-settings')?.addEventListener('click', () => {
    toggleMenu()
    showSettingsPanel()
  })

  // Top bar undo button handler
  document.querySelector('#top-undo')?.addEventListener('click', () => {
    if (state.history.length === 0) {
      alert('没有可悔棋的步数')
      return
    }
    const previous = state.history.pop()!
    state.board = previous.board
    state.current = previous.current
    state.winner = 0
    state.lastMove = null
    localStorage.setItem('fivechess-state', JSON.stringify(state))
    redraw()
  })

  // Top bar sound toggle handler
  document.querySelector('#top-sound')?.addEventListener('click', () => {
    settings.soundEnabled = !settings.soundEnabled
    localStorage.setItem('fivechess-settings', JSON.stringify(settings))
    const soundBtn = document.querySelector('#top-sound') as HTMLButtonElement
    if (settings.soundEnabled) {
      soundBtn.classList.remove('sound-disabled')
    } else {
      soundBtn.classList.add('sound-disabled')
    }
  })

  document.querySelector('#menu-exit')?.addEventListener('click', () => {
    const electronAPI = (window as any).electronAPI
    if (electronAPI && typeof electronAPI.quitApp === 'function') {
      // Electron 由主进程弹一次确认
      electronAPI.quitApp()
    } else {
      // Web 版本：本地确认一次
      if (confirm('确定要退出游戏吗？')) {
        if (window.opener) {
          window.close()
        } else {
          location.href = '/'
        }
      }
    }
  })

  // Game end panel handlers
  document.querySelector('#game-end-restart')?.addEventListener('click', () => {
    const panel = document.querySelector<HTMLDivElement>('#game-end-panel')!
    state = createInitialState()
    localStorage.removeItem('fivechess-state')
    redraw()
    panel.classList.add('hidden')
  })

  document.querySelector('#game-end-menu')?.addEventListener('click', () => {
    const panel = document.querySelector<HTMLDivElement>('#game-end-panel')!
    panel.classList.add('hidden')
    toggleMenu()
  })

  function showSettingsPanel() {
    const panel = document.querySelector<HTMLDivElement>('#settings-panel')!
    const soundToggle = document.querySelector<HTMLInputElement>('#sound-toggle')!
    const themeSelect = document.querySelector<HTMLSelectElement>('#theme-select')!
    
    soundToggle.checked = settings.soundEnabled
    themeSelect.value = settings.theme
    
    soundToggle.onchange = () => {
      settings.soundEnabled = soundToggle.checked
      localStorage.setItem('fivechess-settings', JSON.stringify(settings))
    }
    
    themeSelect.onchange = () => {
      settings.theme = themeSelect.value as 'dark' | 'light' | 'nature' | 'traditional' | 'highcontrast'
      localStorage.setItem('fivechess-settings', JSON.stringify(settings))
      applyTheme()
      redraw()
    }
    
    panel.classList.remove('hidden')
    const closeBtn = document.querySelector<HTMLButtonElement>('#settings-close')
    if (closeBtn) {
      closeBtn.onclick = () => {
        panel.classList.add('hidden')
      }
    }
  }

  function showLoadPanel() {
    const panel = document.querySelector<HTMLDivElement>('#load-panel')!
    const savesList = document.querySelector<HTMLDivElement>('#saves-list')!
    const saves = localStorage.getItem('fivechess-saves')
    if (saves) {
      savesList.innerHTML = ''
      try {
        const savesArray = JSON.parse(saves) as Save[]
        if (savesArray.length === 0) {
          savesList.innerHTML = '<p class="text-gray-400">没有保存的游戏</p>'
        } else {
          savesArray.reverse().forEach((save, idx) => {
            // Create container for save item with load and delete buttons
            const itemContainer = document.createElement('div')
            itemContainer.className = 'flex gap-2'
            
            // Load button
            const btn = document.createElement('button')
            btn.className =
              'flex-1 text-left px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 transition text-white text-sm'
            btn.textContent = `保存 ${idx + 1}: ${save.name}`
            btn.addEventListener('click', () => {
              state = save.state
              redraw()
              panel.classList.add('hidden')
              showSuccessNotification('游戏已加载')
            })
            
            // Delete button
            const deleteBtn = document.createElement('button')
            deleteBtn.className =
              'px-3 py-3 rounded-lg bg-red-600 hover:bg-red-500 transition text-white text-sm font-semibold'
            deleteBtn.textContent = '删除'
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation()
              if (confirm(`确定要删除保存"${save.name}"吗？`)) {
                const saves = JSON.parse(localStorage.getItem('fivechess-saves') || '[]') as Save[]
                const filteredSaves = saves.filter(s => s.timestamp !== save.timestamp)
                localStorage.setItem('fivechess-saves', JSON.stringify(filteredSaves))
                showSuccessNotification('保存已删除')
                // Refresh the load panel
                showLoadPanel()
              }
            })
            
            itemContainer.appendChild(btn)
            itemContainer.appendChild(deleteBtn)
            savesList.appendChild(itemContainer)
          })
        }
      } catch (e) {
        console.error('Failed to parse saves:', e)
        savesList.innerHTML = '<p class="text-gray-400">保存数据损坏</p>'
      }
    } else {
      savesList.innerHTML = '<p class="text-gray-400">没有保存的游戏</p>'
    }
    panel.classList.remove('hidden')
    document.querySelector('#load-close')?.addEventListener('click', () => {
      panel.classList.add('hidden')
    })
  }

  function showLeaderboard() {
    const panel = document.querySelector<HTMLDivElement>('#leaderboard-panel')!
    const leaderboardList = document.querySelector<HTMLDivElement>('#leaderboard-list')!
    
    // Get all player records and sort by score
    const records = Array.from(settings.playerRecords.values())
      .sort((a, b) => b.score - a.score)
    
    leaderboardList.innerHTML = ''
    
    if (records.length === 0) {
      leaderboardList.innerHTML = '<p class="text-gray-400 col-span-5">暂无数据</p>'
    } else {
      records.forEach((record, index) => {
        const row = document.createElement('div')
        row.className = 'grid grid-cols-5 gap-2 text-sm py-2 px-2 rounded-lg transition'
        
        // Style top 3
        if (index === 0) {
          row.className += ' bg-yellow-500/20 border border-yellow-500/50'
        } else if (index === 1) {
          row.className += ' bg-gray-400/20 border border-gray-400/50'
        } else if (index === 2) {
          row.className += ' bg-orange-600/20 border border-orange-600/50'
        } else {
          row.className += ' bg-slate-700/50'
        }
        
        // Rank with medal
        const rankDiv = document.createElement('div')
        rankDiv.className = 'font-bold text-2xl'
        if (index === 0) {
          rankDiv.textContent = '🥇'
        } else if (index === 1) {
          rankDiv.textContent = '🥈'
        } else if (index === 2) {
          rankDiv.textContent = '🥉'
        } else {
          rankDiv.textContent = `${index + 1}`
        }
        
        const nameDiv = document.createElement('div')
        nameDiv.textContent = record.name
        nameDiv.className = 'truncate text-white'
        
        const scoreDiv = document.createElement('div')
        scoreDiv.textContent = `${record.score}`
        scoreDiv.className = 'font-semibold text-white'
        
        const recordDiv = document.createElement('div')
        recordDiv.textContent = `${record.wins}-${record.losses}`
        recordDiv.className = 'text-gray-300'
        
        const drawDiv = document.createElement('div')
        drawDiv.textContent = `${record.draws}`
        drawDiv.className = 'text-gray-300'
        
        row.appendChild(rankDiv)
        row.appendChild(nameDiv)
        row.appendChild(scoreDiv)
        row.appendChild(recordDiv)
        row.appendChild(drawDiv)
        
        leaderboardList.appendChild(row)
      })
    }
    
    panel.classList.remove('hidden')
    document.querySelector('#leaderboard-close')?.addEventListener('click', () => {
      panel.classList.add('hidden')
    })
  }

  document.querySelector('#menu-leaderboard')?.addEventListener('click', () => {
    toggleMenu()
    showLeaderboard()
  })

  document.querySelector('#leaderboard-toggle')?.addEventListener('click', () => {
    showLeaderboard()
  })

  canvas.addEventListener('click', handlePlace)
  
  // Touch event for mobile devices
  canvas.addEventListener('touchstart', (evt: TouchEvent) => {
    evt.preventDefault()
    if (evt.touches.length === 1) {
      const touch = evt.touches[0]
      const rect = canvas.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      
      // Simulate mouse event for position calculation
      const mouseEvent = new MouseEvent('click', {
        clientX: touch.clientX,
        clientY: touch.clientY
      })
      Object.defineProperty(mouseEvent, 'offsetX', { value: x })
      Object.defineProperty(mouseEvent, 'offsetY', { value: y })
      handlePlace(mouseEvent as any)
    }
  }, false)
  
  // Mouse move event for hover shadow effect
  canvas.addEventListener('mousemove', (evt: MouseEvent) => {
    const pos = getGridPosition(evt)
    hoverPosition = pos
    redraw()
  })
  
  // Mouse leave event to clear hover effect
  canvas.addEventListener('mouseleave', () => {
    hoverPosition = null
    redraw()
  })

  // Player name and avatar uploads
  const player1NameInput = document.querySelector<HTMLInputElement>('#player1-name')!
  const player2NameInput = document.querySelector<HTMLInputElement>('#player2-name')!
  const player1DropdownBtn = document.querySelector<HTMLButtonElement>('#player1-dropdown-btn')!
  const player2DropdownBtn = document.querySelector<HTMLButtonElement>('#player2-dropdown-btn')!
  const player1Dropdown = document.querySelector<HTMLDivElement>('#player1-dropdown')!
  const player2Dropdown = document.querySelector<HTMLDivElement>('#player2-dropdown')!
  
  let player1DropdownOpen = false
  let player2DropdownOpen = false
  
  // Initialize name inputs with current values
  function updateNameInputs() {
    player1NameInput.value = settings.player1Name
    player2NameInput.value = settings.player2Name
  }
  
  // Build and display dropdown options
  function updatePlayerDropdown(playerNum: 1 | 2) {
    const dropdown = playerNum === 1 ? player1Dropdown : player2Dropdown
    const history = settings.nameHistory || []
    
    dropdown.innerHTML = ''
    
    history.forEach((name, index) => {
      const optionDiv = document.createElement('div')
      optionDiv.className = 'flex items-center justify-between px-3 py-2 hover:bg-slate-600 border-b border-slate-600 text-sm text-white'
      
      // Name option
      const nameSpan = document.createElement('span')
      nameSpan.textContent = name
      nameSpan.className = 'cursor-pointer flex-1'
      nameSpan.addEventListener('click', () => {
        if (playerNum === 1) {
          settings.player1Name = name
          player1NameInput.value = name
        } else {
          settings.player2Name = name
          player2NameInput.value = name
        }
        localStorage.setItem('fivechess-settings', JSON.stringify(settings))
        drawPlayerPieces()
        closeDropdown(playerNum)
      })
      
      // Edit button
      const editBtn = document.createElement('button')
      editBtn.className = 'p-1 hover:bg-slate-500 rounded transition text-xs'
      editBtn.innerHTML = '✎'
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const newName = prompt(`修改名字：`, name)
        if (newName && newName.trim()) {
          const trimmedName = newName.trim()
          history[index] = trimmedName
          settings.nameHistory = history
          if (playerNum === 1) {
            settings.player1Name = trimmedName
            player1NameInput.value = trimmedName
          } else {
            settings.player2Name = trimmedName
            player2NameInput.value = trimmedName
          }
          localStorage.setItem('fivechess-settings', JSON.stringify(settings))
          updatePlayerDropdown(playerNum)
          drawPlayerPieces()
        }
      })
      
      // Delete button
      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'p-1 hover:bg-red-600 rounded transition text-xs'
      deleteBtn.innerHTML = '✕'
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        history.splice(index, 1)
        settings.nameHistory = history
        localStorage.setItem('fivechess-settings', JSON.stringify(settings))
        updatePlayerDropdown(playerNum)
      })
      
      optionDiv.appendChild(nameSpan)
      optionDiv.appendChild(editBtn)
      optionDiv.appendChild(deleteBtn)
      dropdown.appendChild(optionDiv)
    })
  }
  
  // Toggle dropdown
  function toggleDropdown(playerNum: 1 | 2) {
    if (playerNum === 1) {
      player1DropdownOpen = !player1DropdownOpen
      if (player1DropdownOpen) {
        updatePlayerDropdown(1)
        player1Dropdown.classList.remove('hidden')
        player2Dropdown.classList.add('hidden')
        player2DropdownOpen = false
      } else {
        player1Dropdown.classList.add('hidden')
      }
    } else {
      player2DropdownOpen = !player2DropdownOpen
      if (player2DropdownOpen) {
        updatePlayerDropdown(2)
        player2Dropdown.classList.remove('hidden')
        player1Dropdown.classList.add('hidden')
        player1DropdownOpen = false
      } else {
        player2Dropdown.classList.add('hidden')
      }
    }
  }
  
  // Close dropdown
  function closeDropdown(playerNum: 1 | 2) {
    if (playerNum === 1) {
      player1DropdownOpen = false
      player1Dropdown.classList.add('hidden')
    } else {
      player2DropdownOpen = false
      player2Dropdown.classList.add('hidden')
    }
  }
  
  // Dropdown button click
  player1DropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleDropdown(1)
  })
  
  player2DropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleDropdown(2)
  })
  
  // Handle name input change
  player1NameInput.addEventListener('change', () => {
    const newName = player1NameInput.value.trim()
    if (newName) {
      settings.player1Name = newName
      // Add to history if not already there
      if (!settings.nameHistory.includes(newName)) {
        settings.nameHistory.unshift(newName)
        if (settings.nameHistory.length > 20) {
          settings.nameHistory.pop()
        }
      }
      localStorage.setItem('fivechess-settings', JSON.stringify(settings))
      drawPlayerPieces()
    } else {
      updateNameInputs()
    }
  })
  
  player2NameInput.addEventListener('change', () => {
    const newName = player2NameInput.value.trim()
    if (newName) {
      settings.player2Name = newName
      // Add to history if not already there
      if (!settings.nameHistory.includes(newName)) {
        settings.nameHistory.unshift(newName)
        if (settings.nameHistory.length > 20) {
          settings.nameHistory.pop()
        }
      }
      localStorage.setItem('fivechess-settings', JSON.stringify(settings))
      drawPlayerPieces()
    } else {
      updateNameInputs()
    }
  })
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    closeDropdown(1)
    closeDropdown(2)
  })
  
  // Cartoon avatars - using image files for better compatibility
  const cartoonAvatars: { name: string; src: string; isChessPiece?: boolean }[] = [
    {
      name: '黑棋子',
      src: new URL('../public/avatars/black-piece.svg', import.meta.url).href,
      isChessPiece: true
    },
    {
      name: '白棋子',
      src: new URL('../public/avatars/white-piece.svg', import.meta.url).href,
      isChessPiece: true
    },
    {
      name: '朱迪·兔',
      src: new URL('../public/avatars/judy.svg', import.meta.url).href
    },
    {
      name: '尼克·狐',
      src: new URL('../public/avatars/nick.svg', import.meta.url).href
    },
    {
      name: '闪电·树懒',
      src: new URL('../public/avatars/flash.svg', import.meta.url).href
    },
    {
      name: '牛局长',
      src: new URL('../public/avatars/bogo.svg', import.meta.url).href
    },
    {
      name: '绵羊副市长',
      src: new URL('../public/avatars/bellwether.svg', import.meta.url).href
    }
  ]
  
  // Toggle avatar dropdown
  function toggleAvatarDropdown(playerNum: 1 | 2) {
    const dropdownId = playerNum === 1 ? 'player1-avatar-dropdown' : 'player2-avatar-dropdown'
    const canvasId = playerNum === 1 ? 'player1-piece' : 'player2-piece'
    const dropdown = document.querySelector<HTMLDivElement>(`#${dropdownId}`)
    const canvas = document.querySelector<HTMLCanvasElement>(`#${canvasId}`)
    if (!dropdown || !canvas) return
    
    const isHidden = dropdown.classList.contains('hidden')
    // Hide all dropdowns first
    document.querySelectorAll('[id$="-avatar-dropdown"]').forEach(el => {
      el.classList.add('hidden')
    })
    
    if (isHidden) {
      dropdown.classList.remove('hidden')
      
      // Smart positioning: ensure dropdown stays within viewport
      requestAnimationFrame(() => {
        const canvasRect = canvas.getBoundingClientRect()
        const dropdownRect = dropdown.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        
        // Reset transform first
        dropdown.style.transform = 'translateX(-50%)'
        dropdown.style.left = '50%'
        
        // Check if dropdown exceeds left edge
        const dropdownLeft = canvasRect.left + (canvasRect.width / 2) - (dropdownRect.width / 2)
        if (dropdownLeft < 8) {
          // Align to left edge of canvas with padding
          dropdown.style.transform = 'none'
          dropdown.style.left = '0'
        }
        
        // Check if dropdown exceeds right edge
        const dropdownRight = canvasRect.left + (canvasRect.width / 2) + (dropdownRect.width / 2)
        if (dropdownRight > viewportWidth - 8) {
          // Align to right edge of canvas
          dropdown.style.transform = 'none'
          dropdown.style.left = 'auto'
          dropdown.style.right = '0'
        }
      })
      
      // Populate avatar options
      if (dropdown.children.length === 0) {
        cartoonAvatars.forEach((avatar, index) => {
          const option = document.createElement('div')
          option.className = 'cursor-pointer p-2 rounded hover:bg-slate-600 transition flex items-center justify-center'
          option.style.width = '60px'
          option.style.height = '60px'
          option.title = avatar.name
          
          // Create image element for the avatar
          const img = document.createElement('img')
          img.src = avatar.src
          img.width = 48
          img.height = 48
          img.alt = avatar.name
          img.className = 'rounded-full'
          img.style.objectFit = 'cover'
          
          option.appendChild(img)
          option.onclick = () => selectAvatar(playerNum, index)
          dropdown.appendChild(option)
        })
      }
    }
  }
  
  // Make functions globally accessible for HTML onclick handlers
  ;(globalThis as any).toggleAvatarDropdown = toggleAvatarDropdown
  
  // Select avatar
  function selectAvatar(playerNum: 1 | 2, avatarIndex: number) {
    const avatar = cartoonAvatars[avatarIndex]
    const avatarSrc = avatar.src
    
    // Keep chess piece selections as explicit avatars so the change is visible
    if (playerNum === 1) {
      settings.player1Avatar = avatarSrc
    } else {
      settings.player2Avatar = avatarSrc
    }
    
    // Save settings properly (convert Map to Object for JSON serialization)
    const settingsToSave = {
      ...settings,
      playerRecords: Object.fromEntries(settings.playerRecords)
    }
    localStorage.setItem('fivechess-settings', JSON.stringify(settingsToSave))
    
    // Immediately redraw player pieces
    drawPlayerPieces()
    
    // Close dropdown
    const dropdownId = playerNum === 1 ? 'player1-avatar-dropdown' : 'player2-avatar-dropdown'
    const dropdown = document.querySelector<HTMLDivElement>(`#${dropdownId}`)
    if (dropdown) {
      dropdown.classList.add('hidden')
    }
  }
  
  // Make functions globally accessible for HTML onclick handlers
  ;(globalThis as any).toggleAvatarDropdown = toggleAvatarDropdown
  ;(globalThis as any).selectAvatar = selectAvatar
  
  // 监听 Electron 窗口关闭事件
  const electronAPI = (window as any).electronAPI
  if (electronAPI && typeof electronAPI.onConfirmExit === 'function') {
    electronAPI.onConfirmExit(() => {
      if (confirm('确定要退出游戏吗？')) {
        electronAPI.executeExit()
      } else {
        electronAPI.cancelExit()
      }
    })
  }
  
  // Load settings on startup
  loadSettings()
  updateNameInputs()
  updatePlayerDropdown(1)
  updatePlayerDropdown(2)
  drawPlayerPieces()
  updateNextPlayerIndicator()
  animatePiece()
}

run()
