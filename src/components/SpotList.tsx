import { useState, useMemo } from 'react'
import { useLang } from '../i18n'
import { estimateMinutes, DEFAULT_STATION } from '../utils/travelTime'
import type { Station } from '../utils/travelTime'
import type { Spot } from '../utils/spotsByWeek'
import { formatDateDisplay } from '../utils/calendarUtils'
import { getPrefStatus } from '../utils/sakuraStatus'

// 開花状況の表示順（数値が小さいほど「今見ごろ」）
const BLOOM_RANK: Record<string, number> = {
  '見頃':     1,
  '散り始め': 2,
  '開花':     3,
  '開花前':   4,
  '葉桜':     5,
}
function bloomScore(spot: Spot): number {
  const s = getPrefStatus(spot.prefecture)
  if (!s) return 9
  return BLOOM_RANK[s.status] ?? 6
}

type SortKey = 'default' | 'bloom' | 'distance' | 'popularity'

interface Props {
  weekLabel: string
  selectedDate: string | null
  spots: Spot[]
  onSelect: (spotId: string) => void
  onBack: () => void
  fromStation?: Station
  planDates: Record<string, string[]>
  onTogglePlan: (dateStr: string, spotId: string) => void
  lang?: string
}

export function SpotList({
  weekLabel,
  selectedDate,
  spots,
  onSelect,
  onBack,
  fromStation = DEFAULT_STATION,
  planDates,
  onTogglePlan,
  lang = 'ja',
}: Props) {
  const { t } = useLang()
  const [sortKey, setSortKey] = useState<SortKey>('default')
  const isDefault = fromStation.id === 'shitte'

  const plannedIdsForDate = selectedDate ? (planDates[selectedDate] ?? []) : []

  const sorted = useMemo(() => {
    const arr = [...spots]
    switch (sortKey) {
      case 'bloom':
        return arr.sort((a, b) => {
          const diff = bloomScore(a) - bloomScore(b)
          // 同順位は人気順で補助ソート
          return diff !== 0 ? diff : b.popularity - a.popularity
        })
      case 'distance':
        return arr.sort((a, b) => {
          const da = estimateMinutes(fromStation.lat, fromStation.lng, a.lat, a.lng)
          const db = estimateMinutes(fromStation.lat, fromStation.lng, b.lat, b.lng)
          return da - db
        })
      case 'popularity':
        return arr.sort((a, b) => b.popularity - a.popularity)
      default:
        // 計画済みを上に、残りは元の順
        return arr.sort((a, b) => {
          const aP = plannedIdsForDate.includes(a.id) ? 0 : 1
          const bP = plannedIdsForDate.includes(b.id) ? 0 : 1
          return aP - bP
        })
    }
  }, [spots, sortKey, fromStation, plannedIdsForDate])

  const toggleSort = (key: SortKey) => setSortKey(prev => (prev === key ? 'default' : key))

  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={onBack}>{t.backCalendar}</button>
        <div className="header-petal">🌸</div>
        {selectedDate ? (
          <>
            <h1 className="app-title">{formatDateDisplay(selectedDate, lang)}</h1>
            <p className="app-subtitle">{weekLabel} · {spots.length}{t.spotsUnit}</p>
          </>
        ) : (
          <>
            <h1 className="app-title">{weekLabel}</h1>
            <p className="app-subtitle">{spots.length}{t.spotsUnit}</p>
          </>
        )}
      </header>

      {/* ── ソートバー ── */}
      <div className="sort-bar">
        <button
          className={`sort-chip${sortKey === 'bloom' ? ' sort-chip-active' : ''}`}
          onClick={() => toggleSort('bloom')}
        >🌸 {t.sortBloom}</button>
        <button
          className={`sort-chip${sortKey === 'distance' ? ' sort-chip-active' : ''}`}
          onClick={() => toggleSort('distance')}
        >📍 {t.sortDistance}</button>
        <button
          className={`sort-chip${sortKey === 'popularity' ? ' sort-chip-active' : ''}`}
          onClick={() => toggleSort('popularity')}
        >⭐ {t.sortPopularity}</button>
      </div>

      <main className="spot-list">
        {sorted.map((s) => {
          const inPlan = plannedIdsForDate.includes(s.id)
          const prefStatus = sortKey === 'bloom' ? getPrefStatus(s.prefecture) : null
          const distMin = sortKey === 'distance'
            ? estimateMinutes(fromStation.lat, fromStation.lng, s.lat, s.lng)
            : null

          return (
            <button
              key={s.id}
              className={`spot-list-item${inPlan ? ' spot-list-item-planned' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              {/* ★ ボタン */}
              {selectedDate && (
                <button
                  className={`plan-star-btn${inPlan ? ' plan-star-active' : ''}`}
                  onClick={e => { e.stopPropagation(); onTogglePlan(selectedDate, s.id) }}
                  aria-label={inPlan ? 'この日の計画から削除' : 'この日の計画に追加'}
                >
                  {inPlan ? '★' : '☆'}
                </button>
              )}

              <div className="sli-left">
                <span className="sli-name">{s.name}</span>
                <span className="sli-prefecture">{s.prefecture}</span>
              </div>

              <div className="sli-right">
                {/* ソートキーに応じてサブ情報を差し替え */}
                {sortKey === 'bloom' && prefStatus ? (
                  <span className={`sli-bloom-badge sli-bloom-${bloomScore(s)}`}>
                    {prefStatus.status}
                  </span>
                ) : sortKey === 'bloom' ? (
                  <span className="sli-bloom-badge sli-bloom-9">{t.bloomNoData}</span>
                ) : sortKey === 'popularity' ? (
                  <span className="sli-stars">{'★'.repeat(s.popularity)}{'☆'.repeat(5 - s.popularity)}</span>
                ) : sortKey === 'distance' && distMin !== null ? (
                  <span className="sli-dist">約{distMin}分</span>
                ) : (
                  <span className="sli-variety">{s.variety}</span>
                )}
                <span className="sli-travel">
                  📍 {isDefault ? s.travelTime : `約${estimateMinutes(fromStation.lat, fromStation.lng, s.lat, s.lng)}分`}
                  {!isDefault && <span className="estimate-badge-sm">推</span>}
                </span>
              </div>
              <span className="sli-arrow">›</span>
            </button>
          )
        })}
      </main>
    </div>
  )
}
