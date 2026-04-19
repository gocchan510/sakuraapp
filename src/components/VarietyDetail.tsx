import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useShare, APP_BASE } from '../hooks/useShare'
import type { Variety } from '../types'
import { useWikiImageWithState } from '../hooks/useWikiImage'
import spotsData from '../data/spots.json'
import { Discovery, getDiscoveries, addDiscovery } from '../utils/discoveries'
import { getSomeiyoshinoDate, getVarietyBloomWindow } from '../utils/bloomOffset'
import { statusFromWindow } from '../utils/spotBloom'
import type { BloomStatus } from '../utils/spotBloom'
import { PREFS_LIST, getCachedPrefecture } from '../utils/prefectureUtils'
import { useLang } from '../contexts/LangContext'

type DetailTab = 'basic' | 'detail'

// ── スポット検索用 ────────────────────────────────────────────────
type SpotEntry = {
  id: string
  name: string
  lat?: number
  lng?: number
  prefecture?: string
  varietyCount?: number
  popularity?: number
}

const spotsById = new Map((spotsData as unknown as SpotEntry[]).map(s => [s.id, s]))

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Props ────────────────────────────────────────────────────────
interface Props {
  variety: Variety
  onBack: () => void
  userLocation?: { lat: number; lng: number } | null
  onShowOnMap?: (spotId: string) => void
}

export function VarietyDetail({ variety, onBack, userLocation, onShowOnMap }: Props) {
  const location = useLocation()
  const fromPref  = (location.state as { fromPref?: string; fromDate?: string } | null)?.fromPref ?? null
  const fromDate  = (location.state as { fromPref?: string; fromDate?: string } | null)?.fromDate ?? null

  const { lang, tVariety, t } = useLang()
  const tv = tVariety(variety)
  const s = t('detail')

  const { share, toast } = useShare()
  const [tab, setTab] = useState<DetailTab>('basic')
  const [selectedPref, setSelectedPref] = useState<string>(() => {
    if (fromPref) return fromPref
    return getCachedPrefecture() ?? '全国'
  })
  const { imageUrl, loading: imageLoading } = useWikiImageWithState(variety.wikiTitleJa, variety.wikiTitleEn)

  // ── Discovery state ───────────────────────────────────────────
  const [discoveries, setDiscoveries] = useState<Discovery[]>(() =>
    getDiscoveries().filter(d => d.varietyId === variety.id)
  )
  const [reportMode, setReportMode] = useState<'none' | 'locating' | 'spot_select'>('none')
  const [spotSearchQuery, setSpotSearchQuery] = useState('')

  function handleReportCurrentLocation() {
    setReportMode('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearby = (spotsData as unknown as SpotEntry[])
          .filter(s => s.lat && s.lng)
          .map(s => ({ s, d: getDistance(coords.latitude, coords.longitude, s.lat!, s.lng!) }))
          .filter(x => x.d <= 0.5)
          .sort((a, b) => a.d - b.d)[0]

        const discovery: Discovery = {
          varietyId: variety.id,
          spotId: nearby?.s.id ?? null,
          spotName: nearby?.s.name ?? null,
          lat: coords.latitude,
          lng: coords.longitude,
          date: new Date().toISOString(),
        }
        addDiscovery(discovery)
        setDiscoveries(getDiscoveries().filter(d => d.varietyId === variety.id))
        setReportMode('none')
      },
      () => setReportMode('none')
    )
  }

  function handleReportWithSpot(spotId: string, spotName: string) {
    const spotData = spotsById.get(spotId)
    const discovery: Discovery = {
      varietyId: variety.id,
      spotId,
      spotName,
      lat: spotData?.lat ?? null,
      lng: spotData?.lng ?? null,
      date: new Date().toISOString(),
    }
    addDiscovery(discovery)
    setDiscoveries(getDiscoveries().filter(d => d.varietyId === variety.id))
    setReportMode('none')
    setSpotSearchQuery('')
  }

  const gradientStyle = {
    background: `linear-gradient(160deg, ${variety.colorCode}44 0%, ${variety.colorCode}bb 100%)`,
  }

  const showSomeiyoshinoRef = variety.id !== 'someiyoshino' && variety.bloomGroup !== 'someiyoshino'

  const spotsWithBloom = useMemo(() => {
    const refDate = fromDate ? new Date(fromDate + 'T00:00:00') : new Date()
    return (variety.spots ?? []).map(s => {
      const spotData = spotsById.get(s.spotId)
      let daysScore = 99999
      let bloomStatus: BloomStatus = 'off_season'
      let someiyoshinoStatus: BloomStatus | null = null
      if (spotData?.lat && spotData?.lng) {
        const soDate = getSomeiyoshinoDate(spotData.lat, spotData.lng)
        if (variety.bloomGroup) {
          const win = getVarietyBloomWindow(variety.bloomGroup, variety.someiyoshinoOffset ?? null, soDate)
          bloomStatus = statusFromWindow(win, refDate)
          if (win) {
            const t = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate())
            if (t >= win.start && t <= win.end) daysScore = 0
            else if (t > win.end) daysScore = 1000 + (t.getTime() - win.end.getTime()) / 86400000
            else daysScore = (win.start.getTime() - t.getTime()) / 86400000
          }
        }
        if (showSomeiyoshinoRef) {
          const soWin = getVarietyBloomWindow('someiyoshino', 0, soDate)
          someiyoshinoStatus = statusFromWindow(soWin, refDate)
        }
      }
      return { ...s, spotData, daysScore, bloomStatus, someiyoshinoStatus }
    })
  }, [variety, showSomeiyoshinoRef, fromDate])

  const filteredSortedSpots = useMemo(() => {
    const filtered = selectedPref === '全国'
      ? spotsWithBloom
      : spotsWithBloom.filter(x => x.spotData?.prefecture === selectedPref)
    return [...filtered].sort((a, b) => a.daysScore - b.daysScore)
  }, [spotsWithBloom, selectedPref])

  return (
    <div className="detail-page">
      {/* Hero image */}
      <div className="detail-hero" style={!imageUrl && !imageLoading ? gradientStyle : {}}>
        {imageLoading && (
          <div className="skeleton skeleton--img" aria-hidden="true" style={{ position:'absolute', inset:0, borderRadius:0 }} />
        )}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={variety.name}
            onError={(e) => {
              const target = e.currentTarget
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) Object.assign(parent.style, gradientStyle)
              const fb = document.querySelector('.detail-hero-fallback') as HTMLElement | null
              if (fb) fb.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="detail-hero-fallback"
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          {variety.emoji}
        </div>
        <button className="detail-back-btn" onClick={onBack}>{s.backBtn}</button>
        <button
          className="detail-share-btn"
          aria-label={s.shareBtn}
          onClick={() => share({
            title: `${variety.name} | 花見どき`,
            text: variety.summary,
            url: `${APP_BASE}#/variety/${variety.id}`,
          })}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
        <span className="detail-no-badge">No.{variety.no}</span>
      </div>

      {/* Name & tags */}
      <div className="detail-info">
        <div className="detail-name">{tv.name}</div>
        {lang !== 'ja' ? (
          <div className="detail-reading detail-reading--ja">{variety.name}</div>
        ) : (
          <div className="detail-reading">{variety.reading}</div>
        )}
        <div className="detail-tags">
          {(tv.tags ?? variety.tags).map((tag: string) => (
            <span key={tag} className="detail-tag">{tag}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs">
        <button
          className={`detail-tab-btn ${tab === 'basic' ? 'active' : ''}`}
          onClick={() => setTab('basic')}
        >
          {s.tabBasic}
        </button>
        <button
          className={`detail-tab-btn ${tab === 'detail' ? 'active' : ''}`}
          onClick={() => setTab('detail')}
        >
          {s.tabDetail}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'basic' ? (
        <div className="detail-tab-content">
          <div className="detail-info-row">
            <span className="detail-info-label">{s.bloomSeason}</span>
            <span className="detail-info-value">
              {tv.bloomSeason}
              {variety.bloomGroup === 'fuyu' && (
                <span className="bloom-secondary-badge" title="二季咲き">🔄</span>
              )}
            </span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-label">{s.color}</span>
            <span className="detail-info-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: variety.colorCode,
                  border: '1.5px solid rgba(0,0,0,0.12)',
                  flexShrink: 0,
                }}
              />
              {tv.color}
            </span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-label">{s.shape}</span>
            <span className="detail-info-value">{tv.flowerShape}</span>
          </div>
          {variety.rarity && (
            <div className="detail-info-row">
              <span className="detail-info-label">{s.rarity}</span>
              <span className="detail-info-value detail-rarity-value">
                <span>
                  <span className="detail-rarity-stars" data-score={variety.rarity.score}>
                    {variety.rarity.stars}
                  </span>
                  <span className="detail-rarity-label">{tv.rarity?.label ?? variety.rarity.label}</span>
                </span>
                {(tv.rarity?.reasons ?? variety.rarity.reasons).length > 0 && (
                  <span className="detail-rarity-reasons">
                    {(tv.rarity?.reasons ?? variety.rarity.reasons).map((r: string) => (
                      <span key={r} className="detail-rarity-reason">{r}</span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="detail-features-text">{tv.features}</div>
        </div>
      ) : (
        <div className="detail-tab-content">
          <div className="detail-section">
            <div className="detail-section-title">{s.sectionHistory}</div>
            <div className="detail-section-text">{tv.history}</div>
          </div>
          <div className="detail-section">
            <div className="detail-section-title">{s.sectionBackground}</div>
            <div className="detail-section-text">{tv.background}</div>
          </div>
          <div className="detail-section">
            <div className="detail-section-title">{s.sectionTrivia}</div>
            <div className="detail-section-text">{tv.trivia}</div>
          </div>
        </div>
      )}

      {/* ── スポットリスト ── */}
      <div className="detail-spots-section">
        <h3 className="detail-spots-title">{s.spots}</h3>

        {/* 都道府県フィルタ */}
        <div className="detail-spots-pref-row">
          <select
            className="detail-spots-pref-select"
            value={selectedPref}
            onChange={e => setSelectedPref(e.target.value)}
          >
            <option value="全国">🌸 {s.allPref}</option>
            {PREFS_LIST.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <span className="detail-spots-count">{filteredSortedSpots.length}</span>
        </div>

        {filteredSortedSpots.length === 0 ? (
          <p className="detail-spots-empty">
            {selectedPref !== '全国'
              ? s.noSpotInPref(selectedPref)
              : s.noSpotGlobal}
          </p>
        ) : (
          <div className="detail-spots-list">
            {filteredSortedSpots.map(spotEntry => {
              const dist = userLocation && spotEntry.spotData?.lat && spotEntry.spotData?.lng
                ? getDistance(userLocation.lat, userLocation.lng, spotEntry.spotData.lat, spotEntry.spotData.lng)
                : null
              const statusStr = t('status')
              const bloomLabel: Record<BloomStatus, { text: string; emoji: string } | null> = {
                in_bloom:   { text: statusStr.in_bloom, emoji: '🌸' },
                opening:    { text: statusStr.opening,  emoji: '🌷' },
                falling:    { text: statusStr.falling,  emoji: '🍃' },
                leaf:       { text: statusStr.leaf,     emoji: '🌿' },
                budding:    { text: statusStr.budding,  emoji: '🟡' },
                upcoming:   { text: statusStr.upcoming, emoji: '⏳' },
                off_season: null,
              }
              const label = bloomLabel[spotEntry.bloomStatus]
              const soLabel = spotEntry.someiyoshinoStatus ? bloomLabel[spotEntry.someiyoshinoStatus] : null
              return (
                <div key={spotEntry.spotId} className="detail-spot-card">
                  <div className="detail-spot-card__info">
                    <div className="detail-spot-card__name">📍 {spotEntry.spotName}</div>
                    {soLabel && (
                      <div className="detail-spot-someiyoshino-ref">
                        {s.someiyoshinoRef} {soLabel.emoji} {soLabel.text}
                      </div>
                    )}
                    <div className="detail-spot-card__meta">
                      {spotEntry.spotData?.prefecture && <span>{spotEntry.spotData.prefecture}</span>}
                      {(spotEntry.spotData?.varietyCount ?? 0) > 0 && (
                        <span>{s.varietyCount(spotEntry.spotData!.varietyCount!)}</span>
                      )}
                      {dist != null && <span>{s.distKm(dist.toFixed(1))}</span>}
                      {label && (
                        <span className={`detail-spot-bloom-badge detail-spot-bloom-badge--${spotEntry.bloomStatus}`}>
                          {label.emoji} {label.text}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="detail-spot-card__actions">
                    {onShowOnMap && (
                      <button className="detail-spot-btn" onClick={() => onShowOnMap(spotEntry.spotId)}>
                        {t('spots').mapBtn}
                      </button>
                    )}
                    {spotEntry.spotData?.lat && spotEntry.spotData?.lng && (
                      <button
                        className="detail-spot-btn detail-spot-btn--route"
                        onClick={() => window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${spotEntry.spotData!.lat},${spotEntry.spotData!.lng}&travelmode=transit`,
                          '_blank'
                        )}
                      >
                        {t('map').routeBtn}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 見つけた！ ── */}
      <div className="detail-discovery-section">
        <h3 className="detail-discovery-title">📸 {s.reportTitle}</h3>
        <div className="detail-discovery-actions">
          <button
            className="detail-discovery-btn"
            onClick={handleReportCurrentLocation}
            disabled={reportMode === 'locating'}
          >
            {reportMode === 'locating' ? s.reportLocating : s.reportBtn}
          </button>
          <button
            className="detail-discovery-btn"
            onClick={() => setReportMode(m => m === 'spot_select' ? 'none' : 'spot_select')}
          >
            🗺️ {s.reportManual}
          </button>
        </div>

        {reportMode === 'spot_select' && (
          <div className="detail-discovery-spot-select">
            <input
              className="detail-discovery-search"
              type="text"
              placeholder={`${s.reportManual}...`}
              value={spotSearchQuery}
              onChange={e => setSpotSearchQuery(e.target.value)}
              autoFocus
            />
            {spotSearchQuery.length >= 2 && (
              <div className="detail-discovery-spot-results">
                {(spotsData as unknown as SpotEntry[])
                  .filter(sp => sp.name.toLowerCase().includes(spotSearchQuery.toLowerCase()))
                  .slice(0, 6)
                  .map(sp => (
                    <div
                      key={sp.id}
                      className="detail-discovery-spot-item"
                      onClick={() => handleReportWithSpot(sp.id, sp.name)}
                    >
                      📍 {sp.name}{sp.prefecture ? ` (${sp.prefecture})` : ''}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {discoveries.length > 0 && (
          <div className="detail-discovery-log">
            <div className="detail-discovery-log-title">{s.discovered}</div>
            {discoveries.slice(0, 5).map((d, i) => (
              <div key={i} className="detail-discovery-log-item">
                🌸 {d.date.slice(0, 10).replace(/-/g, '/')}
                {d.spotName && ` ${d.spotName}`}
              </div>
            ))}
          </div>
        )}
      </div>
      {toast && <div className="share-toast">URLをコピーしました 📋</div>}
    </div>
  )
}
