import statusData from '../data/sakura_status.json'

// ─────────────────────────────────────────────────────────────
// 日付ベース見頃予測
// 気象庁の実測 満開日 + 標準的な落花ウィンドウで任意日の状態を推定
//   見頃:     満開日 〜 +7日
//   散り始め: +8日 〜 +14日
//   葉桜:    +15日以降
//   開花:    開花日 〜 満開日前日
//   null:    開花前 or データなし
// ─────────────────────────────────────────────────────────────

function parseJpDateStr(jpDate: string, year: number): Date | null {
  const m = /(\d+)月\s*(\d+)日/.exec(jpDate)
  if (!m) return null
  return new Date(year, parseInt(m[1]) - 1, parseInt(m[2]))
}

// 都道府県 → 最寄り観測ステーション
const PREF_TO_STATION: Record<string, string> = {
  '東京都':  '東京',
  '神奈川県': '横浜',
  '埼玉県':  '熊谷',
  '千葉県':  '東京',   // 千葉観測値未公表→東京で代替
  '静岡県':  '静岡',
  '群馬県':  '前橋',
}

export function getBloomStatusForDate(prefecture: string, dateStr: string): string | null {
  const stationName = PREF_TO_STATION[prefecture]
  if (!stationName) return null
  const stations = (statusData as Record<string, unknown>).stations as Record<
    string, { kaika: StationEntry; mankai: StationEntry }
  >
  const data = stations?.[stationName]
  if (!data?.mankai?.date) return null

  const year = parseInt(dateStr.slice(0, 4))
  const mankai = parseJpDateStr(data.mankai.date, year)
  if (!mankai) return null
  const kaika = data.kaika?.date ? parseJpDateStr(data.kaika.date, year) : null

  const target = new Date(dateStr)
  const diff = Math.round((target.getTime() - mankai.getTime()) / 86400000)

  if (diff < 0) {
    if (kaika && target >= kaika) return '開花'
    return null   // 開花前
  }
  if (diff <= 7)  return '見頃'
  if (diff <= 14) return '散り始め'
  return '葉桜'
}

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

// ── 都道府県ごとの現在ステータス（tenki.jp / Yahoo天気）────────────

export type PrefStatusEntry = {
  status: string
  source: string
} | null

export function getPrefStatus(prefecture: string): PrefStatusEntry {
  const prefStatus = (statusData as Record<string, unknown>).prefStatus as Record<string, PrefStatusEntry> | undefined
  return prefStatus?.[prefecture] ?? null
}

/** ステータス文字列 → CSSクラス名（色分け用） */
export function getStatusClass(status: string): string {
  if (status.includes('見頃')) return 'mikoro'
  if (status.includes('散り')) return 'chiri'
  if (status.includes('葉桜')) return 'hazakura'
  if (status.includes('開花前') || status.includes('未発表')) return 'mikaika'
  if (status.includes('開花')) return 'kaika'
  return 'mikaika'
}

/** ステータス文字列 → 絵文字 */
export function getStatusEmoji(status: string): string {
  if (status.includes('見頃')) return '🌸'
  if (status.includes('散り')) return '🌿'
  if (status.includes('葉桜')) return '🍃'
  if (status.includes('開花前') || status.includes('未発表')) return '🌱'
  if (status.includes('開花')) return '🌸'
  return '🌸'
}

export function formatHeikinsa(val: number | null, t?: { statusAvg: string; statusEarly: string; statusDayEarly: string; statusDayLate: string }): string {
  if (val === null) return ''
  if (!t) {
    if (val === 0) return '平年並み'
    const abs = Math.abs(val)
    return val < 0 ? `平年より${abs}日早` : `平年より${abs}日遅`
  }
  if (val === 0) return t.statusAvg
  const abs = Math.abs(val)
  return val < 0 ? `${t.statusEarly}${abs}${t.statusDayEarly}` : `${t.statusEarly}${abs}${t.statusDayLate}`
}
