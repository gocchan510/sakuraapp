// スポットの開花状況を計算するユーティリティ（SpotListPage・SpotListCard共用）
import spotsData from '../data/spots.json'
import varietiesData from '../data/varieties.json'
import type { Variety } from '../types'
import { getSomeiyoshinoDate, getVarietyBloomWindow, isFuyuAutumnBloom, hasOffsetData } from './bloomOffset'

export type BloomStatus = 'in_bloom' | 'budding' | 'past_bloom' | 'upcoming' | 'off_season'

const allVarieties = varietiesData as unknown as Variety[]
export const varietiesById = new Map(allVarieties.map(v => [v.id, v]))

// ── 開花ウィンドウとtodayからステータスを計算 ──────────────────
export function statusFromWindow(
  window: { start: Date; end: Date } | null,
  today: Date = new Date()
): BloomStatus {
  if (!window) return 'off_season'
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (t >= window.start && t <= window.end) return 'in_bloom'
  if (t > window.end) return 'past_bloom'
  const daysUntil = (window.start.getTime() - t.getTime()) / 86400000
  return daysUntil <= 20 ? 'budding' : 'upcoming'
}

// ── 品種の開花ステータス（地点座標を使う） ────────────────────
export function getVarietyBloomStatus(
  bloomGroup: string | null | undefined,
  someiyoshinoOffset: number | null | undefined,
  someiyoshinoDate: Date,
  today = new Date()
): BloomStatus {
  // 二季咲き：秋の開花チェック
  if (isFuyuAutumnBloom(bloomGroup, today)) return 'in_bloom'
  const win = getVarietyBloomWindow(bloomGroup, someiyoshinoOffset, someiyoshinoDate)
  return statusFromWindow(win, today)
}

// ── ソート用スコア（0=見頃中, 正=これから(日数), 1000+=散り終わり） ──
function getDaysScore(
  bloomGroup: string | null | undefined,
  someiyoshinoOffset: number | null | undefined,
  someiyoshinoDate: Date,
  today: Date
): number {
  const win = getVarietyBloomWindow(bloomGroup, someiyoshinoOffset, someiyoshinoDate)
  if (!win) return 99999
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (t >= win.start && t <= win.end) return 0
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

  const someiyoshinoDate = (spot.lat && spot.lng && hasOffsetData())
    ? getSomeiyoshinoDate(spot.lat, spot.lng)
    : getSomeiyoshinoDate(35.6895, 139.6917)  // Tokyo fallback

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
