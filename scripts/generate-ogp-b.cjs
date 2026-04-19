/**
 * OGP案B: 左右分割・ポスター風（Noto Serif JP）
 */
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')
const fs = require('fs')
const path = require('path')
GlobalFonts.registerFromPath('C:/Windows/Fonts/NotoSerifJP-VF.ttf', 'NotoSerifJP')

const W = 1200, H = 630
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

// ── 背景 ──
ctx.fillStyle = '#080010'
ctx.fillRect(0, 0, W, H)

// 右エリアに淡いピンク光
const rightGlow = ctx.createRadialGradient(W * 0.75, H * 0.45, 0, W * 0.75, H * 0.45, 380)
rightGlow.addColorStop(0,   'rgba(140, 35, 80, 0.20)')
rightGlow.addColorStop(0.5, 'rgba(80, 15, 50, 0.08)')
rightGlow.addColorStop(1,   'rgba(0, 0, 0, 0)')
ctx.fillStyle = rightGlow
ctx.fillRect(0, 0, W, H)

// ── 縦の仕切り（グラデーション・細い） ──
ctx.save()
const sepG = ctx.createLinearGradient(0, H * 0.08, 0, H * 0.92)
sepG.addColorStop(0,   'rgba(220, 120, 170, 0)')
sepG.addColorStop(0.25, 'rgba(220, 120, 170, 0.28)')
sepG.addColorStop(0.75, 'rgba(220, 120, 170, 0.28)')
sepG.addColorStop(1,   'rgba(220, 120, 170, 0)')
ctx.strokeStyle = sepG
ctx.lineWidth = 0.8
ctx.beginPath()
ctx.moveTo(W * 0.50, H * 0.08)
ctx.lineTo(W * 0.50, H * 0.92)
ctx.stroke()
ctx.restore()

// ── 右: 枝（1本・シンプル）＋桜（5円スタイル） ──
function branch(x1, y1, cpx, cpy, x2, y2, lw, op) {
  ctx.save()
  ctx.globalAlpha = op
  ctx.strokeStyle = '#8a4060'
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo(cpx, cpy, x2, y2)
  ctx.stroke()
  ctx.restore()
}

branch(1205, -10, 1025, 105, 875, 225, 2.8, 0.38)
branch(875,  225,  815, 278, 748, 355, 2.0, 0.30)
branch(875,  225,  905, 278, 935, 335, 1.5, 0.24)
branch(748,  355,  712, 402, 668, 462, 1.4, 0.22)
branch(875,  225,  930, 168, 968, 128, 1.3, 0.22)
branch(748,  355,  775, 328, 815, 298, 1.0, 0.18)

// 5円スタイルの桜
function sakura5(cx, cy, r, alpha) {
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = cx + Math.cos(angle) * r * 0.46
    const py = cy + Math.sin(angle) * r * 0.46
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(px, py)
    ctx.rotate(angle)
    ctx.scale(1, 1.5)
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.50)
    pg.addColorStop(0,   'rgba(255, 215, 235, 1)')
    pg.addColorStop(0.55,'rgba(255, 185, 215, 0.55)')
    pg.addColorStop(1,   'rgba(255, 160, 200, 0)')
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.50, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.save()
  ctx.globalAlpha = alpha * 0.65
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.16)
  cg.addColorStop(0, 'rgba(255, 252, 228, 1)')
  cg.addColorStop(1, 'rgba(255, 205, 228, 0)')
  ctx.fillStyle = cg
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

sakura5(878, 226,  34, 0.32)
sakura5(818, 278,  26, 0.26)
sakura5(752, 354,  22, 0.24)
sakura5(938, 298,  18, 0.20)
sakura5(970, 128,  20, 0.20)
sakura5(672, 458,  16, 0.17)
sakura5(818, 298,  13, 0.15)

// 散り花びら（右エリア）
;[[615,45,8,0.9,0.14],[565,490,6,1.3,0.11],[1130,355,7,-0.5,0.12],[1055,70,6,1.0,0.10]].forEach(([x,y,s,r,a]) => {
  ctx.save()
  ctx.globalAlpha = a
  ctx.translate(x, y); ctx.rotate(r)
  ctx.beginPath()
  ctx.moveTo(0,0)
  ctx.bezierCurveTo(s*0.7,-s*0.15,s*0.8,-s*0.75,0,-s)
  ctx.bezierCurveTo(-s*0.8,-s*0.75,-s*0.7,-s*0.15,0,0)
  ctx.fillStyle='rgba(255,205,228,1)'; ctx.fill()
  ctx.restore()
})

// ── 左: テキスト ──

// 上部タグ
ctx.save()
ctx.font = `200 15px 'NotoSerifJP'`
ctx.textAlign = 'left'
ctx.textBaseline = 'middle'
ctx.fillStyle = 'rgba(210, 130, 175, 0.60)'
ctx.fillText('SAKURA GUIDE 2026', 96, H * 0.235)
ctx.restore()

// 細い横線（タグとタイトルの間）
ctx.save()
ctx.strokeStyle = 'rgba(210, 120, 165, 0.25)'
ctx.lineWidth = 0.7
ctx.beginPath()
ctx.moveTo(96, H * 0.27)
ctx.lineTo(96 + 260, H * 0.27)
ctx.stroke()
ctx.restore()

// タイトル
ctx.save()
ctx.font = `900 152px 'NotoSerifJP'`
ctx.textAlign = 'left'
ctx.textBaseline = 'middle'
ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
ctx.shadowBlur = 14
ctx.shadowOffsetY = 3
ctx.fillStyle = '#FFFFFF'
ctx.fillText('花見どき', 90, H * 0.475)
ctx.restore()

// サブタイトル
ctx.save()
ctx.font = `300 30px 'NotoSerifJP'`
ctx.textAlign = 'left'
ctx.textBaseline = 'middle'
ctx.fillStyle = 'rgba(255, 205, 230, 0.80)'
ctx.fillText('今年の花見、どこへ行く？', 96, H * 0.645)
ctx.restore()

// 統計
ctx.save()
ctx.font = `200 18px 'NotoSerifJP'`
ctx.textAlign = 'left'
ctx.textBaseline = 'middle'
ctx.fillStyle = 'rgba(190, 125, 160, 0.48)'
ctx.fillText('1,433 スポット  ·  862 品種  ·  開花前線リアルタイム', 96, H * 0.845)
ctx.restore()

const outPath = path.resolve(__dirname, '..', 'public', 'ogp-b.png')
fs.writeFileSync(outPath, canvas.toBuffer('image/png'))
console.log(`✅ B → ${outPath}`)
