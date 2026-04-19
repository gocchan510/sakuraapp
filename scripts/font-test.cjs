const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')
GlobalFonts.registerFromPath('C:/Windows/Fonts/NotoSerifJP-VF.ttf', 'NotoSerifJP')

const W = 800, H = 420
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#08000f'
ctx.fillRect(0, 0, W, H)

const tests = [
  { font: `100 64px 'NotoSerifJP'`,   label: 'NotoSerifJP 100 (ExtraLight)' },
  { font: `400 64px 'NotoSerifJP'`,   label: 'NotoSerifJP 400 (Regular)' },
  { font: `700 64px 'NotoSerifJP'`,   label: 'NotoSerifJP 700 (Bold)' },
  { font: `900 64px 'NotoSerifJP'`,   label: 'NotoSerifJP 900 (Black)' },
  { font: `bold 64px 'Yu Gothic UI'`, label: 'Yu Gothic UI Bold' },
  { font: `bold 64px sans-serif`,     label: 'sans-serif fallback' },
]

tests.forEach(({ font, label }, i) => {
  const y = 36 + i * 66
  ctx.save()
  ctx.font = font
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('花見どき', 20, y)
  ctx.font = `12px 'Yu Gothic UI'`
  ctx.fillStyle = 'rgba(255,160,200,0.5)'
  ctx.fillText(label, 330, y)
  ctx.restore()
})

const fs = require('fs')
fs.writeFileSync('C:/Users/pcyus/Documents/sakura-app/public/font-test.png', canvas.toBuffer('image/png'))
console.log('done')
