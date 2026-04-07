/**
 * Final pass: Commons カテゴリ検索 + 直接ファイルURL指定
 * 実行: node scripts/fetch-spot-images-patch5.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

// Commons カテゴリ検索クエリ（Category: で始まるもの）または通常検索
const CAT_SEARCHES = {
  'kokyo-higashigyoen':       'Cherry blossoms in Chiyoda, Tokyo',
  'nanasawa-forest':          'Cherry blossoms in Kanagawa Prefecture',
  'zama-seriyuze':            'Cherry blossoms in Zama',
  'miyagino-hayakawa':        'Cherry blossoms in Odawara',
  'yumenoshima-park':         'Cherry blossoms in Koto, Tokyo',
  'kitaasaba-sakuratsutsumi': 'Cherry blossoms in Saitama Prefecture',
  'koishikawa-korakuen':      'Koishikawa Korakuen cherry',
  'arai-shiroshigoto':        'Cherry blossoms in Ebina',
  'odawara-castle':           'Cherry blossoms in Odawara Castle',
  'sagamihara-park':          'Cherry blossoms in Sagamihara',
  'yamashita-park':           'Cherry blossoms in Naka, Yokohama',
  'minato-mieru-oka-park':    'Cherry blossoms in Naka, Yokohama',
  'ikuta-ryokuchi':           'Cherry blossoms in Kawasaki',
  'hibiya-park':              'Cherry blossoms in Hibiya',
  'kyu-shiba-rikyu':          'Cherry blossoms in Minato, Tokyo',
  'kasai-rinkai-park':        'Cherry blossoms in Edogawa, Tokyo',
  'senzokuike-park':          'Cherry blossoms in Ota, Tokyo',
  'tama-reien':               'Cherry blossoms in Fuchu',
  'musashino-park':           'Cherry blossoms in Koganei',
  'hikarigaoka-park':         'Cherry blossoms in Nerima, Tokyo',
  'toneri-park':              'Cherry blossoms in Adachi, Tokyo',
  'hikawa-sando':             'Cherry blossoms in Saitama City',
  'musashikyuryo':            'Cherry blossoms in Hiki District',
  'kawagoe-kitain':           'Cherry blossoms in Kawagoe',
  'tokorozawa-kokuu-park':    'Cherry blossoms in Tokorozawa',
  'yoshimi-hyakuana-sakura':  'Cherry blossoms in Hiki District',
  'hanyuu-suigo-park':        'Cherry blossoms in Hanyuu',
  'tokigawa-sakuratsutsumi':  'Cherry blossoms in Higashimatsuyama',
  'inage-seaside-park':       'Cherry blossoms in Inage',
  'naritasan-sakura':         'Cherry blossoms in Narita',
  'naritasan-park':           'Cherry blossoms in Narita',
  'inba-numa-cycling-road':   'Cherry blossoms in Inzai',
  'aoba-forest':              'Cherry blossoms in Chiba',
  'shimizu-park':             'Cherry blossoms in Noda',
  'tsurugaoka-hachimangu':    'Cherry blossoms in Kamakura',
  'kinugasayama-park':        'Cherry blossoms in Yokosuka',
  'takao-mountain':           'Cherry blossoms in Hachioji',
  'jindai-botanical':         'Cherry blossoms in Chofu',
  'hadano-tokawa-park':       'Cherry blossoms in Hadano',
  'tenranzan':                'Cherry blossoms in Hanno',
  'nagatoro-sakura':          'Cherry blossoms in Nagatoro',
  'shimine-park':             'Cherry blossoms in Kanna',
  'hakone-gora':              'Cherry blossoms in Hakone',
  'myogisan-sakura':          'Cherry blossoms in Myogisan',
  'musashino-park':           'Cherry blossoms in Musashino',
  'nikkaryodo-sakura':        'Cherry blossoms in Kawasaki',
  'shikino-mori-park':        'Cherry blossoms in Midori, Yokohama',
  'zenpukujigawa-ryokuchi':   'Cherry blossoms in Suginami, Tokyo',
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

async function fetchCommonsCategory(catName) {
  // カテゴリのメンバーファイルを取得
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&list=categorymembers&cmtitle=${encodeURIComponent('Category:' + catName)}` +
    `&cmtype=file&cmlimit=10` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=800` +
    `&format=json&origin=*`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!res.ok) return null
    const data = await res.json()
    const members = data.query?.categorymembers ?? []
    if (!members.length) return null
    // カテゴリメンバーのURLを別途取得
    const titles = members.slice(0, 5).map(m => m.title).join('|')
    const infoUrl =
      `https://commons.wikimedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(titles)}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=800` +
      `&format=json&origin=*`
    const infoRes = await fetch(infoUrl, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!infoRes.ok) return null
    const infoData = await infoRes.json()
    const pages = Object.values(infoData.query?.pages ?? {})
    const cherry = pages.find(p => isCherryBlossomUrl(p.imageinfo?.[0]?.thumburl ?? ''))
    const best = cherry ?? pages[0]
    return best?.imageinfo?.[0]?.thumburl ?? best?.imageinfo?.[0]?.url ?? null
  } catch { return null }
}

async function fetchCommonsSearch(query) {
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
    const catQuery = CAT_SEARCHES[spot.id]
    let imageUrl = null

    if (catQuery) {
      // 1. カテゴリ検索
      imageUrl = await fetchCommonsCategory(catQuery)
      await new Promise(r => setTimeout(r, 200))

      // 2. 通常検索フォールバック（同じクエリをfull-text検索）
      if (!imageUrl) {
        imageUrl = await fetchCommonsSearch(catQuery + ' sakura cherry')
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
