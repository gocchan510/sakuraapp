import offsetData from '../data/bloom-offset.json'

// ── 型 ───────────────────────────────────────────────────────
interface OffsetEntry {
  station: string
  prefecture: string
  lat: number
  lng: number
  bloomDate: string | null
  fullBloomDate: string | null
  normalBloomDate: string | null
  normalFullBloomDate: string | null
  offsetDays: number | null
  fullBloomOffsetDays: number | null
  status: 'observed' | 'not_yet' | 'no_data'
}

// ── Haversine ─────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── 最寄り観測地点のオフセット取得 ──────────────────────────
const MAX_DISTANCE_KM = 200

export function getOffsetDaysForLocation(lat: number, lng: number): number {
  const observed = (offsetData.offsets as OffsetEntry[]).filter(
    o => o.status === 'observed' && o.offsetDays !== null
  )
  if (observed.length === 0) return 0

  let best = { dist: Infinity, offset: 0 }
  for (const o of observed) {
    const d = haversine(lat, lng, o.lat, o.lng)
    if (d < best.dist) best = { dist: d, offset: o.offsetDays! }
  }

  // 200km超は補正しない
  return best.dist <= MAX_DISTANCE_KM ? best.offset : 0
}

// ── MMDD 整数 ↔ Date 変換 ───────────────────────────────────
function mmddToDate(mmdd: number, year = new Date().getFullYear()): Date {
  const month = Math.floor(mmdd / 100)
  const day   = mmdd % 100
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// ── period → MMDD range ──────────────────────────────────────
function periodToMmddRange(period: string): { start: number; end: number } | null {
  const [monthStr, jun] = period.split('-')
  const m = parseInt(monthStr)
  if (isNaN(m) || m < 1 || m > 12) return null
  const lastDay = new Date(new Date().getFullYear(), m, 0).getDate()
  switch (jun) {
    case 'early': return { start: m * 100 + 1,  end: m * 100 + 10 }
    case 'mid':   return { start: m * 100 + 11, end: m * 100 + 20 }
    case 'late':  return { start: m * 100 + 21, end: m * 100 + lastDay }
    default:      return null
  }
}

// ── 補正しない条件チェック ───────────────────────────────────
// 03-mid(0311) 以前の start は補正しない（冬桜・河津桜等）
const SPRING_THRESHOLD = 311  // MMDD: 3月11日

function shouldAdjust(bloomStart: string): boolean {
  const range = periodToMmddRange(bloomStart)
  if (!range) return false
  return range.start > SPRING_THRESHOLD
}

// ── メイン: 補正した日付範囲で今日が開花中か判定 ─────────
export interface AdjustedBloomResult {
  startDate: Date
  endDate: Date
  adjusted: boolean
}

export function adjustBloomPeriod(
  bloomPeriod: { start: string; end: string },
  offsetDays: number
): AdjustedBloomResult {
  const startRange = periodToMmddRange(bloomPeriod.start)
  const endRange   = periodToMmddRange(bloomPeriod.end)

  if (!startRange || !endRange) {
    // fallback
    return { startDate: new Date(0), endDate: new Date(0), adjusted: false }
  }

  const startDate = mmddToDate(startRange.start)
  const endDate   = mmddToDate(endRange.end)

  if (!shouldAdjust(bloomPeriod.start) || offsetDays === 0) {
    return { startDate, endDate, adjusted: false }
  }

  return {
    startDate: addDays(startDate, offsetDays),
    endDate:   addDays(endDate,   offsetDays),
    adjusted:  true,
  }
}

export function isInBloomAdjusted(
  bloomPeriod: { start: string; end: string } | null | undefined,
  offsetDays: number,
  today: Date = new Date()
): boolean {
  if (!bloomPeriod?.start || !bloomPeriod?.end) return false
  const { startDate, endDate } = adjustBloomPeriod(bloomPeriod, offsetDays)
  return today >= startDate && today <= endDate
}

// ── offset が使えるかチェック ────────────────────────────────
export function hasOffsetData(): boolean {
  return (offsetData.offsets as OffsetEntry[]).some(o => o.status === 'observed' && o.offsetDays !== null)
}

export const OFFSET_UPDATED_AT: string = offsetData.updatedAt
export const OFFSET_SEASON: number = offsetData.season
