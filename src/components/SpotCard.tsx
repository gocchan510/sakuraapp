import { useState } from 'react'
import { getSpotStatus, formatHeikinsa, isSomeiCompatible, getPrefStatus, getStatusClass, getStatusEmoji } from '../utils/sakuraStatus'
import { estimateMinutes, DEFAULT_STATION } from '../utils/travelTime'
import type { Station } from '../utils/travelTime'
import { SpotMap } from './SpotMap'
import { useLang } from '../i18n'
import type { Spot } from '../utils/spotsByWeek'
import { formatDateDisplay } from '../utils/calendarUtils'

interface Props {
  spot: Spot
  onVarietyClick?: (varietyName: string) => void
  fromStation?: Station
  planDates?: Record<string, string[]>  // 全計画データ
  selectedDate?: string | null          // 今タップされた日付
  onTogglePlan?: (dateStr: string, spotId: string) => void
  lang?: string
}

export function SpotCard({
  spot,
  onVarietyClick,
  fromStation = DEFAULT_STATION,
  planDates,
  selectedDate,
  onTogglePlan,
  lang = 'ja',
}: Props) {
  const { t } = useLang()
  const [showDateInput, setShowDateInput] = useState(false)
  const [addDateValue, setAddDateValue] = useState('')

  const mapsUrl =
    spot.lat !== null && spot.lng !== null
      ? `https://maps.google.com/?q=${spot.lat},${spot.lng}`
      : null

  const status = isSomeiCompatible(spot.variety) ? getSpotStatus(spot.name) : null
  const prefStatus = isSomeiCompatible(spot.variety) ? getPrefStatus(spot.prefecture) : null

  const isDefaultStation = fromStation.id === 'shitte'
  const travelTimeText = isDefaultStation
    ? spot.travelTime
    : `約${estimateMinutes(fromStation.lat, fromStation.lng, spot.lat, spot.lng)}分`

  // このスポットが計画済みの日付一覧
  const plannedDatesForSpot = planDates
    ? Object.entries(planDates)
        .filter(([, ids]) => ids.includes(spot.id))
        .map(([d]) => d)
        .sort()
    : []

  // 選択日に対してこのスポットが計画済みか
  const inPlanForSelectedDate = selectedDate
    ? (planDates?.[selectedDate] ?? []).includes(spot.id)
    : false

  return (
    <div className="spot-card">
      {spot.imageUrl && (
        <div className="spot-image-wrap">
          <img
            src={spot.imageUrl}
            alt={spot.name}
            className="spot-image"
            loading="lazy"
          />
        </div>
      )}
      <div className="spot-header">
        <h2 className="spot-name">{spot.name}</h2>
        <span className="prefecture-badge">{spot.prefecture}</span>
      </div>

      {/* ── 計画セクション ── */}
      {onTogglePlan && (
        <div className="spot-plan-section">
          {/* 選択日へのトグルボタン */}
          {selectedDate && (
            <button
              className={`plan-date-toggle-btn${inPlanForSelectedDate ? ' plan-date-active' : ''}`}
              onClick={() => onTogglePlan(selectedDate, spot.id)}
            >
              <span className="plan-date-star">{inPlanForSelectedDate ? '★' : '☆'}</span>
              <span>{formatDateDisplay(selectedDate, lang)}</span>
              <span className="plan-date-label">
                {inPlanForSelectedDate ? t.inPlan : t.addToPlan}
              </span>
            </button>
          )}

          {/* 計画済みの他の日程 */}
          {plannedDatesForSpot.filter(d => d !== selectedDate).length > 0 && (
            <div className="spot-planned-dates">
              <span className="spot-planned-label">{t.planDateSection}</span>
              <div className="spot-planned-chips">
                {plannedDatesForSpot
                  .filter(d => d !== selectedDate)
                  .map(d => (
                    <span key={d} className="spot-planned-chip">
                      {formatDateDisplay(d, lang)}
                      <button
                        className="spot-planned-remove"
                        onClick={() => onTogglePlan(d, spot.id)}
                        aria-label="削除"
                      >×</button>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* 別の日に追加 */}
          {!showDateInput ? (
            <button className="plan-add-other-btn" onClick={() => setShowDateInput(true)}>
              + {t.planAddOther}
            </button>
          ) : (
            <div className="plan-date-input-row">
              <input
                type="date"
                className="plan-date-input"
                value={addDateValue}
                onChange={e => setAddDateValue(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
              <button
                className="plan-date-confirm-btn"
                disabled={!addDateValue}
                onClick={() => {
                  if (addDateValue) {
                    onTogglePlan(addDateValue, spot.id)
                    setAddDateValue('')
                    setShowDateInput(false)
                  }
                }}
              >{t.planConfirmAdd}</button>
              <button className="plan-date-cancel-btn" onClick={() => setShowDateInput(false)}>×</button>
            </div>
          )}
        </div>
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
