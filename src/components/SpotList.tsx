import { useLang } from '../i18n'
import { estimateMinutes, DEFAULT_STATION } from '../utils/travelTime'
import type { Station } from '../utils/travelTime'
import type { Spot } from '../utils/spotsByWeek'
import { formatDateDisplay } from '../utils/calendarUtils'

interface Props {
  weekLabel: string
  selectedDate: string | null   // "2026-04-05" など
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
  const isDefault = fromStation.id === 'shitte'

  // この日に計画済みのスポットID一覧
  const plannedIdsForDate = selectedDate ? (planDates[selectedDate] ?? []) : []

  // 計画済みスポットを上に、それ以外を下に並べる
  const sorted = [...spots].sort((a, b) => {
    const aIn = plannedIdsForDate.includes(a.id) ? 0 : 1
    const bIn = plannedIdsForDate.includes(b.id) ? 0 : 1
    return aIn - bIn
  })

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

      <main className="spot-list">
        {sorted.map((s) => {
          const inPlan = plannedIdsForDate.includes(s.id)
          return (
            <button
              key={s.id}
              className={`spot-list-item${inPlan ? ' spot-list-item-planned' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              {/* ★ ボタン：この日付に対してのみトグル */}
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
                <span className="sli-variety">{s.variety}</span>
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
