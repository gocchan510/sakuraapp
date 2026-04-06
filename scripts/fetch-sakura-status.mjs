/**
 * 気象庁「さくらの開花・満開状況」ページをスクレイピングして
 * src/data/sakura_status.json を生成するスクリプト
 *
 * 対象: https://www.data.jma.go.jp/sakura/sakura_kaika.html
 *       https://www.data.jma.go.jp/sakura/sakura_mankai.html
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 取得対象の観測地点
const TARGET_STATIONS = ['東京', '横浜', '熊谷', '静岡', '下田', '前橋', '千葉', '小田原', '秩父']

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sakura-app-bot/1.0)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const buf = await res.arrayBuffer()
  // 気象庁ページは Shift_JIS のことがあるので対応
  try {
    const decoder = new TextDecoder('shift_jis')
    const text = decoder.decode(buf)
    if (text.includes('開花') || text.includes('満開')) return text
  } catch {}
  return new TextDecoder('utf-8').decode(buf)
}

/**
 * HTML テーブルをパースして観測地点ごとのデータを返す
 * 列構成: 地点名 | 観測日 | 平年差(日) | 平年日 | 昨年差(日) | 昨年日 | 品種
 */
function parseTable(html) {
  const results = {}

  // <tr> ブロックを全て取得
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
    if (!TARGET_STATIONS.includes(station)) continue

    const date = cells[1] || null           // 観測日（例: "3月19日"）
    const heikinsaRaw = cells[2] || null    // 平年差（例: "-5"）
    const heikinDate = cells[3] || null     // 平年日（例: "3月24日"）

    const heikinsa = heikinsaRaw !== null && heikinsaRaw !== '' && !isNaN(Number(heikinsaRaw))
      ? Number(heikinsaRaw)
      : null

    results[station] = { date, heikinsa, heikinDate }
  }

  return results
}

async function main() {
  console.log('気象庁から桜開花データを取得中...')

  let kaikaData = {}
  let mankaiData = {}

  try {
    const kaikaHtml = await fetchHtml('https://www.data.jma.go.jp/sakura/sakura_kaika.html')
    kaikaData = parseTable(kaikaHtml)
    console.log('開花データ取得:', Object.keys(kaikaData))
  } catch (e) {
    console.warn('開花データ取得失敗:', e.message)
  }

  try {
    const mankaiHtml = await fetchHtml('https://www.data.jma.go.jp/sakura/sakura_mankai.html')
    mankaiData = parseTable(mankaiHtml)
    console.log('満開データ取得:', Object.keys(mankaiData))
  } catch (e) {
    console.warn('満開データ取得失敗:', e.message)
  }

  const stations = {}
  for (const name of TARGET_STATIONS) {
    stations[name] = {
      kaika: kaikaData[name] ?? null,
      mankai: mankaiData[name] ?? null,
    }
  }

  const now = new Date()
  const updated = now.toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo',
  })

  const output = { updated, stations }

  const outPath = join(__dirname, '../src/data/sakura_status.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log('書き出し完了:', outPath)
  console.log(JSON.stringify(output, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
