import spotsData from '../data/spots.json'
import { formatDateDisplay, parseDateStr, dateToWeekLabel } from '../utils/calendarUtils'
import { useLang } from '../i18n'

interface Props {
  planDates: Record<string, string[]>
  onBack: () => void
  onSelectSpot: (id: string) => void
  onRemoveSpot: (dateStr: string, spotId: string) => void
  onEditDate: (dateStr: string, weekLabel: string) => void
  lang?: string
}

export function PlanView({ planDates, onBack, onSelectSpot, onRemoveSpot, onEditDate, lang }: Props) {
  const { t } = useLang()

  const sortedDates = Object.keys(planDates).sort()
  const totalSpots = Object.values(planDates).reduce((sum, ids) => sum + ids.length, 0)
  const isEmpty = sortedDates.length === 0

  return (
    <div className="plan-view-wrap">
      <header className="app-header">
        <div className="header-top-row">
          <button className="back-btn" onClick={onBack}>{t.backButton}</button>
        </div>
        <div className="plan-view-header-body">
          <span className="plan-view-icon">⭐</span>
          <div>
            <h1 className="app-title">{t.myPlan}</h1>
            {!isEmpty && (
              <p className="app-subtitle">
                {sortedDates.length}{t.planViewDays}　{totalSpots}{t.planViewSpots}
              </p>
            )}
          </div>
        </div>
      </header>

      {isEmpty ? (
        <div className="plan-view-empty">
          <div className="plan-view-empty-icon">🌸</div>
          <p className="plan-view-empty-msg">{t.planViewEmpty}</p>
          <p className="plan-view-empty-sub">{t.planViewEmptySub}</p>
          <button className="plan-view-go-cal-btn" onClick={onBack}>
            {t.planViewGoCalendar}
          </button>
        </div>
      ) : (
        <main className="plan-itinerary">
          {sortedDates.map(dateStr => {
            const spotIds = planDates[dateStr]
            const spots = spotIds
              .map(id => spotsData.find(s => s.id === id))
              .filter(Boolean) as typeof spotsData

            return (
              <section key={dateStr} className="plan-date-section">
                <div className="plan-date-header">
                  <span className="plan-date-label">{formatDateDisplay(dateStr, lang)}</span>
                  <button
                    className="plan-date-edit-btn"
                    onClick={() => onEditDate(dateStr, dateToWeekLabel(parseDateStr(dateStr)))}
                  >
                    {t.planViewEdit}
                  </button>
                </div>

                <ul className="plan-spot-list">
                  {spots.map(spot => (
                    <li key={spot.id} className="plan-spot-row">
                      <button
                        className="plan-spot-info"
                        onClick={() => onSelectSpot(spot.id)}
                      >
                        <span className="plan-spot-name">{spot.name}</span>
                        <span className="plan-spot-meta">{spot.prefecture} · {spot.variety}</span>
                      </button>
                      <button
                        className="plan-spot-remove-btn"
                        aria-label="削除"
                        onClick={() => onRemoveSpot(dateStr, spot.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {/* 下部のパディング */}
          <div style={{ height: 32 }} />
        </main>
      )}
    </div>
  )
}
