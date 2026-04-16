import offsetData from '../data/bloom-offset.json'

export const PREFS_LIST: string[] = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
  '沖縄県',
]

// bloom-offset.jsonの各prefectureの最初の地点座標
export const PREF_COORDS: Record<string, { lat: number; lng: number }> = (() => {
  const coords: Record<string, { lat: number; lng: number }> = {}
  for (const entry of (offsetData.offsets as Array<{ prefecture: string; lat: number; lng: number }>)) {
    if (!coords[entry.prefecture]) coords[entry.prefecture] = { lat: entry.lat, lng: entry.lng }
  }
  coords['沖縄県'] = { lat: 26.2124, lng: 127.6809 }
  return coords
})()

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export function detectPrefecture(lat: number, lng: number): string {
  const stations = offsetData.offsets as Array<{ prefecture: string; lat: number; lng: number }>
  if (!stations.length) return '全国'
  let bestDist = Infinity, bestPref = '全国'
  for (const s of stations) {
    const d = haversine(lat, lng, s.lat, s.lng)
    if (d < bestDist) { bestDist = d; bestPref = s.prefecture }
  }
  return bestPref
}

// localStorage (sakura_wizard_geo) から都道府県を取得。キャッシュなし→null
const GEO_KEY = 'sakura_wizard_geo'
const GEO_EXPIRY = 30 * 24 * 60 * 60 * 1000
export function getCachedPrefecture(): string | null {
  try {
    const cached = localStorage.getItem(GEO_KEY)
    if (!cached) return null
    const { lat, lng, ts } = JSON.parse(cached)
    if (Date.now() - ts < GEO_EXPIRY) return detectPrefecture(lat, lng)
  } catch { /* ignore */ }
  return null
}
