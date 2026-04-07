import { useLang } from '../i18n'
import { estimateMinutes, DEFAULT_STATION } from '../utils/travelTime'
import type { Station } from '../utils/travelTime'
import type { Spot } from '../utils/spotsByWeek'

interface Props {
  weekLabel: string
  spots: Spot[]
  onSelect: (spotId: string) => void
  onBack: () => void
  fromStation?: Station
}

export function SpotList({ weekLabel, spots, onSelect, onBack, fromStation = DEFAULT_STATION }: Props) {
  const { t } = useLang()
  const isDefault = fromStation.id === 'shitte'
  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={onBack}>{t.backCalendar}</button>
        <div className="header-petal">🌸</div>
        <h1 className="app-title">{weekLabel}</h1>
        <p className="app-subtitle">{spots.length}{t.spotsUnit}</p>
      </header>

      <main className="spot-list">
        {spots.map((s) => (
          <button
            key={s.id}
            className="spot-list-item"
            onClick={() => onSelect(s.id)}
          >
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
        ))}
      </main>
    </div>
  )
}
