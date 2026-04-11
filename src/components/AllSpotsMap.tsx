import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Spot } from '../utils/spotsByWeek'
import { getPrefStatus } from '../utils/sakuraStatus'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function pinColor(varieties: string[], varietyNote: string): string {
  const note = varietyNote || ''
  if (varieties.includes('kawazu-zakura') || note.includes('カワヅザクラ')) return '#ce93d8'
  if (varieties.includes('fuyuzakura') || varieties.includes('jugatsuzakura') ||
      note.includes('フユザクラ') || note.includes('ジュウガツザクラ')) return '#90caf9'
  return '#f06292'
}

// 開花状況→マーカー内ラベルと色の補正
const BLOOM_MARKER: Record<string, { label: string; rim: string }> = {
  '見頃':     { label: '満', rim: '#c62828' },
  '散り始め': { label: '散', rim: '#8d6e63' },
  '開花':     { label: '咲', rim: '#ad1457' },
  '開花前':   { label: '蕾', rim: '#7b8ccc' },
  '葉桜':     { label: '葉', rim: '#558b2f' },
}

function makeIcon(color: string, isHighlight: boolean, isDimmed: boolean, bloomStatus?: string) {
  const size = isHighlight ? 38 : 26
  const opacity = isDimmed ? 0.32 : 1
  const bm = bloomStatus ? BLOOM_MARKER[bloomStatus] : null
  const rimColor = bm ? bm.rim : 'white'
  const strokeW = isHighlight ? 3 : 2

  let inner = ''
  if (isHighlight && bm) {
    // 見頃状況ラベルを中央に表示
    inner = `<text x="19" y="24" text-anchor="middle" font-size="11" font-weight="bold" fill="white" font-family="sans-serif">${bm.label}</text>`
  } else if (isHighlight) {
    inner = '<circle cx="19" cy="19" r="6" fill="white"/>'
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 38 38" opacity="${opacity}">
    <circle cx="19" cy="19" r="15" fill="${color}" stroke="${rimColor}" stroke-width="${strokeW}"/>
    ${inner}
  </svg>`

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

      const peakWeeks = s.peakWeeks ?? []
      const inFilter = filterWeek ? peakWeeks.includes(filterWeek) : true
      const isHighlight = filterWeek
        ? peakWeeks.includes(filterWeek)
        : peakWeeks.includes(todayWeek)
      const isDimmed = filterWeek ? !inFilter : false
      const color = pinColor(s.varieties ?? [], s.varietyNote ?? '')

      // 現在の開花状況（ハイライトスポットのみ取得して表示）
      const prefStatus = isHighlight ? getPrefStatus(s.prefecture) : null
      const bloomStatus = prefStatus?.status
      const icon = makeIcon(color, isHighlight, isDimmed, bloomStatus)

      const bloomLine = bloomStatus
        ? `<br/><span style="font-size:11px;font-weight:bold;color:#c62828">🌸 ${bloomStatus}</span>`
        : ''

      const marker = L.marker([s.lat, s.lng], { icon }).addTo(map)
        .bindPopup(`
          <div style="min-width:150px">
            <b style="font-size:13px">${s.name}</b><br/>
            <span style="font-size:11px;color:#888">${s.varietyNote ?? ''}</span>${bloomLine}<br/>
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
