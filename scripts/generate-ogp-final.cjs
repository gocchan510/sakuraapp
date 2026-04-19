/**
 * OGP最終版: Pollo.ai 夜桜写真 + Noto Serif JP テキスト合成
 */
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const fs = require('fs')
const path = require('path')
GlobalFonts.registerFromPath('C:/Windows/Fonts/yumindb.ttf', 'YuMincho-Demibold')
GlobalFonts.registerFromPath('C:/Windows/Fonts/yumin.ttf',   'YuMincho')
GlobalFonts.registerFromPath('C:/Windows/Fonts/yuminl.ttf',  'YuMincho-Light')

const W = 1200, H = 630

async function main() {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // ── 背景写真を読み込んでクロップ ──
  const img = await loadImage('C:/Users/pcyus/Documents/sakura-app/public/img-check-1.jpg')
  // 元画像: 約1080x1080（square）
  const iw = img.width, ih = img.height
  console.log('Source image:', iw, 'x', ih)

  // クロップ戦略:
  // - 右上の "Pollo.ai" ロゴを避けるため、上部を少し切る
  // - 左側の暗いエリア（テキスト配置用）を残す
  // - 縦横比 1200:630 = 40:21
  // ソース: 横全体 iw, 高さ iw*(630/1200) = iw*0.525
  const cropH = Math.round(iw * (630 / 1200))
  // 上から160px（ロゴ回避）分オフセット
  const cropY = Math.min(160, ih - cropH)
  console.log('Crop: 0,', cropY, iw, cropH)

  ctx.drawImage(img, 0, cropY, iw, cropH, 0, 0, W, H)

  // ── 左側グラデオーバーレイ（テキスト可読性確保） ──
  const textOverlay = ctx.createLinearGradient(0, 0, W * 0.72, 0)
  textOverlay.addColorStop(0,    'rgba(5, 0, 12, 0.78)')
  textOverlay.addColorStop(0.42, 'rgba(5, 0, 12, 0.60)')
  textOverlay.addColorStop(0.65, 'rgba(5, 0, 12, 0.20)')
  textOverlay.addColorStop(1,    'rgba(5, 0, 12, 0)')
  ctx.fillStyle = textOverlay
  ctx.fillRect(0, 0, W, H)

  // 上下にも薄く暗くして自然に締める
  const topOverlay = ctx.createLinearGradient(0, 0, 0, H * 0.25)
  topOverlay.addColorStop(0, 'rgba(0,0,0,0.35)')
  topOverlay.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = topOverlay
  ctx.fillRect(0, 0, W, H)

  const bottomOverlay = ctx.createLinearGradient(0, H * 0.72, 0, H)
  bottomOverlay.addColorStop(0, 'rgba(0,0,0,0)')
  bottomOverlay.addColorStop(1, 'rgba(0,0,0,0.50)')
  ctx.fillStyle = bottomOverlay
  ctx.fillRect(0, 0, W, H)

  // ── タグライン ──
  ctx.save()
  ctx.font = `normal 15px 'YuMincho-Light'`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 190, 215, 0.65)'
  ctx.fillText('SAKURA GUIDE 2026', 88, H * 0.285)
  ctx.restore()

  // タグラインの下に細い線
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 160, 200, 0.30)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(88, H * 0.315)
  ctx.lineTo(88 + 200, H * 0.315)
  ctx.stroke()
  ctx.restore()

  // ── メインタイトル ──
  ctx.save()
  ctx.font = `normal 154px 'YuMincho-Demibold'`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetX = 1
  ctx.shadowOffsetY = 3
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('花見どき', 82, H * 0.490)
  ctx.restore()

  // ── サブタイトル ──
  ctx.save()
  ctx.font = `normal 30px 'YuMincho'`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 8
  ctx.fillStyle = 'rgba(255, 215, 235, 0.90)'
  ctx.fillText('今年の花見、どこへ行く？', 88, H * 0.648)
  ctx.restore()

  // ── 統計テキスト ──
  ctx.save()
  ctx.font = `normal 18px 'YuMincho-Light'`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(220, 170, 195, 0.60)'
  ctx.fillText('1,433 スポット  ·  862 品種  ·  開花前線リアルタイム', 88, H * 0.855)
  ctx.restore()

  // ── 出力 ──
  const outPath = path.resolve(__dirname, '..', 'public', 'ogp.png')
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(outPath, buffer)
  console.log(`✅ OGP → ${outPath}  (${(buffer.length/1024).toFixed(1)} KB)`)
}

main().catch(console.error)
