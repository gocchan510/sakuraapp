/**
 * 画像がnullのスポットに対して追加検索（英語・別名）
 * 実行: node scripts/fetch-spot-images-patch.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

// nullになっているスポットへの追加検索クエリ（英語または別名）
const PATCH_QUERIES = {
  'kokyo-higashigyoen':       ['Imperial Palace East Garden cherry blossom', 'Higashi-Gyoen cherry'],
  'nanasawa-forest':          ['Nanasawa forest park cherry blossom', '七沢 桜 神奈川'],
  'atami-itogawa':            ['Atami cherry blossom', '熱海 早咲き桜 糸川'],
  'matsudayama-herb':         ['Matsuda kawazu cherry blossom', '松田 桜 西平畑公園'],
  'zama-seriyuze':            ['Zama cherry blossom Seriyuze', '座間 桜 神奈川'],
  'miyagino-hayakawa':        ['Hayakawa Odawara cherry blossom', '小田原 早川 桜並木'],
  'yumenoshima-park':         ['Yumenoshima park cherry blossom tokyo', '夢の島 桜 江東'],
  'hakkeijima':               ['Hakkeijima cherry blossom Yokohama', '八景島 桜 横浜'],
  'kitaasaba-sakuratsutsumi': ['Kitaasaba cherry blossom embankment Saitama', '北浅羽 菜の花 桜'],
  'mukojima-hyakkaen':        ['Mukojima Hyakkaen cherry blossom', '向島 百花園 桜'],
  'arai-shiroshigoto':        ['Arai castle ruins park cherry blossom', '荒井城 桜 神奈川'],
  'mitsuike-park':            ['Mitsuike park cherry blossom Yokohama', '三ツ池 桜 横浜'],
  'sankei-en':                ['Sankeien garden cherry blossom Yokohama', '三溪園 桜 横浜'],
  'shikino-mori-park':        ['Shikino Mori park cherry blossom Yokohama', '四季の森 桜 緑区'],
  'yamashita-park':           ['Yamashita park cherry blossom Yokohama', '山下公園 桜 横浜港'],
  'minato-mieru-oka-park':    ['Minato Mieru Oka park cherry blossom', '港の見える丘 桜 元町'],
  'yokohama-park-nihon-odori':['Yokohama park cherry blossom', '横浜 日本大通り 桜並木'],
  'kodomo-shizen-park':       ['Yokohama children nature park cherry blossom', '旭区 桜 横浜'],
  'ikuta-ryokuchi':           ['Ikuta Ryokuchi cherry blossom Kawasaki', '生田緑地 桜 川崎'],
  'kinuta-park':              ['Kinuta park cherry blossom Tokyo', '砧公園 桜 世田谷'],
  'yoyogi-park':              ['Yoyogi park cherry blossom', 'Yoyogi cherry blossom Tokyo'],
  'somei-cemetery':           ['Somei cemetery cherry blossom Tokyo', '染井 桜 豊島区 発祥'],
  'harimabashi-promenade':    ['Harimabashi cherry blossom promenade', '播磨坂 桜 文京区'],
  'kasai-rinkai-park':        ['Kasai Rinkai park cherry blossom', '葛西臨海 桜 江戸川'],
  'todoroki-ravine':          ['Todoroki ravine cherry blossom', '等々力 桜 世田谷'],
  'otonashi-park':            ['Otonashi park cherry blossom Kita Tokyo', '音無 桜 王子 北区'],
  'tama-reien':               ['Tama cemetery cherry blossom', '多磨霊園 桜 府中'],
  'musashino-park':           ['Musashino park cherry blossom', '武蔵野 桜 三鷹 府中'],
  'hikarigaoka-park':         ['Hikarigaoka park cherry blossom Nerima', '光が丘 桜 練馬'],
  'toneri-park':              ['Toneri park cherry blossom Tokyo', '舎人公園 桜 足立'],
  'sakitama-kofun-park':      ['Sakitama kofun park cherry blossom', 'さきたま 古墳 桜 行田'],
  'kumagaya-sakuratsutsumi':  ['Kumagaya cherry blossom embankment', '熊谷 土手 桜 荒川'],
  'musashikyuryo':            ['Musashi Forest park cherry blossom', '武蔵丘陵 森林 桜 滑川'],
  'tokorozawa-kokuu-park':    ['Tokorozawa Aviation Memorial park cherry blossom', '所沢 航空 桜'],
  'hanyuu-suigo-park':        ['Hanyuu Suigo park cherry blossom', '羽生 桜 さくら堤'],
  'tokigawa-sakuratsutsumi':  ['Tokigawa cherry blossom embankment Saitama', '都幾川 桜堤 川越'],
  'satomi-park':              ['Satomi park cherry blossom Ichikawa', '里見公園 桜 市川'],
  'inohana-park':             ['Inohana park cherry blossom Chiba', '亥鼻 桜 千葉城'],
  'inage-seaside-park':       ['Inage seaside park cherry blossom', '稲毛 海浜 桜 千葉'],
  'izumi-nature-park':        ['Izumi nature park cherry blossom Chiba', '泉自然 桜 千葉市'],
  'sakura-castle':            ['Sakura castle ruins cherry blossom', '佐倉城 桜 千葉'],
  'inba-numa-cycling-road':   ['Inba swamp cherry blossom cycling', '印旛沼 桜 千葉 堤'],
  'aoba-forest':              ['Aoba forest park cherry blossom Chiba', '青葉の森 桜 千葉'],
  'koboyama-park':            ['Koboyama cherry blossom Hadano', '弘法山 桜 秦野 神奈川'],
  'kinugasayama-park':        ['Kinugasayama park cherry blossom Yokosuka', '衣笠山 桜 横須賀'],
  'arakawa-tsutsumi':         ['Arakawa cherry blossom embankment Tokyo', '荒川自然公園 桜 北区'],
  'mitake-okutagawa':         ['Mitake gorge cherry blossom Ome', '御岳 桜 奥多摩 青梅'],
  'jindai-botanical':         ['Jindai botanical garden cherry blossom', '神代植物公園 桜 調布'],
  'hadano-tokawa-park':       ['Hadano Tokawa park cherry blossom', '秦野 戸川 桜 神奈川'],
  'tenranzan':                ['Tenranzan mountain cherry blossom Hanno', '天覧山 桜 飯能 埼玉'],
  'hodosan':                  ['Hodosan mountain cherry blossom Nagatoro', '宝登山 桜 長瀞'],
  'shimine-park':             ['Shimine park winter cherry blossom', '城峯公園 冬桜 神流'],
  'hakone-gora':              ['Hakone Gora park cherry blossom', '強羅 桜 箱根 神奈川'],
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

    // 桜キーワードがファイル名に入っているものを優先
    const cherry = pages.find(p => isCherryBlossomFile(p.title ?? ''))
    const best = cherry ?? pages[0]
    return best.imageinfo?.[0]?.thumburl ?? best.imageinfo?.[0]?.url ?? null
  } catch {
    return null
  }
}

// Wikipedia 記事の画像一覧から桜っぽいものを選ぶ
async function fetchWikipediaArticleImages(wikiTitle) {
  const url =
    `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}` +
    `&prop=images&imlimit=20&format=json&origin=*`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const pages = Object.values(data.query?.pages ?? {})
    if (pages.length === 0) return null
    const images = pages[0].images ?? []
    const cherry = images.find(img => isCherryBlossomFile(img.title ?? ''))
    if (!cherry) return null

    // ファイル名からURL取得
    const fileName = cherry.title.replace('ファイル:', '').replace('File:', '')
    const infoUrl =
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + fileName)}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`
    const infoRes = await fetch(infoUrl, {
      headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' },
    })
    if (!infoRes.ok) return null
    const infoData = await infoRes.json()
    const infoPages = Object.values(infoData.query?.pages ?? {})
    return infoPages[0]?.imageinfo?.[0]?.thumburl ?? infoPages[0]?.imageinfo?.[0]?.url ?? null
  } catch {
    return null
  }
}

async function main() {
  const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))
  const nullSpots = spots.filter(s => s.imageUrl === null)
  console.log(`未取得スポット: ${nullSpots.length}件`)

  let found = 0, stillNotFound = 0

  for (const spot of nullSpots) {
    const queries = PATCH_QUERIES[spot.id]
    let imageUrl = null

    if (queries) {
      for (const q of queries) {
        imageUrl = await fetchCommonsImage(q)
        await new Promise(r => setTimeout(r, 200))
        if (imageUrl) break
      }
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
