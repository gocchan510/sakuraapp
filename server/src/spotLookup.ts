// spots.json から必要なフィールドだけ引くルックアップ
import spotsData from '../../src/data/spots.json'

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
