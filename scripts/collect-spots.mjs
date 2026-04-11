#!/usr/bin/env node
/**
 * collect-spots.mjs — 桜スポットデータベース構築
 *
 * Sources:
 *   1. Walker+ 花見 (JSON-LD, 全10地域)
 *   2. さくら名所100選 (Walker+ ss0001)
 *   3. 国指定天然記念物 (Wikipedia)
 *   4. 既存 spots.json との統合
 *
 * Note: じゃらん は URL 変更で消滅、jorudan は JS レンダリング＋Bot保護のため除外
 *
 * Usage:
 *   node scripts/collect-spots.mjs              # 全量
 *   node scripts/collect-spots.mjs --resume     # 中断再開
 *   node scripts/collect-spots.mjs --dry-run    # スクレイピングのみ（保存なし）
 *   node scripts/collect-spots.mjs --enrich-only # 既存スポットの品種情報を強化
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// ── Paths ──────────────────────────────────────────────────────────────────
const VARIETIES_PATH = path.join(ROOT, 'src/data/varieties.json')
const SPOTS_PATH     = path.join(ROOT, 'src/data/spots.json')
const PROGRESS_PATH  = path.join(__dirname, 'spot_progress.json')
const REPORT_PATH    = path.join(__dirname, 'spot_collection_report.csv')

// ── CLI Args ───────────────────────────────────────────────────────────────
const args           = process.argv.slice(2)
const OPT_RESUME     = args.includes('--resume')
const OPT_DRY_RUN    = args.includes('--dry-run')
const OPT_ENRICH     = args.includes('--enrich-only')

const UA = 'SakuraZukan/1.0 (sakura-zukan app; educational non-commercial)'

// ── Walker+ 地域コード ─────────────────────────────────────────────────────
const WALKER_REGIONS = [
  { code: 'ar0100', name: '北海道',     prefs: ['北海道'] },
  { code: 'ar0200', name: '東北',       prefs: ['青森県','岩手県','宮城県','秋田県','山形県','福島県'] },
  { code: 'ar0300', name: '関東',       prefs: ['茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県'] },
  { code: 'ar0400', name: '甲信越',     prefs: ['新潟県','山梨県','長野県'] },
  { code: 'ar0500', name: '北陸',       prefs: ['富山県','石川県','福井県'] },
  { code: 'ar0600', name: '東海',       prefs: ['岐阜県','静岡県','愛知県','三重県'] },
  { code: 'ar0700', name: '関西',       prefs: ['滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県'] },
  { code: 'ar0800', name: '中国',       prefs: ['鳥取県','島根県','岡山県','広島県','山口県'] },
  { code: 'ar0900', name: '四国',       prefs: ['徳島県','香川県','愛媛県','高知県'] },
  { code: 'ar1000', name: '九州・沖縄', prefs: ['福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'] },
]

// ── Utilities ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchWithRetry(url, opts = {}, retries = 3) {
  const headers = { 'User-Agent': UA, ...opts.headers }
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers,
        signal: AbortSignal.timeout(20000),
      })
      if (res.ok) return res
      if (res.status === 429) { await sleep(5000 * (i + 1)); continue }
      if (res.status >= 500)  { await sleep(2000 * (i + 1)); continue }
      return res
    } catch (e) {
      if (i === retries - 1) throw e
      await sleep(2000 * (i + 1))
    }
  }
  return null
}

async function fetchText(url) {
  const res = await fetchWithRetry(url)
  if (!res?.ok) return null
  return res.text()
}

async function fetchJson(url) {
  const res = await fetchWithRetry(url)
  if (!res?.ok) return null
  try { return res.json() } catch { return null }
}

/** Walker+ 詳細URLのIDを取得 */
function walkerUrlToId(url) {
  const m = url.match(/\/detail\/(ar\d+e\d+)\//)
  return m ? m[1] : null
}

/** スポット名からスラグIDを生成 */
function generateSpotId(name, prefecture) {
  // 既に walkerID があればそちらを使う
  const kana = name
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '-')
  const slug = kana
    .replace(/[^\w\u3000-\u9fff\uFF00-\uFFEF-]/g, '')
    .slice(0, 30)
  // ASCII文字のみのスラグ生成は別途必要な場合はkanaマッピングを入れる
  // ここでは "名前のハッシュ" ベースのIDを使う
  const hash = [...(name + prefecture)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 5381)
    .toString(36).slice(0, 6)
  return `spot-${hash}`
}

/** スポット名正規化（重複判定用） */
function normalizeName(name) {
  return name
    .replace(/\s/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, '')
    .toLowerCase()
}

// ── 品種逆引きインデックス ─────────────────────────────────────────────────
function buildVarietyIndex(varieties) {
  const index = new Map()   // 読み仮名/名前 → id
  for (const v of varieties) {
    const keys = [
      v.name,
      v.reading,
      ...(v.aliases ?? []),
    ].filter(Boolean)
    for (const k of keys) {
      index.set(normalizeName(k), v.id)
    }
  }
  return index
}

/** テキストから品種IDリストを抽出 */
function resolveVarieties(text, varietyIndex) {
  if (!text) return { ids: [], raw: [] }

  // Walker+の末尾ゴミ除去: "など。XXXのその他の詳細情報はこちら"
  let cleaned = text
    .replace(/など[。．].*$/g, '')
    .replace(/などが見られる.*$/g, '')
    .replace(/のその他の詳細.*$/g, '')
    .replace(/詳細情報はこちら.*$/g, '')
    .replace(/（[^）]*）/g, '')   // 全角括弧内除去
    .replace(/\([^)]*\)/g, '')    // 半角括弧内除去

  // 「ソメイヨシノ、ヤマザクラ」のようなカンマ区切りを分割
  const parts = cleaned
    .split(/[、,・\s　]+/)
    .map(s => s
      .replace(/^[・\-－\s]+/, '')   // 先頭記号除去
      .replace(/[など等]+$/, '')      // 末尾「など」「等」除去
      .trim()
    )
    .filter(s => s.length >= 2)

  const ids = []
  const raw = []
  for (const part of parts) {
    const norm = normalizeName(part)
    const id = varietyIndex.get(norm)
    if (id) {
      if (!ids.includes(id)) ids.push(id)
    } else if (part.length >= 2 && /[桜花さくら]/.test(part)) {
      raw.push(part)
    }
  }
  return { ids, raw }
}

// ── カテゴリ分類 ───────────────────────────────────────────────────────────
function guessCategory(name, description = '') {
  const text = name + description
  if (/神社|大社|宮|祠/.test(text)) return 'shrine'
  if (/寺|院|堂|仁王/.test(text)) return 'temple'
  if (/城|城址|城跡|城郭/.test(text)) return 'castle'
  if (/山$|嶺|岳|峠/.test(text)) return 'mountain'
  if (/川|堤|河川|土手|用水/.test(text)) return 'river'
  if (/湖|池|沼|ダム/.test(text)) return 'lake'
  if (/一本桜|古木|銘木|御神木/.test(text)) return 'one_tree'
  if (/並木|街道|道/.test(text)) return 'road'
  if (/植物園|庭園|公苑|御苑|農場/.test(text)) return 'garden'
  if (/公園|緑地|緑道/.test(text)) return 'park'
  return 'other'
}

/** featuresタグを推定 */
function guessFeatures(name, description, is100sen, isMonument) {
  const text = name + (description ?? '')
  const tags = []
  if (is100sen) tags.push('さくら名所100選')
  if (isMonument) tags.push('天然記念物')
  if (/ライトアップ/.test(text)) tags.push('ライトアップ')
  if (/夜桜/.test(text)) tags.push('夜桜')
  if (/有料/.test(text)) tags.push('有料')
  if (/無料/.test(text)) tags.push('無料')
  if (/\d{2,}品種/.test(text)) tags.push('多品種')
  if (/一本桜|古木/.test(text)) tags.push('一本桜')
  if (/並木/.test(text)) tags.push('桜並木')
  if (/しだれ|枝垂/.test(text)) tags.push('枝垂れ桜')
  if (/駐車場/.test(text)) tags.push('駐車場あり')
  if (/河津桜|カワヅザクラ/.test(text)) tags.push('河津桜')
  if (/桜まつり|桜祭/.test(text)) tags.push('桜祭り')
  if (/屋台/.test(text)) tags.push('屋台あり')
  return [...new Set(tags)]
}

// ── Walker+ Scraper ────────────────────────────────────────────────────────

/** Walker+ JSON-LDを解析して構造化データを取得
 *  Walker+ は [Event, FAQPage] の配列形式で1つの<script>に入れている
 */
function parseWalkerJsonLd(html) {
  const jsonldPat = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  const results = { event: null, faq: null }
  let m
  while ((m = jsonldPat.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1])
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const obj of items) {
        if (obj['@type'] === 'Event')   results.event = obj
        if (obj['@type'] === 'FAQPage') results.faq   = obj
      }
    } catch {}
  }
  return results
}

/** Walker+ 詳細ページから地図ページで lat/lng を取得 */
async function fetchWalkerCoords(detailUrl) {
  await sleep(1500)
  const mapUrl = detailUrl.replace(/\/$/, '') + '/map.html'
  const html = await fetchText(mapUrl)
  if (!html) return { lat: null, lng: null }
  const m = html.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return { lat: null, lng: null }
}

/** Walker+ 詳細ページ1件を処理 */
async function scrapeWalkerDetail(detailUrl, varietyIndex, is100sen = false) {
  await sleep(1500)
  const html = await fetchText(`https://hanami.walkerplus.com${detailUrl}`)
  if (!html) return null

  const { event, faq } = parseWalkerJsonLd(html)
  if (!event) return null

  const name      = event.name ?? ''
  const loc       = event.location ?? {}
  const address   = loc.address ?? {}
  const prefecture = address.addressRegion ?? ''
  const city       = address.addressLocality ?? ''
  const fullAddr   = `${prefecture}${city}`
  const description = event.description ?? ''
  const imageUrl   = event.image ?? null

  // FAQ から品種情報を抽出
  let varietyText = ''
  let hasLightup = false
  let hasParking = false
  let peakMonth = ''
  for (const qa of faq?.mainEntity ?? []) {
    const q = qa.name ?? ''
    const a = (qa.acceptedAnswer?.text ?? '').replace(/<[^>]+>/g, '')
    if (/種類|品種/.test(q)) varietyText = a
    if (/ライトアップ/.test(q) && /実施/.test(a)) hasLightup = true
    if (/駐車場/.test(q) && /あり/.test(a)) hasParking = true
    if (/見頃|時期/.test(q)) peakMonth = a.replace(/\n/g, ' ').slice(0, 60)
  }

  const { ids: varietyIds, raw: varietyRaw } = resolveVarieties(varietyText, varietyIndex)

  // 座標取得
  const { lat, lng } = await fetchWalkerCoords(`https://hanami.walkerplus.com${detailUrl}`)

  // 人気度
  let popularity = 2
  if (is100sen) popularity = 4

  // featuresタグ
  const features = guessFeatures(name, description, is100sen, false)
  if (hasLightup && !features.includes('ライトアップ')) features.push('ライトアップ')
  if (hasParking && !features.includes('駐車場あり')) features.push('駐車場あり')

  // 本数テキストから varietyCount 推定
  const countMatch = description.match(/(\d+)[,，]?(\d*)本/)
  const treeCount = countMatch ? parseInt(countMatch[1] + (countMatch[2] ?? '')) : null

  // 品種数テキスト
  const vcountMatch = description.match(/(\d+)品種/)
  const varietyCount = vcountMatch ? parseInt(vcountMatch[1]) : (varietyIds.length > 0 ? varietyIds.length : null)

  return {
    _walkerUrl: `https://hanami.walkerplus.com${detailUrl}`,
    _walkerId: walkerUrlToId(detailUrl),
    name,
    prefecture,
    city,
    address: fullAddr,
    lat,
    lng,
    varieties: varietyIds,
    _varietyRaw: varietyRaw,
    varietyCount,
    varietyNote: treeCount ? `約${treeCount}本` : null,
    peakMonth: peakMonth.slice(0, 40),
    popularity,
    category: guessCategory(name, description),
    features,
    sources: ['walker'],
    imageUrl: imageUrl?.replace(/\?.*/, '') ?? null,
    is100sen,
  }
}

/** Walker+ 一覧ページからdetailリンクを取得 */
function extractDetailLinks(html) {
  const links = new Set()
  const pat = /href="(\/detail\/ar\d+e\d+\/)"/g
  let m
  while ((m = pat.exec(html)) !== null) links.add(m[1])
  return [...links]
}

/** Walker+ 地域の全スポットを収集 */
async function scrapeWalkerRegion(region, varietyIndex, progress, is100senIds) {
  const spots = []
  const baseUrl = `https://hanami.walkerplus.com/list/${region.code}/`

  console.log(`\n  [Walker+] ${region.name} (${region.code})`)

  // 全ページを巡回
  let page = 1
  const allDetailLinks = new Set()

  while (true) {
    const url = page === 1 ? baseUrl : `${baseUrl}${page}.html`
    await sleep(1500)
    const html = await fetchText(url)
    if (!html) { console.log(`    p${page}: fetch失敗`); break }

    const links = extractDetailLinks(html)
    if (links.length === 0) {
      console.log(`    p${page}: detailリンクなし → 終了`)
      break
    }

    for (const l of links) allDetailLinks.add(l)
    console.log(`    p${page}: ${links.length}件 (累計${allDetailLinks.size}件)`)
    page++
    if (page > 100) break  // 安全上限
  }

  // 各詳細ページを処理
  let i = 0
  for (const link of allDetailLinks) {
    i++
    const walkerId = walkerUrlToId(link)

    // 再開時スキップ
    if (progress.walker?.[walkerId]?.done) {
      spots.push(progress.walker[walkerId].spot)
      continue
    }

    process.stdout.write(`    詳細 ${i}/${allDetailLinks.size}: ${link.slice(0, 40)}...`)
    const is100sen = is100senIds.has(walkerId)
    const spot = await scrapeWalkerDetail(link, varietyIndex, is100sen)

    if (spot) {
      process.stdout.write(` ✓ ${spot.name}\n`)
      spots.push(spot)
      if (!OPT_DRY_RUN) {
        if (!progress.walker) progress.walker = {}
        progress.walker[walkerId] = { done: true, spot }
        await fs.promises.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2))
      }
    } else {
      process.stdout.write(` ✗\n`)
    }
  }

  return spots
}

// ── さくら名所100選 ────────────────────────────────────────────────────────

/** Walker+ ss0001 から100選のwalkerIDセットを取得 */
async function fetch100senIds() {
  const ids = new Set()
  let page = 1

  while (true) {
    const url = page === 1
      ? 'https://hanami.walkerplus.com/list/ss0001/'
      : `https://hanami.walkerplus.com/list/ss0001/${page}.html`
    await sleep(1500)
    const html = await fetchText(url)
    if (!html) break

    const links = extractDetailLinks(html)
    if (links.length === 0) break

    for (const l of links) {
      const id = walkerUrlToId(l)
      if (id) ids.add(id)
    }

    // 次ページがあるか確認
    const hasNext = new RegExp(`/list/ss0001/${page + 1}\\.html`).test(html)
    if (!hasNext) break
    page++
  }

  console.log(`  さくら名所100選: ${ids.size}件取得`)
  return ids
}

// ── 天然記念物 (Wikipedia) ─────────────────────────────────────────────────

async function scrapeMonuments(varietyIndex) {
  console.log('\n  [天然記念物] Wikipedia から取得...')
  const spots = []

  // Wikipedia API で「桜 国指定天然記念物」の記事リストを取得
  const searchUrl =
    'https://ja.wikipedia.org/w/api.php?action=query&list=categorymembers' +
    '&cmtitle=Category:%E6%97%A5%E6%9C%AC%E3%81%AE%E5%A4%A9%E7%84%B6%E8%A8%98%E5%BF%B5%E7%89%A9_%28%E6%A4%8D%E7%89%A9%29' +
    '&cmlimit=200&cmtype=page&format=json&origin=*'

  await sleep(1000)
  const data = await fetchJson(searchUrl)
  const pages = data?.query?.categorymembers ?? []
  console.log(`    カテゴリメンバー: ${pages.length}件`)

  for (const page of pages) {
    if (!/桜|ザクラ|さくら/.test(page.title)) continue
    await sleep(1000)

    // Wikipedia page summary を取得
    const summaryUrl =
      `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
    const summary = await fetchJson(summaryUrl)
    if (!summary) continue

    const desc = summary.extract ?? ''
    const name = summary.title ?? page.title

    // 都道府県を抽出
    const prefMatch = desc.match(/(北海道|[^\s]{2,3}[都道府県])/)
    const prefecture = prefMatch ? prefMatch[1] : ''

    const { lat, lng } = summary.coordinates
      ? { lat: summary.coordinates.lat, lng: summary.coordinates.lon }
      : { lat: null, lng: null }

    const { ids } = resolveVarieties(name + ' ' + desc, varietyIndex)

    const spot = {
      name,
      prefecture,
      city: '',
      address: prefecture,
      lat,
      lng,
      varieties: ids,
      _varietyRaw: [],
      varietyCount: null,
      varietyNote: null,
      peakMonth: '',
      popularity: 3,
      category: 'one_tree',
      features: ['天然記念物', '一本桜'],
      sources: ['monument'],
      imageUrl: summary.thumbnail?.source ?? null,
      is100sen: false,
    }
    spots.push(spot)
    console.log(`    ${name} (${prefecture})`)
  }

  console.log(`  天然記念物: ${spots.length}件`)
  return spots
}

// ── Geocoding (Nominatim) ─────────────────────────────────────────────────

const geocodeCache = new Map()

async function geocode(address) {
  if (!address) return { lat: null, lng: null }
  if (geocodeCache.has(address)) return geocodeCache.get(address)

  await sleep(1200)   // Nominatim: 1 req/sec 制限
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=jp`
  const data = await fetchJson(url)
  const result = data?.[0]
    ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    : { lat: null, lng: null }

  geocodeCache.set(address, result)
  return result
}

// ── 品種情報の強化 ─────────────────────────────────────────────────────────

/** 品種リストが公開されている主要スポットの強化データ */
const ENRICH_TARGETS = [
  {
    nameMatch: '新宿御苑',
    url: 'https://ja.wikipedia.org/w/api.php?action=query&titles=%E6%96%B0%E5%AE%BF%E5%BE%A1%E8%8B%91&prop=revisions&rvprop=content&format=json&origin=*',
    varietyCount: 65,
    features: ['さくら名所100選', '多品種', '有料'],
    popularity: 5,
  },
  {
    nameMatch: '大阪造幣局',
    varietyCount: 140,
    features: ['多品種'],
    popularity: 5,
  },
  {
    nameMatch: '多摩森林科学園',
    varietyCount: 250,
    features: ['多品種'],
    popularity: 4,
  },
  {
    nameMatch: '弘前公園',
    varietyCount: 50,
    features: ['さくら名所100選', '多品種', '有料', '桜祭り', '屋台あり'],
    popularity: 5,
  },
  {
    nameMatch: '平野神社',
    varietyCount: 60,
    features: ['多品種'],
    popularity: 4,
  },
  {
    nameMatch: '松前公園',
    varietyCount: 250,
    features: ['さくら名所100選', '多品種'],
    popularity: 5,
  },
  {
    nameMatch: '高遠城址公園',
    features: ['さくら名所100選', '有料', '桜祭り'],
    popularity: 5,
  },
  {
    nameMatch: '吉野山',
    features: ['さくら名所100選', '多品種'],
    popularity: 5,
  },
  {
    nameMatch: '千鳥ヶ淵',
    features: ['さくら名所100選', '夜桜', 'ライトアップ'],
    popularity: 5,
  },
]

function enrichSpots(spots) {
  for (const spot of spots) {
    for (const target of ENRICH_TARGETS) {
      if (!spot.name.includes(target.nameMatch)) continue
      if (target.varietyCount) spot.varietyCount = target.varietyCount
      if (target.popularity)   spot.popularity   = target.popularity
      if (target.features) {
        for (const f of target.features) {
          if (!spot.features.includes(f)) spot.features.push(f)
        }
      }
    }
  }
  return spots
}

// ── 既存 spots.json との統合 ───────────────────────────────────────────────

function migrateExistingSpot(old) {
  return {
    id: old.id,
    name: old.name,
    prefecture: old.prefecture ?? '',
    city: '',
    address: old.prefecture ?? '',
    lat: old.lat ?? null,
    lng: old.lng ?? null,
    varieties: [],
    _varietyRaw: old.variety ? [old.variety] : [],
    varietyCount: null,
    varietyNote: old.variety ?? null,
    peakMonth: old.peakWeeks?.join('・') ?? '',
    popularity: old.popularity ?? 2,
    category: guessCategory(old.name),
    features: [],
    sources: ['existing'],
    imageUrl: old.imageUrl ?? null,
    // 既存フィールド保持
    _legacy: {
      travelTime: old.travelTime,
      within1hour: old.within1hour,
      inMetro: old.inMetro,
      comment: old.comment,
      peakWeeks: old.peakWeeks,
    },
    is100sen: false,
  }
}

// ── スポット重複排除 ───────────────────────────────────────────────────────

function deduplicateSpots(spots) {
  const seen  = new Map()  // "normName+pref" → index
  const result = []

  for (const spot of spots) {
    const key = normalizeName(spot.name) + '|' + (spot.prefecture ?? '')
    if (seen.has(key)) {
      // マージ: ソースリストを統合、情報を充実させる
      const existing = result[seen.get(key)]
      existing.sources = [...new Set([...existing.sources, ...spot.sources])]
      if (!existing.lat && spot.lat) { existing.lat = spot.lat; existing.lng = spot.lng }
      if (!existing.varietyCount && spot.varietyCount) existing.varietyCount = spot.varietyCount
      if (spot.varieties.length > existing.varieties.length) existing.varieties = spot.varieties
      for (const f of spot.features) {
        if (!existing.features.includes(f)) existing.features.push(f)
      }
      if (spot.is100sen) existing.is100sen = true
    } else {
      seen.set(key, result.length)
      result.push({ ...spot })
    }
  }
  return result
}

// ── 最終スキーマ変換 ───────────────────────────────────────────────────────

let _idCounter = 0

function finalizeSpot(raw, varietyIndex) {
  // _varietyRaw を再解決（品種逆引き）
  const { ids: extraIds } = resolveVarieties(raw._varietyRaw?.join('、'), varietyIndex)
  const allIds = [...new Set([...raw.varieties, ...extraIds])]

  // ID 生成
  const id = raw._walkerId
    ? `walker-${raw._walkerId}`
    : (raw.id ?? generateSpotId(raw.name, raw.prefecture))

  const spot = {
    id,
    name: raw.name,
    prefecture: raw.prefecture,
    city: raw.city ?? '',
    address: raw.address ?? '',
    lat: raw.lat,
    lng: raw.lng,
    varieties: allIds,
    varietyCount: raw.varietyCount ?? (allIds.length > 0 ? allIds.length : null),
    varietyNote: raw.varietyNote ?? null,
    peakMonth: raw.peakMonth ?? '',
    popularity: raw.popularity ?? 2,
    category: raw.category ?? 'other',
    features: raw.features ?? [],
    sources: raw.sources ?? [],
    imageUrl: raw.imageUrl ?? null,
  }

  // 既存エントリのレガシーフィールドを保持
  if (raw._legacy) {
    if (raw._legacy.travelTime)  spot.travelTime  = raw._legacy.travelTime
    if (raw._legacy.within1hour != null) spot.within1hour = raw._legacy.within1hour
    if (raw._legacy.inMetro     != null) spot.inMetro     = raw._legacy.inMetro
    if (raw._legacy.comment)     spot.comment     = raw._legacy.comment
    if (raw._legacy.peakWeeks)   spot.peakWeeks   = raw._legacy.peakWeeks
  }

  return spot
}

// ── 検証 ──────────────────────────────────────────────────────────────────

function validate(spots, s100senIds) {
  const errors = []

  // 1. 重複ID
  const ids = spots.map(s => s.id)
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupIds.length) errors.push(`重複ID: ${dupIds.join(', ')}`)

  // 2. 総スポット数
  if (spots.length < 500) errors.push(`スポット数不足: ${spots.length} < 500`)

  // 3. lat/lng 欠損
  const noCoords = spots.filter(s => !s.lat || !s.lng)
  if (noCoords.length > 0) {
    console.warn(`  ⚠ 座標未設定: ${noCoords.length}件`)
  }

  // 4. 47都道府県カバレッジ
  const PREFS_47 = [
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
    '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
    '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
    '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
  ]
  const coveredPrefs = new Set(spots.map(s => s.prefecture))
  const missingPrefs = PREFS_47.filter(p => !coveredPrefs.has(p))
  if (missingPrefs.length) errors.push(`都道府県カバレッジ不足: ${missingPrefs.join(', ')}`)

  // 5. さくら名所100選のカバレッジ（Walker+ IDベース）
  const spotIds = new Set(spots.map(s => s.id))
  const walkerIds = new Set(spots.map(s => s.id).filter(id => id.startsWith('walker-')))
  const s100senCovered = [...s100senIds].filter(id => walkerIds.has(`walker-${id}`)).length
  if (s100senCovered < 90) {
    errors.push(`さくら名所100選カバレッジ不足: ${s100senCovered}/${s100senIds.size}`)
  }

  return { errors, coveredPrefs: PREFS_47.length - missingPrefs.length, s100senCovered }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  桜スポット収集スクリプト v2         ║')
  console.log('╚══════════════════════════════════════╝')
  if (OPT_DRY_RUN)  console.log('  モード: ドライラン')
  if (OPT_RESUME)   console.log('  モード: 再開')
  if (OPT_ENRICH)   console.log('  モード: 品種強化のみ')

  // データ読み込み
  const varieties = JSON.parse(await fs.promises.readFile(VARIETIES_PATH, 'utf8'))
  const varietyIndex = buildVarietyIndex(varieties)
  console.log(`品種インデックス: ${varietyIndex.size}エントリ`)

  let existingSpots = []
  try {
    existingSpots = JSON.parse(await fs.promises.readFile(SPOTS_PATH, 'utf8'))
    console.log(`既存スポット: ${existingSpots.length}件`)
  } catch { console.log('既存 spots.json なし') }

  // 進捗読み込み
  let progress = {}
  if (OPT_RESUME) {
    try {
      progress = JSON.parse(await fs.promises.readFile(PROGRESS_PATH, 'utf8'))
      const done = Object.keys(progress.walker ?? {}).length
      console.log(`進捗ファイル: Walker+ ${done}件完了済み`)
    } catch {}
  }

  if (OPT_ENRICH) {
    // 品種強化のみ
    const spots = existingSpots.map(s => ({
      ...s,
      features: s.features ?? [],
      sources: s.sources ?? ['existing'],
    }))
    enrichSpots(spots)
    if (!OPT_DRY_RUN) {
      await fs.promises.writeFile(SPOTS_PATH, JSON.stringify(spots, null, 2))
      console.log(`spots.json 更新: ${spots.length}件`)
    }
    return
  }

  // ── フェーズ1: さくら名所100選IDを先取得 ──────────────────────────────
  console.log('\n═ フェーズ1: さくら名所100選IDを取得...')
  const s100senIds = progress.s100senIds
    ? new Set(progress.s100senIds)
    : await fetch100senIds()
  if (!progress.s100senIds && !OPT_DRY_RUN) {
    progress.s100senIds = [...s100senIds]
    await fs.promises.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2))
  }

  // ── フェーズ2: Walker+ 全地域 ─────────────────────────────────────────
  console.log('\n═ フェーズ2: Walker+ 全10地域を収集...')
  const walkerSpots = []

  for (const region of WALKER_REGIONS) {
    if (progress[`region_done_${region.code}`]) {
      console.log(`  [${region.name}] スキップ（完了済み）`)
      // 完了済みのスポットを progress から復元
      const done = Object.values(progress.walker ?? {})
        .filter(v => v.done && v.spot?.prefecture && WALKER_REGIONS
          .find(r => r.code === region.code)?.prefs.includes(v.spot.prefecture))
        .map(v => v.spot)
      walkerSpots.push(...done)
      continue
    }

    const regionSpots = await scrapeWalkerRegion(region, varietyIndex, progress, s100senIds)
    walkerSpots.push(...regionSpots)
    console.log(`  [${region.name}] 完了: ${regionSpots.length}件`)

    if (!OPT_DRY_RUN) {
      progress[`region_done_${region.code}`] = true
      await fs.promises.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2))
    }
  }

  // ── フェーズ3: 天然記念物 ─────────────────────────────────────────────
  console.log('\n═ フェーズ3: 国指定天然記念物 (Wikipedia)...')
  const monumentSpots = progress.monuments_done
    ? []
    : await scrapeMonuments(varietyIndex)
  if (!progress.monuments_done && !OPT_DRY_RUN) {
    progress.monuments_done = true
    await fs.promises.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2))
  }

  // ── フェーズ4: 統合・重複排除 ────────────────────────────────────────
  console.log('\n═ フェーズ4: 統合・重複排除...')
  const migratedExisting = existingSpots.map(migrateExistingSpot)

  // 優先度: Walker+ → 天然記念物 → 既存
  const allRaw = [...walkerSpots, ...monumentSpots, ...migratedExisting]
  const deduped = deduplicateSpots(allRaw)
  console.log(`  統合前: ${allRaw.length}件 → 重複排除後: ${deduped.length}件`)

  // ── フェーズ5: 品種強化 ──────────────────────────────────────────────
  enrichSpots(deduped)

  // ── フェーズ6: 座標補完 (Nominatim) ─────────────────────────────────
  const noCoords = deduped.filter(s => !s.lat && s.address)
  if (noCoords.length > 0) {
    console.log(`\n═ フェーズ6: Nominatim ジオコーディング (${noCoords.length}件)...`)
    for (let i = 0; i < noCoords.length; i++) {
      const s = noCoords[i]
      process.stdout.write(`  [${i + 1}/${noCoords.length}] ${s.name}...`)
      const { lat, lng } = await geocode(s.address)
      if (lat) {
        s.lat = lat; s.lng = lng
        process.stdout.write(` (${lat.toFixed(4)}, ${lng.toFixed(4)})\n`)
      } else {
        process.stdout.write(' 取得失敗\n')
      }
    }
  }

  // ── フェーズ7: 最終化 ────────────────────────────────────────────────
  console.log('\n═ フェーズ7: 最終化...')
  const finalSpots = deduped.map(s => finalizeSpot(s, varietyIndex))

  // ── 検証 ─────────────────────────────────────────────────────────────
  console.log('\n═ 検証...')
  const { errors, coveredPrefs, s100senCovered } = validate(finalSpots, s100senIds)
  if (errors.length) {
    console.warn('  ⚠ 検証エラー:')
    errors.forEach(e => console.warn(`    - ${e}`))
  } else {
    console.log('  ✓ 全検証パス')
  }

  // ── 保存 ─────────────────────────────────────────────────────────────
  if (!OPT_DRY_RUN) {
    await fs.promises.writeFile(SPOTS_PATH, JSON.stringify(finalSpots, null, 2))
    console.log(`\nspots.json 保存: ${finalSpots.length}件`)

    // CSVレポート
    const header = 'id,name,prefecture,variety_count,source,status\n'
    const rows = finalSpots.map(s =>
      `${s.id},"${s.name}",${s.prefecture},${s.varietyCount ?? 0},"${s.sources.join('+')}",ok`
    ).join('\n')
    await fs.promises.writeFile(REPORT_PATH, '\uFEFF' + header + rows)
    console.log(`レポート: ${REPORT_PATH}`)
  }

  // ── サマリー ─────────────────────────────────────────────────────────
  const bySource = { walker: 0, monument: 0, existing: 0 }
  for (const s of finalSpots) {
    for (const src of s.sources) {
      if (bySource[src] != null) bySource[src]++
    }
  }
  const byPref = {}
  for (const s of finalSpots) {
    byPref[s.prefecture] = (byPref[s.prefecture] ?? 0) + 1
  }
  const withVariety = finalSpots.filter(s => s.varieties.length > 0).length

  console.log('\n╔══════════════════════════════════════╗')
  console.log('║  サマリー                            ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`Total spots:          ${finalSpots.length}`)
  console.log(`By source:  Walker+ ${bySource.walker}, 天然記念物 ${bySource.monument}, 既存 ${bySource.existing}`)
  console.log(`With variety info:    ${withVariety} (${(withVariety/finalSpots.length*100).toFixed(1)}%)`)
  console.log(`Sakura 100:           ${s100senCovered}/${s100senIds.size}`)
  console.log(`Prefectures covered:  ${coveredPrefs}/47`)
  console.log('\nBy prefecture:')
  for (const [pref, count] of Object.entries(byPref).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${pref}: ${count}`)
  }
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
