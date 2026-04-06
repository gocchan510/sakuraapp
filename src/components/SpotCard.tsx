import { getSpotStatus, formatHeikinsa, isSomeiCompatible } from '../utils/sakuraStatus'
import { SpotMap } from './SpotMap'
import { useLang } from '../i18n'
import type { Spot } from '../utils/spotsByWeek'

interface Props {
  spot: Spot
  onVarietyClick?: (varietyName: string) => void
}

export function SpotCard({ spot, onVarietyClick }: Props) {
  const { t } = useLang()

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
          {spot.variety} {t.toZukan}
        </button>
      ) : (
        <p className="variety">{spot.variety}</p>
      )}

      <p className="comment">{spot.comment}</p>

      {status && (
        <div className="status-block">
          <div className="status-header">🌸 {t.statusTitle}（{status.station}{t.statusStation}）</div>
          <div className="status-rows">
            {status.kaika?.date ? (
              <div className="status-row">
                <span className="status-label kaika">{t.statusKaika}</span>
                <span className="status-date">{status.kaika.date}</span>
                {status.kaika.heikinsa !== null && (
                  <span className="status-heikinsa">{formatHeikinsa(status.kaika.heikinsa, t)}</span>
                )}
              </div>
            ) : (
              <div className="status-row">
                <span className="status-label kaika">{t.statusKaika}</span>
                <span className="status-date muted">
                  {t.statusUnobserved}{status.kaika?.heikinDate && `（${t.statusAvgDate} ${status.kaika.heikinDate}${t.statusAround}）`}
                </span>
              </div>
            )}
            {status.mankai?.date ? (
              <div className="status-row">
                <span className="status-label mankai">{t.statusMankai}</span>
                <span className="status-date">{status.mankai.date}</span>
                {status.mankai.heikinsa !== null && (
                  <span className="status-heikinsa">{formatHeikinsa(status.mankai.heikinsa, t)}</span>
                )}
              </div>
            ) : status.kaika?.date ? (
              <div className="status-row">
                <span className="status-label mankai">{t.statusMankai}</span>
                <span className="status-date muted">{t.statusUnobserved}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {spot.lat !== null && spot.lng !== null && (
        <SpotMap spotName={spot.name} lat={spot.lat} lng={spot.lng} />
      )}

      <div className="spot-footer">
        <span className="travel-time">📍 {t.travelFrom}{spot.travelTime}</span>
        {mapsUrl && (
          <a className="maps-link" href={mapsUrl} target="_blank" rel="noreferrer">
            {t.googleMaps}
          </a>
        )}
      </div>
      {!spot.inMetro && (
        <div className="out-of-metro-badge">{t.outOfMetro}</div>
      )}
    </div>
  )
}
