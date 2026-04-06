import spotsData from '../data/spots.json'

export type Spot = typeof spotsData[number]

/** 指定週ラベルのスポット一覧を返す */
export function getSpotsForWeek(weekLabel: string): Spot[] {
  return spotsData.filter(s => s.peakWeeks.includes(weekLabel))
}

/** オフシーズンかどうか（スポットが0件の週） */
export function isOffSeason(weekLabel: string): boolean {
  return getSpotsForWeek(weekLabel).length === 0
}
