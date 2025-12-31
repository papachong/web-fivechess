// SVG to PNG converter for avatars
// Usage: node scripts/convert-avatars-to-png.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Simple SVG to PNG conversion using canvas (Node.js built-in)
async function convertSvgToPng() {
  const avatarDir = path.join(__dirname, '../public/avatars')
  const files = fs.readdirSync(avatarDir).filter(f => f.endsWith('.svg'))
  
  console.log('🎨 Converting SVG avatars to PNG...\n')
  
  // Check if sharp is available
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch (e) {
    console.error('❌ Sharp library not found. Installing...')
    console.error('   Please run: npm install --save-dev sharp')
    console.error('   Then run this script again.\n')
    process.exit(1)
  }
  
  for (const file of files) {
    const svgPath = path.join(avatarDir, file)
    const pngPath = path.join(avatarDir, file.replace('.svg', '.png'))
    
    try {
      await sharp(svgPath, { density: 300 })
        .resize(256, 256, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(pngPath)
      
      console.log(`✓ ${file} → ${file.replace('.svg', '.png')}`)
    } catch (error) {
      console.error(`✗ Failed to convert ${file}:`, error.message)
    }
  }
  
  console.log('\n✅ Conversion complete!')
  console.log('📝 Next step: Update src/main.ts to use .png extensions')
}

convertSvgToPng().catch(console.error)
