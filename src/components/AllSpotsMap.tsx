import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// 品種カテゴリごとのピン色
function pinColor(variety: string): string {
  if (variety === 'オフシーズン') return '#ccc'
  if (['カワヅザクラ'].includes(variety)) return '#ce93d8'
  if (['フユザクラ', 'ジュウガツザクラ', 'フユザクラ・ジュウガツザクラ'].includes(variety)) return '#90caf9'
  return '#f06292' // 春の桜
}

function makeIcon(color: string, isToday: boolean) {
  const size = isToday ? 36 : 28
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="14" fill="${color}" stroke="white" stroke-width="${isToday ? 3 : 2}"/>
      ${isToday ? '<circle cx="18" cy="18" r="6" fill="white"/>' : ''}
    </svg>
  `
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  })
}

interface Spot {
  week: string
  variety: string
  spot: string
  prefecture: string
  comment: string
  travelTime: string
  lat: number | null
  lng: number | null
}

interface Props {
  spots: Spot[]
  todayIndex: number
  onSelectSpot: (index: number) => void
}

export function AllSpotsMap({ spots, todayIndex, onSelectSpot }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = L.map(containerRef.current, {
      center: [35.65, 139.6],
      zoom: 9,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // 重複スポットをまとめる（同じ lat/lng に複数週ある場合）
    const seen = new Map<string, number>() // "lat,lng" → 最初のindex

    spots.forEach((s, i) => {
      if (s.lat === null || s.lng === null) return
      if (s.variety === 'オフシーズン') return

      const key = `${s.lat},${s.lng}`
      if (seen.has(key)) return
      seen.set(key, i)

      const isToday = i === todayIndex
      const color = pinColor(s.variety)
      const icon = makeIcon(color, isToday)

      const marker = L.marker([s.lat, s.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:140px">
            <b style="font-size:13px">${s.spot}</b><br/>
            <span style="font-size:11px;color:#888">${s.variety}</span><br/>
            <span style="font-size:11px">${s.week}</span><br/>
            <span style="font-size:11px;color:#999">📍 尻手から${s.travelTime}</span>
          </div>
        `)

      marker.on('popupopen', () => {
        // ポップアップ内に「詳細を見る」ボタンを動的に追加
        const btn = document.createElement('button')
        btn.textContent = '詳細を見る →'
        btn.style.cssText = 'margin-top:6px;display:block;background:#e91e8c;color:white;border:none;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;width:100%'
        btn.onclick = () => onSelectSpot(i)
        marker.getPopup()?.getElement()?.querySelector('.leaflet-popup-content')?.appendChild(btn)
      })
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [spots, todayIndex, onSelectSpot])

  return <div ref={containerRef} className="all-spots-map" />
}
