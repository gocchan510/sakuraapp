/**
 * 共有カード画像生成（Canvas API）
 * 3サイズ対応: square (1080²) / x (1200×675) / story (1080×1920)
 */
import { weatherEmoji } from './weather'
import type { DayWeather } from './weather'
import type { BloomStatus } from './spotBloom'
import { haptic, HapticPattern } from './haptic'

export type ShareFormat = 'square' | 'x' | 'story'

const FORMAT_SIZE: Record<ShareFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  x:      { w: 1200, h: 675 },
  story:  { w: 1080, h: 1920 },
}

const BLOOM_META: Record<BloomStatus, { label: string; dotColor: string }> = {
  in_bloom:   { label: '見頃ピーク',    dotColor: '#FF69B4' },
  opening:    { label: '咲き始め',      dotColor: '#FF9AB8' },
  falling:    { label: '散り始め',      dotColor: '#C8A870' },
  leaf:       { label: '葉桜',          dotColor: '#66BB6A' },
  budding:    { label: 'もうすぐ開花',  dotColor: '#FFD54F' },
  upcoming:   { label: '時期外',        dotColor: '#C8C8C8' },
  off_season: { label: '時期外',        dotColor: '#C8C8C8' },
}

export type ShareCardParams = {
  name: string
  prefecture: string
  city: string
  bloomStatus: BloomStatus
  weather: DayWeather | null
  isNight: boolean
  dayLabel: string
  features: string[]
  varietyCount: number
  is100sen: boolean
  imageUrl?: string | null
  reliability?: number | null
  primaryVariety?: string | null
  targetDate?: Date | null
  spotId?: string | null         // ディープリンク用
  format?: ShareFormat           // デフォルト 'square'
}

const APP_ORIGIN = 'https://gocchan510.github.io/sakuraapp'

// ── フォント ──
let fontLoaded = false
async function ensureFont() {
  if (fontLoaded) return
  try {
    // @ts-ignore
    const regular = new FontFace(
      'NotoSerifJP',
      "url(https://fonts.gstatic.com/s/notoserifjp/v30/xn7mYHs72GKoTvER4Gn3b5eMRjSvEgmj92ooLSxfDKk.woff2)",
      { weight: '400' }
    )
    // @ts-ignore
    const bold = new FontFace(
      'NotoSerifJP',
      "url(https://fonts.gstatic.com/s/notoserifjp/v30/xn76YHs72GKoTvER4Gn3b5eMRjTgkRg7q6mqQaH8qA.woff2)",
      { weight: '700' }
    )
    await Promise.all([regular.load(), bold.load()])
    // @ts-ignore
    document.fonts.add(regular)
    // @ts-ignore
    document.fonts.add(bold)
    fontLoaded = true
  } catch {}
}

// ── 画像キャッシュ ──
const imageCache = new Map<string, HTMLImageElement | null>()
function loadImageWithTimeout(src: string, timeoutMs = 2500): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src)!)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    let done = false
    const finish = (result: HTMLImageElement | null) => {
      if (done) return
      done = true
      imageCache.set(src, result)
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    img.onload = () => { clearTimeout(timer); finish(img) }
    img.onerror = () => { clearTimeout(timer); finish(null) }
    img.src = src
  })
}

// ── ユーティリティ ──
function prefShort(pref: string): string {
  if (pref === '北海道') return '北海道'
  return pref.replace(/[都府県]$/, '')
}

function buildCatchPrefix(target: Date, now: Date = new Date()): string {
  const DAYS = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜']
  const a = new Date(now); a.setHours(0, 0, 0, 0)
  const b = new Date(target); b.setHours(0, 0, 0, 0)
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000)
  if (diff === 0) return '今日の'
  if (diff === 1) return '明日の'
  if (diff === 2) return '明後日の'
  const todayDow = a.getDay()
  const daysUntilSunday = (7 - todayDow) % 7
  if (diff >= 3 && diff <= daysUntilSunday) return `${DAYS[b.getDay()]}の`
  const endOfNextWeek = daysUntilSunday + 7
  if (diff > daysUntilSunday && diff <= endOfNextWeek) {
    const tdow = b.getDay()
    if (tdow === 6 || tdow === 0) return '来週末の'
    return `来週${DAYS[tdow]}の`
  }
  return `${b.getMonth() + 1}/${b.getDate()}の`
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  fontSpec: string,
  minSize: number = 28
): number {
  let size = initialSize
  ctx.font = `${fontSpec} ${size}px NotoSerifJP, serif`
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4
    ctx.font = `${fontSpec} ${size}px NotoSerifJP, serif`
  }
  return size
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 指定矩形内に桜色夜グラデーションを描画 */
function drawGradientBg(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const bg = ctx.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0,    '#4a1530')
  bg.addColorStop(0.5,  '#251020')
  bg.addColorStop(1,    '#0e0208')
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  const topGlow = ctx.createRadialGradient(x + w*0.5, y + h*0.05, 40, x + w*0.5, y + h*0.05, Math.max(w, h))
  topGlow.addColorStop(0, 'rgba(255, 120, 170, 0.32)')
  topGlow.addColorStop(1, 'rgba(255, 120, 170, 0)')
  ctx.fillStyle = topGlow
  ctx.fillRect(x, y, w, h)
}

/** 花びらを指定矩形内に散らす */
function drawPetalsInRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const petals: [number, number, number, number, number][] = [
    [0.11, 0.17, 56, 0.22, 0.30],
    [0.88, 0.20, 38, 0.14, -0.50],
    [0.18, 0.55, 48, 0.19, 0.80],
    [0.82, 0.50, 30, 0.10, -0.20],
    [0.09, 0.82, 44, 0.17, 0.60],
    [0.88, 0.84, 52, 0.21, 0.10],
    [0.50, 0.09, 34, 0.13, -0.40],
    [0.56, 0.93, 40, 0.16, 0.70],
    [0.31, 0.33, 26, 0.11, 0.20],
    [0.70, 0.76, 60, 0.23, -0.60],
    [0.07, 0.41, 32, 0.12, 0.50],
    [0.93, 0.67, 46, 0.18, -0.30],
  ]
  ctx.save()
  petals.forEach(([rx, ry, size, op, rot]) => {
    ctx.save()
    ctx.globalAlpha = op
    ctx.translate(x + w * rx, y + h * ry)
    ctx.rotate(rot)
    ctx.font = `${size}px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🌸', 0, 0)
    ctx.restore()
  })
  ctx.restore()
}

/**
 * 画像 or グラデーションで指定矩形を埋める
 * @returns usedImage (画像読込成功時true)
 */
async function fillBackground(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  imageUrl?: string | null
): Promise<boolean> {
  let usedImage = false
  if (imageUrl) {
    const bg = await loadImageWithTimeout(imageUrl, 2500)
    if (bg) {
      try {
        // center-crop to target aspect
        const targetAspect = rect.w / rect.h
        const srcAspect = bg.width / bg.height
        let sx = 0, sy = 0, sw = bg.width, sh = bg.height
        if (srcAspect > targetAspect) {
          // 画像が横長 → 左右クロップ
          sw = bg.height * targetAspect
          sx = (bg.width - sw) / 2
        } else {
          // 画像が縦長 → 上下クロップ
          sh = bg.width / targetAspect
          sy = (bg.height - sh) / 2
        }
        ctx.drawImage(bg, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h)
        // taint 検証
        try {
          ctx.getImageData(rect.x, rect.y, 1, 1)
          usedImage = true
        } catch {
          usedImage = false
        }
      } catch {
        usedImage = false
      }
    }
  }
  if (!usedImage) {
    drawGradientBg(ctx, rect.x, rect.y, rect.w, rect.h)
    drawPetalsInRect(ctx, rect.x, rect.y, rect.w, rect.h)
  }
  return usedImage
}

/** 暗いオーバーレイ */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  strength: 'dark' | 'medium' | 'light' = 'medium'
) {
  const overlay = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h)
  const stops = strength === 'dark'
    ? [[0, 0.55], [0.5, 0.62], [1, 0.75]]
    : strength === 'medium'
      ? [[0, 0.42], [0.5, 0.50], [1, 0.65]]
      : [[0, 0.20], [0.5, 0.15], [1, 0.30]]
  stops.forEach(([pos, a]) => overlay.addColorStop(pos, `rgba(0,0,0,${a})`))
  ctx.fillStyle = overlay
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
}

// ────────────────────────────────────────────────────────────────
// レイアウト別描画（元のスクエア版を3フォーマットに分岐）
// ────────────────────────────────────────────────────────────────

type Rect = { x: number; y: number; w: number; h: number }

type LayoutConfig = {
  format: ShareFormat
  W: number
  H: number
  imageRect: Rect   // 画像/グラデ背景の範囲
  textRect: Rect    // テキスト描画対象の範囲
  infoHasOwnBg: boolean  // infoエリアが独立背景を持つ (x/story)
  nameMaxW: number
  centerX: number   // テキスト中央揃え用
  // 各要素のY座標（textRect内の相対位置ではなく絶対）
  catchY: number
  nameY: number
  nameFontMax: number
  locationY: number
  badgeY: number
  bloomY: number
  infoY: number
  tagsY: number
  footerY1: number
  footerY2: number
}

function layoutFor(format: ShareFormat): LayoutConfig {
  const { w: W, h: H } = FORMAT_SIZE[format]
  if (format === 'square') {
    return {
      format, W, H,
      imageRect: { x: 0, y: 0, w: W, h: H },
      textRect:  { x: 0, y: 0, w: W, h: H },
      infoHasOwnBg: false,
      nameMaxW: 960,
      centerX: W / 2,
      catchY: 180,
      nameY: 340,
      nameFontMax: 96,
      locationY: 440,
      badgeY: 480,
      bloomY: 580,
      infoY: 660,
      tagsY: 830,
      footerY1: 960,
      footerY2: 1000,
    }
  }
  if (format === 'x') {
    // 1200×675、左60%(720)画像、右40%(480)テキスト
    const imageW = Math.round(W * 0.6)     // 720
    const infoX = imageW
    const infoW = W - imageW               // 480
    const cx = infoX + infoW / 2           // 960
    return {
      format, W, H,
      imageRect: { x: 0, y: 0, w: imageW, h: H },
      textRect:  { x: infoX, y: 0, w: infoW, h: H },
      infoHasOwnBg: true,
      nameMaxW: infoW - 40,
      centerX: cx,
      catchY: 60,
      nameY: 160,
      nameFontMax: 54,
      locationY: 230,
      badgeY: 260,
      bloomY: 340,
      infoY: 400,
      tagsY: 470,
      footerY1: 600,
      footerY2: 635,
    }
  }
  // story: 1080×1920、上60%(1152)画像、下40%(768)情報
  const imageH = Math.round(H * 0.6)  // 1152
  const infoY = imageH
  const infoH = H - imageH             // 768
  return {
    format, W, H,
    imageRect: { x: 0, y: 0, w: W, h: imageH },
    textRect:  { x: 0, y: infoY, w: W, h: infoH },
    infoHasOwnBg: true,
    nameMaxW: 960,
    centerX: W / 2,
    // 画像エリアにキャッチコピー + スポット名を配置
    catchY: 220,
    nameY: 380,
    nameFontMax: 96,
    locationY: 520,
    badgeY: 575,
    // 情報パネル内（infoY = 1152 から下）
    bloomY: infoY + 120,
    infoY: infoY + 200,
    tagsY: infoY + 320,
    footerY1: infoY + 620,
    footerY2: infoY + 670,
  }
}

// ────────────────────────────────────────────────────────────────
// 共通描画ヘルパー
// ────────────────────────────────────────────────────────────────

function drawCatch(ctx: CanvasRenderingContext2D, L: LayoutConfig, params: ShareCardParams) {
  const prefix = params.targetDate ? buildCatchPrefix(params.targetDate) : ''
  const catchLine = `${prefix}桜、ここに決めた。`
  const maxW = L.format === 'x' ? L.nameMaxW : 960
  const initialSize = L.format === 'x' ? 28 : 36
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 200, 220, 0.92)'
  const size = fitText(ctx, catchLine, maxW, initialSize, '400', 20)
  ctx.font = `400 ${size}px NotoSerifJP, serif`
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 6
  ctx.fillText(catchLine, L.centerX, L.catchY)
  ctx.shadowBlur = 0
  const catchWidth = ctx.measureText(catchLine).width
  const lineHalf = Math.min(200, catchWidth / 2 + 10)
  ctx.strokeStyle = 'rgba(255, 180, 210, 0.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(L.centerX - lineHalf, L.catchY + 28)
  ctx.lineTo(L.centerX + lineHalf, L.catchY + 28)
  ctx.stroke()
  ctx.restore()
}

function drawSpotName(ctx: CanvasRenderingContext2D, L: LayoutConfig, params: ShareCardParams) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
  ctx.shadowBlur = 20
  ctx.fillStyle = '#ffffff'
  const nameSize = fitText(ctx, params.name, L.nameMaxW, L.nameFontMax, '700', 32)
  ctx.font = `700 ${nameSize}px NotoSerifJP, serif`
  ctx.fillText(params.name, L.centerX, L.nameY)
  // 下線
  ctx.shadowBlur = 0
  const underlineY = L.nameY + nameSize / 2 + 18
  ctx.strokeStyle = 'rgba(255, 220, 230, 0.4)'
  ctx.lineWidth = 1.5
  const lineWidth = L.format === 'x' ? 50 : 70
  ctx.beginPath()
  ctx.moveTo(L.centerX - lineWidth, underlineY)
  ctx.lineTo(L.centerX + lineWidth, underlineY)
  ctx.stroke()
  ctx.restore()
}

function drawLocation(ctx: CanvasRenderingContext2D, L: LayoutConfig, params: ShareCardParams) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 215, 230, 0.88)'
  const size = L.format === 'x' ? 22 : 30
  ctx.font = `400 ${size}px NotoSerifJP, serif`
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 4
  ctx.fillText(`${params.prefecture} ${params.city}`.trim(), L.centerX, L.locationY)
  ctx.restore()
}

function drawBadge(ctx: CanvasRenderingContext2D, L: LayoutConfig, params: ShareCardParams) {
  if (!params.is100sen) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const fs = L.format === 'x' ? 18 : 24
  ctx.font = `700 ${fs}px NotoSerifJP, serif`
  const badgeText = '🏆 さくら名所100選'
  const w = ctx.measureText(badgeText).width + 32
  const bx = L.centerX - w / 2
  const h = L.format === 'x' ? 32 : 40
  const by = L.badgeY - h / 2
  const grad = ctx.createLinearGradient(bx, by, bx, by + h)
  grad.addColorStop(0, '#E8B530')
  grad.addColorStop(1, '#B8830E')
  ctx.fillStyle = grad
  roundedRect(ctx, bx, by, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillText(badgeText, L.centerX, L.badgeY)
  ctx.restore()
}

function drawBloom(ctx: CanvasRenderingContext2D, L: LayoutConfig, params: ShareCardParams) {
  const meta = BLOOM_META[params.bloomStatus]
  const bloomText = params.primaryVariety
    ? `${params.primaryVariety} ${meta.label}`
    : meta.label
  ctx.save()
  const baseFontSize = L.format === 'x' ? 30 : 44
  const dotRadius = L.format === 'x' ? 13 : 18
  const dotGap = L.format === 'x' ? 14 : 20
  const maxW = L.format === 'x' ? L.nameMaxW : 880
  const fontSize = fitText(ctx, bloomText, maxW - (dotRadius * 2 + dotGap), baseFontSize, '700', 22)
  ctx.font = `700 ${fontSize}px NotoSerifJP, serif`
  const labelWidth = ctx.measureText(bloomText).width
  const totalWidth = dotRadius * 2 + dotGap + labelWidth
  const startX = L.centerX - totalWidth / 2
  // dot
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(startX + dotRadius, L.bloomY, dotRadius, 0, Math.PI * 2)
  ctx.fillStyle = meta.dotColor
  ctx.fill()
  // highlight
  ctx.shadowBlur = 0
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.arc(startX + dotRadius - dotRadius * 0.28, L.bloomY - dotRadius * 0.28, dotRadius * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.globalAlpha = 1
  // label
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = 8
  ctx.fillStyle = '#ffffff'
  ctx.fillText(bloomText, startX + dotRadius * 2 + dotGap, L.bloomY)
  ctx.restore()
}

function drawInfo(ctx: CanvasRenderingContext2D, L: LayoutConfig, params: ShareCardParams) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const size = L.format === 'x' ? 22 : 34
  ctx.font = `400 ${size}px NotoSerifJP, serif`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 6
  const parts: string[] = []
  if (params.weather) {
    if (params.isNight && params.weather.night) {
      parts.push(`🌙${weatherEmoji(params.weather.night.code)} ${params.weather.night.temp}℃`)
    } else {
      parts.push(`${weatherEmoji(params.weather.code)} ${params.weather.tempMax}℃`)
    }
  }
  parts.push(params.dayLabel)
  if (params.varietyCount > 0) parts.push(`${params.varietyCount}品種`)
  ctx.fillText(parts.join('  ·  '), L.centerX, L.infoY)
  ctx.restore()
}

function drawTags(ctx: CanvasRenderingContext2D, L: LayoutConfig, params: ShareCardParams) {
  const tagMap: Record<string, string> = {
    'ライトアップ': '🌙 ライトアップ',
    '夜桜':         '🌙 夜桜',
    '屋台あり':     '🎪 屋台',
    '桜祭り':       '🎪 桜祭り',
    '駐車場あり':   '🅿️ 駐車場',
  }
  const tags: string[] = []
  params.features.forEach(f => {
    const mapped = tagMap[f]
    if (mapped && !tags.includes(mapped)) tags.push(mapped)
  })
  if (tags.length === 0) return
  ctx.save()
  const fs = L.format === 'x' ? 18 : 26
  ctx.font = `700 ${fs}px NotoSerifJP, serif`
  const paddingX = L.format === 'x' ? 14 : 20
  const gapT = L.format === 'x' ? 10 : 14
  const h = L.format === 'x' ? 32 : 44
  const widths = tags.map(t => ctx.measureText(t).width + paddingX * 2)
  const totalW = widths.reduce((a, b) => a + b, 0) + gapT * (tags.length - 1)
  let x = L.centerX - totalW / 2
  const y = L.tagsY
  tags.forEach((t, i) => {
    const w = widths[i]
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.strokeStyle = 'rgba(255, 200, 220, 0.30)'
    ctx.lineWidth = 1
    roundedRect(ctx, x, y, w, h, h / 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(t, x + w / 2, y + h / 2)
    x += w + gapT
  })
  ctx.restore()
}

function drawFooter(ctx: CanvasRenderingContext2D, L: LayoutConfig) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255, 215, 230, 0.92)'
  const s1 = L.format === 'x' ? 22 : 38
  const s2 = L.format === 'x' ? 14 : 22
  ctx.font = `700 ${s1}px NotoSerifJP, serif`
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 6
  ctx.fillText('花見どき', L.centerX, L.footerY1)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255, 200, 220, 0.60)'
  ctx.font = `400 ${s2}px NotoSerifJP, serif`
  ctx.fillText('gocchan510.github.io/sakuraapp', L.centerX, L.footerY2)
  ctx.restore()
}

/** 情報パネル背景（x / story用） */
function drawInfoPanelBg(ctx: CanvasRenderingContext2D, L: LayoutConfig) {
  if (!L.infoHasOwnBg) return
  // 半透明の桜色夜グラデ
  const r = L.textRect
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h)
  g.addColorStop(0, 'rgba(32, 8, 18, 0.92)')
  g.addColorStop(1, 'rgba(14, 2, 8, 0.95)')
  ctx.fillStyle = g
  ctx.fillRect(r.x, r.y, r.w, r.h)
  // 桜色の上部アクセント
  const accent = ctx.createRadialGradient(
    r.x + r.w / 2, r.y + (L.format === 'x' ? 50 : 80), 20,
    r.x + r.w / 2, r.y + (L.format === 'x' ? 50 : 80), r.w * 0.8
  )
  accent.addColorStop(0, 'rgba(255, 120, 170, 0.18)')
  accent.addColorStop(1, 'rgba(255, 120, 170, 0)')
  ctx.fillStyle = accent
  ctx.fillRect(r.x, r.y, r.w, r.h)
}

/** カード生成メイン */
export async function generateShareCard(params: ShareCardParams): Promise<Blob | null> {
  await ensureFont()
  const format: ShareFormat = params.format ?? 'square'
  const L = layoutFor(format)
  const canvas = document.createElement('canvas')
  canvas.width = L.W
  canvas.height = L.H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // 画像エリア背景
  const usedImage = await fillBackground(ctx, L.imageRect, params.imageUrl)

  // 画像時はオーバーレイ
  if (usedImage) {
    drawOverlay(ctx, L.imageRect, 'medium')
  }

  // 情報パネル背景（x / story）
  drawInfoPanelBg(ctx, L)

  // square は全体にライトオーバーレイ（既に画像オーバーレイ済みならスキップ）
  if (format === 'square' && !usedImage) {
    drawOverlay(ctx, L.textRect, 'light')
  }

  // 描画（フォーマット別に位置が違うだけで要素は共通）
  drawCatch(ctx, L, params)
  drawSpotName(ctx, L, params)
  drawLocation(ctx, L, params)
  if (params.is100sen) drawBadge(ctx, L, params)
  drawBloom(ctx, L, params)
  drawInfo(ctx, L, params)
  drawTags(ctx, L, params)
  drawFooter(ctx, L)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95)
  })
}

// ── トースト ──
function showToast(msg: string, kind: 'info' | 'error' = 'info') {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = `
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    background: ${kind === 'error' ? 'rgba(200, 30, 60, 0.95)' : 'rgba(0, 0, 0, 0.86)'};
    color: #fff; padding: 12px 20px; border-radius: 22px; font-size: 14px;
    font-weight: 600; z-index: 9999;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    opacity: 0; transition: opacity 0.2s;
    pointer-events: none;
    font-family: inherit;
    max-width: calc(100vw - 40px);
  `
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = '1' })
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, 2500)
}

/** シェアカード生成 + Web Share API / ダウンロードフォールバック */
export async function shareSpot(params: ShareCardParams): Promise<'shared' | 'downloaded' | 'failed'> {
  let blob: Blob | null = null
  try {
    blob = await generateShareCard(params)
  } catch {
    blob = null
  }
  if (!blob) {
    showToast('画像の生成に失敗しました', 'error')
    return 'failed'
  }
  const format = params.format ?? 'square'
  const suffix = format === 'x' ? '-x' : format === 'story' ? '-story' : ''
  const fileName = `hanami-${params.name}${suffix}.png`
  const file = new File([blob], fileName, { type: 'image/png' })
  const hashtags = `#花見どき #花見 #桜2026 #${prefShort(params.prefecture)}`
  const prefix = params.targetDate ? buildCatchPrefix(params.targetDate) : ''
  const deepUrl = params.spotId
    ? `${APP_ORIGIN}/#/map?spot=${encodeURIComponent(params.spotId)}`
    : `${APP_ORIGIN}/`
  const text = `🌸 ${prefix}桜、ここに決めた。\n${params.name}（${params.prefecture}）\n${deepUrl}\n\n${hashtags}`

  // @ts-ignore
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      haptic(HapticPattern.success)
      return 'shared'
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'failed'
    }
  }

  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast('画像をダウンロードしました 📥', 'info')
    return 'downloaded'
  } catch {
    showToast('画像の保存に失敗しました', 'error')
    return 'failed'
  }
}
