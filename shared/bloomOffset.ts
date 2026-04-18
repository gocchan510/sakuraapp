// ソメイヨシノ基準の開花計算エンジン（フロント・バック共有）
import offsetData from '../src/data/bloom-offset.json'
import bloomGroupsData from '../src/data/bloomGroups.json'

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

interface BloomGroupDef {
  label: string
  offset: number
  offsetMin: number
  offsetMax: number
  bloomDurationDays: number
  secondaryBloom?: { startMonth: number; endMonth: number }
}

export const BLOOM_GROUPS: Record<string, BloomGroupDef> = bloomGroupsData as Record<string, BloomGroupDef>

const ALL_STATIONS = offsetData.offsets as OffsetEntry[]

// ── Haversine ─────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── 東京基準値 ─────────────────────────────────────────────────
function parseNormalDateMMDD(mmdd: string): Date {
  const [m, d] = mmdd.split('-').map(Number)
  return new Date(2000, m - 1, d)
}

const TOKYO_ENTRY = ALL_STATIONS.find(o => o.station === '東京')
export const TOKYO_NORMAL_DATE = TOKYO_ENTRY?.normalBloomDate
  ? parseNormalDateMMDD(TOKYO_ENTRY.normalBloomDate)
  : new Date(2000, 2, 24)

function getRegionalDiff(normalBloomDate: string): number {
  const local = parseNormalDateMMDD(normalBloomDate)
  return Math.round((local.getTime() - TOKYO_NORMAL_DATE.getTime()) / (1000 * 60 * 60 * 24))
}

function findNearestWithNormal(lat: number, lng: number): OffsetEntry | null {
  const candidates = ALL_STATIONS.filter(o => o.normalBloomDate)
  if (!candidates.length) return null
  return candidates.reduce((best, o) => {
    return haversine(lat, lng, o.lat, o.lng) < haversine(lat, lng, best.lat, best.lng) ? o : best
  })
}

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

export function getOffsetDaysForLocation(lat: number, lng: number): number {
  return findNearestObserved(lat, lng)?.offsetDays ?? 0
}

export function getNearestObservedDistanceKm(lat: number, lng: number): number | null {
  const observed = ALL_STATIONS.filter(o => o.status === 'observed' && o.offsetDays !== null)
  if (!observed.length) return null
  let minDist = Infinity
  for (const o of observed) {
    const d = haversine(lat, lng, o.lat, o.lng)
    if (d < minDist) minDist = d
  }
  return minDist === Infinity ? null : minDist
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function getSomeiyoshinoDate(
  lat: number,
  lng: number,
  year = new Date().getFullYear()
): Date {
  const { totalOffset } = getTotalOffset(lat, lng)
  const base = new Date(year, TOKYO_NORMAL_DATE.getMonth(), TOKYO_NORMAL_DATE.getDate())
  return addDays(base, totalOffset)
}

export function getVarietyBloomWindow(
  bloomGroup: string | null | undefined,
  someiyoshinoOffset: number | null | undefined,
  someiyoshinoDate: Date
): { start: Date; end: Date } | null {
  const key = bloomGroup ?? 'unknown'
  const group = BLOOM_GROUPS[key]
  if (!group || key === 'unknown' || group.bloomDurationDays === 0) return null

  const offset = someiyoshinoOffset ?? group.offset
  const halfDur = Math.round(group.bloomDurationDays / 2)
  return {
    start: addDays(someiyoshinoDate, offset - halfDur),
    end:   addDays(someiyoshinoDate, offset + halfDur),
  }
}

export function isFuyuAutumnBloom(bloomGroup: string | null | undefined, today: Date): boolean {
  if (bloomGroup !== 'fuyu') return false
  const group = BLOOM_GROUPS['fuyu']
  if (!group?.secondaryBloom) return false
  const m = today.getMonth() + 1
  return m >= group.secondaryBloom.startMonth && m <= group.secondaryBloom.endMonth
}

export function hasOffsetData(): boolean {
  return ALL_STATIONS.some(o => o.status === 'observed' && o.offsetDays !== null)
}

export const OFFSET_UPDATED_AT: string = offsetData.updatedAt
export const OFFSET_SEASON: number = offsetData.season
