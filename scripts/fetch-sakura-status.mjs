/**
 * 桜開花情報スクレイパー
 *
 * ① 気象庁（JMA） — 開花日・満開日・平年差
 *    https://www.data.jma.go.jp/sakura/sakura_kaika.html
 *    https://www.data.jma.go.jp/sakura/sakura_mankai.html
 *
 * ② tenki.jp — 現在の開花ステータス（見頃 / 散り始め など）
 *    https://sakura.tenki.jp/sakura/information/
 *
 * ③ Yahoo天気 — 都道府県ごとの開花ステータス（補完用）
 *    https://weather.yahoo.co.jp/weather/sakura/
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ============================================================
   共通設定
   ============================================================ */

// ① JMA 取得対象の観測地点
const JMA_TARGET_STATIONS = ['東京', '横浜', '熊谷', '静岡', '下田', '前橋', '千葉', '小田原', '秩父']

// ② tenki.jp / ③ Yahoo 取得対象の都道府県
const PREF_LIST = ['東京都', '神奈川県', '埼玉県', '千葉県', '静岡県', '群馬県']

// tenki.jp 地点名 → 都道府県
const TENKI_POINT_TO_PREF = {
  '東京': '東京都',
  '横浜': '神奈川県',
  '小田原': '神奈川県',
  'さいたま': '埼玉県',
  '熊谷': '埼玉県',
  '千葉': '千葉県',
  '静岡': '静岡県',
  '前橋': '群馬県',
  '高崎': '群馬県',
}

// Yahoo天気 地名 → 都道府県
const YAHOO_LOC_TO_PREF = {
  '東京': '東京都',
  '神奈川': '神奈川県',
  '横浜': '神奈川県',
  '埼玉': '埼玉県',
  'さいたま': '埼玉県',
  '千葉': '千葉県',
  '静岡': '静岡県',
  '群馬': '群馬県',
  '前橋': '群馬県',
}

// 開花ステータスの優先順（先にある方が「進んでいる」）
const BLOOM_STATUS_PRIORITY = ['葉桜', '散り始め', '見頃', '開花', '開花前', '未発表']

/* ============================================================
   HTML フェッチ（Shift-JIS 対応）
   ============================================================ */
async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; sakura-app-bot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en;q=0.5',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const buf = await res.arrayBuffer()
  try {
    const sjis = new TextDecoder('shift_jis').decode(buf)
    if (sjis.includes('開花') || sjis.includes('満開') || sjis.includes('見頃')) return sjis
  } catch {}
  return new TextDecoder('utf-8').decode(buf)
}

/* ============================================================
   ① 気象庁パーサー
   ============================================================ */
function parseJmaTable(html) {
  const results = {}
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi

  for (const rowMatch of html.matchAll(rowRegex)) {
    const row = rowMatch[0]
    const cells = []
    for (const cellMatch of row.matchAll(cellRegex)) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim())
    }
    if (cells.length < 3) continue
    const station = cells[0]
    if (!JMA_TARGET_STATIONS.includes(station)) continue

    const date = cells[1] || null
    const heikinsaRaw = cells[2] || null
    const heikinDate = cells[3] || null
    const heikinsa = heikinsaRaw !== null && heikinsaRaw !== '' && !isNaN(Number(heikinsaRaw))
      ? Number(heikinsaRaw) : null
    results[station] = { date, heikinsa, heikinDate }
  }
  return results
}

/* ============================================================
   ② / ③ 共通ステータスパーサー
   ============================================================ */

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function findStatusInText(text) {
  for (const s of BLOOM_STATUS_PRIORITY) {
    if (text.includes(s)) return s
  }
  return null
}

/** <tr> 単位でパース（テーブル形式のページに有効） */
function parseByRows(html, locationMap, source) {
  const results = {}
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi
  for (const rowMatch of html.matchAll(rowRegex)) {
    const text = stripTags(rowMatch[0])
    for (const [loc, pref] of Object.entries(locationMap)) {
      if (results[pref]) continue
      if (!text.includes(loc)) continue
      const status = findStatusInText(text)
      if (status) {
        results[pref] = { status, source }
        console.log(`  [${source}] ${pref}（${loc}）→ ${status}`)
      }
    }
  }
  return results
}

/** 地名の出現位置から前後 600 文字でステータスを探す（非テーブルページ対応） */
function parseByProximity(html, locationMap, source) {
  const results = {}
  for (const [loc, pref] of Object.entries(locationMap)) {
    if (results[pref]) continue
    const idx = html.indexOf(loc)
    if (idx === -1) continue
    const window = stripTags(html.slice(Math.max(0, idx - 50), idx + 600))
    const status = findStatusInText(window)
    if (status) {
      results[pref] = { status, source }
      console.log(`  [${source}] ${pref}（${loc}）→ ${status} [近接]`)
    }
  }
  return results
}

/* ============================================================
   ② tenki.jp スクレイパー
   ============================================================ */
async function fetchTenkiJp() {
  console.log('\n[tenki.jp] 桜状況を取得中...')
  const url = 'https://sakura.tenki.jp/sakura/information/'
  try {
    const html = await fetchHtml(url)
    let result = parseByRows(html, TENKI_POINT_TO_PREF, 'tenki.jp')
    if (Object.keys(result).length < 2) {
      console.log('  行パース不足 → 近接パース試行')
      const fallback = parseByProximity(html, TENKI_POINT_TO_PREF, 'tenki.jp')
      result = { ...fallback, ...result }
    }
    console.log(`  完了: ${Object.keys(result).length}件`)
    return result
  } catch (e) {
    console.warn('  tenki.jp 取得失敗:', e.message)
    return {}
  }
}

/* ============================================================
   ③ Yahoo天気 スクレイパー
   ============================================================ */
async function fetchYahooSakura() {
  console.log('\n[Yahoo天気] 桜状況を取得中...')
  const url = 'https://weather.yahoo.co.jp/weather/sakura/'
  try {
    const html = await fetchHtml(url)
    let result = parseByRows(html, YAHOO_LOC_TO_PREF, 'Yahoo天気')
    if (Object.keys(result).length < 2) {
      console.log('  行パース不足 → 近接パース試行')
      const fallback = parseByProximity(html, YAHOO_LOC_TO_PREF, 'Yahoo天気')
      result = { ...fallback, ...result }
    }
    console.log(`  完了: ${Object.keys(result).length}件`)
    return result
  } catch (e) {
    console.warn('  Yahoo天気 取得失敗:', e.message)
    return {}
  }
}

/* ============================================================
   メイン
   ============================================================ */
async function main() {
  // ① JMA
  console.log('=== ① 気象庁 開花/満開データ取得 ===')
  let kaikaData = {}
  let mankaiData = {}

  try {
    const html = await fetchHtml('https://www.data.jma.go.jp/sakura/sakura_kaika.html')
    kaikaData = parseJmaTable(html)
    console.log('  開花取得:', Object.keys(kaikaData))
  } catch (e) { console.warn('  開花取得失敗:', e.message) }

  try {
    const html = await fetchHtml('https://www.data.jma.go.jp/sakura/sakura_mankai.html')
    mankaiData = parseJmaTable(html)
    console.log('  満開取得:', Object.keys(mankaiData))
  } catch (e) { console.warn('  満開取得失敗:', e.message) }

  const stations = {}
  for (const name of JMA_TARGET_STATIONS) {
    stations[name] = {
      kaika: kaikaData[name] ?? null,
      mankai: mankaiData[name] ?? null,
    }
  }

  // ② tenki.jp  ③ Yahoo（並列取得）
  console.log('\n=== ② tenki.jp / ③ Yahoo 現在ステータス取得 ===')
  const [tenkiResult, yahooResult] = await Promise.all([
    fetchTenkiJp(),
    fetchYahooSakura(),
  ])

  // マージ: tenki.jp 優先、なければ Yahoo で補完
  const prefStatus = {}
  for (const pref of PREF_LIST) {
    prefStatus[pref] = tenkiResult[pref] || yahooResult[pref] || null
  }

  console.log('\n=== prefStatus 最終結果 ===')
  for (const [pref, val] of Object.entries(prefStatus)) {
    console.log(`  ${pref}: ${val ? `${val.status}（${val.source}）` : 'なし'}`)
  }

  // 出力
  const now = new Date()
  const updated = now.toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo',
  })

  const output = { updated, stations, prefStatus }
  const outPath = join(__dirname, '../src/data/sakura_status.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log('\n✅ 書き出し完了:', outPath)
}

main().catch(e => { console.error(e); process.exit(1) })
