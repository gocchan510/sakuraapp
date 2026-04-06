import statusData from '../data/sakura_status.json'

// スポット名 → 気象庁観測地点名
const SPOT_TO_STATION: Record<string, string> = {
  // 東京観測点
  '皇居東御苑': '東京',
  '飛鳥山公園': '東京',
  '新宿御苑': '東京',
  '小石川後楽園': '東京',
  '千鳥ヶ淵緑道': '東京',
  '目黒川': '東京',
  '上野公園': '東京',
  '荒川堤（荒川自然公園）': '東京',
  '神代植物公園': '東京',
  '奥多摩・御岳山': '東京',
  '砧公園・世田谷': '東京',
  '生田緑地・川崎': '横浜',
  // 横浜観測点
  '大岡川沿い・横浜': '横浜',
  '三浦海岸': '横浜',
  '松田山ハーブガーデン': '横浜',
  '県立七沢森林公園': '横浜',
  '箱根強羅公園': '横浜',
  // 熊谷観測点（埼玉）
  '幸手権現堂桜堤': '熊谷',
  '城峯公園': '熊谷',
  '宝登山': '熊谷',
  // 静岡観測点
  '熱海糸川': '静岡',
  '河津桜まつり会場': '静岡',
  // 前橋観測点（群馬）
  '妙義山さくらの里': '前橋',
  // 千葉（データなければ東京で代用）
  '清水公園': '東京',
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
  if (!data) return null
  if (!data.kaika && !data.mankai) return null

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
