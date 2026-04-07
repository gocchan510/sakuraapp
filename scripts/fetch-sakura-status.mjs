/**
 * 桜開花情報スクレイパー
 *
 * ① 気象庁（JMA） — 開花日・満開日・平年差を取得
 *    → 取得した日付と今日の日付を比較して「現在の状況」を自動推定
 *
 * ② tenki.jp / Yahoo天気 — 直接スクレイピング（取れれば優先）
 *    ※ ブロックや404の場合は ① の推定値にフォールバック
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ============================================================
   設定
   ============================================================ */

const JMA_TARGET_STATIONS = ['東京', '横浜', '熊谷', '静岡', '下田', '前橋', '千葉', '小田原', '秩父']

const PREF_LIST = ['東京都', '神奈川県', '埼玉県', '千葉県', '静岡県', '群馬県']

// 気象庁観測地点 → 都道府県（推定に使用）
const JMA_STATION_TO_PREF = {
  '東京': '東京都',
  '横浜': '神奈川県',
  '小田原': '神奈川県',
  '千葉': '千葉県',
  '熊谷': '埼玉県',
  '秩父': '埼玉県',
  '静岡': '静岡県',
  '下田': '静岡県',
  '前橋': '群馬県',
}

// tenki.jp 地点名 → 都道府県
const TENKI_POINT_TO_PREF = {
  '東京': '東京都',
  '横浜': '神奈川県',
  'さいたま': '埼玉県',
  '熊谷': '埼玉県',
  '千葉': '千葉県',
  '静岡': '静岡県',
  '前橋': '群馬県',
}

// Yahoo 地名 → 都道府県
const YAHOO_LOC_TO_PREF = {
  '東京': '東京都',
  '神奈川': '神奈川県',
  '埼玉': '埼玉県',
  '千葉': '千葉県',
  '静岡': '静岡県',
  '群馬': '群馬県',
}

const BLOOM_STATUS_PRIORITY = ['葉桜', '散り始め', '見頃', '開花', '開花前', '未発表']

/* ============================================================
   HTML フェッチ
   ============================================================ */
async function fetchHtml(url, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; sakura-app-bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.5',
      },
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
    const buf = await res.arrayBuffer()
    try {
      const sjis = new TextDecoder('shift_jis').decode(buf)
      if (sjis.includes('開花') || sjis.includes('満開') || sjis.includes('見頃')) return sjis
    } catch {}
    return new TextDecoder('utf-8').decode(buf)
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

/* ============================================================
   ① 気象庁パーサー
   ============================================================ */
function parseJmaTable(html) {
  const results = {}
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi

  for (const rowMatch of html.matchAll(rowRegex)) {
    const cells = []
    for (const cellMatch of rowMatch[0].matchAll(cellRegex)) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim())
    }
    if (cells.length < 3) continue
    const station = cells[0]
    if (!JMA_TARGET_STATIONS.includes(station)) continue
    const date = cells[1] || null
    const heikinsaRaw = cells[2] || null
    const heikinDate = cells[3] || null
    const heikinsa = heikinsaRaw && !isNaN(Number(heikinsaRaw)) ? Number(heikinsaRaw) : null
    results[station] = { date, heikinsa, heikinDate }
  }
  return results
}

/* ============================================================
   ① 気象庁データから「現在の状況」を推定
   ============================================================ */

/** "3月19日" や "4月 1日" を Date に変換（年は引数で指定） */
function parseJapaneseDate(str, year) {
  if (!str) return null
  const m = str.match(/(\d+)月\s*(\d+)日/)
  if (!m) return null
  return new Date(year, parseInt(m[1]) - 1, parseInt(m[2]))
}

/**
 * 開花日・満開日・今日の日付から現在ステータスを推定
 *
 * タイミング目安（ソメイヨシノ）:
 *   開花前     : today < 開花日
 *   開花       : 開花日 ≤ today < 満開日-2日
 *   見頃       : 満開日-2日 ≤ today ≤ 満開日+7日
 *   散り始め   : 満開日+7日 < today ≤ 満開日+14日
 *   葉桜       : today > 満開日+14日
 */
function deriveStatusFromDates(kaika, mankai, todayJST) {
  const year = todayJST.getFullYear()
  const todayMs = todayJST.getTime()

  if (kaika?.date) {
    const kaikaDate = parseJapaneseDate(kaika.date, year)
    if (!kaikaDate) return null

    if (todayMs < kaikaDate.getTime()) return '開花前'

    if (mankai?.date) {
      const mankaiDate = parseJapaneseDate(mankai.date, year)
      if (mankaiDate) {
        const daysAfter = (todayMs - mankaiDate.getTime()) / 86400000
        if (daysAfter < -2)  return '開花'
        if (daysAfter <= 7)  return '見頃'
        if (daysAfter <= 14) return '散り始め'
        return '葉桜'
      }
    }
    return '開花'
  }

  // 観測前：平年日を使って開花前かどうか判断
  if (kaika?.heikinDate) {
    const heikin = parseJapaneseDate(kaika.heikinDate, year)
    if (heikin && todayMs < heikin.getTime()) return '開花前'
  }
  return null
}

function deriveAllPrefStatus(stations, todayJST) {
  const results = {}
  for (const [station, pref] of Object.entries(JMA_STATION_TO_PREF)) {
    if (results[pref]) continue            // 同都道府県で既に決まっていればスキップ
    const data = stations[station]
    if (!data) continue
    const status = deriveStatusFromDates(data.kaika, data.mankai, todayJST)
    if (status) {
      results[pref] = { status, source: '気象庁推定' }
      console.log(`  [気象庁推定] ${pref}（${station}）→ ${status}`)
    }
  }
  return results
}

/* ============================================================
   ② / ③ スクレイピング共通
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
function parseByRows(html, locationMap, source) {
  const results = {}
  for (const rowMatch of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const text = stripTags(rowMatch[0])
    for (const [loc, pref] of Object.entries(locationMap)) {
      if (results[pref] || !text.includes(loc)) continue
      const status = findStatusInText(text)
      if (status) {
        results[pref] = { status, source }
        console.log(`  [${source}] ${pref}（${loc}）→ ${status}`)
      }
    }
  }
  return results
}
function parseByProximity(html, locationMap, source) {
  const results = {}
  for (const [loc, pref] of Object.entries(locationMap)) {
    if (results[pref]) continue
    const idx = html.indexOf(loc)
    if (idx === -1) continue
    const win = stripTags(html.slice(Math.max(0, idx - 50), idx + 600))
    const status = findStatusInText(win)
    if (status) {
      results[pref] = { status, source }
      console.log(`  [${source}] ${pref}（${loc}）→ ${status} [近接]`)
    }
  }
  return results
}

/* ============================================================
   ② tenki.jp（行パースのみ・複数URLを試行）
   ============================================================ */
async function fetchTenkiJp() {
  console.log('\n[tenki.jp] 桜状況を取得中...')
  const urls = [
    'https://tenki.jp/sakura/',
    'https://tenki.jp/lite/sakura/',
    'https://sakura.tenki.jp/sakura/information/',
  ]
  for (const url of urls) {
    try {
      console.log(`  試行: ${url}`)
      const html = await fetchHtml(url)
      const result = parseByRows(html, TENKI_POINT_TO_PREF, 'tenki.jp')
      if (Object.keys(result).length >= 2) {
        console.log(`  完了: ${Object.keys(result).length}件`)
        return result
      }
      console.log(`  行パース結果 ${Object.keys(result).length}件 → 次のURLを試行`)
    } catch (e) {
      console.warn(`  失敗（${url}）:`, e.message)
    }
  }
  console.warn('  tenki.jp 取得できず（JMA推定で補完）')
  return {}
}

/* ============================================================
   ③ Yahoo天気（行パースのみ・複数URLを試行）
   ============================================================ */
async function fetchYahooSakura() {
  console.log('\n[Yahoo天気] 桜状況を取得中...')
  const urls = [
    'https://weather.yahoo.co.jp/weather/sakura/',
    'https://weather.yahoo.co.jp/weather/jp/sakura/',
  ]
  for (const url of urls) {
    try {
      console.log(`  試行: ${url}`)
      const html = await fetchHtml(url)
      const result = parseByRows(html, YAHOO_LOC_TO_PREF, 'Yahoo天気')
      if (Object.keys(result).length >= 2) {
        console.log(`  完了: ${Object.keys(result).length}件`)
        return result
      }
      console.log(`  行パース結果 ${Object.keys(result).length}件 → 次のURLを試行`)
    } catch (e) {
      console.warn(`  失敗（${url}）:`, e.message)
    }
  }
  console.warn('  Yahoo天気 取得できず（JMA推定で補完）')
  return {}
}

/* ============================================================
   メイン
   ============================================================ */
async function main() {
  // ① JMA 開花・満開データ
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

  // ① 気象庁データから現在ステータスを推定（最重要フォールバック）
  console.log('\n=== ① 気象庁データから現在ステータスを推定 ===')
  const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  console.log(`  今日（JST）: ${nowJST.getFullYear()}/${nowJST.getMonth()+1}/${nowJST.getDate()}`)
  const derivedStatus = deriveAllPrefStatus(stations, nowJST)

  // ② / ③ スクレイピング（取れれば推定より優先）
  console.log('\n=== ② tenki.jp / ③ Yahoo 現在ステータス取得 ===')
  const [tenkiResult, yahooResult] = await Promise.all([
    fetchTenkiJp(),
    fetchYahooSakura(),
  ])

  // マージ優先順:
  //   気象庁推定（日付計算）> tenki.jp行パース > Yahoo行パース
  //   ※ 気象庁の実測日から計算した推定が最も信頼性が高い
  const prefStatus = {}
  for (const pref of PREF_LIST) {
    prefStatus[pref] = derivedStatus[pref] || tenkiResult[pref] || yahooResult[pref] || null
  }

  console.log('\n=== prefStatus 最終結果 ===')
  for (const [pref, val] of Object.entries(prefStatus)) {
    console.log(`  ${pref}: ${val ? `${val.status}（${val.source}）` : 'なし'}`)
  }

  // 出力
  const updated = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo',
  })
  const output = { updated, stations, prefStatus }
  const outPath = join(__dirname, '../src/data/sakura_status.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log('\n✅ 書き出し完了:', outPath)
}

main().catch(e => { console.error(e); process.exit(1) })
