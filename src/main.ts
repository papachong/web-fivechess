import './style.css'
import { Application, BLEND_MODES, Container, Graphics, Sprite, Texture } from 'pixi.js'

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
  theme: 'dark' | 'light' | 'nature' | 'traditional' | 'highcontrast' | 'ink'
  pieceStyle: 'realistic' | 'glass' | 'flat' | 'neon'
  player1Name: string
  player2Name: string
  player1Type: 'human' | 'ai'
  player1Difficulty: 'easy' | 'medium' | 'hard'
  player2Type: 'human' | 'ai'
  player2Difficulty: 'easy' | 'medium' | 'hard'
  lastHumanPlayer1Name?: string
  lastHumanPlayer2Name?: string
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

let pixiRenderer: PixiBoardRenderer | null = null
let fireworksOverlay: FireworksOverlay | null = null
let settings: Settings = { 
  soundEnabled: true, 
  theme: 'traditional', 
  pieceStyle: 'realistic',
  player1Name: '西门鸡翅', 
  player2Name: '孤独牛排',
  player1Type: 'human',
  player1Difficulty: 'medium',
  player2Type: 'ai',
  player2Difficulty: 'medium',
  nameHistory: ['西门鸡翅', '孤独牛排'],
  playerRecords: new Map()
}
let hoverPosition: { r: number; c: number } | null = null

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem('fivechess-settings')
  if (saved) {
    try {
      const loaded = JSON.parse(saved)
      // Migration: remove avatar fields if present
      if ('player1Avatar' in loaded) delete loaded.player1Avatar
      if ('player2Avatar' in loaded) delete loaded.player2Avatar
      
      // Migration: map old gameMode/difficulty to new fields
      if ('gameMode' in loaded) {
         if (loaded.gameMode === 'pve') {
             loaded.player2Type = 'ai'
             loaded.player2Difficulty = loaded.difficulty || 'medium'
         } else {
             loaded.player2Type = 'human'
         }
         delete loaded.gameMode
         delete loaded.difficulty
      }

      settings = { ...settings, ...loaded }
      // Convert playerRecords to Map if needed
      if (loaded.playerRecords && typeof loaded.playerRecords === 'object') {
        settings.playerRecords = new Map(Object.entries(loaded.playerRecords))
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  // Single style only: force traditional theme regardless of stored value.
  settings.theme = 'traditional'

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
  
  // Single style only: always apply the traditional theme tokens.
  root.classList.remove('light-theme', 'nature-theme', 'traditional-theme', 'highcontrast-theme', 'ink-theme')
  root.style.setProperty('--board-bg', '#d4a574')
  root.style.setProperty('--board-line', '#8b6f47')
  root.style.setProperty('--panel-bg', '#2c1810')
  root.style.setProperty('--text-color', '#f0e6d2')
  root.classList.add('traditional-theme')
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
  fireworksOverlay?.spawnFireworks(x, y, count)
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
      const x = Math.random() * window.innerWidth
      const y = Math.random() * window.innerHeight * 0.8 // Keep it mostly in the upper part
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
    // Count backward
    let backCount = 0
    let x = r - dr
    let y = c - dc
    while (x >= 0 && x < boardSize && y >= 0 && y < boardSize && board[x][y] === player) {
      backCount++
      x -= dr
      y -= dc
    }
    
    // Count forward
    let forwardCount = 0
    x = r + dr
    y = c + dc
    while (x >= 0 && x < boardSize && y >= 0 && y < boardSize && board[x][y] === player) {
      forwardCount++
      x += dr
      y += dc
    }
    
    const totalCount = 1 + backCount + forwardCount
    
    if (totalCount >= 5) {
      // Collect the winning pieces
      const winningPieces: Array<{ r: number; c: number }> = []
      
      // Add backward pieces
      x = r - dr
      y = c - dc
      for (let i = 0; i < backCount; i++) {
        winningPieces.unshift({ r: x, c: y })
        x -= dr
        y -= dc
      }
      
      // Add center piece
      winningPieces.push({ r, c })
      
      // Add forward pieces
      x = r + dr
      y = c + dc
      for (let i = 0; i < forwardCount; i++) {
        winningPieces.push({ r: x, c: y })
        x += dr
        y += dc
      }
      
      // Return first 5 consecutive pieces
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
      return { boardBg: '#c7d9a8', boardLine: '#5f7a38', panelBg: '#e8f5e9' }
    case 'traditional':
      return { boardBg: '#e6b380', boardLine: '#5d4037', panelBg: '#3e2723' }
    case 'highcontrast':
      return { boardBg: '#ffff00', boardLine: '#000000', panelBg: '#000000' }
    case 'ink':
      return { boardBg: '#f0f0f0', boardLine: '#1a1a1a', panelBg: '#ffffff' }
    default: // 'dark'
      return { boardBg: '#2d3748', boardLine: '#60a5fa', panelBg: '#0b1221' }
  }
}

function hexToNumber(hex: string) {
  return parseInt(hex.replace('#', ''), 16)
}

class FireworksOverlay {
  private app: Application
  private layer: Graphics
  private particles: FireworkParticle[] = []

  constructor() {
    const canvas = document.createElement('canvas')
    canvas.id = 'fireworks-overlay'
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '9999'
    })
    document.body.appendChild(canvas)

    this.app = new Application({
      view: canvas,
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    this.layer = new Graphics()
    this.app.stage.addChild(this.layer)
    this.app.ticker.add(this.tick)
  }

  spawnFireworks(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.5 - 0.25)
      const speed = 3 + Math.random() * 6
      const ttl = 1.5 + Math.random() * 1.0
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: ttl,
        ttl,
        color: fireworkPalette[Math.floor(Math.random() * fireworkPalette.length)],
        trail: [],
      })
    }
  }

  private tick = (delta: number) => {
    if (!this.particles.length) {
      this.layer.clear()
      return
    }

    this.layer.clear()
    this.layer.blendMode = BLEND_MODES.ADD
    
    const toRemove: number[] = []

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]
      particle.trail.unshift({ x: particle.x, y: particle.y })
      if (particle.trail.length > 8) particle.trail.pop()

      particle.x += particle.vx * delta
      particle.y += particle.vy * delta
      particle.vy += 0.15 * delta // Gravity
      particle.life -= 0.016 * delta

      const progress = particle.life / particle.ttl
      if (progress <= 0) {
        toRemove.push(i)
        continue
      }

      const { r, g, b } = hexToRgb(particle.color)
      const color = (r << 16) + (g << 8) + b

      if (particle.trail.length > 1) {
        this.layer.lineStyle({ width: 3, color, alpha: Math.min(0.8, progress + 0.2) })
        this.layer.moveTo(particle.trail[0].x, particle.trail[0].y)
        for (let t = 1; t < particle.trail.length; t++) {
          this.layer.lineTo(particle.trail[t].x, particle.trail[t].y)
        }
      }

      const radius = 2 + (1 - progress) * 4
      this.layer.beginFill(color, 0.9)
      this.layer.drawCircle(particle.x, particle.y, radius)
      this.layer.endFill()
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.particles.splice(toRemove[i], 1)
    }
  }
}

class PixiBoardRenderer {
  private app: Application
  private panelLayer: Graphics
  private boardBgSprite: Sprite
  private gridLayer: Graphics
  private pieceLayer: Container
  private overlayLayer: Container
  private hoverLayer: Graphics
  private lastMoveLayer: Graphics
  private winningLayer: Graphics
  private pieceTextures: Record<1 | 2, Texture>
  private boardBgTexture: Texture | null
  private pieceSprites: Map<string, Sprite>
  private animatingPieces: Map<string, number>
  private winAnimationTime: number
  private state: GameState | null
  private hover: { r: number; c: number } | null
  private colors: { boardBg: string; boardLine: string; panelBg: string }

  constructor(view: HTMLCanvasElement) {
    this.app = new Application({
      view,
      width,
      height,
      antialias: true,
      backgroundAlpha: 0,
      resolution: 1,
      autoDensity: false,
    })

    this.panelLayer = new Graphics()
    this.boardBgSprite = new Sprite(Texture.EMPTY)
    this.gridLayer = new Graphics()
    this.pieceLayer = new Container()
    this.overlayLayer = new Container()
    this.hoverLayer = new Graphics()
    this.lastMoveLayer = new Graphics()
    this.winningLayer = new Graphics()

    this.overlayLayer.addChild(this.hoverLayer, this.lastMoveLayer, this.winningLayer)
    this.app.stage.addChild(this.panelLayer, this.boardBgSprite, this.gridLayer, this.pieceLayer, this.overlayLayer)

    this.pieceSprites = new Map()
    this.animatingPieces = new Map()
    this.state = null
    this.hover = null
    this.winAnimationTime = 0
    this.colors = getThemeColors()
    this.boardBgTexture = null

    this.pieceTextures = {
      1: this.buildPieceTexture(0x1a252f, 0x0f1419),
      2: this.buildPieceTexture(0xffffff, 0xd0d0d0),
    }

    this.drawBoardBase()
    this.app.ticker.add(this.tick)
  }

  updateTheme() {
    this.colors = getThemeColors()
    this.rebuildPieceTextures()
    this.drawBoardBase()
  }

  renderState(state: GameState) {
    this.state = state
    if (!state.winner) {
      this.winAnimationTime = 0
    }
    this.syncPieces()
    this.updateLastMove()
    this.updateWinningPieces()
  }

  setHover(position: { r: number; c: number } | null) {
    this.hover = position
    this.drawHover()
  }

  startPieceAnimation(r: number, c: number) {
    const key = `${r}-${c}`
    this.animatingPieces.set(key, 0)
    const sprite = this.pieceSprites.get(key)
    if (sprite) {
      sprite.scale.set(0.25)
    }
  }

  private drawBoardBase() {
    const { boardBg, boardLine, panelBg } = this.colors
    this.panelLayer.clear()
    this.panelLayer.beginFill(hexToNumber(panelBg))
    this.panelLayer.drawRect(0, 0, width, height)
    this.panelLayer.endFill()

    // Board background: solid by default; textured for traditional theme.
    const boardPx = boardSize * grid
    const useTexturedBoard = settings.theme === 'traditional'

    if (useTexturedBoard) {
      const nextTexture = this.buildBoardTexture(boardPx, boardPx)
      if (this.boardBgTexture) {
        this.boardBgTexture.destroy(true)
      }
      this.boardBgTexture = nextTexture
      this.boardBgSprite.texture = nextTexture
    } else {
      // Use a 1x1 texture from a Graphics for solid fill.
      const g = new Graphics()
      g.beginFill(hexToNumber(boardBg))
      g.drawRect(0, 0, 1, 1)
      g.endFill()
      const solid = this.app.renderer.generateTexture(g)
      g.destroy()
      if (this.boardBgTexture) this.boardBgTexture.destroy(true)
      this.boardBgTexture = solid
      this.boardBgSprite.texture = solid
    }

    this.boardBgSprite.position.set(margin, margin)
    this.boardBgSprite.width = boardPx
    this.boardBgSprite.height = boardPx

    this.gridLayer.clear()
    this.gridLayer.lineStyle({ width: 3, color: hexToNumber(boardLine) })
    this.gridLayer.drawRect(margin, margin, boardPx, boardPx)

    this.gridLayer.lineStyle({ width: 2, color: hexToNumber(boardLine) })
    for (let i = 0; i < boardSize; i++) {
      const x = margin + i * grid
      this.gridLayer.moveTo(x, margin)
      this.gridLayer.lineTo(x, margin + boardSize * grid)

      const y = margin + i * grid
      this.gridLayer.moveTo(margin, y)
      this.gridLayer.lineTo(margin + boardSize * grid, y)
    }

    const stars = [
      [3, 3],
      [3, 11],
      [11, 3],
      [11, 11],
      [7, 7],
    ]
    this.gridLayer.beginFill(hexToNumber(boardLine))
    for (const [r, c] of stars) {
      const x = margin + c * grid
      const y = margin + r * grid
      this.gridLayer.drawCircle(x, y, 5)
    }
    this.gridLayer.endFill()
  }

  private rebuildPieceTextures() {
    const nextTextures: Record<1 | 2, Texture> = {
      1: this.buildPieceTexture(0x1a252f, 0x0f1419),
      2: this.buildPieceTexture(0xffffff, 0xd0d0d0),
    }
    // Destroy old textures
    if (this.pieceTextures) {
      this.pieceTextures[1]?.destroy(true)
      this.pieceTextures[2]?.destroy(true)
    }
    this.pieceTextures = nextTextures

    // Refresh existing sprites
    if (this.state) {
      for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
          const p = this.state.board[r][c]
          if (p === 0) continue
          const key = `${r}-${c}`
          const sprite = this.pieceSprites.get(key)
          if (sprite) sprite.texture = this.pieceTextures[p as 1 | 2]
        }
      }
    }
  }

  private buildBoardTexture(w: number, h: number): Texture {
    // Generate a texture matching public/style.html (Wood color + Noise)
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(w * scale))
    canvas.height = Math.max(1, Math.floor(h * scale))
    const ctx = canvas.getContext('2d')!

    // 1. Base Color #E0B870
    ctx.fillStyle = '#E0B870'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 2. Noise Effect (Simulating SVG feTurbulence)
    // We'll use a simple random noise approach
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    for (let i = 0; i < data.length; i += 4) {
        // Random noise value
        const noise = (Math.random() - 0.5) * 20 // Intensity
        
        // Apply to RGB channels
        data[i] = Math.min(255, Math.max(0, data[i] + noise))     // R
        data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise)) // G
        data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise)) // B
        // Alpha remains unchanged
    }
    
    ctx.putImageData(imageData, 0, 0)

    // 3. Optional: Keep the "Panel Lines" but make them very subtle to fit the style
    // The reference style.html doesn't have panel lines, it's a clean board.
    // But the user liked the previous "Huanghuali" structure. 
    // I will keep the panel lines but make them match the new color scheme (subtle darker gold).
    
    const panelsX = 4
    const panelsY = 4
    const panelW = canvas.width / panelsX
    const panelH = canvas.height / panelsY
    
    ctx.globalAlpha = 0.1
    ctx.strokeStyle = '#8B5A2B' // Darker wood tone
    ctx.lineWidth = 1 * scale
    ctx.beginPath()
    for (let i = 1; i < panelsX; i++) {
        ctx.moveTo(i * panelW, 0)
        ctx.lineTo(i * panelW, canvas.height)
    }
    for (let i = 1; i < panelsY; i++) {
        ctx.moveTo(0, i * panelH)
        ctx.lineTo(canvas.width, i * panelH)
    }
    ctx.stroke()

    // 4. Optional: Keep the Cloud Border but very subtle
    ctx.globalAlpha = 0.08
    ctx.strokeStyle = '#8B5A2B'
    ctx.lineWidth = 1.5 * scale
    
    // Simple cloud motif function (reused)
    const drawCloud = (cx: number, cy: number, s: number, rotation: number) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rotation)
      ctx.beginPath()
      ctx.moveTo(-2 * s, 0)
      ctx.bezierCurveTo(-1.5 * s, -1.5 * s, 0, -1.5 * s, 0, 0)
      ctx.bezierCurveTo(0.5 * s, -1 * s, 1.5 * s, -1 * s, 2 * s, 0)
      ctx.bezierCurveTo(1.5 * s, 1 * s, 0.5 * s, 1 * s, 0, 0)
      ctx.bezierCurveTo(0, 1.5 * s, -1.5 * s, 1.5 * s, -2 * s, 0)
      ctx.stroke()
      ctx.restore()
    }

    const borderSize = canvas.width * 0.1
    const motifsPerSide = 6
    
    // Draw border motifs
    for (let i = 0; i < motifsPerSide; i++) {
        const x = (canvas.width / motifsPerSide) * (i + 0.5)
        if (Math.random() > 0.5) drawCloud(x, borderSize * Math.random() * 0.5, (10 + Math.random() * 10) * scale, Math.random() * 0.5)
        if (Math.random() > 0.5) drawCloud(x, canvas.height - borderSize * Math.random() * 0.5, (10 + Math.random() * 10) * scale, Math.PI + Math.random() * 0.5)
    }
    for (let i = 0; i < motifsPerSide; i++) {
        const y = (canvas.height / motifsPerSide) * (i + 0.5)
        if (Math.random() > 0.5) drawCloud(borderSize * Math.random() * 0.5, y, (10 + Math.random() * 10) * scale, -Math.PI/2 + Math.random() * 0.5)
        if (Math.random() > 0.5) drawCloud(canvas.width - borderSize * Math.random() * 0.5, y, (10 + Math.random() * 10) * scale, Math.PI/2 + Math.random() * 0.5)
    }

    ctx.globalAlpha = 1
    const tex = Texture.from(canvas)
    return tex
  }

  private buildPieceTexture(bodyColor: number, _edgeColor: number): Texture {
    // Use Canvas to replicate CSS radial gradients from public/style.html
    const radius = grid * 0.43
    const size = Math.ceil(radius * 2.5) // Extra space for shadow
    const center = size / 2
    
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    
    const isWhite = bodyColor === 0xffffff
    
    // 1. Shadow
    // CSS: box-shadow: 2px 2px 4px rgba(0,0,0,0.4) (Black) / 0.3 (White)
    const shadowOpacity = isWhite ? 0.3 : 0.4
    ctx.shadowColor = `rgba(0, 0, 0, ${shadowOpacity})`
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    
    // Draw shadow base (circle)
    ctx.fillStyle = 'rgba(0,0,0,1)' // Color doesn't matter much as we'll draw over it, but for shadow it does
    // Actually, to get just the shadow we draw the shape.
    // But we want the gradient on top.
    
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fill()
    
    // Reset shadow for the piece itself so it doesn't double apply or look weird
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    
    // 2. Piece Gradient
    // CSS Black: radial-gradient(circle at 35% 35%, #666 0%, #000 60%)
    // CSS White: radial-gradient(circle at 35% 35%, #fff 0%, #ddd 60%, #999 100%)
    
    // Gradient center (35% 35%)
    // In canvas coordinates relative to the circle center:
    // Top-left is roughly (center - radius * 0.3, center - radius * 0.3)
    const gradX = center - radius * 0.3
    const gradY = center - radius * 0.3
    
    const grad = ctx.createRadialGradient(gradX, gradY, 0, gradX, gradY, radius * 1.5)
    
    if (isWhite) {
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.4, '#dddddd') // Adjusted stop to match visual feel of 60%
        grad.addColorStop(1, '#999999')
    } else {
        grad.addColorStop(0, '#666666')
        grad.addColorStop(0.6, '#000000')
        grad.addColorStop(1, '#000000')
    }
    
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fill()

    return Texture.from(canvas)
  }

  private syncPieces() {
    if (!this.state) return
    const requiredKeys = new Set<string>()

    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const p = this.state.board[r][c]
        const key = `${r}-${c}`
        if (p === 0) continue
        requiredKeys.add(key)

        if (!this.pieceSprites.has(key)) {
          const sprite = new Sprite(this.pieceTextures[p as 1 | 2])
          sprite.anchor.set(0.5)
          sprite.position.set(margin + c * grid, margin + r * grid)
          this.pieceLayer.addChild(sprite)
          this.pieceSprites.set(key, sprite)
          this.startPieceAnimation(r, c)
        } else {
          const sprite = this.pieceSprites.get(key)!
          sprite.texture = this.pieceTextures[p as 1 | 2]
          sprite.position.set(margin + c * grid, margin + r * grid)
        }
      }
    }

    for (const [key, sprite] of this.pieceSprites.entries()) {
      if (!requiredKeys.has(key)) {
        sprite.destroy()
        this.pieceSprites.delete(key)
        this.animatingPieces.delete(key)
      }
    }
  }

  private drawHover() {
    this.hoverLayer.clear()
    if (!this.state || !this.hover) return
    const { r, c } = this.hover
    if (this.state.board[r][c] !== 0 || this.state.winner) return
    const x = margin + c * grid
    const y = margin + r * grid
    const radius = grid * 0.42
    const color = this.state.current === 1 ? 0x2c3e50 : 0xffffff
    this.hoverLayer.beginFill(color, 0.45)
    this.hoverLayer.drawCircle(x, y, radius)
    this.hoverLayer.endFill()
  }

  private updateLastMove() {
    this.lastMoveLayer.clear()
    if (!this.state || !this.state.lastMove) return
    const { r, c } = this.state.lastMove
    const x = margin + c * grid
    const y = margin + r * grid
    
    // Shadow (simulated)
    this.lastMoveLayer.beginFill(0x000000, 0.3)
    this.lastMoveLayer.drawCircle(x + 1, y + 1, grid * 0.15)
    this.lastMoveLayer.endFill()

    // White border
    this.lastMoveLayer.beginFill(0xffffff)
    this.lastMoveLayer.drawCircle(x, y, grid * 0.15)
    this.lastMoveLayer.endFill()

    // Red fill
    this.lastMoveLayer.beginFill(0xef4444)
    this.lastMoveLayer.drawCircle(x, y, grid * 0.12)
    this.lastMoveLayer.endFill()
  }

  private updateWinningPieces() {
    this.winningLayer.clear()
    if (!this.state || !this.state.winningPieces || !this.state.winningPieces.length) return
    const pulse = 0.5 + 0.5 * Math.sin(this.winAnimationTime * 0.1)
    for (const { r, c } of this.state.winningPieces) {
      const x = margin + c * grid
      const y = margin + r * grid
      const radius = grid * 0.42
      const alpha = 0.6 * pulse
      this.winningLayer.beginFill(0x22c55e, alpha)
      this.winningLayer.drawCircle(x, y, radius * 1.3)
      this.winningLayer.endFill()

      this.winningLayer.lineStyle({ width: 3, color: 0x22c55e, alpha: 0.8 * pulse })
      this.winningLayer.drawCircle(x, y, radius)
    }
  }

  private tick = (delta: number) => {
    for (const [key, progress] of this.animatingPieces.entries()) {
      const next = Math.min(1, progress + 0.12 * delta)
      const sprite = this.pieceSprites.get(key)
      if (sprite) {
        sprite.scale.set(0.25 + 0.75 * next)
      }
      if (next >= 1) {
        this.animatingPieces.delete(key)
      } else {
        this.animatingPieces.set(key, next)
      }
    }

    if (this.state && this.state.winner && this.state.winningPieces && this.state.winningPieces.length > 0) {
      this.winAnimationTime += delta
      this.updateWinningPieces()
    }
  }
}

function drawPieceRealistic(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, player: 1 | 2) {
  // Shadow
  ctx.shadowColor = player === 2 ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.4)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 2
  
  // Gradient
  const gradX = x - radius * 0.3
  const gradY = y - radius * 0.3
  const gradient = ctx.createRadialGradient(gradX, gradY, 0, gradX, gradY, radius * 1.5)
  
  if (player === 2) { // White
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.4, '#dddddd')
    gradient.addColorStop(1, '#999999')
  } else { // Black
    gradient.addColorStop(0, '#666666')
    gradient.addColorStop(0.6, '#000000')
    gradient.addColorStop(1, '#000000')
  }
  
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  
  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, player: 1 | 2) {
  drawPieceRealistic(ctx, x, y, radius, player)
}

// --- AI Logic ---

function getAIMove(board: Player[][], difficulty: 'easy' | 'medium' | 'hard', player: Player): { r: number, c: number } | null {
  const emptySpots: { r: number, c: number }[] = []
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] === 0) {
        emptySpots.push({ r, c })
      }
    }
  }

  if (emptySpots.length === 0) return null

  // Easy: Random move
  if (difficulty === 'easy') {
    return emptySpots[Math.floor(Math.random() * emptySpots.length)]
  }

  const opponent = player === 1 ? 2 : 1

  // Medium: Block immediate threats or win immediately
  if (difficulty === 'medium') {
    // 1. Check for winning move
    for (const spot of emptySpots) {
      board[spot.r][spot.c] = player
      if (checkWin(board, spot.r, spot.c)) {
        board[spot.r][spot.c] = 0
        return spot
      }
      board[spot.r][spot.c] = 0
    }

    // 2. Check for blocking opponent win
    for (const spot of emptySpots) {
      board[spot.r][spot.c] = opponent
      if (checkWin(board, spot.r, spot.c)) {
        board[spot.r][spot.c] = 0
        return spot
      }
      board[spot.r][spot.c] = 0
    }

    // 3. Otherwise random, but prefer center
    const center = boardSize / 2
    emptySpots.sort((a, b) => {
      const distA = Math.abs(a.r - center) + Math.abs(a.c - center)
      const distB = Math.abs(b.r - center) + Math.abs(b.c - center)
      return distA - distB + (Math.random() * 4 - 2)
    })
    return emptySpots[0]
  }

  // Hard: Heuristic Scoring
  if (difficulty === 'hard') {
    let bestScore = -Infinity
    let bestMoves: { r: number, c: number }[] = []

    for (const spot of emptySpots) {
      const score = evaluatePosition(board, spot.r, spot.c, player)
      if (score > bestScore) {
        bestScore = score
        bestMoves = [spot]
      } else if (score === bestScore) {
        bestMoves.push(spot)
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)]
  }

  return emptySpots[0]
}

function evaluatePosition(board: Player[][], r: number, c: number, player: Player): number {
  // We need to check 4 directions
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
  let totalScore = 0
  const opponent = player === 1 ? 2 : 1

  // 1. Attack Score (Value of placing my piece here)
  board[r][c] = player
  for (const [dr, dc] of dirs) {
    totalScore += getLineScore(board, r, c, dr, dc, player)
  }
  board[r][c] = 0

  // 2. Defense Score (Value of blocking opponent here)
  board[r][c] = opponent
  let defenseScore = 0
  for (const [dr, dc] of dirs) {
    defenseScore += getLineScore(board, r, c, dr, dc, opponent)
  }
  board[r][c] = 0

  // If opponent has a winning move (Live 4 or 5), blocking is top priority
  if (defenseScore >= 100000) return 200000 // Must block
  if (defenseScore >= 10000) return 50000 // Block live 3

  return totalScore + defenseScore * 0.8
}

function getLineScore(board: Player[][], r: number, c: number, dr: number, dc: number, player: Player): number {
  let count = 1
  let openEnds = 0
  
  // Check forward
  let i = 1
  while (true) {
    const nr = r + dr * i
    const nc = c + dc * i
    if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) break
    if (board[nr][nc] === player) {
      count++
    } else if (board[nr][nc] === 0) {
      openEnds++
      break
    } else {
      break
    }
    i++
  }

  // Check backward
  i = 1
  while (true) {
    const nr = r - dr * i
    const nc = c - dc * i
    if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) break
    if (board[nr][nc] === player) {
      count++
    } else if (board[nr][nc] === 0) {
      openEnds++
      break
    } else {
      break
    }
    i++
  }

  if (count >= 5) return 100000
  if (count === 4) {
    if (openEnds === 2) return 10000 // Live 4
    if (openEnds === 1) return 1000  // Dead 4
  }
  if (count === 3) {
    if (openEnds === 2) return 1000  // Live 3
    if (openEnds === 1) return 100   // Dead 3
  }
  if (count === 2) {
    if (openEnds === 2) return 100
    if (openEnds === 1) return 10
  }
  return 0
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
            <button id="menu-exit" class="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 transition text-left">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              退出游戏
            </button>
          </nav>
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
                <a href="./downloads/miu-fivechess-mac.dmg.zip" download class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  macOS (DMG.ZIP)
                </a>
                <a href="./downloads/miu-fivechess-win.exe.zip" download class="flex items-center gap-3 px-4 py-3 text-white hover:bg-slate-700 transition text-left">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 12V6.75l6-1.32v6.48L3 12zm6.74.08l8.26-.87V5.31l-8.26 1.09v5.68zM3 13l6 .09v6.81l-6-1.09V13zm6.74.09l8.26.91v6.5l-8.26-1.12V13.09z"/>
                  </svg>
                  Windows (EXE.ZIP)
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
            <div class="relative group flex-shrink-0 cursor-pointer" id="player1-avatar-container">
              <div id="player1-piece" class="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg bg-slate-800 flex items-center justify-center overflow-hidden relative">
                <canvas width="48" height="48" class="w-full h-full"></canvas>
                <div class="absolute bottom-0 right-0 bg-slate-700 rounded-tl px-1 text-[10px] text-white opacity-80">▼</div>
              </div>
              <!-- Player 1 Type Dropdown -->
              <div id="player1-type-dropdown" class="hidden absolute top-full left-0 mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 w-32 py-1">
                 <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700" data-type="human">玩家</button>
                 <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700" data-type="ai" data-difficulty="easy">AI (简单)</button>
                 <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700" data-type="ai" data-difficulty="medium">AI (中等)</button>
                 <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700" data-type="ai" data-difficulty="hard">AI (困难)</button>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="relative">
                <div class="flex gap-1">
                  <input id="player1-name" type="text" class="flex-1 min-w-0 px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 hover:border-slate-500 focus:border-cyan-400 focus:outline-none text-sm font-semibold truncate" placeholder="输入玩家名字" value="西门鸡翅" />
                </div>
                <!-- Player 1 Name History Dropdown -->
                <div id="player1-name-dropdown" class="hidden absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 w-full py-1 max-h-40 overflow-y-auto">
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
            <div class="relative group flex-shrink-0 cursor-pointer" id="player2-avatar-container">
              <div id="player2-piece" class="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg bg-slate-800 flex items-center justify-center overflow-hidden relative">
                <canvas width="48" height="48" class="w-full h-full"></canvas>
                <div class="absolute bottom-0 left-0 bg-slate-700 rounded-tr px-1 text-[10px] text-white opacity-80">▼</div>
              </div>
              <!-- Player 2 Type Dropdown -->
              <div id="player2-type-dropdown" class="hidden absolute top-full right-0 mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 w-32 py-1">
                 <button class="w-full text-right px-3 py-2 text-sm text-white hover:bg-slate-700" data-type="human">玩家</button>
                 <button class="w-full text-right px-3 py-2 text-sm text-white hover:bg-slate-700" data-type="ai" data-difficulty="easy">AI (简单)</button>
                 <button class="w-full text-right px-3 py-2 text-sm text-white hover:bg-slate-700" data-type="ai" data-difficulty="medium">AI (中等)</button>
                 <button class="w-full text-right px-3 py-2 text-sm text-white hover:bg-slate-700" data-type="ai" data-difficulty="hard">AI (困难)</button>
              </div>
            </div>
            <div class="flex-1 min-w-0 text-right">
              <div class="relative">
                <div class="flex gap-1 flex-row-reverse">
                  <input id="player2-name" type="text" class="flex-1 min-w-0 px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 hover:border-slate-500 focus:border-cyan-400 focus:outline-none text-sm font-semibold text-right truncate" placeholder="输入玩家名字" value="孤独牛排" />
                </div>
                <!-- Player 2 Name History Dropdown -->
                <div id="player2-name-dropdown" class="hidden absolute top-full right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 w-full py-1 max-h-40 overflow-y-auto">
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
            <a href="https://ruhooai.com/" target="_blank" rel="noopener noreferrer" class="hover:text-cyan-400 transition duration-200">儒虎智能科技（北京）有限公司</a>
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
  pixiRenderer = new PixiBoardRenderer(canvas)
  fireworksOverlay = new FireworksOverlay()
  let state = createInitialState()
  let menuOpen = false

  // Load settings (includes theme setup) before first render
  loadSettings()
  pixiRenderer.updateTheme()

  // Helper to update input state based on player type
  function updatePlayerInputState(playerId: 1 | 2) {
      const AI_NAME = 'GomokuAI'
      const type = playerId === 1 ? settings.player1Type : settings.player2Type
      const input = document.querySelector<HTMLInputElement>(`#player${playerId}-name`)
      
      if (!input) return

      if (type === 'ai') {
          // Save current name if it's not AI name
          const currentName = input.value
        if (currentName !== AI_NAME && currentName !== 'AI' && currentName !== 'Gomoku AI') {
              if (playerId === 1) settings.lastHumanPlayer1Name = currentName
              else settings.lastHumanPlayer2Name = currentName
          }
          
        input.value = AI_NAME
          input.disabled = true
          input.classList.add('opacity-50', 'cursor-not-allowed')
          
        if (playerId === 1) settings.player1Name = AI_NAME
        else settings.player2Name = AI_NAME
      } else {
          // Restore last human name
          const lastHumanName = playerId === 1 ? settings.lastHumanPlayer1Name : settings.lastHumanPlayer2Name
        if (lastHumanName && lastHumanName !== AI_NAME && lastHumanName !== 'AI' && lastHumanName !== 'Gomoku AI') {
              input.value = lastHumanName
              if (playerId === 1) settings.player1Name = lastHumanName
              else settings.player2Name = lastHumanName
          } else {
              // Fallback if no history or history is AI name
              const defaultName = playerId === 1 ? '西门鸡翅' : '孤独牛排'
              // Check if current value is AI name, if so reset to default
          if (input.value === AI_NAME || input.value === 'AI' || input.value === 'Gomoku AI') {
                  input.value = defaultName
                  if (playerId === 1) settings.player1Name = defaultName
                  else settings.player2Name = defaultName
              }
          }
          
          input.disabled = false
          input.classList.remove('opacity-50', 'cursor-not-allowed')
      }
  }

  // Setup Avatar Dropdowns
  function setupAvatarDropdown(playerId: 1 | 2) {
      const container = document.querySelector(`#player${playerId}-avatar-container`)
      const dropdown = document.querySelector(`#player${playerId}-type-dropdown`)
      
      if (!container || !dropdown) return

      container.addEventListener('click', (e) => {
          e.stopPropagation()
          // Close other dropdowns
          document.querySelectorAll('[id$="-type-dropdown"]').forEach(el => {
              if (el !== dropdown) el.classList.add('hidden')
          })
          dropdown.classList.toggle('hidden')
      })

      dropdown.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', (e) => {
              e.stopPropagation()
              const type = (e.target as HTMLElement).dataset.type as 'human' | 'ai'
              const difficulty = (e.target as HTMLElement).dataset.difficulty as 'easy' | 'medium' | 'hard' | undefined
              
              if (playerId === 1) {
                  settings.player1Type = type
                  if (difficulty) settings.player1Difficulty = difficulty
              } else {
                  settings.player2Type = type
                  if (difficulty) settings.player2Difficulty = difficulty
              }
              
              updatePlayerInputState(playerId)
              localStorage.setItem('fivechess-settings', JSON.stringify(settings))
              dropdown.classList.add('hidden')
              
              // Close name dropdown as well
              const nameDropdown = document.querySelector(`#player${playerId}-name-dropdown`)
              if (nameDropdown) nameDropdown.classList.add('hidden')
              
              // If it's currently this player's turn and they just became AI, trigger move
              if (state.current === playerId && type === 'ai' && !state.winner) {
                  triggerAI()
              }
          })
      })
  }

  setupAvatarDropdown(1)
  setupAvatarDropdown(2)
  
  // Initialize inputs based on loaded settings
  updatePlayerInputState(1)
  updatePlayerInputState(2)

  // Setup name dropdown functionality
  function setupNameDropdown(playerId: 1 | 2) {
      const input = document.querySelector<HTMLInputElement>(`#player${playerId}-name`)!
      const dropdown = document.querySelector<HTMLDivElement>(`#player${playerId}-name-dropdown`)!
      let pickingFromDropdown = false
      const AI_NAME = 'GomokuAI'

      function getDefaultName() {
        return playerId === 1 ? '西门鸡翅' : '孤独牛排'
      }

      function setPlayerName(value: string) {
        input.value = value
        if (playerId === 1) settings.player1Name = value
        else settings.player2Name = value
      }

      function persistSettings() {
        localStorage.setItem('fivechess-settings', JSON.stringify(settings))
      }

      function renameHistoryItem(oldName: string, newName: string) {
        const next = [] as string[]
        const trimmed = newName.trim()
        for (const n of settings.nameHistory) {
          if (!n) continue
          if (n === oldName) {
            if (trimmed) next.push(trimmed)
            continue
          }
          if (n === trimmed) continue
          next.push(n)
        }
        settings.nameHistory = next
      }

      function deleteHistoryItem(name: string) {
        settings.nameHistory = settings.nameHistory.filter((n) => n !== name)
      }
      
      function showNameDropdown() {
          const type = playerId === 1 ? settings.player1Type : settings.player2Type
          // Only show dropdown if player (not AI)
          if (type === 'ai') return
          
          dropdown.innerHTML = ''
          const filteredNames = settings.nameHistory.filter(
            (name) =>
              name &&
              name.trim() &&
              name !== AI_NAME &&
              name !== 'AI' &&
              name !== 'Gomoku AI'
          )
          
          if (filteredNames.length === 0) {
              dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-gray-400">无历史记录</div>'
          } else {
              filteredNames.forEach(name => {
                  const row = document.createElement('div')
                  row.className = 'flex items-center gap-2 px-2'

                  const pickBtn = document.createElement('button')
                  pickBtn.className = `flex-1 min-w-0 ${playerId === 1 ? 'text-left' : 'text-right'} px-1 py-2 text-sm text-white hover:bg-slate-700 transition rounded`
                  pickBtn.textContent = name

                  // Use pointerdown so selection happens before input blur.
                  pickBtn.addEventListener('pointerdown', (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      pickingFromDropdown = true

                      setPlayerName(name)
                      persistSettings()
                      dropdown.classList.add('hidden')

                      setTimeout(() => {
                        pickingFromDropdown = false
                      }, 0)
                  })

                  const editBtn = document.createElement('button')
                  editBtn.className = 'flex-shrink-0 p-2 rounded hover:bg-slate-700 transition text-white'
                  editBtn.title = '修改'
                  editBtn.setAttribute('aria-label', '修改')
                  editBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4h2M12 6v14m7.121-13.121a3 3 0 010 4.242L9 21l-4 1 1-4 10.121-10.879a3 3 0 014.242 0z" />
                    </svg>
                  `

                  editBtn.addEventListener('pointerdown', (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      pickingFromDropdown = true

                      // Inline edit: replace the name area (red box) with an input, keep icons.
                      const originalName = name
                      let ignoreNextBlur = false
                      const editInput = document.createElement('input')
                      editInput.type = 'text'
                      editInput.value = originalName
                      editInput.className = `flex-1 min-w-0 px-2 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-cyan-400 focus:outline-none text-sm font-semibold ${playerId === 1 ? '' : 'text-right'}`

                      const cancelBtn = document.createElement('button')
                      cancelBtn.className = 'flex-shrink-0 p-2 rounded hover:bg-slate-700 transition text-white'
                      cancelBtn.title = '取消'
                      cancelBtn.setAttribute('aria-label', '取消')
                      cancelBtn.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      `

                      const restoreRow = () => {
                        // Re-render the dropdown to restore default row UI.
                        showNameDropdown()
                      }

                      const commitRename = () => {
                        ignoreNextBlur = true
                        const nextName = editInput.value.trim()
                        if (!nextName || nextName === AI_NAME || nextName === 'AI' || nextName === 'Gomoku AI') {
                          restoreRow()
                          return
                        }

                        renameHistoryItem(originalName, nextName)

                        // If this name is currently used, keep UI consistent.
                        if (input.value === originalName) {
                          setPlayerName(nextName)
                        }

                        if (playerId === 1) {
                          if (settings.lastHumanPlayer1Name === originalName) settings.lastHumanPlayer1Name = nextName
                        } else {
                          if (settings.lastHumanPlayer2Name === originalName) settings.lastHumanPlayer2Name = nextName
                        }

                        persistSettings()
                        restoreRow()
                      }

                      // Swap the name button with input.
                      row.replaceChild(editInput, pickBtn)

                      // Turn the pencil into a confirm button.
                      editBtn.title = '确认'
                      editBtn.setAttribute('aria-label', '确认')
                      editBtn.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      `

                      // Insert cancel button next to confirm.
                      row.insertBefore(cancelBtn, deleteBtn)

                      const confirmHandler = (ev: Event) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        ignoreNextBlur = true
                        commitRename()
                      }

                      const cancelHandler = (ev: Event) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        ignoreNextBlur = true
                        restoreRow()
                      }

                      editBtn.addEventListener('pointerdown', confirmHandler, { once: true })
                      cancelBtn.addEventListener('pointerdown', cancelHandler)

                      editInput.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter') {
                          ev.preventDefault()
                          ignoreNextBlur = true
                          commitRename()
                        } else if (ev.key === 'Escape') {
                          ev.preventDefault()
                          ignoreNextBlur = true
                          restoreRow()
                        }
                      })

                      editInput.addEventListener('blur', () => {
                        // Do NOT auto-confirm when the user just clicks the input.
                        // Losing focus is treated as cancel unless an explicit confirm/cancel happened.
                        if (!ignoreNextBlur) restoreRow()
                      })

                      // Prevent outside click handler closing while interacting with the editor.
                      editInput.addEventListener('pointerdown', (ev) => {
                        ev.stopPropagation()
                      })

                      editInput.focus()
                      editInput.select()

                      setTimeout(() => {
                        pickingFromDropdown = false
                      }, 0)
                  })

                  const deleteBtn = document.createElement('button')
                  deleteBtn.className = 'flex-shrink-0 p-2 rounded hover:bg-slate-700 transition text-white'
                  deleteBtn.title = '删除'
                  deleteBtn.setAttribute('aria-label', '删除')
                  deleteBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m2 0V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                    </svg>
                  `

                  deleteBtn.addEventListener('pointerdown', (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      pickingFromDropdown = true

                      deleteHistoryItem(name)

                      // If deleting currently used name, fall back to default name.
                      const type = playerId === 1 ? settings.player1Type : settings.player2Type
                      if (type !== 'ai' && input.value === name) {
                        const fallback = getDefaultName()
                        setPlayerName(fallback)
                        if (playerId === 1) settings.lastHumanPlayer1Name = fallback
                        else settings.lastHumanPlayer2Name = fallback
                      }

                      persistSettings()
                      showNameDropdown()

                      setTimeout(() => {
                        pickingFromDropdown = false
                      }, 0)
                  })

                  row.appendChild(pickBtn)
                  row.appendChild(editBtn)
                  row.appendChild(deleteBtn)
                  dropdown.appendChild(row)
              })
          }
          
          dropdown.classList.remove('hidden')
      }
      
      input.addEventListener('click', (e) => {
          e.stopPropagation()
          // Close other dropdowns
          document.querySelectorAll('[id$="-name-dropdown"], [id$="-type-dropdown"]').forEach(el => {
              if (el !== dropdown) el.classList.add('hidden')
          })
          showNameDropdown()
      })
      
      input.addEventListener('blur', () => {
          // Save the name when input loses focus.
          // Delay hiding a bit to avoid killing a click on the dropdown.
          const value = input.value.trim()
            if (!pickingFromDropdown && value && value !== AI_NAME && value !== 'AI' && value !== 'Gomoku AI') {
            if (playerId === 1) {
              settings.player1Name = value
              if (!settings.nameHistory.includes(value)) settings.nameHistory.unshift(value)
            } else {
              settings.player2Name = value
              if (!settings.nameHistory.includes(value)) settings.nameHistory.unshift(value)
            }
              persistSettings()
          }
          setTimeout(() => {
          dropdown.classList.add('hidden')
          }, 0)
      })
      
      input.addEventListener('input', () => {
          const type = playerId === 1 ? settings.player1Type : settings.player2Type
          // Update the player name in real-time
          if (type !== 'ai') {
              if (playerId === 1) settings.player1Name = input.value
              else settings.player2Name = input.value
          }
      })
  }
  
  setupNameDropdown(1)
  setupNameDropdown(2)

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
      document.querySelectorAll('[id$="-type-dropdown"], [id$="-name-dropdown"]').forEach(el => el.classList.add('hidden'))
  })

  // Load from localStorage
  const saved = localStorage.getItem('fivechess-state')
  if (saved) {
    try {
      state = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load state:', e)
    }
  }

  const redraw = () => {
    pixiRenderer?.renderState(state)
    pixiRenderer?.setHover(hoverPosition)
  }

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
    
    // Draw pieces
    drawPiece(ctx1, 24, 24, 20, 1)
    drawPiece(ctx2, 24, 24, 20, 2)
  }

  function refreshBoard() {
    redraw()
    drawPlayerPieces()
    updateNextPlayerIndicator()
  }

  refreshBoard()

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
    
    // Check if current player is AI
    const isAI = state.current === 1 ? settings.player1Type === 'ai' : settings.player2Type === 'ai'
    if (isAI) return

    const pos = getGridPosition(evt)
    if (!pos) return
    const { r: row, c: col } = pos
    if (state.board[row][col] !== 0) return

    executeMove(row, col)
  }

  function executeMove(row: number, col: number) {
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
      triggerAI()
    }
    localStorage.setItem('fivechess-state', JSON.stringify(state))
    refreshBoard()
  }

  function triggerAI() {
      if (state.winner) return
      
      const isAI = state.current === 1 ? settings.player1Type === 'ai' : settings.player2Type === 'ai'
      if (isAI) {
          const difficulty = state.current === 1 ? settings.player1Difficulty : settings.player2Difficulty
          setTimeout(() => {
              // Double check state hasn't changed (e.g. reset)
              if (state.winner) return
              const currentIsAI = state.current === 1 ? settings.player1Type === 'ai' : settings.player2Type === 'ai'
              if (!currentIsAI) return

              const move = getAIMove(state.board, difficulty, state.current)
              if (move) {
                  executeMove(move.r, move.c)
              }
          }, 500)
      }
  }

  // Update next player indicator - Removed as requested
  function updateNextPlayerIndicator() {
     // No-op
  }

  // Menu item handlers
  document.querySelector('#menu-reset')?.addEventListener('click', () => {
    state = createInitialState()
    localStorage.removeItem('fivechess-state')
    hoverPosition = null
    refreshBoard()
    toggleMenu()
  })

  // Top reset button
  document.querySelector('#top-reset')?.addEventListener('click', () => {
    state = createInitialState()
    localStorage.removeItem('fivechess-state')
    hoverPosition = null
    refreshBoard()
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
    hoverPosition = null
    refreshBoard()
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
    hoverPosition = null
    refreshBoard()
    panel.classList.add('hidden')
  })

  document.querySelector('#game-end-menu')?.addEventListener('click', () => {
    const panel = document.querySelector<HTMLDivElement>('#game-end-panel')!
    panel.classList.add('hidden')
    toggleMenu()
  })

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
              hoverPosition = null
              refreshBoard()
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
    pixiRenderer?.setHover(hoverPosition)
  })
  
  // Mouse leave event to clear hover effect
  canvas.addEventListener('mouseleave', () => {
    hoverPosition = null
    pixiRenderer?.setHover(null)
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
  updateNameInputs()
  updatePlayerDropdown(1)
  updatePlayerDropdown(2)
  drawPlayerPieces()
  updateNextPlayerIndicator()
}

run()
