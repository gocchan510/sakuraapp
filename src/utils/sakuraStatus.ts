import statusData from '../data/sakura_status.json'

// スポット名 → 気象庁観測地点名
const SPOT_TO_STATION: Record<string, string> = {
  '皇居東御苑': '東京', '飛鳥山公園': '東京', '新宿御苑': '東京',
  '小石川後楽園': '東京', '千鳥ヶ淵緑道': '東京', '目黒川': '東京',
  '上野恩賜公園': '東京', '荒川堤（荒川自然公園）': '東京',
  '神代植物公園': '東京', '奥多摩・御岳山': '東京', '砧公園': '東京',
  '井の頭恩賜公園': '東京', '小金井公園': '東京', '国営昭和記念公園': '東京',
  '隅田公園': '東京', '六義園': '東京', '播磨坂桜並木': '東京',
  '夢の島公園': '東京',
  '大岡川プロムナード': '横浜', '三浦海岸': '横浜', '松田山ハーブガーデン': '横浜',
  '県立七沢森林公園': '横浜', '箱根強羅公園': '横浜', '県立三ツ池公園': '横浜',
  '三溪園': '横浜', '荒井城址公園': '横浜', '座間市芹沢公園': '横浜',
  '八景島シーパラダイス周辺': '横浜', '宮城野早川堤': '横浜',
  '二ヶ領用水宿河原堀': '横浜', '生田緑地': '横浜',
  '幸手権現堂桜堤': '熊谷', '城峯公園': '熊谷', '宝登山': '熊谷',
  '大宮公園': '熊谷', '北浅羽桜堤公園': '熊谷', '武蔵一宮氷川神社参道': '熊谷',
  '武蔵丘陵森林公園': '熊谷', '天覧山・多峯主山': '熊谷', '熊谷桜堤': '熊谷',
  '熱海糸川': '静岡', '河津桜まつり会場': '静岡',
  '妙義山さくらの里': '前橋',
  '清水公園': '東京', '亥鼻公園': '東京', '千葉公園': '東京',
  '泉自然公園': '東京', '成田さくらの山': '東京', '佐倉城址公園': '東京',
  '青葉の森公園': '東京',
}

const SOMEI_COMPATIBLE_VARIETIES = new Set([
  'ソメイヨシノ', 'ヤマザクラ', 'ヤマザクラ系', 'オオカンザクラ',
  'カンザン（八重）', 'ケイオウザクラ・シダレザクラ', 'サトザクラ系（遅咲き）',
  'ギョイコウ・ウコン', 'ソメイヨシノ・ヤマザクラ', 'ソメイヨシノ・カンザン',
  'ソメイヨシノ・ヤエザクラ', 'ソメイヨシノ・シダレザクラ・ヤエザクラ',
  'ソメイヨシノ・オオシマザクラ・カンザン', 'ソメイヨシノ・ヤエザクラ・多品種',
  'ソメイヨシノ・ヤエザクラ・シダレザクラ',
])

export function isSomeiCompatible(variety: string): boolean {
  if (SOMEI_COMPATIBLE_VARIETIES.has(variety)) return true
  // ソメイヨシノを含む組み合わせ品種も対象
  return variety.includes('ソメイヨシノ') || variety.includes('ヤマザクラ')
}

type StationEntry = {
  date: string | null
  heikinsa: number | null
  heikinDate: string | null
} | null

export type SpotStatus = {
  station: string
  kaika: StationEntry
  mankai: StationEntry
}

export function getSpotStatus(spotName: string): SpotStatus | null {
  const station = SPOT_TO_STATION[spotName]
  if (!station) return null
  const stations = (statusData as Record<string, unknown>).stations as Record<string, { kaika: StationEntry; mankai: StationEntry }>
  const data = stations?.[station]
  if (!data || (!data.kaika && !data.mankai)) return null
  return { station, kaika: data.kaika, mankai: data.mankai }
}

export function getStatusUpdated(): string | null {
  return ((statusData as Record<string, unknown>).updated as string) ?? null
}

export function formatHeikinsa(val: number | null): string {
  if (val === null) return ''
  if (val === 0) return '平年並み'
  const abs = Math.abs(val)
  return val < 0 ? `平年より${abs}日早` : `平年より${abs}日遅`
}
