/** "MM-jun" → 比較用整数 (例: "04-mid" → 13) */
export function bloomOrd(period: string): number {
  const [month, jun] = period.split('-')
  const junVal = ({ early: 0, mid: 1, late: 2 } as Record<string, number>)[jun] ?? 0
  return parseInt(month) * 3 + junVal
}

const MIN_ORD = bloomOrd('01-early') // 3
const MAX_ORD = bloomOrd('12-late')  // 38

/** 2つの期間が重なるか（冬越えの wrap-around に対応） */
export function periodsOverlap(
  fs: string, fe: string,
  bs: string, be: string,
): boolean {
  const fso = bloomOrd(fs), feo = bloomOrd(fe)
  const bso = bloomOrd(bs), beo = bloomOrd(be)
  const filterWraps = feo < fso
  const bloomWraps  = beo < bso

  if (!filterWraps && !bloomWraps) {
    return bso <= feo && beo >= fso
  }
  if (filterWraps && !bloomWraps) {
    // フィルタ = [fso, MAX] ∪ [MIN, feo]
    return (bso <= MAX_ORD && beo >= fso) || (bso <= feo && beo >= MIN_ORD)
  }
  if (!filterWraps && bloomWraps) {
    // 開花 = [bso, MAX] ∪ [MIN, beo]
    return bso <= feo || beo >= fso
  }
  return true // 両方ラップ → 必ず重なる
}

export interface BloomPeriodLike {
  start: string
  end: string
  secondary: { start: string; end: string } | null
}

/** 品種がフィルタ期間にマッチするか（primary OR secondary） */
export function varietyMatchesFilter(
  bp: BloomPeriodLike | null | undefined,
  filterStart: string,
  filterEnd: string,
): boolean {
  if (!bp) return true
  if (periodsOverlap(filterStart, filterEnd, bp.start, bp.end)) return true
  if (bp.secondary &&
      periodsOverlap(filterStart, filterEnd, bp.secondary.start, bp.secondary.end)) return true
  return false
}

/** 全36期間リスト */
export const ALL_PERIODS = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0')
  return [
    { value: `${m}-early`, label: `${i + 1}月上旬` },
    { value: `${m}-mid`,   label: `${i + 1}月中旬` },
    { value: `${m}-late`,  label: `${i + 1}月下旬` },
  ]
}).flat()

export interface BloomPreset {
  key: string
  label: string
  emoji: string
  start: string
  end: string
}

export const BLOOM_PRESETS: BloomPreset[] = [
  { key: 'early',      label: '早咲き',   emoji: '🌱', start: '02-early', end: '03-late' },
  { key: 'peak',       label: '見頃',     emoji: '🌸', start: '04-early', end: '04-mid'  },
  { key: 'late',       label: '遅咲き',   emoji: '🌿', start: '04-late',  end: '05-late' },
  { key: 'autumn',     label: '秋冬咲き', emoji: '🍂', start: '09-early', end: '02-late' },
]
