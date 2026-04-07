/**
 * Wikimedia Commons で「スポット名 桜」検索し、桜の写真URLを spots.json に保存する
 * 実行: node scripts/fetch-spot-images.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

// スポットごとに検索ワードを上書き（デフォルトは "スポット名 桜"）
const SEARCH_OVERRIDES = {
  'kokyo-higashigyoen':       '皇居東御苑 桜',
  'asukayama-park':           '飛鳥山公園 桜',
  'nanasawa-forest':          '七沢森林公園 桜',
  'atami-itogawa':            '糸川 桜 熱海',
  'kawazu-matsuri':           '河津桜まつり',
  'miura-kaigan':             '三浦海岸 河津桜',
  'matsudayama-herb':         '松田山 河津桜',
  'ofuna-flower-center':      '大船植物園 桜',
  'okagawa-yokohama':         '大岡川 桜 横浜',
  'zama-seriyuze':            '座間 桜 芹沢公園',
  'miyagino-hayakawa':        '早川堤 桜 小田原',
  'yumenoshima-park':         '夢の島公園 桜',
  'hakkeijima':               '八景島 桜',
  'kitaasaba-sakuratsutsumi': '北浅羽桜堤 桜',
  'shinjuku-gyoen':           '新宿御苑 桜',
  'koishikawa-korakuen':      '小石川後楽園 桜',
  'koishikawa-botanical':     '小石川植物園 桜',
  'mukojima-hyakkaen':        '向島百花園 桜',
  'rikugien':                 '六義園 枝垂れ桜',
  'arai-shiroshigoto':        '荒井城址公園 桜',
  'odawara-castle':           '小田原城 桜',
  'chidorigafuchi':           '千鳥ヶ淵 桜',
  'meguro-river':             '目黒川 桜',
  'mitsuike-park':            '三ツ池公園 桜',
  'sankei-en':                '三溪園 桜',
  'sagamihara-park':          '相模原公園 桜',
  'shikino-mori-park':        '四季の森公園 桜',
  'yamashita-park':           '山下公園 桜 横浜',
  'minato-mieru-oka-park':    '港の見える丘公園 桜',
  'yokohama-park-nihon-odori':'横浜公園 桜',
  'kodomo-shizen-park':       '横浜こども自然公園 桜',
  'nikkaryodo-sakura':        '二ヶ領用水 桜 川崎',
  'ikuta-ryokuchi':           '生田緑地 桜',
  'kinuta-park':              '砧公園 桜',
  'inokashira-park':          '井の頭公園 桜',
  'hibiya-park':              '日比谷公園 桜',
  'hama-rikyu':               '浜離宮 桜',
  'kyu-shiba-rikyu':          '旧芝離宮 桜',
  'yoyogi-park':              '代々木公園 桜',
  'somei-cemetery':           '染井霊園 桜',
  'ueno-park':                '上野公園 桜',
  'sumida-park':              '隅田公園 桜',
  'harimabashi-promenade':    '播磨坂 桜並木',
  'kasai-rinkai-park':        '葛西臨海公園 桜',
  'kiba-park':                '木場公園 桜',
  'senzokuike-park':          '洗足池 桜',
  'todoroki-ravine':          '等々力渓谷 桜',
  'zenpukujigawa-ryokuchi':   '善福寺川 桜',
  'otonashi-park':            '音無親水公園 桜',
  'koganei-park':             '小金井公園 桜',
  'showa-kinen-park':         '昭和記念公園 桜',
  'tama-reien':               '多磨霊園 桜',
  'musashino-park':           '武蔵野公園 桜',
  'shakujii-park':            '石神井公園 桜',
  'hikarigaoka-park':         '光が丘公園 桜',
  'toneri-park':              '舎人公園 桜',
  'omiya-park':               '大宮公園 桜',
  'hikawa-sando':             '氷川神社 桜 大宮',
  'kitakoshigaya-motoarakawa':'元荒川 桜 越谷',
  'sakitama-kofun-park':      'さきたま古墳公園 桜',
  'gongendo-sakuratsutsumi':  '権現堂 桜堤',
  'kumagaya-sakuratsutsumi':  '熊谷桜堤 桜',
  'musashikyuryo':            '武蔵丘陵森林公園 桜',
  'kawagoe-kitain':           '喜多院 桜 川越',
  'tokorozawa-kokuu-park':    '所沢航空記念公園 桜',
  'yoshimi-hyakuana-sakura':  '吉見百穴 桜',
  'hanyuu-suigo-park':        '羽生水郷公園 桜',
  'tokigawa-sakuratsutsumi':  '都幾川 桜',
  'satomi-park':              '里見公園 桜',
  'inohana-park':             '亥鼻公園 桜 千葉',
  'chiba-park':               '千葉公園 桜',
  'inage-seaside-park':       '稲毛海浜公園 桜',
  'izumi-nature-park':        '泉自然公園 桜',
  'naritasan-sakura':         '成田山 桜',
  'naritasan-park':           '成田山公園 桜',
  'sakura-castle':            '佐倉城址公園 桜',
  'inba-numa-cycling-road':   '印旛沼 桜 サイクリング',
  'funabashi-ebigawa':        '海老川 桜 船橋',
  'aoba-forest':              '青葉の森公園 桜 千葉',
  'shimizu-park':             '清水公園 桜',
  'tsurugaoka-hachimangu':    '鶴岡八幡宮 桜 鎌倉',
  'koboyama-park':            '弘法山 桜 秦野',
  'kinugasayama-park':        '衣笠山公園 桜',
  'arakawa-tsutsumi':         '荒川 桜堤 東京',
  'mitake-okutagawa':         '御岳渓谷 桜',
  'takao-mountain':           '高尾山 桜',
  'jindai-botanical':         '神代植物公園 桜',
  'hadano-tokawa-park':       '秦野戸川公園 桜',
  'tenranzan':                '天覧山 桜 飯能',
  'nagatoro-sakura':          '長瀞 桜 荒川',
  'chichibu-hitsujiyama-park':'羊山公園 芝桜',
  'hodosan':                  '宝登山 桜',
  'shimine-park':             '城峯公園 冬桜',
  'hakone-gora':              '強羅公園 桜 箱根',
  'myogisan-sakura':          '妙義山 桜',
}

// 桜ファイルらしいかチェック（ファイル名に桜関連キーワードが含まれるものを優先）
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
  // ファイル名に桜キーワードが含まれるものを優先しつつ、最初のヒットを返す
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=10` +
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

    // 1. ファイル名に桜キーワードが入っているものを優先
    const cherry = pages.find(p => isCherryBlossomFile(p.title ?? ''))
    const best = cherry ?? pages[0]
    return best.imageinfo?.[0]?.thumburl ?? best.imageinfo?.[0]?.url ?? null
  } catch {
    return null
  }
}

async function main() {
  const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))
  let found = 0, notFound = 0

  for (const spot of spots) {
    const query = SEARCH_OVERRIDES[spot.id] ?? `${spot.name} 桜`
    const imageUrl = await fetchCommonsImage(query)

    if (imageUrl) {
      spot.imageUrl = imageUrl
      found++
      console.log(`✓ ${spot.name.padEnd(20)} → ${imageUrl.slice(0, 70)}...`)
    } else {
      spot.imageUrl = null
      notFound++
      console.log(`✗ ${spot.name} (query: ${query})`)
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200))
  }

  fs.writeFileSync(SPOTS_PATH, JSON.stringify(spots, null, 2), 'utf-8')
  console.log(`\n完了: ${found}件取得, ${notFound}件未取得`)
}

main().catch(console.error)
