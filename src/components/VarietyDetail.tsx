import varietiesData from '../data/varieties.json'
import spotsData from '../data/spots.json'

interface Props {
  id: string
  onBack: () => void
  onSelectSpot: (weekIndex: number) => void
}

export function VarietyDetail({ id, onBack, onSelectSpot }: Props) {
  const variety = varietiesData.find((v) => v.id === id)
  if (!variety) return null

  // この品種が登場する週のインデックスを探す
  const linkedSpots = variety.spots.flatMap((spotName) =>
    spotsData
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.spot === spotName || s.spot.includes(spotName))
      .map(({ s, i }) => ({ index: i, week: s.week, spot: s.spot }))
  )
  // 重複除去
  const uniqueSpots = linkedSpots.filter(
    (item, idx, self) => self.findIndex((x) => x.index === item.index) === idx
  )

  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={onBack}>← 図鑑一覧</button>
        <div className="variety-detail-hero" style={{ background: `linear-gradient(135deg, ${variety.color}55, ${variety.color}22)` }}>
          <span className="variety-detail-emoji">{variety.emoji}</span>
          <div>
            <h1 className="variety-detail-name">{variety.name}</h1>
            <p className="variety-detail-reading">（{variety.reading}）</p>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="section">
          <div className="section-title">基本情報</div>
          <div className="variety-info-card">
            <div className="variety-info-row">
              <span className="variety-info-label">開花時期</span>
              <span className="variety-info-value">{variety.season}</span>
            </div>
            <div className="variety-info-row">
              <span className="variety-info-label">花の色</span>
              <span className="variety-info-value">
                <span className="variety-color-chip" style={{ background: variety.color }} />
              </span>
            </div>
            <div className="variety-info-row variety-info-row-tags">
              <span className="variety-info-label">特徴</span>
              <span className="variety-info-value">
                {variety.tags.map((t) => (
                  <span key={t} className="variety-tag">{t}</span>
                ))}
              </span>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-title">どんな桜？</div>
          <div className="variety-desc-card">
            <p className="variety-desc">{variety.detail}</p>
          </div>
        </section>

        {uniqueSpots.length > 0 && (
          <section className="section">
            <div className="section-title">このアプリで見られるスポット</div>
            <div className="variety-spots">
              {uniqueSpots.map(({ index, week, spot }) => (
                <button
                  key={index}
                  className="variety-spot-btn"
                  onClick={() => onSelectSpot(index)}
                >
                  <span className="variety-spot-name">{spot}</span>
                  <span className="variety-spot-week">{week} →</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
