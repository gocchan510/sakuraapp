// スポットの開花状況を計算するユーティリティ（SpotListPage・SpotListCard共用）
import spotsData from '../data/spots.json'
import varietiesData from '../data/varieties.json'
import type { Variety } from '../types'
import { getTotalOffset, adjustBloomPeriod, isInBloomAdjusted, hasOffsetData } from './bloomOffset'
import { bloomOrd, periodsOverlap } from './bloomFilter'

export type BloomStatus = 'in_bloom' | 'budding' | 'past_bloom' | 'upcoming' | 'off_season'

const allVarieties = varietiesData as unknown as Variety[]
export const varietiesById = new Map(allVarieties.map(v => [v.id, v]))

// ── 期間ベースのフォールバック（オフセットなし） ─────────────────
function getCurrentPeriod(): string {
  const d = new Date()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const jun = day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late'
  return `${String(m).padStart(2, '0')}-${jun}`
}

const TODAY_PERIOD = getCurrentPeriod()
const TODAY_ORD = bloomOrd(TODAY_PERIOD)

function varietyBloomStatusFallback(
  bp: { start?: string; end?: string; secondary?: { start: string; end: string } | null }
): BloomStatus {
  if (!bp?.start || !bp?.end) return 'off_season'
  if (periodsOverlap(TODAY_PERIOD, TODAY_PERIOD, bp.start, bp.end)) return 'in_bloom'
  if (bp.secondary && periodsOverlap(TODAY_PERIOD, TODAY_PERIOD, bp.secondary.start, bp.secondary.end)) return 'in_bloom'
  const startOrd = bloomOrd(bp.start)
  const endOrd = bloomOrd(bp.end)
  const wraps = endOrd < startOrd
  if (!wraps) {
    if (endOrd < TODAY_ORD) return 'past_bloom'
    return (startOrd - TODAY_ORD) <= 2 ? 'budding' : 'upcoming'
  }
  return 'off_season'
}

// ── オフセット込みの開花ステータス ───────────────────────────────
export function getVarietyBloomStatus(
  bp: { start?: string; end?: string; secondary?: { start: string; end: string } | null } | null | undefined,
  totalOffset: number,
  today = new Date()
): BloomStatus {
  if (!bp?.start || !bp?.end) return 'off_season'
  if (totalOffset === 0) return varietyBloomStatusFallback(bp)
  if (isInBloomAdjusted({ start: bp.start, end: bp.end }, totalOffset, today)) return 'in_bloom'
  if (bp.secondary && isInBloomAdjusted({ start: bp.secondary.start, end: bp.secondary.end }, totalOffset, today)) return 'in_bloom'
  const { startDate, endDate } = adjustBloomPeriod({ start: bp.start, end: bp.end }, totalOffset)
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (todayDate > endDate) return 'past_bloom'
  const daysUntil = (startDate.getTime() - todayDate.getTime()) / 86400000
  return daysUntil <= 20 ? 'budding' : 'upcoming'
}

// ── ソート用スコア（0=見頃中・正値=これから・1000+=散った） ──────
function getDaysScore(
  bp: { start: string; end: string },
  totalOffset: number,
  today: Date
): number {
  const { startDate, endDate } = adjustBloomPeriod(bp, totalOffset)
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (todayDate >= startDate && todayDate <= endDate) return 0
  if (todayDate > endDate) return 1000 + (todayDate.getTime() - endDate.getTime()) / 86400000
  return (startDate.getTime() - todayDate.getTime()) / 86400000
}

function estimateFromPeakMonth(text: string): BloomStatus {
  const months = [...(text ?? '').matchAll(/(\d+)月/g)].map(m => +m[1])
  if (!months.length) return 'off_season'
  const today = new Date()
  const m = today.getMonth() + 1
  const min = Math.min(...months)
  const max = Math.max(...months)
  if (m >= min && m <= max) return 'in_bloom'
  if (m === min - 1) return 'budding'
  if (m > max) return 'past_bloom'
  return (min - m <= 1) ? 'budding' : 'upcoming'
}

const STATUS_PRIORITY: Record<BloomStatus, number> = {
  in_bloom: 0, budding: 1, upcoming: 2, past_bloom: 3, off_season: 4
}

// ── スポットの開花状況を計算 ─────────────────────────────────────
type SpotLike = {
  id: string
  lat?: number | null
  lng?: number | null
  varieties?: string[]
  peakMonth?: string | number
}

export function computeSpotBloom(
  spot: SpotLike,
  today = new Date()
): { status: BloomStatus; daysScore: number } {
  const ids = spot.varieties ?? []

  if (!ids.length) {
    const status = estimateFromPeakMonth(String(spot.peakMonth ?? ''))
    const daysScore = { in_bloom: 0, budding: 10, upcoming: 500, past_bloom: 1100, off_season: 9999 }[status]
    return { status, daysScore }
  }

  const offset = (spot.lat && spot.lng && hasOffsetData())
    ? getTotalOffset(spot.lat, spot.lng).totalOffset
    : 0

  let bestStatus: BloomStatus = 'off_season'
  let bestDaysScore = 99999

  for (const id of ids) {
    const v = varietiesById.get(id)
    if (!v?.bloomPeriod?.start || !v?.bloomPeriod?.end) continue
    const status = getVarietyBloomStatus(v.bloomPeriod, offset, today)
    const daysScore = getDaysScore({ start: v.bloomPeriod.start, end: v.bloomPeriod.end }, offset, today)
    if (STATUS_PRIORITY[status] < STATUS_PRIORITY[bestStatus]) bestStatus = status
    if (Math.abs(daysScore) < Math.abs(bestDaysScore)) bestDaysScore = daysScore
  }

  return { status: bestStatus, daysScore: bestDaysScore }
}

// ── モジュールロード時に全スポット分を一括計算（キャッシュ） ─────
const allSpots = spotsData as unknown as SpotLike[]
const TODAY = new Date()

export const spotBloomCache = new Map<string, { status: BloomStatus; daysScore: number }>(
  allSpots.map(s => [s.id, computeSpotBloom(s, TODAY)])
)

// ── スポットの品種を見頃順・レア度順に並べて返す ─────────────────
export function getSortedVarieties(
  spot: SpotLike,
  today = TODAY
): Array<{ id: string; variety: Variety; status: BloomStatus }> {
  const offset = (spot.lat && spot.lng && hasOffsetData())
    ? getTotalOffset(spot.lat, spot.lng).totalOffset
    : 0

  return (spot.varieties ?? [])
    .map(id => {
      const v = varietiesById.get(id)
      if (!v) return null
      const status = getVarietyBloomStatus(v.bloomPeriod, offset, today)
      return { id, variety: v, status }
    })
    .filter((x): x is { id: string; variety: Variety; status: BloomStatus } => x !== null)
    .sort((a, b) => {
      const rs = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
      if (rs !== 0) return rs
      return (b.variety.rarity?.score ?? 0) - (a.variety.rarity?.score ?? 0)
    })
}
