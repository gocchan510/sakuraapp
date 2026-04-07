/**
 * Wikipedia API で各スポットの画像URLを取得し spots.json に保存する
 * 実行: node scripts/fetch-spot-images.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

// スポットIDに対応するWikipedia記事名（直接マッチしない場合の代替名）
const WIKI_NAMES = {
  'kokyo-higashigyoen':      '皇居東御苑',
  'asukayama-park':          '飛鳥山公園',
  'nanasawa-forest':         '七沢森林公園',
  'atami-itogawa':           '糸川 (熱海市)',
  'kawazu-matsuri':          '河津桜',
  'miura-kaigan':            '三浦海岸駅',
  'matsudayama-herb':        '松田山ハーブガーデン',
  'ofuna-flower-center':     '大船フラワーセンター',
  'okagawa-yokohama':        '大岡川',
  'zama-seriyuze':           '座間市',
  'miyagino-hayakawa':       '早川堤',
  'yumenoshima-park':        '夢の島公園',
  'hakkeijima':              '横浜・八景島シーパラダイス',
  'kitaasaba-sakuratsutsumi':'北浅羽桜堤公園',
  'shinjuku-gyoen':          '新宿御苑',
  'koishikawa-korakuen':     '小石川後楽園',
  'koishikawa-botanical':    '東京大学大学院理学系研究科附属植物園',
  'mukojima-hyakkaen':       '向島百花園',
  'rikugien':                '六義園',
  'arai-shiroshigoto':       '荒井城址公園',
  'odawara-castle':          '小田原城',
  'chidorigafuchi':          '千鳥ヶ淵',
  'meguro-river':            '目黒川',
  'mitsuike-park':           '三ツ池公園',
  'sankei-en':               '三溪園',
  'sagamihara-park':         '相模原公園',
  'shikino-mori-park':       '四季の森公園',
  'yamashita-park':          '山下公園',
  'minato-mieru-oka-park':   '港の見える丘公園',
  'yokohama-park-nihon-odori':'横浜公園',
  'kodomo-shizen-park':      '横浜市こども自然公園',
  'nikkaryodo-sakura':       '二ヶ領用水',
  'ikuta-ryokuchi':          '生田緑地',
  'kinuta-park':             '砧公園',
  'inokashira-park':         '井の頭恩賜公園',
  'hibiya-park':             '日比谷公園',
  'hama-rikyu':              '浜離宮恩賜庭園',
  'kyu-shiba-rikyu':         '旧芝離宮恩賜庭園',
  'yoyogi-park':             '代々木公園',
  'somei-cemetery':          '染井霊園',
  'ueno-park':               '上野恩賜公園',
  'sumida-park':             '隅田公園',
  'harimabashi-promenade':   '播磨坂',
  'kasai-rinkai-park':       '葛西臨海公園',
  'kiba-park':               '木場公園',
  'senzokuike-park':         '洗足池',
  'todoroki-ravine':         '等々力渓谷',
  'zenpukujigawa-ryokuchi':  '善福寺川緑地',
  'otonashi-park':           '音無親水公園',
  'koganei-park':            '小金井公園',
  'showa-kinen-park':        '国営昭和記念公園',
  'tama-reien':              '多磨霊園',
  'musashino-park':          '武蔵野公園',
  'shakujii-park':           '石神井公園',
  'hikarigaoka-park':        '光が丘公園',
  'toneri-park':             '舎人公園',
  'omiya-park':              '大宮公園',
  'hikawa-sando':            '武蔵一宮氷川神社',
  'kitakoshigaya-motoarakawa':'元荒川',
  'sakitama-kofun-park':     'さきたま古墳公園',
  'gongendo-sakuratsutsumi': '権現堂桜堤',
  'kumagaya-sakuratsutsumi': '熊谷桜堤',
  'musashikyuryo':           '武蔵丘陵森林公園',
  'kawagoe-kitain':          '喜多院',
  'tokorozawa-kokuu-park':   '所沢航空記念公園',
  'yoshimi-hyakuana-sakura': '吉見百穴',
  'hanyuu-suigo-park':       '羽生水郷公園',
  'tokigawa-sakuratsutsumi': '都幾川',
  'satomi-park':             '里見公園',
  'inohana-park':            '亥鼻公園',
  'chiba-park':              '千葉公園',
  'inage-seaside-park':      '稲毛海浜公園',
  'izumi-nature-park':       '泉自然公園',
  'naritasan-sakura':        '成田空港',
  'naritasan-park':          '成田山新勝寺',
  'sakura-castle':           '佐倉城',
  'inba-numa-cycling-road':  '印旛沼',
  'funabashi-ebigawa':       '海老川',
  'aoba-forest':             '千葉県立青葉の森公園',
  'shimizu-park':            '清水公園',
  'tsurugaoka-hachimangu':   '鶴岡八幡宮',
  'koboyama-park':           '弘法山',
  'kinugasayama-park':       '衣笠山公園',
  'arakawa-tsutsumi':        '荒川自然公園',
  'mitake-okutagawa':        '御岳山',
  'takao-mountain':          '高尾山',
  'jindai-botanical':        '神代植物公物園',
  'hadano-tokawa-park':      '秦野戸川公園',
  'tenranzan':               '天覧山',
  'nagatoro-sakura':         '長瀞',
  'chichibu-hitsujiyama-park':'羊山公園',
  'hodosan':                 '宝登山',
  'shimine-park':            '城峯公園',
  'hakone-gora':             '強羅公園',
  'myogisan-sakura':         '妙義山',
}

async function fetchWikipediaImage(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=800&pilicense=any&format=json&origin=*`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SakuraApp/1.0 (educational project)' }
    })
    if (!res.ok) return null
    const data = await res.json()
    const pages = data.query?.pages ?? {}
    const page = Object.values(pages)[0]
    if (!page || page.missing !== undefined) return null
    return page.thumbnail?.source ?? null
  } catch (e) {
    return null
  }
}

async function main() {
  const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))
  let found = 0, notFound = 0

  for (const spot of spots) {
    const wikiTitle = WIKI_NAMES[spot.id] ?? spot.name
    const imageUrl = await fetchWikipediaImage(wikiTitle)

    if (imageUrl) {
      spot.imageUrl = imageUrl
      found++
      console.log(`✓ ${spot.name.padEnd(20)} → ${imageUrl.slice(0, 60)}...`)
    } else {
      spot.imageUrl = null
      notFound++
      console.log(`✗ ${spot.name} (${wikiTitle})`)
    }

    // Rate limit: 150ms間隔
    await new Promise(r => setTimeout(r, 150))
  }

  fs.writeFileSync(SPOTS_PATH, JSON.stringify(spots, null, 2), 'utf-8')
  console.log(`\n完了: ${found}件取得, ${notFound}件未取得`)
}

main().catch(console.error)
