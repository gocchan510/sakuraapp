// spots.json から必要なフィールドだけ引くルックアップ
import spotsData from '../../src/data/spots.json'
import varietiesJa from '../../src/data/varieties.json'
import varietiesEn from '../../src/data/varieties_en.json'
import varietiesZhTw from '../../src/data/varieties_zh-TW.json'

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

/** spot.varieties[] の先頭から最大 N 件の品種名を指定言語で返す。
 *  IDマップに無ければ、その文字列（生の日本語品種名）をフォールバックで返す。 */
export function getVarietyNames(
  ids: string[] | undefined,
  lang: 'ja' | 'en' | 'zh-TW',
  max = 3,
): string[] {
  if (!ids || ids.length === 0) return []
  const m = varMap[lang]
  const names: string[] = []
  for (const id of ids) {
    if (names.length >= max) break
    const name = m.get(id) || id // フォールバックは生文字列
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}
