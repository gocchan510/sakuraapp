/**
 * OGP画像生成スクリプト（1200×630px PNG）— 夜桜 Night Sakura Edition
 * 実行: node scripts/generate-ogp.cjs
 */
const { createCanvas } = require('@napi-rs/canvas')
const fs   = require('fs')
const path = require('path')

const W = 1200, H = 630
const canvas = createCanvas(W, H)
const ctx    = canvas.getContext('2d')

const FONT = '"Yu Gothic UI", "Yu Gothic", "Meiryo", "MS Gothic", sans-serif'

// ════════════════════════════════════════════════════
//  1. 背景（漆黒 → 深紅のグラデーション・多層）
// ════════════════════════════════════════════════════

// ベース: 漆黒
ctx.fillStyle = '#060009'
ctx.fillRect(0, 0, W, H)

// 右寄り中央: 深いワインレッドの輝き
;(function() {
  const g = ctx.createRadialGradient(W * 0.6, H * 0.46, 0, W * 0.6, H * 0.46, 440)
  g.addColorStop(0,   'rgba(150, 18, 55, 0.72)')
  g.addColorStop(0.45,'rgba(90,  8, 35, 0.42)')
  g.addColorStop(1,   'rgba(0,   0,  0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
})()

// 左上: 紫寄り
;(function() {
  const g = ctx.createRadialGradient(W * 0.12, H * 0.18, 0, W * 0.12, H * 0.18, 340)
  g.addColorStop(0,   'rgba(65, 5, 80, 0.55)')
  g.addColorStop(1,   'rgba(0, 0,  0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
})()

// 右下: 暗いローズ
;(function() {
  const g = ctx.createRadialGradient(W * 0.9, H * 0.85, 0, W * 0.9, H * 0.85, 300)
  g.addColorStop(0,   'rgba(170, 25, 70, 0.38)')
  g.addColorStop(1,   'rgba(0,   0,  0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
})()

// ════════════════════════════════════════════════════
//  2. ボケ玉（光のパーティクル）
// ════════════════════════════════════════════════════
;[
  [110, 88,  20, 0.13], [940, 562, 24, 0.11], [1085, 135, 16, 0.14],
  [58,  492, 13, 0.10], [378, 18,  10, 0.11], [822,  592, 15, 0.12],
  [1162,402, 11, 0.10], [288, 602, 9,  0.09], [652,  12,  12, 0.11],
  [1052,312, 8,  0.09], [178, 282, 7,  0.08], [732,  582, 10, 0.10],
  [482, 618, 8,  0.08], [1142,562, 13, 0.10], [28,  182,  9, 0.09],
  [550, 610, 6,  0.07], [1190, 80, 7,  0.08], [30,  60,   5, 0.07],
].forEach(([x, y, r, op]) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3)
  g.addColorStop(0,   `rgba(255,175,210,${op})`)
  g.addColorStop(0.5, `rgba(255,145,190,${op * 0.5})`)
  g.addColorStop(1,   'rgba(255,125,180,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r * 3, 0, Math.PI * 2)
  ctx.fill()
})

// ════════════════════════════════════════════════════
//  3. 桜の枝
// ════════════════════════════════════════════════════
function branch(x1, y1, cpx, cpy, x2, y2, lw, op) {
  ctx.save()
  ctx.globalAlpha  = op
  ctx.strokeStyle  = '#8B4060'
  ctx.lineWidth    = lw
  ctx.lineCap      = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo(cpx, cpy, x2, y2)
  ctx.stroke()
  ctx.restore()
}
// 左下
branch( -8, 645,  115, 490,  282, 382, 3.8, 0.22)
branch(282, 382,  365, 308,  485, 252, 2.8, 0.18)
branch(282, 382,  295, 445,  345, 495, 2.2, 0.14)
branch(485, 252,  518, 208,  582, 192, 1.8, 0.15)
branch(485, 252,  492, 295,  510, 325, 1.6, 0.12)
branch(282, 382,  230, 350,  175, 360, 1.4, 0.12)
// 右上
branch(1210, -8, 1055, 118,  948, 225, 3.8, 0.20)
branch( 948, 225,  882, 272,  822, 342, 2.8, 0.17)
branch( 948, 225,  942, 285,  962, 332, 2.2, 0.13)
branch( 822, 342,  792, 382,  752, 422, 1.8, 0.14)
branch( 948, 225, 1010, 175, 1025, 140, 1.6, 0.13)
branch( 822, 342,  855, 320,  892, 298, 1.4, 0.11)

// ════════════════════════════════════════════════════
//  4. 桜の花（リアル・グロー付き）
// ════════════════════════════════════════════════════
function drawPetal(cx, cy, len, wid, angle, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo( wid * 0.85, -len * 0.12,  wid * 0.92, -len * 0.72, 0, -len)
  ctx.bezierCurveTo(-wid * 0.92, -len * 0.72, -wid * 0.85, -len * 0.12, 0, 0)
  ctx.fillStyle = 'rgba(255,205,225,1)'
  ctx.fill()
  // 中スジ
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -len * 0.85)
  ctx.strokeStyle = 'rgba(255,170,200,0.4)'
  ctx.lineWidth = wid * 0.12
  ctx.stroke()
  ctx.restore()
}

function sakura(cx, cy, size, rot, alpha) {
  // グロー
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.6)
  g.addColorStop(0,   `rgba(255,180,210,${alpha * 0.35})`)
  g.addColorStop(1,   'rgba(255,160,200,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, size * 1.6, 0, Math.PI * 2)
  ctx.fill()

  // 花びら × 5
  for (let i = 0; i < 5; i++) {
    drawPetal(cx, cy, size, size * 0.44, rot + (i / 5) * Math.PI * 2, alpha)
  }
  // 内側（明るめ）× 5
  for (let i = 0; i < 5; i++) {
    drawPetal(cx, cy, size * 0.68, size * 0.28,
              rot + (i / 5) * Math.PI * 2 + 0.12,
              alpha * 0.55)
  }
  // 中心
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.22)
  cg.addColorStop(0,   `rgba(255,252,222,${alpha * 1.5})`)
  cg.addColorStop(1,   `rgba(255,210,230,${alpha * 0.3})`)
  ctx.fillStyle = cg
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2)
  ctx.fill()
  // おしべ
  if (size > 22) {
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * Math.PI * 2
      ctx.save()
      ctx.globalAlpha = alpha * 0.38
      ctx.strokeStyle  = 'rgba(255,232,180,1)'
      ctx.lineWidth    = 0.9
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * size * 0.34, cy + Math.sin(a) * size * 0.34)
      ctx.stroke()
      ctx.restore()
    }
  }
}

// 左下枝の花
sakura(278, 385,  40, 0.25,  0.28)
sakura(355, 330,  34, 1.05,  0.25)
sakura(470, 254,  30, 0.68,  0.23)
sakura(495, 302,  23, 1.95,  0.20)
sakura(192, 432,  28, -0.42, 0.19)
sakura(325, 460,  22, 1.48,  0.18)
sakura(564, 198,  20, 0.22,  0.18)
sakura(178, 365,  18, -0.9,  0.15)
sakura(560, 312,  16, 1.3,   0.14)
// 右上枝の花
sakura(955, 222,  38, -0.52, 0.28)
sakura(880, 272,  32,  2.08, 0.25)
sakura(826, 344,  28,  0.82, 0.23)
sakura(972, 298,  24, -1.18, 0.20)
sakura(1022,165,  26,  0.42, 0.19)
sakura(758, 418,  20,  1.28, 0.18)
sakura(895, 182,  18, -0.78, 0.17)
sakura(860, 322,  16,  1.0,  0.15)
sakura(1040,195,  14,  -0.3, 0.13)

// 散り花びら
;[[582,542,13,0.42,0.14],[148,202,11,-0.72,0.12],[1052,482,12,1.22,0.13],
  [682, 42, 10, 0.82,0.12],[42,382,9,-0.32,0.11],[1172,222,11,1.82,0.12],
  [432, 52, 9,-1.02,0.11],[902,602,10, 0.52,0.11],[762,592,8,-0.62,0.10],
  [1102,58, 9, 1.12,0.11],[222,592,10, 0.92,0.10],[622,620,7, 0.12,0.09],
].forEach(([x,y,s,r,a]) => {
  ctx.save()
  ctx.globalAlpha = a
  ctx.translate(x, y)
  ctx.rotate(r)
  ctx.beginPath()
  ctx.moveTo(0,0)
  ctx.bezierCurveTo( s*0.7,-s*0.15, s*0.8,-s*0.75, 0,-s)
  ctx.bezierCurveTo(-s*0.8,-s*0.75,-s*0.7,-s*0.15, 0, 0)
  ctx.fillStyle = 'rgba(255,205,228,1)'
  ctx.fill()
  ctx.restore()
})

// ════════════════════════════════════════════════════
//  5. メインタイトル「花見どき」（多層グロー）
// ════════════════════════════════════════════════════
const TX = W / 2
const TY = H * 0.41

// パス1: 大きな外側グロー（ピンク）
ctx.save()
ctx.font        = `bold 158px ${FONT}`
ctx.textAlign   = 'center'
ctx.textBaseline= 'middle'
ctx.shadowColor = 'rgba(255, 100, 160, 0.65)'
ctx.shadowBlur  = 90
ctx.fillStyle   = 'rgba(255,255,255,0)'
ctx.fillText('花見どき', TX, TY)
ctx.restore()

// パス2: 中グロー（白ピンク）
ctx.save()
ctx.font        = `bold 158px ${FONT}`
ctx.textAlign   = 'center'
ctx.textBaseline= 'middle'
ctx.shadowColor = 'rgba(255, 210, 235, 0.85)'
ctx.shadowBlur  = 42
ctx.fillStyle   = 'rgba(255,255,255,0.12)'
ctx.fillText('花見どき', TX, TY)
ctx.restore()

// パス3: 本体（白）
ctx.save()
ctx.font        = `bold 158px ${FONT}`
ctx.textAlign   = 'center'
ctx.textBaseline= 'middle'
ctx.shadowColor = 'rgba(0,0,0,0.55)'
ctx.shadowBlur  = 22
ctx.shadowOffsetY = 4
ctx.fillStyle   = '#FFFFFF'
ctx.fillText('花見どき', TX, TY)
ctx.restore()

// ════════════════════════════════════════════════════
//  6. サブタイトル
// ════════════════════════════════════════════════════
ctx.save()
ctx.font        = `42px ${FONT}`
ctx.textAlign   = 'center'
ctx.textBaseline= 'middle'
ctx.shadowColor = 'rgba(255, 140, 190, 0.5)'
ctx.shadowBlur  = 18
ctx.fillStyle   = 'rgba(255, 218, 235, 0.96)'
ctx.fillText('今年の花見、どこへ行く？', W / 2, H * 0.605)
ctx.restore()

// ════════════════════════════════════════════════════
//  7. 区切りライン + 中央小花
// ════════════════════════════════════════════════════
const DIV_Y = H * 0.715
;(function() {
  const g = ctx.createLinearGradient(W * 0.12, 0, W * 0.88, 0)
  g.addColorStop(0,    'rgba(255,170,210,0)')
  g.addColorStop(0.25, 'rgba(255,170,210,0.40)')
  g.addColorStop(0.5,  'rgba(255,200,228,0.65)')
  g.addColorStop(0.75, 'rgba(255,170,210,0.40)')
  g.addColorStop(1,    'rgba(255,170,210,0)')
  ctx.strokeStyle = g
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.moveTo(W * 0.12, DIV_Y)
  ctx.lineTo(W * 0.88, DIV_Y)
  ctx.stroke()
})()
sakura(W / 2, DIV_Y, 9, 0, 0.6)

// ════════════════════════════════════════════════════
//  8. 統計バー
// ════════════════════════════════════════════════════
;(function() {
  const g = ctx.createLinearGradient(0, H * 0.74, 0, H)
  g.addColorStop(0,   'rgba(4,0,10,0)')
  g.addColorStop(0.3, 'rgba(4,0,10,0.68)')
  g.addColorStop(1,   'rgba(4,0,10,0.82)')
  ctx.fillStyle = g
  ctx.fillRect(0, H * 0.74, W, H * 0.26)
})()

ctx.save()
ctx.font        = `27px ${FONT}`
ctx.textAlign   = 'center'
ctx.textBaseline= 'middle'
ctx.fillStyle   = 'rgba(255, 185, 220, 0.72)'
ctx.fillText('📍 1,433スポット   ·   🌸 862品種   ·   🔄 開花前線リアルタイム', W / 2, H * 0.835)
ctx.restore()

// ════════════════════════════════════════════════════
//  9. PNG 出力
// ════════════════════════════════════════════════════
const outPath = path.resolve(__dirname, '..', 'public', 'ogp.png')
const buffer  = canvas.toBuffer('image/png')
fs.writeFileSync(outPath, buffer)
console.log(`✅ OGP → ${outPath}  (${(buffer.length/1024).toFixed(1)} KB)`)
