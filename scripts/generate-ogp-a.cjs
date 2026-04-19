/**
 * OGP案A: タイポグラフィ一点集中ミニマル（Noto Serif JP）
 */
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')
const fs = require('fs')
const path = require('path')
GlobalFonts.registerFromPath('C:/Windows/Fonts/NotoSerifJP-VF.ttf', 'NotoSerifJP')

const W = 1200, H = 630
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

// ── 背景: ほぼ漆黒、中央下にごく薄いウォームトーン ──
ctx.fillStyle = '#09000e'
ctx.fillRect(0, 0, W, H)

const warmGlow = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, 520)
warmGlow.addColorStop(0,   'rgba(120, 30, 70, 0.14)')
warmGlow.addColorStop(1,   'rgba(0, 0, 0, 0)')
ctx.fillStyle = warmGlow
ctx.fillRect(0, 0, W, H)

// ── 右上: ぼんやりとした桜のシルエット（5円で構成・シンプル） ──
function simpleSakura(cx, cy, r, alpha) {
  // 5枚の花びら（楕円を回転）
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = cx + Math.cos(angle) * r * 0.48
    const py = cy + Math.sin(angle) * r * 0.48
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(px, py)
    ctx.rotate(angle)
    ctx.scale(1, 1.55)
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.52)
    pg.addColorStop(0,   'rgba(255, 210, 230, 1)')
    pg.addColorStop(0.6, 'rgba(255, 185, 215, 0.6)')
    pg.addColorStop(1,   'rgba(255, 160, 200, 0)')
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // 中心
  ctx.save()
  ctx.globalAlpha = alpha * 0.7
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.18)
  cg.addColorStop(0, 'rgba(255, 252, 230, 1)')
  cg.addColorStop(1, 'rgba(255, 200, 225, 0)')
  ctx.fillStyle = cg
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// 右上に大きく1輪（薄く）
simpleSakura(W * 0.86, H * 0.22, 115, 0.10)
// 右端に小さく1輪
simpleSakura(W * 0.96, H * 0.60, 50,  0.07)
// 左下に極小
simpleSakura(W * 0.06, H * 0.82, 38,  0.05)

// ── タイトル: Noto Serif JP Black・超大・中央 ──
ctx.save()
ctx.font = `900 176px 'NotoSerifJP'`
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
// ドロップシャドウ（控えめ）
ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
ctx.shadowBlur = 18
ctx.shadowOffsetY = 4
ctx.fillStyle = '#FFFFFF'
ctx.fillText('花見どき', W / 2, H * 0.415)
ctx.restore()

// ── 細い区切り線 ──
const divY = H * 0.575
ctx.save()
const lineG = ctx.createLinearGradient(W * 0.3, 0, W * 0.7, 0)
lineG.addColorStop(0,   'rgba(255, 150, 195, 0)')
lineG.addColorStop(0.5, 'rgba(255, 150, 195, 0.45)')
lineG.addColorStop(1,   'rgba(255, 150, 195, 0)')
ctx.strokeStyle = lineG
ctx.lineWidth = 0.8
ctx.beginPath()
ctx.moveTo(W * 0.3, divY)
ctx.lineTo(W * 0.7, divY)
ctx.stroke()
ctx.restore()

// ── サブタイトル: Light ──
ctx.save()
ctx.font = `300 36px 'NotoSerifJP'`
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.fillStyle = 'rgba(255, 205, 230, 0.80)'
ctx.fillText('今年の花見、どこへ行く？', W / 2, H * 0.665)
ctx.restore()

// ── 統計: ExtraLight・最小 ──
ctx.save()
ctx.font = `200 20px 'NotoSerifJP'`
ctx.textAlign = 'center'
ctx.textBaseline = 'middle'
ctx.fillStyle = 'rgba(190, 130, 165, 0.48)'
ctx.fillText('1,433 スポット　·　862 品種　·　開花前線リアルタイム', W / 2, H * 0.855)
ctx.restore()

const outPath = path.resolve(__dirname, '..', 'public', 'ogp-a.png')
fs.writeFileSync(outPath, canvas.toBuffer('image/png'))
console.log(`✅ A → ${outPath}  (${(canvas.toBuffer('image/png').length/1024).toFixed(1)} KB)`)
