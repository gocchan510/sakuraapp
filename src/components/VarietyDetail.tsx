import varietiesData from '../data/varieties.json'
import spotsData from '../data/spots.json'
import { useLang } from '../i18n'

interface Props {
  id: string
  onBack: () => void
  onSelectSpot: (spotId: string) => void
}

export function VarietyDetail({ id, onBack, onSelectSpot }: Props) {
  const { t } = useLang()
  const variety = varietiesData.find((v) => v.id === id)
  if (!variety) return null

  const linkedSpots = variety.spots.flatMap((spotName) =>
    spotsData.filter((s) => s.name === spotName || s.name.includes(spotName) || spotName.includes(s.name))
  )
  const uniqueSpots = linkedSpots.filter(
    (item, idx, self) => self.findIndex((x) => x.id === item.id) === idx
  )

  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={onBack}>{t.backZukan}</button>
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
          <div className="section-title">{t.detailBasicInfo}</div>
          <div className="variety-info-card">
            <div className="variety-info-row">
              <span className="variety-info-label">{t.detailSeason}</span>
              <span className="variety-info-value">{variety.season}</span>
            </div>
            <div className="variety-info-row">
              <span className="variety-info-label">{t.detailColor}</span>
              <span className="variety-info-value">
                <span className="variety-color-chip" style={{ background: variety.color }} />
              </span>
            </div>
            <div className="variety-info-row variety-info-row-tags">
              <span className="variety-info-label">{t.detailFeatures}</span>
              <span className="variety-info-value">
                {variety.tags.map((tag) => (
                  <span key={tag} className="variety-tag">{tag}</span>
                ))}
              </span>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-title">{t.detailDescription}</div>
          <div className="variety-desc-card">
            <p className="variety-desc">{variety.detail}</p>
          </div>
        </section>

        {uniqueSpots.length > 0 && (
          <section className="section">
            <div className="section-title">{t.detailLinkedSpots}</div>
            <div className="variety-spots">
              {uniqueSpots.map((s) => (
                <button
                  key={s.id}
                  className="variety-spot-btn"
                  onClick={() => onSelectSpot(s.id)}
                >
                  <span className="variety-spot-name">{s.name}</span>
                  <span className="variety-spot-week">{s.peakWeeks[0]} →</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
