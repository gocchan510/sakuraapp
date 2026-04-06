import { getSpotStatus, formatHeikinsa, isSomeiCompatible } from '../utils/sakuraStatus'
import { SpotMap } from './SpotMap'
import type { Spot } from '../utils/spotsByWeek'

interface Props {
  spot: Spot
  onVarietyClick?: (varietyName: string) => void
}

export function SpotCard({ spot, onVarietyClick }: Props) {
  const mapsUrl =
    spot.lat !== null && spot.lng !== null
      ? `https://maps.google.com/?q=${spot.lat},${spot.lng}`
      : null

  const status = isSomeiCompatible(spot.variety) ? getSpotStatus(spot.name) : null

  return (
    <div className="spot-card">
      <div className="spot-header">
        <h2 className="spot-name">{spot.name}</h2>
        <span className="prefecture-badge">{spot.prefecture}</span>
      </div>

      {onVarietyClick ? (
        <button
          className="variety variety-link"
          onClick={() => onVarietyClick(spot.variety)}
        >
          {spot.variety} →図鑑
        </button>
      ) : (
        <p className="variety">{spot.variety}</p>
      )}

      <p className="comment">{spot.comment}</p>

      {status && (
        <div className="status-block">
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
                  未観測{status.kaika?.heikinDate && `（平年 ${status.kaika.heikinDate}頃）`}
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

      {spot.lat !== null && spot.lng !== null && (
        <SpotMap spotName={spot.name} lat={spot.lat} lng={spot.lng} />
      )}

      <div className="spot-footer">
        <span className="travel-time">📍 尻手から{spot.travelTime}</span>
        {mapsUrl && (
          <a className="maps-link" href={mapsUrl} target="_blank" rel="noreferrer">
            → Googleマップで見る
          </a>
        )}
      </div>
      {!spot.inMetro && (
        <div className="out-of-metro-badge">1都3県外</div>
      )}
    </div>
  )
}
