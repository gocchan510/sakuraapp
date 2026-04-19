// spots.json から必要なフィールドだけ引くルックアップ
import spotsData from '../../src/data/spots.json'
import varietiesJa from '../../src/data/varieties.json'
import varietiesEn from '../../src/data/varieties_en.json'
import varietiesZhTw from '../../src/data/varieties_zh-TW.json'
import { varietiesById } from '../../shared/spotBloom.ts'
import { getVarietyBloomStatus } from '../../shared/spotBloom.ts'
import { getSomeiyoshinoDate, hasOffsetData } from '../../shared/bloomOffset.ts'

export interface SpotMeta {
  id: string
  name: string
  prefecture: string
  city: string
  lat?: number | null
  lng?: number | null
  varieties?: string[]
  peakMonth?: string | number
}

const spots = spotsData as unknown as SpotMeta[]
export const spotsById = new Map(spots.map(s => [s.id, s]))

export function getSpot(id: string): SpotMeta | undefined {
  return spotsById.get(id)
}

// ── 品種名ルックアップ ────────────────────────────────────────
interface VarietyLite { id: string; name: string }
const varMap = {
  ja: new Map((varietiesJa as VarietyLite[]).map(v => [v.id, v.name])),
  en: new Map((varietiesEn as VarietyLite[]).map(v => [v.id, v.name])),
  'zh-TW': new Map((varietiesZhTw as VarietyLite[]).map(v => [v.id, v.name])),
}

/** 今まさに見頃（in_bloom/opening）の品種名を最大 N 件返す。
 *  該当が1つも無い場合は空配列。嘘の品種を通知本文に含めないために使う。 */
export function getBloomingVarietyNames(
  spot: SpotMeta,
  today: Date,
  lang: 'ja' | 'en' | 'zh-TW',
  max = 3,
): string[] {
  const ids = spot.varieties ?? []
  if (ids.length === 0) return []

  const someiyoshinoDate = (spot.lat && spot.lng && hasOffsetData())
    ? getSomeiyoshinoDate(spot.lat, spot.lng)
    : getSomeiyoshinoDate(35.6895, 139.6917)

  const nameMap = varMap[lang]
  const names: string[] = []

  for (const id of ids) {
    if (names.length >= max) break
    const v = varietiesById.get(id)
    if (!v) continue
    const status = getVarietyBloomStatus(v.bloomGroup, v.someiyoshinoOffset, someiyoshinoDate, today)
    if (status !== 'in_bloom' && status !== 'opening') continue
    const name = nameMap.get(id) || v.name
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}
