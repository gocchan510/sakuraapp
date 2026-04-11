export interface Discovery {
  varietyId: string
  spotId: string | null
  spotName: string | null
  lat: number | null
  lng: number | null
  date: string
}

const KEY = 'sakura-discoveries'

export function getDiscoveries(): Discovery[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch { return [] }
}

export function addDiscovery(d: Discovery): void {
  const all = getDiscoveries()
  all.unshift(d)
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 1000)))
}

export function getDiscoveredVarietyIds(): Set<string> {
  return new Set(getDiscoveries().map(d => d.varietyId))
}
