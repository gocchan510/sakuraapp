import spotsData from '../data/spots.json'

// spots.json の型を拡張（varieties が never[] に推論されるのを防ぐ）
type RawSpot = typeof spotsData[number]
export type Spot = Omit<RawSpot, 'varieties' | 'variety'> & {
  varieties?: string[]
  variety?: string
}

/** 指定週ラベルのスポット一覧を返す */
export function getSpotsForWeek(weekLabel: string): Spot[] {
  return spotsData.filter(s => (s.peakWeeks ?? []).includes(weekLabel))
}

/** オフシーズンかどうか（スポットが0件の週） */
export function isOffSeason(weekLabel: string): boolean {
  return getSpotsForWeek(weekLabel).length === 0
}
