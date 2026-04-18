// スポットの開花状況を計算するユーティリティ（フロント・バック共有）
import spotsData from '../src/data/spots.json'
import varietiesData from '../src/data/varieties.json'
import type { Variety } from './types'
import { getSomeiyoshinoDate, getVarietyBloomWindow, isFuyuAutumnBloom, hasOffsetData } from './bloomOffset'

export type BloomStatus = 'in_bloom' | 'opening' | 'falling' | 'leaf' | 'budding' | 'upcoming' | 'off_season'

const allVarieties = varietiesData as unknown as Variety[]
export const varietiesById = new Map(allVarieties.map(v => [v.id, v]))

// ── 開花ウィンドウとtodayからステータスを計算 ──────────────────
export function statusFromWindow(
  window: { start: Date; end: Date } | null,
  today: Date = new Date()
): BloomStatus {
  if (!window) return 'off_season'
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (t > window.end) {
    const daysAfter = (t.getTime() - window.end.getTime()) / 86400000
    return daysAfter <= 7 ? 'leaf' : 'off_season'
  }

  if (t < window.start) {
    const daysUntil = (window.start.getTime() - t.getTime()) / 86400000
    return daysUntil <= 20 ? 'budding' : 'upcoming'
  }

  const duration = (window.end.getTime() - window.start.getTime()) / 86400000
  const elapsed  = (t.getTime() - window.start.getTime()) / 86400000
  const ratio = duration > 0 ? elapsed / duration : 0.5
  if (ratio < 0.35) return 'opening'
  if (ratio < 0.65) return 'in_bloom'
  return 'falling'
}

export function getVarietyBloomStatus(
  bloomGroup: string | null | undefined,
  someiyoshinoOffset: number | null | undefined,
  someiyoshinoDate: Date,
  today = new Date()
): BloomStatus {
  if (isFuyuAutumnBloom(bloomGroup, today)) return 'in_bloom'
  const win = getVarietyBloomWindow(bloomGroup, someiyoshinoOffset, someiyoshinoDate)
  return statusFromWindow(win, today)
}

function getDaysScore(
  bloomGroup: string | null | undefined,
  someiyoshinoOffset: number | null | undefined,
  someiyoshinoDate: Date,
  today: Date
): number {
  const win = getVarietyBloomWindow(bloomGroup, someiyoshinoOffset, someiyoshinoDate)
  if (!win) return 99999
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (t >= win.start && t <= win.end) {
    const duration = (win.end.getTime() - win.start.getTime()) / 86400000
    const elapsed  = (t.getTime() - win.start.getTime()) / 86400000
    const ratio = duration > 0 ? elapsed / duration : 0.5
    if (ratio < 0.35) return 1
    if (ratio < 0.65) return 0
    return 2
  }
  if (t > win.end) return 1000 + (t.getTime() - win.end.getTime()) / 86400000
  return (win.start.getTime() - t.getTime()) / 86400000
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
  if (m > max) return 'falling'
  return (min - m <= 1) ? 'budding' : 'upcoming'
}

export const STATUS_PRIORITY: Record<BloomStatus, number> = {
  in_bloom: 0, opening: 1, falling: 2, budding: 3, upcoming: 4, leaf: 5, off_season: 6
}

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
): { status: BloomStatus; daysScore: number; someiyoshinoStatus: BloomStatus } {
  const ids = spot.varieties ?? []

  const someiyoshinoDate = (spot.lat && spot.lng && hasOffsetData())
    ? getSomeiyoshinoDate(spot.lat, spot.lng)
    : getSomeiyoshinoDate(35.6895, 139.6917)
  const soWin = getVarietyBloomWindow('someiyoshino', 0, someiyoshinoDate)
  const someiyoshinoStatus: BloomStatus = (spot.lat && spot.lng)
    ? statusFromWindow(soWin, today)
    : 'off_season'

  if (!ids.length) {
    const status = estimateFromPeakMonth(String(spot.peakMonth ?? ''))
    const daysScore = { in_bloom: 0, opening: 1, falling: 2, budding: 10, upcoming: 500, leaf: 1100, off_season: 9999 }[status] ?? 9999
    return { status, daysScore, someiyoshinoStatus }
  }

  let bestStatus: BloomStatus = 'off_season'
  let bestDaysScore = 99999

  for (const id of ids) {
    const v = varietiesById.get(id)
    if (!v) continue
    const status = getVarietyBloomStatus(v.bloomGroup, v.someiyoshinoOffset ?? null, someiyoshinoDate, today)
    const daysScore = getDaysScore(v.bloomGroup, v.someiyoshinoOffset ?? null, someiyoshinoDate, today)
    if (STATUS_PRIORITY[status] < STATUS_PRIORITY[bestStatus]) bestStatus = status
    if (Math.abs(daysScore) < Math.abs(bestDaysScore)) bestDaysScore = daysScore
  }

  return { status: bestStatus, daysScore: bestDaysScore, someiyoshinoStatus }
}

const allSpots = spotsData as unknown as SpotLike[]
const TODAY = new Date()

export const spotBloomCache = new Map(
  allSpots.map(s => [s.id, computeSpotBloom(s, TODAY)])
)

export function getSortedVarieties(
  spot: SpotLike,
  today = TODAY
): Array<{ id: string; variety: Variety; status: BloomStatus }> {
  const someiyoshinoDate = (spot.lat && spot.lng && hasOffsetData())
    ? getSomeiyoshinoDate(spot.lat, spot.lng)
    : getSomeiyoshinoDate(35.6895, 139.6917)

  return (spot.varieties ?? [])
    .map(id => {
      const v = varietiesById.get(id)
      if (!v) return null
      const status = getVarietyBloomStatus(v.bloomGroup, v.someiyoshinoOffset ?? null, someiyoshinoDate, today)
      return { id, variety: v, status }
    })
    .filter((x): x is { id: string; variety: Variety; status: BloomStatus } => x !== null)
    .sort((a, b) => {
      const rs = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
      if (rs !== 0) return rs
      return (b.variety.rarity?.score ?? 0) - (a.variety.rarity?.score ?? 0)
    })
}
