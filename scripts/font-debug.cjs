const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')
const fs = require('fs')

// 游明朝 3ウェイトを登録
GlobalFonts.registerFromPath('C:/Windows/Fonts/yuminl.ttf',  'YuMincho-Light')
GlobalFonts.registerFromPath('C:/Windows/Fonts/yumin.ttf',   'YuMincho')
GlobalFonts.registerFromPath('C:/Windows/Fonts/yumindb.ttf', 'YuMincho-Demibold')
// VFとの比較用
GlobalFonts.registerFromPath('C:/Windows/Fonts/NotoSerifJP-VF.ttf', 'NotoSerifJP')

const W = 900, H = 420
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#0a0015'
ctx.fillRect(0,0,W,H)

const tests = [
  { font: `normal 68px 'YuMincho-Light'`,    label: '游明朝 Light' },
  { font: `normal 68px 'YuMincho'`,          label: '游明朝 Regular' },
  { font: `normal 68px 'YuMincho-Demibold'`, label: '游明朝 Demibold' },
  { font: `900 68px 'NotoSerifJP'`,          label: 'NotoSerifJP 900 (VF・比較)' },
  { font: `bold 68px 'Yu Gothic UI'`,        label: 'Yu Gothic UI Bold (比較)' },
]

tests.forEach(({ font, label }, i) => {
  const y = 38 + i * 76
  ctx.save()
  ctx.font = font
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('花見どき', 20, y)
  ctx.font = `13px 'Yu Gothic UI'`
  ctx.fillStyle = 'rgba(255,160,200,0.55)'
  ctx.fillText(label, 310, y)
  ctx.restore()
})

fs.writeFileSync('C:/Users/pcyus/Documents/sakura-app/public/font-debug.png', canvas.toBuffer('image/png'))
console.log('done')
