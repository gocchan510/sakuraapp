export interface Variety {
  id: string
  no: string
  name: string
  reading: string
  bloomSeason: string
  bloomGroup?: string | null
  someiyoshinoOffset?: number | null
  color: string
  colorCode: string
  flowerShape: string
  tags: string[]
  summary: string
  features: string
  history: string
  background: string
  trivia: string
  wikiTitleJa: string
  wikiTitleEn: string
  emoji: string
  aliases?: string[]
  hasImage?: boolean
  images?: { file: string; source?: string; author?: string; license?: string; originalUrl?: string }[]
  rarity?: {
    score: number
    stars: string
    label: string
    reasons: string[]
  }
  spots?: { spotId: string; spotName: string; linkSource?: string }[]
}
