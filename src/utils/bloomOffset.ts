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

const ALL_STATIONS = offsetData.offsets as OffsetEntry[]

// ── Haversine ─────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── 東京基準値（地域差計算の基準） ──────────────────────────
function parseNormalDateMMDD(mmdd: string): Date {
  const [m, d] = mmdd.split('-').map(Number)
  return new Date(2000, m - 1, d)  // 閏年の2000年で統一
}

const TOKYO_ENTRY = ALL_STATIONS.find(o => o.station === '東京')
const TOKYO_NORMAL_DATE = TOKYO_ENTRY?.normalBloomDate
  ? parseNormalDateMMDD(TOKYO_ENTRY.normalBloomDate)
  : new Date(2000, 2, 24)  // fallback: 3月24日

// ── 地域差の計算（地点の平年値 − 東京の平年値）────────────
function getRegionalDiff(normalBloomDate: string): number {
  const local = parseNormalDateMMDD(normalBloomDate)
  return Math.round((local.getTime() - TOKYO_NORMAL_DATE.getTime()) / (1000 * 60 * 60 * 24))
}

// ── 最寄り地点検索 ────────────────────────────────────────────
// 地域差用: normalBloomDate がある地点なら距離制限なし
function findNearestWithNormal(lat: number, lng: number): OffsetEntry | null {
  const candidates = ALL_STATIONS.filter(o => o.normalBloomDate)
  if (!candidates.length) return null
  return candidates.reduce((best, o) => {
    return haversine(lat, lng, o.lat, o.lng) < haversine(lat, lng, best.lat, best.lng) ? o : best
  })
}

// 今年のズレ用: 観測済み地点のみ、200km 以内
const MAX_DISTANCE_KM = 200

function findNearestObserved(lat: number, lng: number): OffsetEntry | null {
  const observed = ALL_STATIONS.filter(o => o.status === 'observed' && o.offsetDays !== null)
  if (!observed.length) return null
  let best = { dist: Infinity, entry: null as OffsetEntry | null }
  for (const o of observed) {
    const d = haversine(lat, lng, o.lat, o.lng)
    if (d < best.dist) best = { dist: d, entry: o }
  }
  return best.dist <= MAX_DISTANCE_KM ? best.entry : null
}

// ── 合計オフセット取得（地域差 + 今年のズレ）─────────────────
export function getTotalOffset(lat: number, lng: number): {
  regionalDiff: number
  yearlyOffset: number
  totalOffset: number
  stationName: string | null
} {
  const normalStation = findNearestWithNormal(lat, lng)
  const regionalDiff = normalStation?.normalBloomDate
    ? getRegionalDiff(normalStation.normalBloomDate)
    : 0

  const observedStation = findNearestObserved(lat, lng)
  const yearlyOffset = observedStation?.offsetDays ?? 0

  return {
    regionalDiff,
    yearlyOffset,
    totalOffset: regionalDiff + yearlyOffset,
    stationName: normalStation?.station ?? null,
  }
}

// v1 互換: 今年のズレのみ（内部での後方互換用）
export function getOffsetDaysForLocation(lat: number, lng: number): number {
  return findNearestObserved(lat, lng)?.offsetDays ?? 0
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

// ── 補正対象チェック（3月中旬以前の冬桜・河津桜等は対象外）──
const SPRING_THRESHOLD = 311  // MMDD: 3月11日

function shouldAdjust(bloomStart: string): boolean {
  const range = periodToMmddRange(bloomStart)
  if (!range) return false
  return range.start > SPRING_THRESHOLD
}

// ── bloomPeriod を補正して実日付に変換 ───────────────────────
export interface AdjustedBloomResult {
  startDate: Date
  endDate: Date
  adjusted: boolean
}

export function adjustBloomPeriod(
  bloomPeriod: { start: string; end: string },
  totalOffset: number
): AdjustedBloomResult {
  const startRange = periodToMmddRange(bloomPeriod.start)
  const endRange   = periodToMmddRange(bloomPeriod.end)

  if (!startRange || !endRange) {
    return { startDate: new Date(0), endDate: new Date(0), adjusted: false }
  }

  const startDate = mmddToDate(startRange.start)
  const endDate   = mmddToDate(endRange.end)

  if (!shouldAdjust(bloomPeriod.start) || totalOffset === 0) {
    return { startDate, endDate, adjusted: false }
  }

  return {
    startDate: addDays(startDate, totalOffset),
    endDate:   addDays(endDate,   totalOffset),
    adjusted:  true,
  }
}

export function isInBloomAdjusted(
  bloomPeriod: { start: string; end: string } | null | undefined,
  totalOffset: number,
  today: Date = new Date()
): boolean {
  if (!bloomPeriod?.start || !bloomPeriod?.end) return false
  const { startDate, endDate } = adjustBloomPeriod(bloomPeriod, totalOffset)
  return today >= startDate && today <= endDate
}

// ── 補正後の見頃時期を日本語ラベルで返す ──────────────────────
function dateToJunLabel(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const jun = d <= 10 ? '上旬' : d <= 20 ? '中旬' : '下旬'
  return `${m}月${jun}`
}

export function adjustedBloomLabel(
  bloomPeriod: { start: string; end: string } | null | undefined,
  totalOffset: number
): string | null {
  if (!bloomPeriod?.start || !bloomPeriod?.end) return null
  const { startDate, endDate, adjusted } = adjustBloomPeriod(bloomPeriod, totalOffset)
  if (startDate.getTime() === 0) return null
  const startLabel = dateToJunLabel(startDate)
  const endLabel   = dateToJunLabel(endDate)
  const label = startLabel === endLabel ? startLabel : `${startLabel}〜${endLabel}`
  return adjusted ? label : label  // 表示は同じ、呼び出し側で adjusted フラグを使える
}

// ── ユーティリティ ────────────────────────────────────────────
export function hasOffsetData(): boolean {
  return ALL_STATIONS.some(o => o.status === 'observed' && o.offsetDays !== null)
}

export const OFFSET_UPDATED_AT: string = offsetData.updatedAt
export const OFFSET_SEASON: number = offsetData.season
