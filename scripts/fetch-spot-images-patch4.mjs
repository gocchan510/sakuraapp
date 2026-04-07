/**
 * 5th pass: Wikipedia記事の画像一覧から桜画像を探す
 * 実行: node scripts/fetch-spot-images-patch4.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

// 各スポットのWikipedia記事名（桜らしい画像が含まれそうなもの）
const WIKI_ARTICLES = {
  'kokyo-higashigyoen':       '皇居東御苑',
  'nanasawa-forest':          '七沢森林公園',
  'zama-seriyuze':            '座間市',
  'miyagino-hayakawa':        '早川堤',
  'yumenoshima-park':         '夢の島公園',
  'kitaasaba-sakuratsutsumi': '北浅羽桜堤公園',
  'koishikawa-korakuen':      '小石川後楽園',
  'arai-shiroshigoto':        '荒井城址公園',
  'odawara-castle':           '小田原城',
  'sagamihara-park':          '相模原公園',
  'yamashita-park':           '山下公園',
  'minato-mieru-oka-park':    '港の見える丘公園',
  'nikkaryodo-sakura':        '二ヶ領用水',
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

// 追加のCommons直接検索（Wikipedia記事が見つからない場合のフォールバック）
const EXTRA_QUERIES = {
  'kokyo-higashigyoen':       'Tokyo Imperial Palace cherry blossom spring',
  'nanasawa-forest':          'Kanagawa park cherry blossom spring forest',
  'zama-seriyuze':            'Zama cherry blossom festival spring Japan',
  'miyagino-hayakawa':        'Odawara Hayakawa cherry blossom avenue',
  'yumenoshima-park':         'Tokyo east bay area cherry blossom spring',
  'kitaasaba-sakuratsutsumi': 'sakura tsutsumi Saitama cherry blossom embankment',
  'koishikawa-korakuen':      'Korakuen garden Bunkyo cherry blossom spring',
  'arai-shiroshigoto':        'Ebina Kanagawa cherry blossom castle ruins',
  'odawara-castle':           'Odawara castle spring cherry blossom moat',
  'sagamihara-park':          'Sagamihara city cherry blossom spring Kanagawa',
  'yamashita-park':           'Yokohama waterfront cherry blossom spring park',
  'minato-mieru-oka-park':    'Yokohama hilltop cherry blossom spring',
  'nikkaryodo-sakura':        'Tamagawa canal cherry blossom Kawasaki',
  'ikuta-ryokuchi':           'Kawasaki Tama spring cherry blossom green',
  'hibiya-park':              'Hibiya Tokyo cherry blossom spring festival',
  'kyu-shiba-rikyu':          'Shiba Rikyu Tokyo garden cherry blossom',
  'kasai-rinkai-park':        'Tokyo bayside cherry blossom spring park',
  'senzokuike-park':          'Senzokuike pond Ota Tokyo cherry blossom',
  'tama-reien':               'Tokyo cemetery cherry blossom Fuchu spring',
  'musashino-park':           'Musashino Fuchu spring cherry blossom park',
  'hikarigaoka-park':         'Nerima Tokyo cherry blossom spring Hikarigaoka',
  'toneri-park':              'Adachi Tokyo sakura spring park Toneri',
  'hikawa-sando':             'Hikawa shrine Omiya cherry blossom spring avenue',
  'musashikyuryo':            'Musashi Kyuryo national park cherry blossom',
  'kawagoe-kitain':           'Kawagoe Kitain temple cherry blossom spring',
  'tokorozawa-kokuu-park':    'Tokorozawa Saitama cherry blossom spring',
  'yoshimi-hyakuana-sakura':  'Yoshimi Saitama ancient tomb cherry blossom',
  'hanyuu-suigo-park':        'Hanyuu Saitama spring cherry sakura',
  'tokigawa-sakuratsutsumi':  'Toki river Saitama cherry blossom embankment',
  'inage-seaside-park':       'Chiba Inage seaside sakura spring cherry',
  'naritasan-sakura':         'Narita airport sakura cherry blossom spring',
  'naritasan-park':           'Naritasan park Chiba cherry blossom spring',
  'inba-numa-cycling-road':   'Inba Numa Chiba cherry blossom cycling road',
  'aoba-forest':              'Chiba forest park cherry blossom spring green',
  'shimizu-park':             'Noda Chiba Shimizu park cherry blossom spring',
  'tsurugaoka-hachimangu':    'Kamakura shrine cherry blossom spring Japan',
  'kinugasayama-park':        'Yokosuka Kanagawa cherry blossom mountain park',
  'takao-mountain':           'Mount Takao cherry blossom spring hiking',
  'jindai-botanical':         'Jindai botanical garden cherry blossom spring Chofu',
  'hadano-tokawa-park':       'Hadano Kanagawa river park cherry blossom spring',
  'tenranzan':                'Hanno mountain cherry blossom spring Saitama',
  'nagatoro-sakura':          'Nagatoro Saitama river cherry blossom spring',
  'shimine-park':             'Kanna Gunma winter cherry blossom autumn park',
  'hakone-gora':              'Hakone Gora garden cherry blossom spring',
  'myogisan-sakura':          'Myogisan Gunma cherry blossom spring mountain',
}

function isCherryBlossomUrl(url) {
  if (!url) return false
  const decoded = decodeURIComponent(url)
  const lower = decoded.toLowerCase()
  if (lower.includes('ohka') || lower.includes('mxy7') || lower.includes('aircraft')) return false
  return (
    lower.includes('sakura') ||
    lower.includes('cherry') ||
    lower.includes('blossom') ||
    lower.includes('hanami') ||
    lower.includes('桜') ||
    lower.includes('cherryblossom')
  )
}

// Wikipedia 記事の画像一覧 → 桜関連ファイルを選ぶ → URLを取得
async function fetchFromWikipediaArticle(wikiTitle) {
  const listUrl = `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=images&imlimit=50&format=json&origin=*`
  try {
    const res = await fetch(listUrl, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!res.ok) return null
    const data = await res.json()
    const pages = Object.values(data.query?.pages ?? {})
    if (!pages.length || pages[0].missing !== undefined) return null
    const images = pages[0].images ?? []
    // 桜っぽいファイルを探す
    const cherry = images.find(img => isCherryBlossomUrl(img.title ?? ''))
    if (!cherry) return null
    const fileName = (cherry.title ?? '').replace(/^(ファイル|File):/i, '')
    await new Promise(r => setTimeout(r, 150))
    // ファイルのURLを取得
    const infoUrl = `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + fileName)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`
    const infoRes = await fetch(infoUrl, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!infoRes.ok) return null
    const infoData = await infoRes.json()
    const infoPages = Object.values(infoData.query?.pages ?? {})
    return infoPages[0]?.imageinfo?.[0]?.thumburl ?? infoPages[0]?.imageinfo?.[0]?.url ?? null
  } catch { return null }
}

async function fetchCommonsImage(query) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=20` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=800` +
    `&format=json&origin=*`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!res.ok) return null
    const data = await res.json()
    const pages = Object.values(data.query?.pages ?? {})
    if (!pages.length) return null
    const cherry = pages.find(p => isCherryBlossomUrl(p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url ?? ''))
    if (!cherry) return null
    return cherry.imageinfo?.[0]?.thumburl ?? cherry.imageinfo?.[0]?.url ?? null
  } catch { return null }
}

async function main() {
  const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))
  const nullSpots = spots.filter(s => s.imageUrl === null)
  console.log(`未取得スポット: ${nullSpots.length}件\n`)

  let found = 0, stillNotFound = 0

  for (const spot of nullSpots) {
    let imageUrl = null

    // 1. Wikipedia記事の画像一覧をスキャン
    const wikiTitle = WIKI_ARTICLES[spot.id]
    if (wikiTitle) {
      imageUrl = await fetchFromWikipediaArticle(wikiTitle)
      await new Promise(r => setTimeout(r, 200))
    }

    // 2. Commons検索フォールバック
    if (!imageUrl) {
      const q = EXTRA_QUERIES[spot.id]
      if (q) {
        imageUrl = await fetchCommonsImage(q)
        await new Promise(r => setTimeout(r, 200))
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
