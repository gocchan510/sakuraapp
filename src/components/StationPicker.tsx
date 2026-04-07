import { useState, useRef, useEffect } from 'react'
import stationsData from '../data/stations.json'
import type { Station } from '../utils/travelTime'
import { useLang } from '../i18n'

interface Props {
  current: Station
  onSelect: (station: Station) => void
  onClose: () => void
}

export function StationPicker({ current, onSelect, onClose }: Props) {
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // 少し遅らせてフォーカス（モーダルアニメーション後）
    const id = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(id)
  }, [])

  const stations = stationsData as Station[]

  const filtered = query.trim()
    ? stations.filter(s => s.name.includes(query.trim()))
    : stations

  // エリアでグループ化（元の並び順を維持）
  const areaOrder: string[] = []
  const grouped: Record<string, Station[]> = {}
  for (const s of filtered) {
    if (!grouped[s.area]) {
      grouped[s.area] = []
      areaOrder.push(s.area)
    }
    grouped[s.area].push(s)
  }

  return (
    <div className="station-picker-overlay" onClick={onClose}>
      <div className="station-picker-modal" onClick={e => e.stopPropagation()}>

        {/* ヘッダー */}
        <div className="station-picker-header">
          <h2 className="station-picker-title">{t.fromStationSelect}</h2>
          <button className="station-picker-close" onClick={onClose}>✕</button>
        </div>

        {/* 検索 */}
        <div className="station-search-wrap">
          <span className="station-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="station-search-input"
            placeholder={t.stationSearchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="station-search-clear" onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {/* リスト */}
        <div className="station-list">
          {areaOrder.length === 0 && (
            <div className="station-not-found">該当なし</div>
          )}
          {areaOrder.map(area => (
            <div key={area}>
              <div className="station-area-label">{area}</div>
              <div className="station-area-items">
                {grouped[area].map(s => (
                  <button
                    key={s.id}
                    className={`station-item ${s.id === current.id ? 'station-item-selected' : ''}`}
                    onClick={() => { onSelect(s); onClose() }}
                  >
                    {s.name}
                    {s.id === current.id && <span className="station-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="station-picker-note">{t.travelTimeNote}</p>
      </div>
    </div>
  )
}
