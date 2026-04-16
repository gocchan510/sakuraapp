import { useState } from 'react'
import spotsData from '../data/spots.json'
import { spotBloomCache } from '../utils/spotBloom'
import type { BloomStatus } from '../utils/spotBloom'
import { getNearestObservedDistanceKm, hasOffsetData } from '../utils/bloomOffset'
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
}

const allSpots = spotsData as unknown as WizardSpot[]

// ── 位置情報キャッシュ（localStorage、1ヶ月有効）────────────────
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

// ── 信頼度スター（来週以降のみ表示） ─────────────────────────────
function getReliabilityStars(lat: number, lng: number): number {
  if (!hasOffsetData()) return 1
  const dist = getNearestObservedDistanceKm(lat, lng)
  if (dist === null) return 1
  return dist <= 200 ? 5 : 3
}

// ── 質問の選択肢定義 ──────────────────────────────────────────────
const Q1_OPTIONS = [
  { key: 'today',   label: '🌸 今日' },
  { key: 'weekend', label: '📅 今週末' },
  { key: 'later',   label: '🔭 来週以降' },
]

const Q2_OPTIONS = [
  { key: 'night',   label: '🌙 夜桜' },
  { key: 'stalls',  label: '🎪 屋台' },
  { key: 'parking', label: '🅿️ 駐車場あり' },
  { key: 'hidden',  label: '💎 穴場' },
  { key: 'variety', label: '🌸 品種が多い' },
]

const Q3_OPTIONS = [
  { key: 'walk',  label: '🚶 歩いて行ける',    needsGeo: true  },
  { key: 'train', label: '🚃 電車で1時間以内',  needsGeo: true  },
  { key: 'car',   label: '🚗 車で1時間以内',    needsGeo: true  },
  { key: 'trip',  label: '🎒 日帰り旅行',       needsGeo: false },
]

// ── フィルタリング + ランキング ────────────────────────────────────
function filterAndRankSpots(
  q1: string,
  q2: Set<string>,
  q3: string,
  userLoc: { lat: number; lng: number } | null
): WizardSpot[] {
  return allSpots
    .filter(spot => {
      // Q1: 開花状況フィルタ
      const bloom = spotBloomCache.get(spot.id)
      if (!bloom) return false
      const { status, daysScore } = bloom

      if (q1 === 'today') {
        if (status !== 'in_bloom') return false
      } else if (q1 === 'weekend') {
        const ok = status === 'in_bloom' ||
          (status === 'budding' && daysScore >= 0 && daysScore <= 7)
        if (!ok) return false
      } else if (q1 === 'later') {
        if (status !== 'budding' || daysScore <= 7) return false
      }

      // Q2: こだわりフィルタ（AND条件）
      if (q2.size > 0) {
        const features = spot.features ?? []
        const vc  = spot.varietyCount ?? 0
        const pop = spot.popularity ?? 2

        if (q2.has('night') &&
          !features.includes('ライトアップ') && !features.includes('夜桜')) return false
        if (q2.has('stalls') &&
          !features.includes('屋台あり') && !features.includes('桜祭り')) return false
        if (q2.has('parking') && !features.includes('駐車場あり')) return false
        if (q2.has('hidden') && !(vc > 3 && pop <= 2)) return false
        if (q2.has('variety') && vc <= 3) return false
      }

      // Q3: 距離フィルタ
      if (q3 !== 'trip' && userLoc && spot.lat && spot.lng) {
        const dist = haversine(userLoc.lat, userLoc.lng, spot.lat, spot.lng)
        if (q3 === 'walk'  && dist > 2)  return false
        if (q3 === 'train' && dist > 50) return false
        if (q3 === 'car'   && dist > 80) return false
      }

      return true
    })
    .sort((a, b) => {
      // 見頃中 → budding の順、同一カテゴリ内は人気順
      const ba = spotBloomCache.get(a.id)
      const bb = spotBloomCache.get(b.id)
      const sa = ba?.status === 'in_bloom' ? 0 : 1
      const sb = bb?.status === 'in_bloom' ? 0 : 1
      if (sa !== sb) return sa - sb
      return (b.popularity ?? 2) - (a.popularity ?? 2)
    })
    .slice(0, 20)
}

// ── 見頃表示定義 ──────────────────────────────────────────────────
const BLOOM_DISPLAY: Record<BloomStatus, { label: string; emoji: string; color: string; bg: string }> = {
  in_bloom:   { label: '見頃',    emoji: '🌸', color: '#c2185b', bg: '#fce4ec' },
  budding:    { label: 'もうすぐ', emoji: '🌱', color: '#2e7d32', bg: '#e8f5e9' },
  past_bloom: { label: '散り頃',  emoji: '🍃', color: '#795548', bg: '#efebe9' },
  upcoming:   { label: '時期外',  emoji: '⬜', color: '#9e9e9e', bg: '#f5f5f5' },
  off_season: { label: '時期外',  emoji: '⬜', color: '#9e9e9e', bg: '#f5f5f5' },
}

// ── 結果カード ────────────────────────────────────────────────────
function ResultCard({ spot, showReliability, onMapClick }: {
  spot: WizardSpot
  showReliability: boolean
  onMapClick: () => void
}) {
  const bloom = spotBloomCache.get(spot.id) ?? { status: 'off_season' as BloomStatus, daysScore: 99999 }
  const bd = BLOOM_DISPLAY[bloom.status]
  const reliability = (showReliability && spot.lat && spot.lng)
    ? getReliabilityStars(spot.lat, spot.lng)
    : null

  return (
    <div className="wizard-result-card">
      {spot.imageUrl
        ? <img src={spot.imageUrl} alt={spot.name} className="wizard-result-card__img" loading="lazy" />
        : <div className="wizard-result-card__img-placeholder">🌸</div>
      }
      <div className="wizard-result-card__body">
        <div className="wizard-result-card__pref">{spot.prefecture}</div>
        <div className="wizard-result-card__name">{spot.name}</div>
        <div className="wizard-result-card__meta">
          <span
            className="wizard-result-card__bloom"
            style={{ color: bd.color, background: bd.bg }}
          >
            {bd.emoji} {bd.label}
          </span>
          {reliability !== null && (
            <span className="wizard-result-card__reliability" title="予測信頼度">
              {'★'.repeat(reliability)}{'☆'.repeat(5 - reliability)}
            </span>
          )}
        </div>
        {(spot.features ?? []).length > 0 && (
          <div className="wizard-result-card__features">
            {(spot.features ?? []).slice(0, 3).map(f => (
              <span key={f} className="wizard-result-card__feature-tag">{f}</span>
            ))}
          </div>
        )}
      </div>
      <button
        className="wizard-result-card__map-btn"
        onClick={onMapClick}
        aria-label="地図で見る"
      >
        🗺
      </button>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────
interface Props {
  onClose: () => void
  onNavigateToMap: (spotId: string) => void
}

export function RecommendWizard({ onClose, onNavigateToMap }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [q1, setQ1] = useState<string | null>(null)
  const [q2, setQ2] = useState<Set<string>>(new Set())
  const [q3, setQ3] = useState<string | null>(null)
  const [results, setResults] = useState<WizardSpot[]>([])
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(loadGeo)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState(false)

  // ── ナビゲーション ──
  function goBack() {
    if (step === 4) {
      // 最初からリセット
      setStep(1); setQ1(null); setQ2(new Set()); setQ3(null); setResults([])
    } else {
      setStep(s => (s - 1) as typeof step)
    }
  }

  // ── Q1 選択 ──
  function handleQ1(key: string) {
    setQ1(key)
    setStep(2)
  }

  // ── Q2 トグル ──
  function toggleQ2(key: string) {
    setQ2(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Q3 選択（位置情報取得を含む） ──
  function handleQ3(key: string) {
    const option = Q3_OPTIONS.find(o => o.key === key)!
    setGeoError(false)

    if (!option.needsGeo || userLoc) {
      // 位置情報不要 or キャッシュあり → そのまま確定
      finalize(key, userLoc)
      return
    }

    // 位置情報を新規取得
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
        finalize('trip', null)  // フォールバック: 日帰り旅行
      },
      { timeout: 10000, maximumAge: 300000 }
    )
  }

  // ── 結果確定 ──
  function finalize(q3Key: string, loc: { lat: number; lng: number } | null) {
    setQ3(q3Key)
    const filtered = filterAndRankSpots(q1!, q2, q3Key, loc)
    setResults(filtered)
    setStep(4)
  }

  // ── リセット ──
  function reset() {
    setStep(1); setQ1(null); setQ2(new Set()); setQ3(null); setResults([])
  }

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={e => e.stopPropagation()}>

        {/* ヘッダー */}
        <div className="wizard-header">
          <div className="wizard-header__left">
            {step > 1 && (
              <button className="wizard-back" onClick={goBack} aria-label="戻る">
                ←
              </button>
            )}
          </div>
          <div className="wizard-header__title">
            {step === 1 && 'いつ行く？'}
            {step === 2 && 'こだわりは？'}
            {step === 3 && 'どうやって行く？'}
            {step === 4 && (results.length > 0 ? `${results.length}件見つかりました` : '条件に合うスポットなし')}
          </div>
          <button className="wizard-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        {/* ステップインジケーター */}
        {step < 4 && (
          <div className="wizard-steps">
            {[1, 2, 3].map(s => (
              <div key={s} className={`wizard-step-dot${step >= s ? ' active' : ''}`} />
            ))}
          </div>
        )}

        {/* ── Step 1: いつ行く？ ── */}
        {step === 1 && (
          <div className="wizard-body">
            <div className="wizard-options">
              {Q1_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  className="wizard-option-btn"
                  onClick={() => handleQ1(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: こだわりは？ ── */}
        {step === 2 && (
          <div className="wizard-body">
            <div className="wizard-hint">複数選択OK（AND条件）</div>
            <div className="wizard-chips">
              {Q2_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`wizard-chip${q2.has(key) ? ' active' : ''}`}
                  onClick={() => toggleQ2(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="wizard-next-btn" onClick={() => setStep(3)}>
              {q2.size === 0 ? 'こだわりなしで進む →' : `${q2.size}件選択 → 次へ`}
            </button>
          </div>
        )}

        {/* ── Step 3: どうやって行く？ ── */}
        {step === 3 && (
          <div className="wizard-body">
            {geoError && (
              <div className="wizard-geo-error">
                📍 位置情報を取得できませんでした。「日帰り旅行」で検索します。
              </div>
            )}
            {geoLoading ? (
              <div className="wizard-loading">📍 位置情報を取得中...</div>
            ) : (
              <div className="wizard-options">
                {Q3_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    className="wizard-option-btn"
                    onClick={() => handleQ3(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: 結果 ── */}
        {step === 4 && (
          <div className="wizard-results">
            {results.length === 0 ? (
              <div className="wizard-empty">
                <div className="wizard-empty__icon">🔍</div>
                <div className="wizard-empty__text">
                  条件に合うスポットが見つかりませんでした。<br />
                  こだわりを減らして再検索してみてください。
                </div>
                <button className="wizard-retry-btn" onClick={reset}>
                  もう一度探す
                </button>
              </div>
            ) : (
              <>
                {q1 === 'later' && (
                  <div className="wizard-reliability-note">
                    ★ = 予測信頼度（観測データとの距離ベース）
                  </div>
                )}
                <div className="wizard-result-list">
                  {results.map(spot => (
                    <ResultCard
                      key={spot.id}
                      spot={spot}
                      showReliability={q1 === 'later'}
                      onMapClick={() => { onClose(); onNavigateToMap(spot.id) }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
