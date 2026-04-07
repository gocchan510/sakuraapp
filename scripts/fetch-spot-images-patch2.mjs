/**
 * 3rd pass: 残り32件を英語・さらに別名で再挑戦
 * 実行: node scripts/fetch-spot-images-patch2.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

const PATCH2_QUERIES = {
  'nanasawa-forest':          ['Nanasawa Park cherry blossom Atsugi', 'Atsugi cherry blossom park'],
  'zama-seriyuze':            ['Zama cherry blossom park Kanagawa', 'Kanagawa cherry blossom park'],
  'miyagino-hayakawa':        ['Hayakawa cherry blossom Odawara', 'Odawara cherry blossom'],
  'yumenoshima-park':         ['Yumenoshima Tokyo cherry', 'Tokyo bay cherry blossom park'],
  'kitaasaba-sakuratsutsumi': ['Saitama cherry blossom river embankment', 'Kitaasaba sakura tsutsumi'],
  'mukojima-hyakkaen':        ['Mukojima Hyakkaen garden Tokyo', 'Sumida garden cherry blossom'],
  'shikino-mori-park':        ['Yokohama Midori cherry blossom park', 'Kanagawa cherry blossom nature park'],
  'minato-mieru-oka-park':    ['Minato Mieru Oka Yokohama cherry', 'Yokohama harbor view park cherry'],
  'somei-cemetery':           ['Somei Yoshino cemetery Tokyo cherry', 'Tokyo cemetery cherry blossom'],
  'harimabashi-promenade':    ['Harimabashi cherry blossom avenue Bunkyo', 'Bunkyo Tokyo cherry blossom street'],
  'kasai-rinkai-park':        ['Kasai Rinkai Park Tokyo cherry blossom', 'Tokyo seaside cherry blossom'],
  'todoroki-ravine':          ['Todoroki valley Setagaya cherry', 'Setagaya Tokyo cherry blossom'],
  'otonashi-park':            ['Oji Kita Tokyo cherry blossom', 'Otonashi river park cherry blossom'],
  'hikarigaoka-park':         ['Hikarigaoka Nerima cherry blossom', 'Nerima Tokyo cherry blossom park'],
  'toneri-park':              ['Toneri Adachi Tokyo cherry blossom', 'Adachi cherry blossom park Tokyo'],
  'tokorozawa-kokuu-park':    ['Tokorozawa park cherry blossom Saitama', 'Saitama cherry blossom aviation park'],
  'hanyuu-suigo-park':        ['Hanyuu Saitama cherry blossom', 'Saitama suigo cherry blossom'],
  'tokigawa-sakuratsutsumi':  ['Tokigawa Saitama cherry blossom', 'Saitama river cherry blossom embankment'],
  'satomi-park':              ['Satomi park Ichikawa cherry blossom', 'Ichikawa Chiba cherry blossom'],
  'inohana-park':             ['Inohana Chiba castle cherry blossom', 'Chiba castle cherry blossom'],
  'inage-seaside-park':       ['Inage seaside Chiba cherry blossom', 'Chiba seaside cherry blossom'],
  'inba-numa-cycling-road':   ['Inba Numa Chiba cherry blossom cycling road', 'Chiba swamp cherry blossom'],
  'aoba-forest':              ['Aoba Forest Park Chiba cherry blossom', 'Chiba forest park cherry blossom'],
  'koboyama-park':            ['Koboyama Hadano Kanagawa cherry blossom', 'Hadano mountain cherry blossom'],
  'kinugasayama-park':        ['Kinugasayama Yokosuka cherry blossom', 'Yokosuka cherry blossom park'],
  'arakawa-tsutsumi':         ['Arakawa river cherry blossom Tokyo', 'Tokyo river cherry blossom embankment'],
  'mitake-okutagawa':         ['Okutama cherry blossom Ome Tokyo', 'Ome cherry blossom river'],
  'jindai-botanical':         ['Jindai botanical garden cherry', 'Chofu cherry blossom botanical'],
  'hadano-tokawa-park':       ['Hadano Tokawa Kanagawa cherry blossom', 'Kanagawa mountain park cherry'],
  'tenranzan':                ['Tenranzan Hanno cherry blossom', 'Hanno Saitama cherry blossom mountain'],
  'hodosan':                  ['Hodosan Nagatoro cherry blossom', 'Nagatoro Saitama cherry blossom'],
  'shimine-park':             ['Shimine park Kanna winter cherry', 'Gunma winter cherry blossom park'],
}

function isCherryBlossomFile(title) {
  const lower = title.toLowerCase()
  return (
    lower.includes('sakura') ||
    lower.includes('cherry') ||
    lower.includes('桜') ||
    lower.includes('blossom') ||
    lower.includes('hanami')
  )
}

async function fetchCommonsImage(query) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=15` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=800` +
    `&format=json&origin=*`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const pages = Object.values(data.query?.pages ?? {})
    if (pages.length === 0) return null
    const cherry = pages.find(p => isCherryBlossomFile(p.title ?? ''))
    const best = cherry ?? pages[0]
    return best.imageinfo?.[0]?.thumburl ?? best.imageinfo?.[0]?.url ?? null
  } catch {
    return null
  }
}

// Wikipedia pageimages から桜の画像を探す（最終手段）
async function fetchWikipediaImage(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=800&pilicense=any&format=json&origin=*`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' } })
    if (!res.ok) return null
    const data = await res.json()
    const pages = Object.values(data.query?.pages ?? {})
    const page = pages[0]
    if (!page || page.missing !== undefined) return null
    return page.thumbnail?.source ?? null
  } catch { return null }
}

// スポット名でWikipedia検索して記事のサムネイルを返す（最終フォールバック）
const WIKI_FALLBACK = {
  'nanasawa-forest':          '七沢森林公園',
  'zama-seriyuze':            '座間市',
  'miyagino-hayakawa':        '宮城野早川堤',
  'yumenoshima-park':         '夢の島公園',
  'kitaasaba-sakuratsutsumi': '北浅羽桜堤公園',
  'mukojima-hyakkaen':        '向島百花園',
  'shikino-mori-park':        '四季の森公園',
  'minato-mieru-oka-park':    '港の見える丘公園',
  'somei-cemetery':           '染井霊園',
  'harimabashi-promenade':    '播磨坂',
  'kasai-rinkai-park':        '葛西臨海公園',
  'todoroki-ravine':          '等々力渓谷',
  'otonashi-park':            '音無親水公園',
  'hikarigaoka-park':         '光が丘公園',
  'toneri-park':              '舎人公園',
  'tokorozawa-kokuu-park':    '所沢航空記念公園',
  'hanyuu-suigo-park':        '羽生水郷公園',
  'tokigawa-sakuratsutsumi':  '都幾川',
  'satomi-park':              '里見公園',
  'inohana-park':             '亥鼻公園',
  'inage-seaside-park':       '稲毛海浜公園',
  'inba-numa-cycling-road':   '印旛沼',
  'aoba-forest':              '千葉県立青葉の森公園',
  'koboyama-park':            '弘法山',
  'kinugasayama-park':        '衣笠山公園',
  'arakawa-tsutsumi':         '荒川自然公園',
  'mitake-okutagawa':         '御岳渓谷',
  'jindai-botanical':         '神代植物公園',
  'hadano-tokawa-park':       '秦野戸川公園',
  'tenranzan':                '天覧山',
  'hodosan':                  '宝登山',
  'shimine-park':             '城峯公園',
}

async function main() {
  const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))
  const nullSpots = spots.filter(s => s.imageUrl === null)
  console.log(`未取得スポット: ${nullSpots.length}件`)

  let found = 0, stillNotFound = 0

  for (const spot of nullSpots) {
    const queries = PATCH2_QUERIES[spot.id]
    let imageUrl = null

    // 1. Commons英語検索
    if (queries) {
      for (const q of queries) {
        imageUrl = await fetchCommonsImage(q)
        await new Promise(r => setTimeout(r, 200))
        if (imageUrl) break
      }
    }

    // 2. Wikipedia記事サムネイル（最終フォールバック）
    if (!imageUrl && WIKI_FALLBACK[spot.id]) {
      imageUrl = await fetchWikipediaImage(WIKI_FALLBACK[spot.id])
      await new Promise(r => setTimeout(r, 200))
    }

    if (imageUrl) {
      spot.imageUrl = imageUrl
      found++
      console.log(`✓ ${spot.name.padEnd(20)} → ${imageUrl.slice(0, 70)}...`)
    } else {
      stillNotFound++
      console.log(`✗ ${spot.name}`)
    }
  }

  // spotsに反映
  for (const s of spots) {
    const patched = nullSpots.find(n => n.id === s.id)
    if (patched && patched.imageUrl) s.imageUrl = patched.imageUrl
  }

  fs.writeFileSync(SPOTS_PATH, JSON.stringify(spots, null, 2), 'utf-8')
  console.log(`\n追加取得: ${found}件, 残り未取得: ${stillNotFound}件`)
}

main().catch(console.error)
