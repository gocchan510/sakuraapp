import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Spot } from '../utils/spotsByWeek'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function pinColor(variety: string): string {
  if (variety.includes('カワヅザクラ')) return '#ce93d8'
  if (variety.includes('フユザクラ') || variety.includes('ジュウガツザクラ')) return '#90caf9'
  return '#f06292'
}

function makeIcon(color: string, isHighlight: boolean, isDimmed: boolean) {
  const size = isHighlight ? 36 : 26
  const opacity = isDimmed ? 0.35 : 1
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36" opacity="${opacity}">
      <circle cx="18" cy="18" r="14" fill="${color}" stroke="white" stroke-width="${isHighlight ? 3 : 2}"/>
      ${isHighlight ? '<circle cx="18" cy="18" r="6" fill="white"/>' : ''}
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

interface Props {
  spots: Spot[]
  filterWeek: string | null   // nullなら全件表示
  todayWeek: string
  onSelectSpot: (spotId: string) => void
}

export function AllSpotsMap({ spots, filterWeek, todayWeek, onSelectSpot }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

    const map = L.map(containerRef.current, {
      center: [35.65, 139.6],
      zoom: 9,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // 重複座標除去（同じ場所に複数スポットは最初の1件だけピン）
    const seen = new Set<string>()

    spots.forEach((s) => {
      if (s.lat === null || s.lng === null) return
      const key = `${s.lat},${s.lng}`
      if (seen.has(key)) return
      seen.add(key)

      const inFilter = filterWeek ? s.peakWeeks.includes(filterWeek) : true
      const isHighlight = filterWeek
        ? s.peakWeeks.includes(filterWeek)
        : s.peakWeeks.includes(todayWeek)
      const isDimmed = filterWeek ? !inFilter : false
      const color = pinColor(s.variety)
      const icon = makeIcon(color, isHighlight, isDimmed)

      const marker = L.marker([s.lat, s.lng], { icon }).addTo(map)
        .bindPopup(`
          <div style="min-width:150px">
            <b style="font-size:13px">${s.name}</b><br/>
            <span style="font-size:11px;color:#888">${s.variety}</span><br/>
            <span style="font-size:11px;color:#999">📍 尻手から${s.travelTime}</span>
          </div>
        `)

      marker.on('popupopen', () => {
        const btn = document.createElement('button')
        btn.textContent = '詳細を見る →'
        btn.style.cssText = 'margin-top:6px;display:block;background:#e91e8c;color:white;border:none;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;width:100%'
        btn.onclick = () => onSelectSpot(s.id)
        marker.getPopup()?.getElement()?.querySelector('.leaflet-popup-content')?.appendChild(btn)
      })
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [spots, filterWeek, todayWeek, onSelectSpot])

  return <div ref={containerRef} className="all-spots-map" />
}
