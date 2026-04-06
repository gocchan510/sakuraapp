import { getSpotStatus, formatHeikinsa } from '../utils/sakuraStatus'

interface Spot {
  week: string
  variety: string
  spot: string
  prefecture: string
  comment: string
  inMetro: boolean
  travelTime: string
  within1hour: boolean
  alternative: string
  lat: number | null
  lng: number | null
}

interface Props {
  spot: Spot
}

export function SpotCard({ spot }: Props) {
  if (spot.variety === 'オフシーズン') {
    return (
      <div className="spot-card off-season">
        <p className="off-season-icon">🍃</p>
        <p className="off-season-message">桜のシーズンではありません</p>
        <p className="off-season-sub">{spot.comment}</p>
      </div>
    )
  }

  const mapsUrl =
    spot.lat !== null && spot.lng !== null
      ? `https://maps.google.com/?q=${spot.lat},${spot.lng}`
      : null

  const status = getSpotStatus(spot.spot)

  return (
    <div
      className="spot-card"
      onClick={() => mapsUrl && window.open(mapsUrl, '_blank')}
      role={mapsUrl ? 'link' : undefined}
      style={{ cursor: mapsUrl ? 'pointer' : 'default' }}
    >
      <div className="spot-header">
        <h2 className="spot-name">{spot.spot}</h2>
        <span className="prefecture-badge">{spot.prefecture}</span>
      </div>
      <p className="variety">{spot.variety}</p>
      <p className="comment">{spot.comment}</p>

      {status && (
        <div className="status-block" onClick={e => e.stopPropagation()}>
          <div className="status-header">🌸 開花情報（{status.station}観測点）</div>
          <div className="status-rows">
            {status.kaika?.date ? (
              <div className="status-row">
                <span className="status-label kaika">開花</span>
                <span className="status-date">{status.kaika.date}</span>
                {status.kaika.heikinsa !== null && (
                  <span className="status-heikinsa">{formatHeikinsa(status.kaika.heikinsa)}</span>
                )}
              </div>
            ) : (
              <div className="status-row">
                <span className="status-label kaika">開花</span>
                <span className="status-date muted">
                  未観測
                  {status.kaika?.heikinDate && `（平年 ${status.kaika.heikinDate}頃）`}
                </span>
              </div>
            )}
            {status.mankai?.date ? (
              <div className="status-row">
                <span className="status-label mankai">満開</span>
                <span className="status-date">{status.mankai.date}</span>
                {status.mankai.heikinsa !== null && (
                  <span className="status-heikinsa">{formatHeikinsa(status.mankai.heikinsa)}</span>
                )}
              </div>
            ) : status.kaika?.date ? (
              <div className="status-row">
                <span className="status-label mankai">満開</span>
                <span className="status-date muted">未観測</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="spot-footer">
        <span className="travel-time">📍 尻手から{spot.travelTime}</span>
        {mapsUrl && <span className="maps-link">→ Googleマップで見る</span>}
      </div>
      {!spot.inMetro && (
        <div className="out-of-metro-badge">1都3県外</div>
      )}
    </div>
  )
}
