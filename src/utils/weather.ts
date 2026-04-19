/**
 * Open-Meteo API 連携
 * 複数地点・複数日の天気を一度に取得
 */

export type WeatherCode =
  | 'clear' | 'partly' | 'cloudy' | 'fog'
  | 'rain' | 'snow' | 'shower' | 'snowshower' | 'thunder'

export type DayWeather = {
  code: WeatherCode
  tempMax: number        // 最高気温（摂氏）
  tempMin: number        // 最低気温（摂氏）
  /** 夜間（18-21時平均）の気温とコード */
  night?: {
    code: WeatherCode
    temp: number
  }
}

/** Open-Meteo の weathercode を絵文字カテゴリに変換 */
function mapWeatherCode(code: number): WeatherCode {
  if (code === 0) return 'clear'
  if (code >= 1 && code <= 3) return code === 1 ? 'partly' : 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'shower'
  if (code === 85 || code === 86) return 'snowshower'
  if (code >= 95) return 'thunder'
  return 'cloudy'
}

/** 絵文字マッピング（昼） */
export function weatherEmoji(code: WeatherCode): string {
  switch (code) {
    case 'clear':      return '☀️'
    case 'partly':     return '🌤️'
    case 'cloudy':     return '☁️'
    case 'fog':        return '🌫️'
    case 'rain':       return '🌧️'
    case 'snow':       return '❄️'
    case 'shower':     return '🌦️'
    case 'snowshower': return '🌨️'
    case 'thunder':    return '⛈️'
  }
}

/** 日付を YYYY-MM-DD に整形（Asia/Tokyo） */
function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 複数地点×複数日の天気を一括取得 */
export async function fetchWeatherForSpots(
  spots: { id: string; lat: number; lng: number }[],
  dates: Date[],
  includeNight: boolean
): Promise<Map<string, Map<string, DayWeather>>> {
  // 結果: Map<spotId, Map<YYYY-MM-DD, DayWeather>>
  const result = new Map<string, Map<string, DayWeather>>()
  if (spots.length === 0 || dates.length === 0) return result

  const lats = spots.map(s => s.lat).join(',')
  const lngs = spots.map(s => s.lng).join(',')
  const startDate = formatYmd(dates[0])
  const endDate = formatYmd(dates[dates.length - 1])

  const hourlyParam = includeNight ? '&hourly=temperature_2m,weather_code' : ''

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lats}&longitude=${lngs}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    hourlyParam +
    `&timezone=Asia/Tokyo` +
    `&start_date=${startDate}&end_date=${endDate}`

  try {
    const res = await fetch(url)
    if (!res.ok) return result
    const json = await res.json()
    // 単一地点なら object、複数地点なら array が返ってくる
    const arr = Array.isArray(json) ? json : [json]

    arr.forEach((entry: any, i: number) => {
      const spot = spots[i]
      if (!spot || !entry?.daily) return
      const daily = entry.daily
      const dayMap = new Map<string, DayWeather>()

      const times: string[] = daily.time ?? []
      times.forEach((ymd, idx) => {
        const code = mapWeatherCode(daily.weather_code?.[idx] ?? 0)
        const tempMax = Math.round(daily.temperature_2m_max?.[idx] ?? 0)
        const tempMin = Math.round(daily.temperature_2m_min?.[idx] ?? 0)
        const dw: DayWeather = { code, tempMax, tempMin }

        // 夜間（18-21時）の平均
        if (includeNight && entry.hourly) {
          const hTimes: string[] = entry.hourly.time ?? []
          const hCodes: number[] = entry.hourly.weather_code ?? []
          const hTemps: number[] = entry.hourly.temperature_2m ?? []
          const nightIdx: number[] = []
          hTimes.forEach((t, hi) => {
            if (!t.startsWith(ymd)) return
            const hour = parseInt(t.slice(11, 13), 10)
            if (hour >= 18 && hour <= 21) nightIdx.push(hi)
          })
          if (nightIdx.length > 0) {
            const avgTemp = Math.round(
              nightIdx.reduce((sum, i) => sum + (hTemps[i] ?? 0), 0) / nightIdx.length
            )
            // 代表コード = 時間帯の中央値
            const midCode = hCodes[nightIdx[Math.floor(nightIdx.length / 2)]] ?? 0
            dw.night = { code: mapWeatherCode(midCode), temp: avgTemp }
          }
        }

        dayMap.set(ymd, dw)
      })

      result.set(spot.id, dayMap)
    })
  } catch {
    // ネットワークエラー等: 空のMapを返す（呼び出し側で天気非表示）
  }

  return result
}

/** Date を YYYY-MM-DD に（Map のキー用） */
export function dateKey(d: Date): string {
  return formatYmd(d)
}
