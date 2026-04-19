/**
 * OGP案C: 和モダン・線描き桜（Noto Serif JP）
 */
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')
const fs = require('fs')
const path = require('path')
GlobalFonts.registerFromPath('C:/Windows/Fonts/NotoSerifJP-VF.ttf', 'NotoSerifJP')

const W = 1200, H = 630
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

// ── 背景: 純黒に近い ──
ctx.fillStyle = '#060008'
ctx.fillRect(0, 0, W, H)

// 右上に極薄のピンク光源1つ
const glow = ctx.createRadialGradient(W * 0.80, H * 0.22, 0, W * 0.80, H * 0.22, 450)
glow.addColorStop(0,   'rgba(160, 40, 90, 0.12)')
glow.addColorStop(1,   'rgba(0, 0, 0, 0)')
ctx.fillStyle = glow
ctx.fillRect(0, 0, W, H)

// ── 枝（右上から・細い2本） ──
function inkLine(x1, y1, cpx, cpy, x2, y2, lw, op) {
  ctx.save()
  ctx.globalAlpha = op
  ctx.strokeStyle = '#b06888'
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo(cpx, cpy, x2, y2)
  ctx.stroke()
  ctx.restore()
}

// 主幹（右上から左へ流れる）
inkLine(1200, 0,    1040, 80,   890, 200, 2.2, 0.42)
inkLine(890,  200,  832, 260,   765, 340, 1.6, 0.34)
inkLine(765,  340,  730, 395,   682, 462, 1.1, 0.26)
inkLine(890,  200,  928, 158,   968, 118, 1.0, 0.26)
inkLine(890,  200,  920, 260,   952, 315, 0.9, 0.22)
inkLine(765,  340,  790, 312,   828, 285, 0.8, 0.20)

// ── 花（アウトラインのみ・細い・5円） ──
function outlineSakura(cx, cy, r, alpha) {
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = cx + Math.cos(angle) * r * 0.46
    const py = cy + Math.sin(angle) * r * 0.46
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(px, py)
    ctx.rotate(angle)
    ctx.scale(1, 1.5)
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 195, 225, 0.04)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 180, 215, 0.85)'
    ctx.lineWidth = 0.75
    ctx.stroke()
    ctx.restore()
  }
  // 中心の点
  ctx.save()
  ctx.globalAlpha = alpha * 0.6
  ctx.fillStyle = 'rgba(255, 245, 215, 1)'
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

outlineSakura(893, 200, 30, 0.58)
outlineSakura(835, 260, 24, 0.48)
outlineSakura(768, 340, 20, 0.44)
outlineSakura(930, 265, 17, 0.36)
outlineSakura(970, 118, 18, 0.36)
outlineSakura(685, 458, 15, 0.28)
outlineSakura(830, 285, 12, 0.24)

// 散り花びら（右エリア・アウトライン）
;[[625,42,7,0.8,0.24],[1095,42,6,1.2,0.20],[1155,310,6,-0.5,0.18],[578,498,5,1.4,0.18]].forEach(([x,y,s,r,a]) => {
  ctx.save()
  ctx.globalAlpha = a
  ctx.translate(x, y); ctx.rotate(r)
  ctx.beginPath()
  ctx.moveTo(0,0)
  ctx.bezierCurveTo(s*0.65,-s*0.12,s*0.72,-s*0.70,0,-s)
  ctx.bezierCurveTo(-s*0.72,-s*0.70,-s*0.65,-s*0.12,0,0)
  ctx.fillStyle = 'rgba(255,195,225,0.06)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,175,210,0.8)'
  ctx.lineWidth = 0.6
  ctx.stroke()
  ctx.restore()
})

// ── 左のアクセントライン ──
ctx.save()
const acLine = ctx.createLinearGradient(0, H * 0.25, 0, H * 0.65)
acLine.addColorStop(0,    'rgba(210, 110, 160, 0)')
acLine.addColorStop(0.25, 'rgba(210, 110, 160, 0.55)')
acLine.addColorStop(0.75, 'rgba(210, 110, 160, 0.55)')
acLine.addColorStop(1,    'rgba(210, 110, 160, 0)')
ctx.strokeStyle = acLine
ctx.lineWidth = 1.2
ctx.beginPath()
ctx.moveTo(78, H * 0.25)
ctx.lineTo(78, H * 0.65)
ctx.stroke()
ctx.restore()

// ── テキスト ──

// 小タグ
ctx.save()
ctx.font = `200 14px 'NotoSerifJP'`
ctx.textAlign = 'left'
ctx.textBaseline = 'middle'
ctx.fillStyle = 'rgba(210, 130, 175, 0.55)'
ctx.fillText('SAKURA GUIDE', 100, H * 0.295)
ctx.restore()

// タイトル（大・左寄り）
ctx.save()
ctx.font = `900 162px 'NotoSerifJP'`
ctx.textAlign = 'left'
ctx.textBaseline = 'middle'
ctx.shadowColor = 'rgba(0, 0, 0, 0.70)'
ctx.shadowBlur = 16
ctx.shadowOffsetY = 3
ctx.fillStyle = '#FFFFFF'
ctx.fillText('花見どき', 92, H * 0.490)
ctx.restore()

// サブタイトル
ctx.save()
ctx.font = `300 28px 'NotoSerifJP'`
ctx.textAlign = 'left'
ctx.textBaseline = 'middle'
ctx.fillStyle = 'rgba(255, 200, 228, 0.75)'
ctx.fillText('今年の花見、どこへ行く？', 100, H * 0.648)
ctx.restore()

// 統計
ctx.save()
ctx.font = `200 18px 'NotoSerifJP'`
ctx.textAlign = 'left'
ctx.textBaseline = 'middle'
ctx.fillStyle = 'rgba(185, 120, 158, 0.45)'
ctx.fillText('1,433 スポット  ·  862 品種  ·  開花前線リアルタイム', 100, H * 0.858)
ctx.restore()

const outPath = path.resolve(__dirname, '..', 'public', 'ogp-c.png')
fs.writeFileSync(outPath, canvas.toBuffer('image/png'))
console.log(`✅ C → ${outPath}`)
