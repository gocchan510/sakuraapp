import type { Spot } from '../utils/spotsByWeek'

interface Props {
  weekLabel: string
  spots: Spot[]
  onSelect: (spotId: string) => void
  onBack: () => void
}

export function SpotList({ weekLabel, spots, onSelect, onBack }: Props) {
  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={onBack}>← カレンダー</button>
        <div className="header-petal">🌸</div>
        <h1 className="app-title">{weekLabel}</h1>
        <p className="app-subtitle">{spots.length}件のスポット</p>
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
              <span className="sli-travel">📍 {s.travelTime}</span>
            </div>
            <span className="sli-arrow">›</span>
          </button>
        ))}
      </main>
    </div>
  )
}
