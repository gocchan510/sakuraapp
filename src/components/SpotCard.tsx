import { getSpotStatus, formatHeikinsa, isSomeiCompatible, getPrefStatus, getStatusClass, getStatusEmoji } from '../utils/sakuraStatus'
import { estimateMinutes, DEFAULT_STATION } from '../utils/travelTime'
import type { Station } from '../utils/travelTime'
import { SpotMap } from './SpotMap'
import { useLang } from '../i18n'
import type { Spot } from '../utils/spotsByWeek'

interface Props {
  spot: Spot
  onVarietyClick?: (varietyName: string) => void
  fromStation?: Station
  inPlan?: boolean
  onTogglePlan?: (id: string) => void
}

export function SpotCard({ spot, onVarietyClick, fromStation = DEFAULT_STATION, inPlan, onTogglePlan }: Props) {
  const { t } = useLang()

  const mapsUrl =
    spot.lat !== null && spot.lng !== null
      ? `https://maps.google.com/?q=${spot.lat},${spot.lng}`
      : null

  const status = isSomeiCompatible(spot.variety) ? getSpotStatus(spot.name) : null
  const prefStatus = isSomeiCompatible(spot.variety) ? getPrefStatus(spot.prefecture) : null

  // 所要時間：尻手の場合はオリジナルの実測値、それ以外は推定
  const isDefaultStation = fromStation.id === 'shitte'
  const travelTimeText = isDefaultStation
    ? spot.travelTime
    : `約${estimateMinutes(fromStation.lat, fromStation.lng, spot.lat, spot.lng)}分`

  return (
    <div className="spot-card">
      <div className="spot-header">
        <h2 className="spot-name">{spot.name}</h2>
        <span className="prefecture-badge">{spot.prefecture}</span>
      </div>

      {onTogglePlan && (
        <button
          className={`plan-star-card-btn${inPlan ? ' plan-star-active' : ''}`}
          onClick={() => onTogglePlan(spot.id)}
        >
          {inPlan ? '★ ' + t.inPlan : '☆ ' + t.addToPlan}
        </button>
      )}

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

      {prefStatus && (
        <div className={`pref-status-badge pref-status-${getStatusClass(prefStatus.status)}`}>
          <span className="pref-status-emoji">{getStatusEmoji(prefStatus.status)}</span>
          <span className="pref-status-label">{t.statusNow}</span>
          <strong className="pref-status-value">{prefStatus.status}</strong>
          <span className="pref-status-source">{prefStatus.source}</span>
        </div>
      )}

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
        <span className="travel-time">
          📍 {fromStation.name}{t.travelFrom}{travelTimeText}
          {!isDefaultStation && <span className="estimate-badge">{t.estimate}</span>}
        </span>
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
