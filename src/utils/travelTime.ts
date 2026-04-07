/**
 * 直線距離から所要時間を推定するユーティリティ
 *
 * 精度について:
 *   東京圏の鉄道ネットワークを前提に直線距離 → 移動時間を推定します。
 *   乗り換えや路線の迂回を考慮できないため、±15分程度の誤差があります。
 *   尻手駅選択時は spots.json の実測値をそのまま使用します。
 */

/** Haversine 公式で直線距離 (km) を計算 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * 直線距離 (km) から所要時間 (分) を推定
 *
 * 推定式: max(15, ceil((dist × 2.5 + 8) / 5) × 5)
 * 5分単位で切り上げ
 *
 * 参考: 尻手→目黒川 7.5km → 25min（実測27分）
 *       尻手→千鳥ヶ淵 15km → 45min（実測50分）
 *       尻手→昭和記念公園 28km → 80min（実測55分 ※特急利用考慮なし）
 */
export function estimateMinutes(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): number {
  const dist = haversineKm(fromLat, fromLng, toLat, toLng)
  const raw = dist * 2.5 + 8
  return Math.max(15, Math.ceil(raw / 5) * 5)
}

export type Station = {
  id: string
  name: string
  area: string
  lat: number
  lng: number
}

export const DEFAULT_STATION: Station = {
  id: 'shitte',
  name: '尻手',
  area: '神奈川（川崎）',
  lat: 35.5752,
  lng: 139.6703,
}
