/**
 * 4th pass: null スポットへのさらに精密な検索
 * 実行: node scripts/fetch-spot-images-patch3.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

const PATCH3_QUERIES = {
  'kokyo-higashigyoen':       ['Imperial Palace East Garden cherry blossom Tokyo', 'Higashi Gyoen sakura'],
  'asukayama-park':           ['Asukayama Park cherry blossom Kita Tokyo', 'Asukayama sakura'],
  'nanasawa-forest':          ['Nanasawa prefectural park cherry blossom', 'Atsugi spring cherry'],
  'zama-seriyuze':            ['Zama Kanagawa cherry blossom', 'Zama city cherry'],
  'miyagino-hayakawa':        ['Hayakawa embankment cherry blossom Odawara', 'Odawara sakura river'],
  'yumenoshima-park':         ['Yumenoshima park cherry blossom Tokyo bay', 'dream island cherry Tokyo'],
  'kitaasaba-sakuratsutsumi': ['Kitaasaba sakura embankment Saitama', 'sakura tsutsumi Saitama river'],
  'mukojima-hyakkaen':        ['Mukojima Hyakkaen cherry blossom Tokyo', 'Sumida cherry blossom garden'],
  'arai-shiroshigoto':        ['Arai castle ruins cherry blossom Kanagawa', 'Ebina castle cherry'],
  'sagamihara-park':          ['Sagamihara park cherry blossom', 'Sagamihara sakura spring'],
  'shikino-mori-park':        ['Shikino Mori park cherry blossom Midori Yokohama', 'spring nature park Yokohama cherry'],
  'yamashita-park':           ['Yamashita park cherry blossom Yokohama harbor', 'cherry blossom Yokohama waterfront'],
  'minato-mieru-oka-park':    ['Minato Mieru Oka cherry blossom Yokohama', 'Yamatedori cherry Yokohama'],
  'nikkaryodo-sakura':        ['Nikaryo canal cherry blossom Kawasaki', 'Tamagawa canal cherry blossom'],
  'ikuta-ryokuchi':           ['Ikuta Ryokuchi cherry blossom Kawasaki', 'Ikuta green space sakura'],
  'hibiya-park':              ['Hibiya Park cherry blossom Tokyo', 'Hibiya sakura spring'],
  'hama-rikyu':               ['Hama Rikyu cherry blossom Tokyo', 'Hamarikyu garden cherry'],
  'kyu-shiba-rikyu':          ['Kyu Shiba Rikyu cherry blossom', 'old Shiba detached palace cherry'],
  'kasai-rinkai-park':        ['Kasai Rinkai park cherry blossom seaside Tokyo', 'cherry blossom Tokyo bay park'],
  'senzokuike-park':          ['Senzokuike park cherry blossom', 'Okusawa cherry blossom pond'],
  'zenpukujigawa-ryokuchi':   ['Zenpukuji river cherry blossom Tokyo', 'Suginami cherry blossom river'],
  'tama-reien':               ['Tama Reien cemetery cherry blossom', 'Fuchu cemetery cherry blossom'],
  'musashino-park':           ['Musashino park cherry blossom Koganei', 'Musashino spring cherry'],
  'hikarigaoka-park':         ['Hikarigaoka park cherry blossom Nerima', 'Nerima cherry blossom park spring'],
  'toneri-park':              ['Toneri park cherry blossom Adachi Tokyo', 'Adachi sakura spring'],
  'hikawa-sando':             ['Hikawa shrine cherry blossom Omiya', 'Omiya Hikawa sakura avenue'],
  'kumagaya-sakuratsutsumi':  ['Kumagaya cherry blossom embankment', 'Kumagaya sakura tsutsumi Saitama'],
  'musashikyuryo':            ['Musashikyuryo national park cherry blossom', 'Yokote mountain sakura Saitama'],
  'kawagoe-kitain':           ['Kitain temple cherry blossom Kawagoe', 'Kawagoe castle cherry blossom'],
  'tokorozawa-kokuu-park':    ['Tokorozawa Aviation Memorial park cherry blossom spring', 'Tokorozawa sakura park'],
  'yoshimi-hyakuana-sakura':  ['Yoshimi Hyakuana cherry blossom Saitama', 'ancient tombs cherry Saitama'],
  'hanyuu-suigo-park':        ['Hanyuu Suigo park cherry blossom Saitama', 'Saitama swamp park cherry'],
  'tokigawa-sakuratsutsumi':  ['Tokigawa cherry blossom embankment Saitama', 'Higashimatsuyama cherry river'],
  'inage-seaside-park':       ['Inage seaside park cherry blossom spring', 'Chiba Inage sakura park'],
  'inba-numa-cycling-road':   ['Inba swamp cherry blossom road Chiba', 'Inbanuma cycling sakura Chiba'],
  'aoba-forest':              ['Aoba forest park cherry blossom Chiba', 'Chiba prefectural forest cherry'],
  'shimizu-park':             ['Shimizu park Noda cherry blossom', 'Noda Chiba sakura cherry'],
  'tsurugaoka-hachimangu':    ['Tsurugaoka Hachimangu cherry blossom Kamakura', 'Kamakura shrine cherry'],
  'koboyama-park':            ['Koboyama cherry blossom Hadano Kanagawa', 'Gongen mountain cherry blossom'],
  'nagatoro-sakura':          ['Nagatoro cherry blossom river Saitama', 'Arakawa Nagatoro sakura'],
  'shimine-park':             ['Shimine park winter cherry blossom Gunma', 'Kanna winter cherry blossom'],
  'hakone-gora':              ['Gora Park Hakone cherry blossom', 'Hakone cherry blossom spring'],
  'myogisan-sakura':          ['Myogisan sakura cherry blossom Gunma', 'Myogi mountain cherry blossom'],
  'takao-mountain':           ['Takao mountain cherry blossom spring', 'Mount Takao sakura'],
  'jindai-botanical':         ['Jindai botanical garden cherry blossom', 'Chofu cherry blossom garden'],
  'hadano-tokawa-park':       ['Hadano Tokawa park cherry blossom Kanagawa', 'Tanzawa cherry blossom spring'],
  'tenranzan':                ['Tenranzan cherry blossom Hanno', 'Hanno mountain cherry spring'],
  'koishikawa-korakuen':      ['Koishikawa Korakuen cherry blossom garden', 'Korakuen garden sakura spring'],
  'odawara-castle':           ['Odawara castle cherry blossom moat', 'Odawara sakura castle spring'],
  'kinugasayama-park':        ['Kinugasa mountain park cherry blossom', 'Yokosuka sakura cherry park'],
}

function isCherryBlossomUrl(url) {
  if (!url) return false
  const decoded = decodeURIComponent(url)
  const lower = decoded.toLowerCase()
  // Ohka は桜ではなく航空機名
  if (lower.includes('ohka') || lower.includes('mxy7')) return false
  return (
    lower.includes('sakura') ||
    lower.includes('cherry') ||
    lower.includes('blossom') ||
    lower.includes('hanami') ||
    lower.includes('桜')
  )
}

async function fetchCommonsImage(query) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=20` +
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

    // ファイル名に桜キーワードが含まれるものを優先
    const cherry = pages.find(p => isCherryBlossomUrl(p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url ?? ''))
    const best = cherry ?? null // 桜ファイルが見つからない場合は返さない
    if (!best) return null
    return best.imageinfo?.[0]?.thumburl ?? best.imageinfo?.[0]?.url ?? null
  } catch {
    return null
  }
}

async function main() {
  const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))

  // 衣笠山公園のOhka（航空機）画像を除去
  for (const spot of spots) {
    if (spot.imageUrl && !isCherryBlossomUrl(spot.imageUrl)) {
      console.log(`除去: ${spot.name} - ${spot.imageUrl.split('/').pop()?.slice(0, 50)}`)
      spot.imageUrl = null
    }
  }

  const nullSpots = spots.filter(s => s.imageUrl === null)
  console.log(`\n未取得スポット: ${nullSpots.length}件\n`)

  let found = 0, stillNotFound = 0

  for (const spot of nullSpots) {
    const queries = PATCH3_QUERIES[spot.id]
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
      console.log(`✓ ${spot.name.padEnd(20)} ${imageUrl.split('/').pop()?.slice(0, 55)}`)
    } else {
      stillNotFound++
      console.log(`✗ ${spot.name}`)
    }
  }

  // spots に反映
  for (const s of spots) {
    const patched = nullSpots.find(n => n.id === s.id)
    if (patched) s.imageUrl = patched.imageUrl
  }

  fs.writeFileSync(SPOTS_PATH, JSON.stringify(spots, null, 2), 'utf-8')
  console.log(`\n追加取得: ${found}件, 残り未取得: ${stillNotFound}件`)
  console.log(`合計: ${spots.filter(s => s.imageUrl).length}/95件`)
}

main().catch(console.error)
