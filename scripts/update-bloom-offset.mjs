// scripts/update-bloom-offset.mjs
import { load } from 'cheerio'
import { writeFileSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../src/data/bloom-offset.json')

// ── 地点マスタ（緯度経度） ─────────────────────────────────────
const STATIONS = [
  { name: "稚内", prefecture: "北海道", lat: 45.4155, lng: 141.6730 },
  { name: "旭川", prefecture: "北海道", lat: 43.7709, lng: 142.3650 },
  { name: "留萌", prefecture: "北海道", lat: 43.9358, lng: 141.6392 },
  { name: "札幌", prefecture: "北海道", lat: 43.0621, lng: 141.3544 },
  { name: "岩見沢", prefecture: "北海道", lat: 43.1962, lng: 141.7758 },
  { name: "網走", prefecture: "北海道", lat: 44.0183, lng: 144.2730 },
  { name: "帯広", prefecture: "北海道", lat: 42.9239, lng: 143.1960 },
  { name: "釧路", prefecture: "北海道", lat: 42.9847, lng: 144.3816 },
  { name: "根室", prefecture: "北海道", lat: 43.3303, lng: 145.5831 },
  { name: "室蘭", prefecture: "北海道", lat: 42.3151, lng: 140.9737 },
  { name: "浦河", prefecture: "北海道", lat: 42.1657, lng: 142.7756 },
  { name: "函館", prefecture: "北海道", lat: 41.7688, lng: 140.7289 },
  { name: "青森", prefecture: "青森県", lat: 40.8233, lng: 140.7397 },
  { name: "むつ", prefecture: "青森県", lat: 41.2937, lng: 141.1843 },
  { name: "八戸", prefecture: "青森県", lat: 40.5124, lng: 141.4881 },
  { name: "秋田", prefecture: "秋田県", lat: 39.7186, lng: 140.1024 },
  { name: "盛岡", prefecture: "岩手県", lat: 39.7011, lng: 141.1539 },
  { name: "宮古", prefecture: "岩手県", lat: 39.6413, lng: 141.9576 },
  { name: "大船渡", prefecture: "岩手県", lat: 39.0817, lng: 141.7100 },
  { name: "仙台", prefecture: "宮城県", lat: 38.2688, lng: 140.8721 },
  { name: "山形", prefecture: "山形県", lat: 38.2553, lng: 140.3397 },
  { name: "酒田", prefecture: "山形県", lat: 38.9139, lng: 139.8369 },
  { name: "福島", prefecture: "福島県", lat: 37.7608, lng: 140.4748 },
  { name: "小名浜", prefecture: "福島県", lat: 36.9448, lng: 140.9038 },
  { name: "水戸", prefecture: "茨城県", lat: 36.3716, lng: 140.4714 },
  { name: "宇都宮", prefecture: "栃木県", lat: 36.5499, lng: 139.8726 },
  { name: "前橋", prefecture: "群馬県", lat: 36.3917, lng: 139.0608 },
  { name: "熊谷", prefecture: "埼玉県", lat: 36.1469, lng: 139.3885 },
  { name: "銚子", prefecture: "千葉県", lat: 35.7344, lng: 140.8508 },
  { name: "東京", prefecture: "東京都", lat: 35.6895, lng: 139.6917 },
  { name: "大島", prefecture: "東京都", lat: 34.7568, lng: 139.3577 },
  { name: "八丈島", prefecture: "東京都", lat: 33.1139, lng: 139.7870 },
  { name: "横浜", prefecture: "神奈川県", lat: 35.4478, lng: 139.6425 },
  { name: "新潟", prefecture: "新潟県", lat: 37.9162, lng: 139.0365 },
  { name: "富山", prefecture: "富山県", lat: 36.6953, lng: 137.2115 },
  { name: "金沢", prefecture: "石川県", lat: 36.5611, lng: 136.6561 },
  { name: "輪島", prefecture: "石川県", lat: 37.3900, lng: 136.8991 },
  { name: "福井", prefecture: "福井県", lat: 36.0652, lng: 136.2217 },
  { name: "甲府", prefecture: "山梨県", lat: 35.6641, lng: 138.5685 },
  { name: "長野", prefecture: "長野県", lat: 36.6519, lng: 138.1810 },
  { name: "飯田", prefecture: "長野県", lat: 35.5153, lng: 137.8218 },
  { name: "静岡", prefecture: "静岡県", lat: 34.9756, lng: 138.3831 },
  { name: "浜松", prefecture: "静岡県", lat: 34.7026, lng: 137.7325 },
  { name: "名古屋", prefecture: "愛知県", lat: 35.1709, lng: 136.8816 },
  { name: "津", prefecture: "三重県", lat: 34.7303, lng: 136.5086 },
  { name: "尾鷲", prefecture: "三重県", lat: 34.0726, lng: 136.1910 },
  { name: "岐阜", prefecture: "岐阜県", lat: 35.3916, lng: 136.7223 },
  { name: "彦根", prefecture: "滋賀県", lat: 35.2762, lng: 136.2458 },
  { name: "京都", prefecture: "京都府", lat: 35.0116, lng: 135.7681 },
  { name: "大阪", prefecture: "大阪府", lat: 34.6863, lng: 135.5200 },
  { name: "神戸", prefecture: "兵庫県", lat: 34.6913, lng: 135.1830 },
  { name: "奈良", prefecture: "奈良県", lat: 34.6851, lng: 135.8327 },
  { name: "和歌山", prefecture: "和歌山県", lat: 34.2260, lng: 135.1675 },
  { name: "鳥取", prefecture: "鳥取県", lat: 35.5011, lng: 134.2377 },
  { name: "松江", prefecture: "島根県", lat: 35.4703, lng: 133.0505 },
  { name: "岡山", prefecture: "岡山県", lat: 34.6618, lng: 133.9349 },
  { name: "広島", prefecture: "広島県", lat: 34.3963, lng: 132.4594 },
  { name: "下関", prefecture: "山口県", lat: 33.9511, lng: 130.9411 },
  { name: "徳島", prefecture: "徳島県", lat: 34.0658, lng: 134.5593 },
  { name: "高松", prefecture: "香川県", lat: 34.3401, lng: 134.0434 },
  { name: "松山", prefecture: "愛媛県", lat: 33.8416, lng: 132.7657 },
  { name: "高知", prefecture: "高知県", lat: 33.5597, lng: 133.5311 },
  { name: "福岡", prefecture: "福岡県", lat: 33.6063, lng: 130.4183 },
  { name: "佐賀", prefecture: "佐賀県", lat: 33.2635, lng: 130.3009 },
  { name: "長崎", prefecture: "長崎県", lat: 32.7502, lng: 129.8777 },
  { name: "熊本", prefecture: "熊本県", lat: 32.8031, lng: 130.7079 },
  { name: "大分", prefecture: "大分県", lat: 33.2382, lng: 131.6126 },
  { name: "宮崎", prefecture: "宮城県", lat: 31.9111, lng: 131.4239 },
  { name: "鹿児島", prefecture: "鹿児島県", lat: 31.5602, lng: 130.5581 },
  { name: "那覇", prefecture: "沖縄県", lat: 26.2124, lng: 127.6809 },
  { name: "名護", prefecture: "沖縄県", lat: 26.5921, lng: 127.9774 },
  { name: "石垣島", prefecture: "沖縄県", lat: 24.3402, lng: 124.1534 },
]

// ── 日付パース ─────────────────────────────────────────────────
// normalDate: "03-24" → mm-dd
// bloomDate cell text: "3/20" or "3月20日" or "-" or "未"
function parseObservedDate(text, year) {
  if (!text || text === '-' || text === '未' || text.trim() === '') return null
  // "3/20" format
  const slash = text.match(/^(\d+)\/(\d+)$/)
  if (slash) return `${year}-${String(+slash[1]).padStart(2,'0')}-${String(+slash[2]).padStart(2,'0')}`
  // "3月20日"
  const ja = text.match(/(\d+)月(\d+)日/)
  if (ja) return `${year}-${String(+ja[1]).padStart(2,'0')}-${String(+ja[2]).padStart(2,'0')}`
  return null
}

// normalDate: "03-24" (mm-dd)
function parseNormalDate(text) {
  if (!text || text === '-') return null
  const m = text.match(/^(\d+)-(\d+)$/)
  if (m) return `${m[1]}-${m[2]}`
  // "3/24"
  const slash = text.match(/^(\d+)\/(\d+)$/)
  if (slash) return `${String(+slash[1]).padStart(2,'0')}-${String(+slash[2]).padStart(2,'0')}`
  return null
}

function calcOffsetDays(observedDate, normalDate, year) {
  if (!observedDate || !normalDate) return null
  // normalDate: "MM-DD", observedDate: "YYYY-MM-DD"
  const obs = new Date(observedDate)
  const [nm, nd] = normalDate.split('-').map(Number)
  const norm = new Date(year, nm - 1, nd)
  const diffMs = obs - norm
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

// ── HTMLフェッチ ──────────────────────────────────────────────
async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; sakura-app-updater/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = await res.arrayBuffer()
  // JMA pages may be Shift-JIS encoded
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let text = decoder.decode(buf)
  // If garbled, try Shift-JIS via a workaround (decode as latin-1 and recode)
  if (text.includes('\uFFFD') || !text.includes('開花')) {
    const decoder2 = new TextDecoder('shift-jis', { fatal: false })
    text = decoder2.decode(buf)
  }
  return text
}

// ── テーブルパース ────────────────────────────────────────────
// Returns Map<stationName, { bloomDate, normalBloomDate }>
function parseKaikaTable(html, year) {
  const $ = load(html)
  const result = new Map()

  // JMA table usually has: 地点 | 平年値 | 昨年 | 今年
  // Look for the main data table
  $('table').each((_, table) => {
    const rows = $(table).find('tr')
    if (rows.length < 3) return

    // Find header row to identify columns
    let stationCol = 0, normalCol = -1, thisYearCol = -1
    const headerRow = $(rows[0]).find('th, td')
    headerRow.each((i, el) => {
      const text = $(el).text().trim()
      if (text.includes('平年') || text.includes('平均')) normalCol = i
      if (text.includes(String(year)) || text.includes('今年')) thisYearCol = i
    })

    if (normalCol === -1 && thisYearCol === -1) return // Not the right table

    // Default: last col is this year, second-to-last is last year, before that is normal
    const allRows = rows.toArray()
    allRows.slice(1).forEach(row => {
      const cells = $(row).find('td')
      if (cells.length < 2) return
      const stationText = $(cells[0]).text().trim()
      const station = STATIONS.find(s => stationText.includes(s.name) || s.name === stationText)
      if (!station) return

      const numCells = cells.length
      // Try to find data: typically [prefecture?, station, normal, lastYear, thisYear] or similar
      // Flexible extraction: get last cell as thisYear, look for normal pattern MM/DD
      const lastCellText = $(cells[numCells - 1]).text().trim()
      const secondLastText = numCells >= 2 ? $(cells[numCells - 2]).text().trim() : ''
      const thirdLastText = numCells >= 3 ? $(cells[numCells - 3]).text().trim() : ''

      const observed = parseObservedDate(lastCellText, year)
                    ?? parseObservedDate(secondLastText, year)
      const normal = parseNormalDate(thirdLastText)
                  ?? parseNormalDate(secondLastText)
                  ?? parseNormalDate(lastCellText)

      if (!result.has(station.name)) {
        result.set(station.name, { bloomDate: observed, normalBloomDate: normal })
      }
    })
  })

  return result
}

// ── メイン ────────────────────────────────────────────────────
async function main() {
  const year = new Date().getFullYear()
  console.log(`Fetching JMA sakura data for ${year}...`)

  let kaikaData = new Map()
  let manKaiData = new Map()

  // Fetch 開花日 page
  try {
    const kaikaHtml = await fetchPage('https://www.data.jma.go.jp/sakura/data/sakura_kaika.html')
    kaikaData = parseKaikaTable(kaikaHtml, year)
    console.log(`Parsed ${kaikaData.size} stations from 開花日 page`)
  } catch (e) {
    console.warn('Failed to fetch 開花日 page:', e.message)
  }

  // Fetch 満開日 page
  try {
    const manKaiHtml = await fetchPage('https://www.data.jma.go.jp/sakura/data/sakura004_07.html')
    manKaiData = parseKaikaTable(manKaiHtml, year)
    console.log(`Parsed ${manKaiData.size} stations from 満開日 page`)
  } catch (e) {
    console.warn('Failed to fetch 満開日 page:', e.message)
  }

  // Build output
  const offsets = STATIONS.map(station => {
    const kaika = kaikaData.get(station.name)
    const mankai = manKaiData.get(station.name)

    const bloomDate = kaika?.bloomDate ?? null
    const fullBloomDate = mankai?.bloomDate ?? null
    const normalBloomDate = kaika?.normalBloomDate ?? null
    const normalFullBloomDate = mankai?.normalBloomDate ?? null

    const offsetDays = calcOffsetDays(bloomDate, normalBloomDate, year)
    const fullBloomOffsetDays = calcOffsetDays(fullBloomDate, normalFullBloomDate, year)

    let status = 'no_data'
    if (bloomDate) status = 'observed'
    else if (normalBloomDate) status = 'not_yet'

    return {
      station: station.name,
      prefecture: station.prefecture,
      lat: station.lat,
      lng: station.lng,
      bloomDate,
      fullBloomDate,
      normalBloomDate,
      normalFullBloomDate,
      offsetDays,
      fullBloomOffsetDays,
      status,
    }
  })

  // If we got no data at all, keep the existing file
  if (kaikaData.size === 0 && manKaiData.size === 0) {
    console.warn('No data fetched from JMA — keeping existing bloom-offset.json')
    return
  }

  const output = {
    updatedAt: new Date().toISOString().slice(0, 10),
    season: year,
    offsets,
  }

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2))
  console.log(`✓ Updated ${OUT_PATH} with ${offsets.filter(o => o.status === 'observed').length} observed stations`)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
