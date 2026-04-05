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
