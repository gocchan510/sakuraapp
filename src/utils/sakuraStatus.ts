import statusData from '../data/sakura_status.json'

// ─────────────────────────────────────────────────────────────
// スポット × 日付 個別見頃予測
//
// spots.json の peakWeeks（スポット個別・品種個別の見頃週）を使用し、
// ソメイヨシノ系スポットは気象庁実測の満開日 heikinsa で補正する。
//
// アルゴリズム:
//   1. peakWeeks → 年月日範囲に変換
//   2. 連続する週を「シーズンクラスター」に集約（2週以上離れたら別シーズン）
//      ※ 飛鳥山のような冬桜+春桜の混在スポットに対応
//   3. 対象日に最も近いクラスターを選択
//   4. ソメイヨシノ系は JMA 満開日 heikinsa 日数でピーク窓を前後補正
//   5. ピーク窓との距離で状態を返す:
//        > 21日前  → null（開花前）
//        1〜21日前 → '開花'
//        窓内      → '見頃'
//        1〜10日後 → '散り始め'
//        11〜21日後→ '葉桜'
//        > 21日後  → null（終了）
// ─────────────────────────────────────────────────────────────

// 都道府県 → 最寄り観測ステーション（JMA補正用）
const PREF_TO_STATION: Record<string, string> = {
  '東京都':   '東京',
  '神奈川県': '横浜',
  '埼玉県':   '熊谷',
  '千葉県':   '東京',  // 千葉観測値未公表→東京で代替
  '静岡県':   '静岡',
  '群馬県':   '前橋',
}

/** 「N月第X週」→ その年の [開始日, 終了日] */
function weekLabelToRange(label: string, year: number): [Date, Date] | null {
  const m = /^(\d+)月第(\d+)週$/.exec(label)
  if (!m) return null
  const month = parseInt(m[1]) - 1          // 0-indexed
  const weekNum = parseInt(m[2])            // 1〜4
  const startDay = (weekNum - 1) * 7 + 1
  const endDay = weekNum < 4
    ? startDay + 6
    : new Date(year, month + 1, 0).getDate()  // 月末まで
  return [new Date(year, month, startDay), new Date(year, month, endDay)]
}

/** ソメイヨシノ系スポットの JMA 満開日ヘイキンサ補正値（日数） */
function getMankaiOffsetDays(prefecture: string): number {
  const stationName = PREF_TO_STATION[prefecture]
  if (!stationName) return 0
  const stations = (statusData as Record<string, unknown>).stations as Record<
    string, { kaika: StationEntry; mankai: StationEntry }
  >
  const heikinsa = stations?.[stationName]?.mankai?.heikinsa
  // heikinsa が負 = 今年は平年より早い → ピーク窓を heikinsa 日早める
  return typeof heikinsa === 'number' ? -heikinsa : 0
}

/**
 * スポット × 日付 → 見頃状態を返す
 * spot は { variety, peakWeeks, prefecture } を持つオブジェクト
 */
export function getBloomStatusForSpot(
  spot: { variety: string; peakWeeks: string[]; prefecture: string },
  dateStr: string
): string | null {
  const { peakWeeks, variety, prefecture } = spot
  if (!peakWeeks.length) return null

  const year = parseInt(dateStr.slice(0, 4))
  const targetMs = new Date(dateStr).getTime()

  // peakWeeks → 日付範囲リスト（ソート済み）
  const ranges = peakWeeks
    .map(w => weekLabelToRange(w, year))
    .filter((r): r is [Date, Date] => r !== null)
    .sort((a, b) => a[0].getTime() - b[0].getTime())
  if (!ranges.length) return null

  // シーズンクラスター集約（14日以内のギャップは同シーズン）
  type Cluster = { start: number; end: number }
  const clusters: Cluster[] = []
  let cur: Cluster = { start: ranges[0][0].getTime(), end: ranges[0][1].getTime() }
  for (let i = 1; i < ranges.length; i++) {
    const gapDays = (ranges[i][0].getTime() - cur.end) / 86400000
    if (gapDays <= 14) {
      cur.end = ranges[i][1].getTime()
    } else {
      clusters.push(cur)
      cur = { start: ranges[i][0].getTime(), end: ranges[i][1].getTime() }
    }
  }
  clusters.push(cur)

  // 対象日に最も近いクラスターを選択
  let best = clusters[0]
  let bestDist = Infinity
  for (const c of clusters) {
    const dist = targetMs < c.start ? c.start - targetMs
      : targetMs > c.end ? targetMs - c.end
      : 0
    if (dist < bestDist) { bestDist = dist; best = c }
  }

  // ソメイヨシノ系は JMA 実測 heikinsa でピーク窓を補正
  let offsetMs = 0
  if (isSomeiCompatible(variety)) {
    offsetMs = getMankaiOffsetDays(prefecture) * 86400000
  }
  const peakStart = best.start - offsetMs
  const peakEnd   = best.end   - offsetMs

  const daysBefore = (peakStart - targetMs) / 86400000
  const daysAfter  = (targetMs  - peakEnd)  / 86400000

  if (daysBefore > 21) return null        // 開花前（まだ遠い）
  if (daysBefore > 0)  return '開花'      // 直前〜開花期
  if (daysAfter <= 0)  return '見頃'      // ピーク窓内
  if (daysAfter <= 10) return '散り始め'
  if (daysAfter <= 21) return '葉桜'
  return null                             // 終了
}

// ─────────────────────────────────────────────────────────────
// 都道府県 × 日付 の簡易予測（カレンダードット用）
// JMA 観測満開日から直接計算（品種・スポット個別ではない）
// ─────────────────────────────────────────────────────────────
function parseJpDateStr(jpDate: string, year: number): Date | null {
  const m = /(\d+)月\s*(\d+)日/.exec(jpDate)
  if (!m) return null
  return new Date(year, parseInt(m[1]) - 1, parseInt(m[2]))
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
    return null
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
