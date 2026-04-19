import { useState, useEffect } from 'react'
import spotsData from '../data/spots.json'
import { computeSpotBloom, getSortedVarieties, STATUS_PRIORITY } from '../utils/spotBloom'
import type { BloomStatus } from '../utils/spotBloom'
import { fetchWeatherForSpots, weatherEmoji, dateKey } from '../utils/weather'
import type { DayWeather } from '../utils/weather'
import type { ShareCardParams } from '../utils/shareCard'
import { ShareModal } from './ShareModal'
import { FavoriteHeart } from './FavoriteHeart'
import { haptic, HapticPattern } from '../utils/haptic'
import '../styles/wizard.css'

// ── 型 ──────────────────────────────────────────────────────────
type WizardSpot = {
  id: string
  name: string
  prefecture: string
  city: string
  lat?: number | null
  lng?: number | null
  features?: string[]
  popularity?: number
  varietyCount?: number
  imageUrl?: string | null
  varieties?: string[]
  peakMonth?: string | number
}

const allSpots = spotsData as unknown as WizardSpot[]

// ── 今週末の日付計算 ─────────────────────────────────────────────
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export type WeekendDates = {
  sat: Date | null
  sun: Date | null
  satLabel: string
  sunLabel: string
}

export function getWeekendDates(): WeekendDates {
  const today = new Date()
  const dow = today.getDay() // 0=日, 1=月, ..., 6=土

  if (dow === 0) {
    // 日曜: 今日のみ
    return { sat: null, sun: today, satLabel: '', sunLabel: `日曜 ${formatDate(today)}` }
  } else if (dow === 6) {
    // 土曜: 今日 + 明日
    const sun = addDays(today, 1)
    return { sat: today, sun, satLabel: `土曜 ${formatDate(today)}`, sunLabel: `日曜 ${formatDate(sun)}` }
  } else {
    // 月〜金: 次の土日
    const daysUntilSat = 6 - dow
    const sat = addDays(today, daysUntilSat)
    const sun = addDays(sat, 1)
    return { sat, sun, satLabel: `土曜 ${formatDate(sat)}`, sunLabel: `日曜 ${formatDate(sun)}` }
  }
}

// ── 位置情報キャッシュ ────────────────────────────────────────────
const GEO_KEY = 'sakura_wizard_geo'
const GEO_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

function loadGeo(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(GEO_KEY)
    if (!raw) return null
    const { lat, lng, ts } = JSON.parse(raw)
    if (Date.now() - ts > GEO_EXPIRY_MS) { localStorage.removeItem(GEO_KEY); return null }
    return { lat, lng }
  } catch { return null }
}

function saveGeo(lat: number, lng: number) {
  localStorage.setItem(GEO_KEY, JSON.stringify({ lat, lng, ts: Date.now() }))
}

// ── Haversine ─────────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── 質問選択肢 ────────────────────────────────────────────────────
const Q1_OPTIONS = [
  { key: 'night',   label: '🌙 夜桜・ライトアップ' },
  { key: 'stalls',  label: '🎪 屋台・お祭り' },
  { key: 'parking', label: '🅿️ 駐車場あり' },
  { key: 'hidden',  label: '💎 穴場スポット' },
  { key: 'variety', label: '🌸 珍しい品種を見たい' },
]

const Q2_OPTIONS = [
  { key: 'walk',  label: '🚶 歩いて行ける',   sub: '〜2km',    needsGeo: true  },
  { key: 'train', label: '🚃 電車で1時間以内', sub: '〜50km',   needsGeo: true  },
  { key: 'car',   label: '🚗 車で行ける',      sub: '〜80km',   needsGeo: true  },
  { key: 'trip',  label: '🎒 どこでも',        sub: '距離制限なし', needsGeo: false },
]

// ── 指定日のフィルタ&ランキング ───────────────────────────────────
function filterForDate(
  targetDate: Date,
  prefs: Set<string>,
  distance: string,
  userLoc: { lat: number; lng: number } | null
): WizardSpot[] {
  // 対象日の開花状況を一括計算
  const bloomMap = new Map(
    allSpots.map(s => [s.id, computeSpotBloom(s, targetDate)])
  )

  return allSpots
    .filter(spot => {
      const bloom = bloomMap.get(spot.id)
      if (!bloom) return false
      const { status } = bloom

      // 当日に見頃・開花・散り頃のスポットのみ
      if (status !== 'in_bloom' && status !== 'opening' && status !== 'falling') return false

      // こだわりフィルタ（AND条件）
      if (prefs.size > 0) {
        const features = spot.features ?? []
        const vc  = spot.varietyCount ?? 0
        const pop = spot.popularity ?? 2
        // イベント系（夜桜・屋台）は散り頃には終わっていることが多いため
        // in_bloom / opening のみを対象にする
        const isEventBloom = status === 'in_bloom' || status === 'opening'
        if (prefs.has('night')   && (!features.includes('ライトアップ') && !features.includes('夜桜'))) return false
        if (prefs.has('night')   && !isEventBloom) return false
        if (prefs.has('stalls')  && (!features.includes('屋台あり') && !features.includes('桜祭り'))) return false
        if (prefs.has('stalls')  && !isEventBloom) return false
        if (prefs.has('parking') && !features.includes('駐車場あり')) return false
        if (prefs.has('hidden')  && !(vc > 3 && pop <= 2)) return false
        if (prefs.has('variety') && vc <= 3) return false
      }

      // 距離フィルタ
      if (distance !== 'trip' && userLoc && spot.lat && spot.lng) {
        const dist = haversine(userLoc.lat, userLoc.lng, spot.lat, spot.lng)
        if (distance === 'walk'  && dist > 2)  return false
        if (distance === 'train' && dist > 50) return false
        if (distance === 'car'   && dist > 80) return false
      }

      return true
    })
    .sort((a, b) => {
      const ba = bloomMap.get(a.id)!
      const bb = bloomMap.get(b.id)!
      const sa = STATUS_PRIORITY[ba.status]
      const sb = STATUS_PRIORITY[bb.status]
      if (sa !== sb) return sa - sb
      return (b.popularity ?? 2) - (a.popularity ?? 2)
    })
    .slice(0, 20)
}

// ── 見頃表示定義 ──────────────────────────────────────────────────
const BLOOM_DISPLAY: Record<BloomStatus, { label: string; emoji: string; color: string; bg: string }> = {
  in_bloom:   { label: '満開・見頃', emoji: '🌸', color: '#c2185b', bg: '#fce4ec' },
  opening:    { label: '開花中',    emoji: '🌷', color: '#e91e63', bg: '#fce4ec' },
  falling:    { label: '散り頃',    emoji: '🍃', color: '#795548', bg: '#efebe9' },
  leaf:       { label: '葉桜',      emoji: '🌿', color: '#558b2f', bg: '#f1f8e9' },
  budding:    { label: 'もうすぐ',  emoji: '🌱', color: '#2e7d32', bg: '#e8f5e9' },
  upcoming:   { label: '時期外',    emoji: '⬜', color: '#9e9e9e', bg: '#f5f5f5' },
  off_season: { label: '時期外',    emoji: '⬜', color: '#9e9e9e', bg: '#f5f5f5' },
}

// ── 結果カード ────────────────────────────────────────────────────
function ResultCard({ spot, targetDate, weather, isNight, dayLabel, onMapClick }: {
  spot: WizardSpot
  targetDate: Date
  weather: DayWeather | null
  isNight: boolean
  dayLabel: string
  onMapClick: () => void
}) {
  const bloom = computeSpotBloom(spot, targetDate)
  const bd = BLOOM_DISPLAY[bloom.status]
  const [shareParams, setShareParams] = useState<Omit<ShareCardParams, 'format'> | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  function handleShare() {
    if (shareParams) return
    // 代表品種：ソメイヨシノ優先、なければ最上位ステータスの品種
    const sorted = getSortedVarieties(spot as any, targetDate)
    let primaryVariety: string | null = null
    if (sorted.length > 0) {
      const topStatus = sorted[0].status
      const someiyoshino = sorted.find(x => x.variety.id === 'someiyoshino' && x.status === topStatus)
      primaryVariety = someiyoshino ? someiyoshino.variety.name : sorted[0].variety.name
    }
    setShareParams({
      name: spot.name,
      prefecture: spot.prefecture,
      city: spot.city,
      bloomStatus: bloom.status,
      weather,
      isNight,
      dayLabel,
      features: spot.features ?? [],
      varietyCount: spot.varietyCount ?? 0,
      is100sen: (spot.features ?? []).includes('さくら名所100選'),
      imageUrl: spot.imageUrl ?? null,
      primaryVariety,
      targetDate,
      spotId: spot.id,
    })
  }

  // 天気の表示（夜桜時は夜データを優先、なければ昼データ）
  let weatherDisplay: React.ReactNode = null
  if (weather) {
    if (isNight && weather.night) {
      weatherDisplay = (
        <span className="wizard-result-card__weather wizard-result-card__weather--night">
          🌙{weatherEmoji(weather.night.code)}{weather.night.temp}℃
        </span>
      )
    } else {
      weatherDisplay = (
        <span className="wizard-result-card__weather">
          {weatherEmoji(weather.code)}{weather.tempMax}℃
        </span>
      )
    }
  }

  return (
    <div className="wizard-result-card">
      <div className="wizard-result-card__thumb">
        {spot.imageUrl ? (
          <>
            {!imgLoaded && <div className="skeleton skeleton--img" aria-hidden="true" style={{ position:'absolute', inset:0 }} />}
            <img
              src={spot.imageUrl}
              alt={spot.name}
              className="wizard-result-card__img"
              loading="lazy"
              style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.25s' }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="wizard-result-card__img-placeholder">🌸</div>
        )}
        <FavoriteHeart spotId={spot.id} variant="overlay" />
      </div>
      <div className="wizard-result-card__body">
        <div className="wizard-result-card__pref">{spot.prefecture} {spot.city}</div>
        <div className="wizard-result-card__name">{spot.name}</div>
        <div className="wizard-result-card__meta">
          <span className="wizard-result-card__bloom" style={{ color: bd.color, background: bd.bg }}>
            {bd.emoji} {bd.label}
          </span>
          {weatherDisplay}
        </div>
        {(spot.features ?? []).length > 0 && (
          <div className="wizard-result-card__features">
            {(spot.features ?? []).slice(0, 3).map(f => (
              <span key={f} className="wizard-result-card__feature-tag">{f}</span>
            ))}
          </div>
        )}
      </div>
      <div className="wizard-result-card__actions">
        <button className="wizard-result-card__map-btn" onClick={onMapClick} aria-label="地図で見る">
          🗺
        </button>
        <button
          className="wizard-result-card__share-btn"
          onClick={handleShare}
          disabled={!!shareParams}
          aria-label="共有する"
        >
          📤
        </button>
      </div>
      {shareParams && (
        <ShareModal params={shareParams} onClose={() => setShareParams(null)} />
      )}
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────
interface Props {
  onClose: () => void
  onNavigateToMap: (spotId: string) => void
}

export function RecommendWizard({ onClose, onNavigateToMap }: Props) {
  const weekend = getWeekendDates()
  const hasBothDays = weekend.sat !== null

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [q1Prefs, setQ1Prefs] = useState<Set<string>>(new Set())
  const [q2Distance, setQ2Distance] = useState<string | null>(null)
  const [satResults, setSatResults] = useState<WizardSpot[]>([])
  const [sunResults, setSunResults] = useState<WizardSpot[]>([])
  const [activeTab, setActiveTab] = useState<'sat' | 'sun'>('sat')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(loadGeo)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState(false)
  // 天気データ: Map<spotId, Map<YYYY-MM-DD, DayWeather>>
  const [weatherMap, setWeatherMap] = useState<Map<string, Map<string, DayWeather>>>(new Map())
  // 空状態救済: エリアを「どこでも」に自動拡大した場合、元の距離を保持して「元に戻す」導線を出す
  const [widenedFromDistance, setWidenedFromDistance] = useState<string | null>(null)
  const isNight = q1Prefs.has('night')

  // Step3 突入時に天気取得
  useEffect(() => {
    if (step !== 3) return
    const allSpots = [...satResults, ...sunResults]
    const uniqueSpots = Array.from(
      new Map(allSpots.filter(s => s.lat && s.lng).map(s => [s.id, s])).values()
    ).map(s => ({ id: s.id, lat: s.lat!, lng: s.lng! }))
    if (uniqueSpots.length === 0) return

    const dates: Date[] = []
    if (weekend.sat) dates.push(weekend.sat)
    if (weekend.sun) dates.push(weekend.sun)

    let cancelled = false
    fetchWeatherForSpots(uniqueSpots, dates, isNight).then(map => {
      if (!cancelled) setWeatherMap(map)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function toggleQ1(key: string) {
    haptic(HapticPattern.light)
    setQ1Prefs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleQ2(key: string) {
    const option = Q2_OPTIONS.find(o => o.key === key)!
    setGeoError(false)

    if (!option.needsGeo || userLoc) {
      finalize(key, userLoc)
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude }
        saveGeo(loc.lat, loc.lng)
        setUserLoc(loc)
        setGeoLoading(false)
        finalize(key, loc)
      },
      () => {
        setGeoLoading(false)
        setGeoError(true)
        finalize('trip', null)
      },
      { timeout: 10000, maximumAge: 300000 }
    )
  }

  function finalize(distKey: string, loc: { lat: number; lng: number } | null) {
    setQ2Distance(distKey)
    if (weekend.sat) {
      setSatResults(filterForDate(weekend.sat, q1Prefs, distKey, loc))
    }
    setSunResults(filterForDate(weekend.sun!, q1Prefs, distKey, loc))
    setActiveTab(hasBothDays ? 'sat' : 'sun')
    setStep(3)
  }

  function reset() {
    setStep(1)
    setQ1Prefs(new Set())
    setQ2Distance(null)
    setSatResults([])
    setSunResults([])
    setWidenedFromDistance(null)
  }

  // ── 空状態救済ロジック ──────────────────────────────────────
  function refilterAndStay(prefs: Set<string>, dist: string, loc: typeof userLoc) {
    if (weekend.sat) setSatResults(filterForDate(weekend.sat, prefs, dist, loc))
    setSunResults(filterForDate(weekend.sun!, prefs, dist, loc))
  }
  function backToFeaturesStep() {
    setStep(1)
  }
  function removeOnlyFeature() {
    const next = new Set<string>()
    setQ1Prefs(next)
    if (q2Distance) refilterAndStay(next, q2Distance, userLoc)
  }
  function widenArea() {
    if (!q2Distance || q2Distance === 'trip') return
    setWidenedFromDistance(q2Distance)
    setQ2Distance('trip')
    refilterAndStay(q1Prefs, 'trip', userLoc)
  }
  function restoreArea() {
    if (!widenedFromDistance) return
    const orig = widenedFromDistance
    setQ2Distance(orig)
    setWidenedFromDistance(null)
    refilterAndStay(q1Prefs, orig, userLoc)
  }

  const currentResults = activeTab === 'sat' ? satResults : sunResults
  const currentDate    = activeTab === 'sat' ? weekend.sat! : weekend.sun!

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={e => e.stopPropagation()}>

        {/* ヘッダー */}
        <div className="wizard-header">
          <div className="wizard-header__left">
            {step > 1 && (
              <button className="wizard-back" onClick={() => setStep(s => (s - 1) as typeof step)} aria-label="戻る">←</button>
            )}
          </div>
          <div className="wizard-header__title">
            {step === 1 && 'どんな花見にしたい？'}
            {step === 2 && 'どこまで行ける？'}
            {step === 3 && '今週末のおすすめ'}
          </div>
          <button className="wizard-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        {/* ステップドット */}
        {step < 3 && (
          <div className="wizard-steps">
            {[1, 2].map(s => (
              <div key={s} className={`wizard-step-dot${step >= s ? ' active' : ''}`} />
            ))}
          </div>
        )}

        {/* ── Step 1: こだわり ── */}
        {step === 1 && (
          <>
            <div className="wizard-body">
              <div className="wizard-hint">複数選択OK・なくてもOK</div>
              <div className="wizard-chips">
                {Q1_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`wizard-chip${q1Prefs.has(key) ? ' active' : ''}`}
                    onClick={() => toggleQ1(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="wizard-footer">
              <button className="wizard-next-btn" onClick={() => { haptic(HapticPattern.light); setStep(2) }}>
                {q1Prefs.size === 0 ? 'こだわりなしで進む →' : `${q1Prefs.size}件選択 → 次へ`}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: 距離 ── */}
        {step === 2 && (
          <div className="wizard-body">
            {geoError && (
              <div className="wizard-geo-error">
                📍 位置情報を取得できませんでした。「どこでも」で検索します。
              </div>
            )}
            {geoLoading ? (
              <div className="wizard-loading">📍 位置情報を取得中...</div>
            ) : (
              <div className="wizard-options">
                {Q2_OPTIONS.map(({ key, label, sub }) => (
                  <button
                    key={key}
                    className="wizard-option-btn"
                    onClick={() => handleQ2(key)}
                  >
                    <span>{label}</span>
                    <span className="wizard-option-sub">{sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: 結果 ── */}
        {step === 3 && (
          <>
            {/* エリア拡大中チップ */}
            {widenedFromDistance && (
              <div className="wizard-widen-notice">
                <span>🎒 エリア: どこでも に変更中</span>
                <button className="wizard-widen-notice__restore" onClick={restoreArea}>元に戻す</button>
              </div>
            )}
            {/* 土日タブ */}
            {hasBothDays && (
              <div className="wizard-day-tabs">
                <button
                  className={`wizard-day-tab${activeTab === 'sat' ? ' active' : ''}`}
                  onClick={() => setActiveTab('sat')}
                >
                  🌸 {weekend.satLabel}
                </button>
                <button
                  className={`wizard-day-tab${activeTab === 'sun' ? ' active' : ''}`}
                  onClick={() => setActiveTab('sun')}
                >
                  🌸 {weekend.sunLabel}
                </button>
              </div>
            )}

            <div className="wizard-results">
              {currentResults.length === 0 ? (
                <div className="wizard-empty">
                  <div className="wizard-empty__icon">🔍</div>
                  <div className="wizard-empty__text">
                    条件に合うスポットが見つかりませんでした。
                  </div>
                  <div className="wizard-empty__actions">
                    {q1Prefs.size >= 2 && (
                      <button className="wizard-retry-btn" onClick={backToFeaturesStep}>
                        こだわりを減らす（{q1Prefs.size}件選択中）
                      </button>
                    )}
                    {q1Prefs.size === 1 && (() => {
                      const onlyKey = q1Prefs.values().next().value as string
                      const label = Q1_OPTIONS.find(o => o.key === onlyKey)?.label ?? onlyKey
                      return (
                        <button className="wizard-retry-btn" onClick={removeOnlyFeature}>
                          「{label}」のこだわりを外す
                        </button>
                      )
                    })()}
                    {q1Prefs.size === 0 && q2Distance && q2Distance !== 'trip' && (
                      <button className="wizard-retry-btn" onClick={widenArea}>
                        もっと広いエリアで探す（🎒 どこでも）
                      </button>
                    )}
                    <button className="wizard-retry-btn wizard-retry-btn--secondary" onClick={reset}>
                      もう一度最初から
                    </button>
                  </div>
                </div>
              ) : (
                <div className="wizard-result-list">
                  {currentResults.map(spot => {
                    const key = dateKey(currentDate)
                    const w = weatherMap.get(spot.id)?.get(key) ?? null
                    const dayLabel = activeTab === 'sat' ? weekend.satLabel : weekend.sunLabel
                    return (
                      <ResultCard
                        key={spot.id}
                        spot={spot}
                        targetDate={currentDate}
                        weather={w}
                        isNight={isNight}
                        dayLabel={dayLabel}
                        onMapClick={() => { onClose(); onNavigateToMap(spot.id) }}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
