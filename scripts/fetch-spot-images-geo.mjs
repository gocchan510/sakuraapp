/**
 * Geo search + Wikipedia pageimages で残り null スポットに画像を付ける
 * 実行: node scripts/fetch-spot-images-geo.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

// 日本語 Wikipedia 記事名（各スポットの正確な記事タイトル）
const WIKI_TITLE = {
  'kokyo-higashigyoen':       '皇居東御苑',
  'nanasawa-forest':          '七沢森林公園',
  'zama-seriyuze':            '座間市',
  'miyagino-hayakawa':        '宮城野早川堤',
  'yumenoshima-park':         '夢の島公園',
  'kitaasaba-sakuratsutsumi': '北浅羽桜堤公園',
  'koishikawa-korakuen':      '小石川後楽園',
  'arai-shiroshigoto':        '荒井城址公園',
  'odawara-castle':           '小田原城',
  'sagamihara-park':          '相模原公園',
  'yamashita-park':           '山下公園',
  'minato-mieru-oka-park':    '港の見える丘公園',
  'ikuta-ryokuchi':           '生田緑地',
  'hibiya-park':              '日比谷公園',
  'kyu-shiba-rikyu':          '旧芝離宮恩賜庭園',
  'kasai-rinkai-park':        '葛西臨海公園',
  'senzokuike-park':          '洗足池',
  'tama-reien':               '多磨霊園',
  'musashino-park':           '武蔵野公園',
  'hikarigaoka-park':         '光が丘公園',
  'toneri-park':              '舎人公園',
  'hikawa-sando':             '武蔵一宮氷川神社',
  'musashikyuryo':            '武蔵丘陵森林公園',
  'kawagoe-kitain':           '喜多院',
  'tokorozawa-kokuu-park':    '所沢航空記念公園',
  'yoshimi-hyakuana-sakura':  '吉見百穴',
  'hanyuu-suigo-park':        '羽生水郷公園',
  'tokigawa-sakuratsutsumi':  '都幾川',
  'inage-seaside-park':       '稲毛海浜公園',
  'naritasan-sakura':         '成田空港',
  'naritasan-park':           '成田山新勝寺',
  'inba-numa-cycling-road':   '印旛沼',
  'aoba-forest':              '千葉県立青葉の森公園',
  'shimizu-park':             '清水公園',
  'tsurugaoka-hachimangu':    '鶴岡八幡宮',
  'kinugasayama-park':        '衣笠山公園',
  'takao-mountain':           '高尾山',
  'jindai-botanical':         '神代植物公園',
  'hadano-tokawa-park':       '秦野戸川公園',
  'tenranzan':                '天覧山',
  'nagatoro-sakura':          '長瀞',
  'shimine-park':             '城峯公園',
  'hakone-gora':              '強羅公園',
  'myogisan-sakura':          '妙義山',
}

function isCherryBlossomUrl(url) {
  if (!url) return false
  const decoded = decodeURIComponent(url)
  const lower = decoded.toLowerCase()
  if (lower.includes('ohka') || lower.includes('mxy7')) return false
  return (
    lower.includes('sakura') ||
    lower.includes('cherry') ||
    lower.includes('blossom') ||
    lower.includes('hanami') ||
    lower.includes('桜')
  )
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Commons ジオサーチ → 桜ファイルをフィルタ
async function geoSearch(lat, lng, radius = 500) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&list=geosearch&gscoord=${lat}|${lng}&gsradius=${radius}&gsnamespace=6&gslimit=20` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=800` +
    `&format=json&origin=*`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!res.ok) return null
    const data = await res.json()
    const hits = data.query?.geosearch ?? []
    if (!hits.length) return null

    // タイトルをまとめてURL取得
    const titles = hits.slice(0, 10).map(h => h.title).join('|')
    const infoUrl =
      `https://commons.wikimedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(titles)}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=800` +
      `&format=json&origin=*`
    const infoRes = await fetch(infoUrl, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!infoRes.ok) return null
    const infoData = await infoRes.json()
    const pages = Object.values(infoData.query?.pages ?? {})
    const cherry = pages.find(p => isCherryBlossomUrl(p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url ?? ''))
    if (!cherry) return null
    return cherry.imageinfo?.[0]?.thumburl ?? cherry.imageinfo?.[0]?.url ?? null
  } catch { return null }
}

// Wikipedia pageimages（記事サムネイル、桜フィルタなし）
async function wikiThumb(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=800&pilicense=any&format=json&origin=*`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!res.ok) return null
    const data = await res.json()
    const pages = Object.values(data.query?.pages ?? {})
    const page = pages[0]
    if (!page || page.missing !== undefined) return null
    const thumb = page.thumbnail?.source ?? null
    // 桜チェック
    return isCherryBlossomUrl(thumb) ? thumb : null
  } catch { return null }
}

async function main() {
  const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))
  const nullSpots = spots.filter(s => s.imageUrl === null)
  console.log(`未取得スポット: ${nullSpots.length}件\n`)

  let found = 0, stillNotFound = 0

  for (const spot of nullSpots) {
    let imageUrl = null

    // 1. 座標ジオサーチ（500m 以内の桜画像）
    if (spot.lat && spot.lng) {
      imageUrl = await geoSearch(spot.lat, spot.lng, 500)
      await sleep(300)
      // 見つからなければ 1km に広げる
      if (!imageUrl) {
        imageUrl = await geoSearch(spot.lat, spot.lng, 1000)
        await sleep(300)
      }
    }

    // 2. Wikipedia 記事サムネイル（桜キーワードがあれば採用）
    if (!imageUrl) {
      const title = WIKI_TITLE[spot.id]
      if (title) {
        imageUrl = await wikiThumb(title)
        await sleep(250)
      }
    }

    if (imageUrl) {
      spot.imageUrl = imageUrl
      found++
      console.log(`✓ ${spot.name.padEnd(20)} ${decodeURIComponent(imageUrl).split('/').pop()?.slice(0, 55)}`)
    } else {
      stillNotFound++
      console.log(`✗ ${spot.name}`)
    }
  }

  for (const s of spots) {
    const patched = nullSpots.find(n => n.id === s.id)
    if (patched) s.imageUrl = patched.imageUrl
  }

  fs.writeFileSync(SPOTS_PATH, JSON.stringify(spots, null, 2), 'utf-8')
  console.log(`\n追加取得: ${found}件, 残り未取得: ${stillNotFound}件`)
  console.log(`合計: ${spots.filter(s => s.imageUrl).length}/95件`)
}

main().catch(console.error)
