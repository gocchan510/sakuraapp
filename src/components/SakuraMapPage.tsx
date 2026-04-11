import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import spotsData from '../data/spots.json'
import varietiesData from '../data/varieties.json'
import type { Variety } from '../types'
import { bloomOrd, periodsOverlap } from '../utils/bloomFilter'
import { getOffsetDaysForLocation, isInBloomAdjusted, hasOffsetData, OFFSET_UPDATED_AT } from '../utils/bloomOffset'

// ── 型 ───────────────────────────────────────────────────────────
type RawSpot = typeof spotsData[number]
type MapSpot = Omit<RawSpot, 'varieties'> & {
  varieties?: string[]
  features?: string[]
  category?: string
}
const allSpots = spotsData as unknown as MapSpot[]
const allVarieties = varietiesData as unknown as Variety[]

// ── 開花状況 ─────────────────────────────────────────────────────
type BloomStatus = 'in_bloom' | 'budding' | 'past_bloom' | 'upcoming' | 'off_season'

const BLOOM_COLOR: Record<BloomStatus, string> = {
  in_bloom:   '#FF69B4',
  budding:    '#7CCD7C',
  past_bloom: '#C8A870',
  upcoming:   '#87CEEB',
  off_season: '#C8C8C8',
}

function getCurrentPeriod(): string {
  const d = new Date()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const jun = day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late'
  return `${String(m).padStart(2, '0')}-${jun}`
}

const TODAY_PERIOD = getCurrentPeriod()
const TODAY_ORD    = bloomOrd(TODAY_PERIOD)

function varietyBloomStatus(
  bp: { start?: string; end?: string; secondary: { start: string; end: string } | null } | null | undefined,
  offsetDays = 0
): BloomStatus {
  if (!bp?.start || !bp?.end) return 'off_season'

  // Use offset-adjusted date comparison if offset provided and should adjust
  if (offsetDays !== 0) {
    const today = new Date()
    if (isInBloomAdjusted({ start: bp.start, end: bp.end }, offsetDays, today)) return 'in_bloom'
    if (bp.secondary && isInBloomAdjusted(
      { start: bp.secondary.start, end: bp.secondary.end }, offsetDays, today
    )) return 'in_bloom'
  }

  // Original period-based logic as fallback
  if (periodsOverlap(TODAY_PERIOD, TODAY_PERIOD, bp.start, bp.end)) return 'in_bloom'
  if (bp.secondary && periodsOverlap(TODAY_PERIOD, TODAY_PERIOD, bp.secondary.start, bp.secondary.end)) return 'in_bloom'

  const startOrd = bloomOrd(bp.start)
  const endOrd   = bloomOrd(bp.end)
  const wraps    = endOrd < startOrd

  if (!wraps) {
    if (endOrd < TODAY_ORD) return 'past_bloom'
    const ahead = startOrd - TODAY_ORD
    return ahead <= 2 ? 'budding' : 'upcoming'
  } else {
    // wrap-around period (e.g. Oct–Feb)
    if (TODAY_ORD < startOrd && TODAY_ORD > endOrd) {
      return (startOrd - TODAY_ORD <= 2) ? 'budding' : 'past_bloom'
    }
    return 'off_season'
  }
}

function estimateFromPeakMonth(text: string): BloomStatus {
  const months = [...(text ?? '').matchAll(/(\d+)月/g)].map(m => +m[1])
  if (!months.length) return 'off_season'
  const today = new Date()
  const m = today.getMonth() + 1
  const min = Math.min(...months)
  const max = Math.max(...months)
  if (m >= min && m <= max)  return 'in_bloom'
  if (m === min - 1)         return 'budding'
  if (m > max)               return 'past_bloom'
  return (min - m <= 1)      ? 'budding' : 'upcoming'
}

// ── 事前計算 ─────────────────────────────────────────────────────
const varietiesById = new Map(allVarieties.map(v => [v.id, v]))

function computeSpotStatus(spot: MapSpot): BloomStatus {
  const ids = spot.varieties ?? []
  if (!ids.length) return estimateFromPeakMonth(spot.peakMonth ?? '')

  // Get offset for this spot's location
  const offset = (spot.lat && spot.lng && hasOffsetData())
    ? getOffsetDaysForLocation(spot.lat, spot.lng)
    : 0

  const statuses = ids.map(id => {
    const v = varietiesById.get(id)
    if (!v?.bloomPeriod?.start || !v?.bloomPeriod?.end) return 'off_season' as BloomStatus

    // Use offset-adjusted date comparison for spring varieties
    if (offset !== 0) {
      const today = new Date()
      if (isInBloomAdjusted(v.bloomPeriod, offset, today)) return 'in_bloom' as BloomStatus

      // Check secondary
      if (v.bloomPeriod.secondary && isInBloomAdjusted(
        { start: v.bloomPeriod.secondary.start, end: v.bloomPeriod.secondary.end },
        offset, today
      )) return 'in_bloom' as BloomStatus
    }

    // Fall back to original period-based calculation
    return varietyBloomStatus(v.bloomPeriod)
  })

  for (const s of ['in_bloom', 'budding', 'upcoming', 'past_bloom'] as BloomStatus[]) {
    if (statuses.includes(s)) return s
  }
  return 'off_season'
}

// モジュールロード時に1回だけ計算
const spotStatusMap = new Map<string, BloomStatus>(
  allSpots.map(s => [s.id, computeSpotStatus(s)])
)

// ── フィルタ事前計算 ──────────────────────────────────────────────
// Build rareSpotsSet: spotIds that have at least one variety with rarity.score >= 3
const rareSpotsSet = new Set<string>()
allSpots.forEach(spot => {
  if ((spot.varieties ?? []).some(id => (varietiesById.get(id)?.rarity?.score ?? 0) >= 3)) {
    rareSpotsSet.add(spot.id)
  }
})

// Pre-compute which filter keys each spot matches
function computeSpotFilterKeys(spot: MapSpot): Set<string> {
  const keys = new Set<string>()
  if (spotStatusMap.get(spot.id) === 'in_bloom') keys.add('in_bloom')
  if (rareSpotsSet.has(spot.id)) keys.add('rare')
  const cnt = spot.varieties?.length ?? (spot as any).varietyCount ?? 0
  if (cnt >= 10) keys.add('many')
  if (spot.features?.includes('一本桜') || (spot as any).category === 'one_tree') keys.add('one_tree')
  if (spot.features?.includes('駅近')) keys.add('near_station')
  if (spot.features?.includes('無料') || !spot.features?.includes('有料')) keys.add('free')
  return keys
}
const spotFilterKeysMap = new Map<string, Set<string>>(allSpots.map(s => [s.id, computeSpotFilterKeys(s)]))

// Count per filter key
const filterCounts: Record<string, number> = { in_bloom: 0, rare: 0, many: 0, one_tree: 0, near_station: 0, free: 0 }
allSpots.forEach(spot => {
  spotFilterKeysMap.get(spot.id)?.forEach(k => { if (k in filterCounts) filterCounts[k]++ })
})

const CHIPS = [
  { key: 'in_bloom',     label: '🌸 今見頃' },
  { key: 'rare',         label: '★★★+ 珍しい' },
  { key: 'many',         label: '🌳 多品種' },
  { key: 'one_tree',     label: '🌲 一本桜' },
  { key: 'near_station', label: '🚶 駅近' },
  { key: 'free',         label: '🆓 無料' },
]

// ── ズームレベル → 最小 popularity ─────────────────────────────
function minPopForZoom(zoom: number): number {
  if (zoom >= 11) return 2
  if (zoom >= 9)  return 3
  if (zoom >= 7)  return 4
  return 5
}
function pinRadius(pop: number, inBloom: boolean): number {
  const base = pop === 5 ? 9 : pop === 4 ? 7 : pop === 3 ? 6 : 5
  return inBloom ? base + 2 : base
}

// ── Haversine distance ───────────────────────────────────────────
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── 検索インデックス ─────────────────────────────────────────────
const varietyNameToSpotIds = new Map<string, Set<string>>()
allVarieties.forEach(v => {
  ((v as any).spots ?? []).forEach((s: { spotId: string }) => {
    if (!varietyNameToSpotIds.has(v.name)) varietyNameToSpotIds.set(v.name, new Set())
    varietyNameToSpotIds.get(v.name)!.add(s.spotId)
  })
})

function searchSpots(query: string): MapSpot[] {
  if (query.length < 2) return []
  const q = query.toLowerCase()
  const matched = new Set<string>()
  allSpots.forEach(s => {
    if (s.name.toLowerCase().includes(q)) matched.add(s.id)
    if ((s.prefecture ?? '').toLowerCase().startsWith(q)) matched.add(s.id)
  })
  // variety name search
  varietyNameToSpotIds.forEach((spotIds, vName) => {
    if (vName.includes(query)) spotIds.forEach(id => matched.add(id))
  })
  return allSpots.filter(s => matched.has(s.id)).slice(0, 10)
}

// ── BottomSheet 内の品種カード ────────────────────────────────────
interface MiniCardProps {
  variety: Variety
  status: BloomStatus
  onTap: () => void
}
function VarietyMiniCard({ variety, status, onTap }: MiniCardProps) {
  const imgSrc = variety.hasImage && variety.images?.[0]?.file
  const isPast = status === 'past_bloom' || status === 'off_season'

  return (
    <div
      className={`map-mini-card${isPast ? ' map-mini-card--past' : ''}`}
      onClick={onTap}
    >
      <div className="map-mini-card__img" style={{ background: variety.colorCode + '66' }}>
        {imgSrc
          ? <img src={imgSrc} alt={variety.name} />
          : <span className="map-mini-card__dot" style={{ background: variety.colorCode }} />
        }
        {status === 'in_bloom' && <span className="map-mini-card__badge">見頃</span>}
        {status === 'budding'  && <span className="map-mini-card__badge map-mini-card__badge--bud">間もなく</span>}
      </div>
      <div className="map-mini-card__body">
        <div className="map-mini-card__name">{variety.name}</div>
        {variety.rarity && (
          <div className="map-mini-card__stars" data-score={variety.rarity.score}>
            {variety.rarity.stars}
          </div>
        )}
      </div>
    </div>
  )
}

// ── BottomSheet ─────────────────────────────────────────────────
interface SheetProps {
  spot: MapSpot
  onClose:           () => void
  onViewAll:         () => void
  onSelectVariety:   (id: string) => void
}
function SpotBottomSheet({ spot, onClose, onViewAll, onSelectVariety }: SheetProps) {
  const [expanded, setExpanded] = useState(false)
  const touchStartY = useRef(0)

  const ids      = spot.varieties ?? []
  const variants: { variety: Variety; status: BloomStatus }[] = ids
    .map(id => {
      const v = varietiesById.get(id)
      if (!v) return null
      return { variety: v, status: varietyBloomStatus(v.bloomPeriod) }
    })
    .filter(Boolean) as { variety: Variety; status: BloomStatus }[]

  const inBloom  = variants.filter(x => x.status === 'in_bloom')
  const budding  = variants.filter(x => x.status === 'budding')
  const others   = variants.filter(x => x.status !== 'in_bloom' && x.status !== 'budding')

  const varCount  = spot.varietyCount ?? ids.length
  const peakShort = (spot.peakMonth ?? '').replace(/[（(].*/, '').trim().slice(0, 24)
  const spotStatus = spotStatusMap.get(spot.id) ?? 'off_season'

  const STATUS_LABEL: Record<BloomStatus, string> = {
    in_bloom:   '🌸 今見頃',
    budding:    '🌱 もうすぐ咲く',
    past_bloom: '🍃 散り終わり',
    upcoming:   '🫧 まだ先',
    off_season: '⬜ 時期外',
  }

  function onHandleTouch(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }
  function onHandleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientY - touchStartY.current
    if (delta < -30) setExpanded(true)
    if (delta > 30)  delta > 80 ? onClose() : setExpanded(false)
  }

  return (
    <>
      {/* Backdrop — タップで閉じる */}
      {expanded && <div className="sheet-backdrop" onClick={onClose} />}

      <div className={`spot-sheet${expanded ? ' spot-sheet--full' : ' spot-sheet--peek'}`}>
        {/* Handle */}
        <div
          className="spot-sheet__handle-wrap"
          onTouchStart={onHandleTouch}
          onTouchEnd={onHandleTouchEnd}
          onClick={() => setExpanded(e => !e)}
        >
          <div className="spot-sheet__handle" />
        </div>

        {/* ヘッダー */}
        <div className="spot-sheet__header">
          <div className="spot-sheet__title-row">
            <h2 className="spot-sheet__name">🌸 {spot.name}</h2>
            <div className="spot-sheet__header-actions">
              {spot.lat && spot.lng && (
                <button
                  className="spot-sheet__route-btn"
                  onClick={() => window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=transit`,
                    '_blank'
                  )}
                >
                  🚶 ルート
                </button>
              )}
              <button className="spot-sheet__close" onClick={onClose} aria-label="閉じる">✕</button>
            </div>
          </div>
          <div className="spot-sheet__meta">
            <span className="spot-sheet__pref">{spot.prefecture}</span>
            {varCount > 0 && <span className="spot-sheet__count">{varCount}品種</span>}
            <span className="spot-sheet__status" style={{ color: BLOOM_COLOR[spotStatus] }}>
              {STATUS_LABEL[spotStatus]}
            </span>
          </div>
          {peakShort && (
            <div className="spot-sheet__peak">見頃: {peakShort}</div>
          )}
          {/* Feature 3a: 特徴タグ */}
          {spot.features && spot.features.length > 0 && (
            <div className="spot-sheet__features">
              {spot.features.slice(0, 6).map(f => (
                <span key={f} className="spot-sheet__feature-tag">{f}</span>
              ))}
            </div>
          )}
        </div>

        {/* 品種リスト（expanded時のみ） */}
        {expanded && (
          <div className="spot-sheet__body">
            {/* Feature 3b: レア品種セクション */}
            {(() => {
              const rareVariants = variants.filter(x => (x.variety.rarity?.score ?? 0) >= 3)
              if (!rareVariants.length) return null
              return (
                <section className="spot-sheet__section">
                  <div className="spot-sheet__section-title">✨ レア品種</div>
                  <div className="spot-sheet__cards">
                    {rareVariants.map(({ variety, status }) => (
                      <VarietyMiniCard key={variety.id} variety={variety} status={status} onTap={() => onSelectVariety(variety.id)} />
                    ))}
                  </div>
                </section>
              )
            })()}

            {inBloom.length > 0 && (
              <section className="spot-sheet__section">
                <div className="spot-sheet__section-title">🌸 今見頃の品種</div>
                <div className="spot-sheet__cards">
                  {inBloom.map(({ variety, status }) => (
                    <VarietyMiniCard
                      key={variety.id}
                      variety={variety}
                      status={status}
                      onTap={() => onSelectVariety(variety.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {budding.length > 0 && (
              <section className="spot-sheet__section">
                <div className="spot-sheet__section-title">🌱 もうすぐ咲く品種</div>
                <div className="spot-sheet__cards">
                  {budding.map(({ variety, status }) => (
                    <VarietyMiniCard
                      key={variety.id}
                      variety={variety}
                      status={status}
                      onTap={() => onSelectVariety(variety.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {others.length > 0 && (
              <section className="spot-sheet__section">
                <div className="spot-sheet__section-title" style={{ color: '#b09ab0' }}>その他の品種</div>
                <div className="spot-sheet__cards">
                  {others.slice(0, 12).map(({ variety, status }) => (
                    <VarietyMiniCard
                      key={variety.id}
                      variety={variety}
                      status={status}
                      onTap={() => onSelectVariety(variety.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {ids.length > 0 && (
              <button className="spot-sheet__view-all" onClick={onViewAll}>
                全品種を図鑑で見る →
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── 凡例 ─────────────────────────────────────────────────────────
function MapLegend() {
  return (
    <div className="map-legend">
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.in_bloom }} />見頃</span>
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.budding }} />もうすぐ</span>
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.past_bloom }} />散り終わり</span>
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.off_season }} />時期外</span>
    </div>
  )
}

// ── NearbySpotCard ───────────────────────────────────────────────
function NearbySpotCard({ spot, distance, status, onTap }: {
  spot: MapSpot, distance: number, status: BloomStatus, onTap: () => void
}) {
  const rarities = (spot.varieties ?? [])
    .map(id => varietiesById.get(id)?.rarity)
    .filter(Boolean)
  const maxRarity = rarities.reduce((max, r) => Math.max(max, r!.score), 0)
  const rareCount = rarities.filter(r => r!.score >= 3).length
  const varCount = (spot as any).varietyCount ?? spot.varieties?.length ?? 0

  return (
    <div className="nearby-card" onClick={onTap}>
      <div className="nearby-card__dot" style={{ background: BLOOM_COLOR[status] }} />
      <div className="nearby-card__name">{spot.name}</div>
      <div className="nearby-card__dist">{distance.toFixed(1)} km</div>
      {varCount > 0 && <div className="nearby-card__count">{varCount}品種</div>}
      {rareCount > 0 && (
        <div className="nearby-card__rare">
          {'★'.repeat(Math.min(maxRarity, 5))}{rareCount}種
        </div>
      )}
      {spot.lat && spot.lng && (
        <button
          className="nearby-card__route"
          onClick={e => {
            e.stopPropagation()
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=transit`, '_blank')
          }}
        >
          🚶
        </button>
      )}
    </div>
  )
}

// ── NearbyCarousel ───────────────────────────────────────────────
function NearbyCarousel({ spots, onSpotTap }: {
  spots: { spot: MapSpot; distance: number; status: BloomStatus }[]
  onSpotTap: (spot: MapSpot) => void
}) {
  if (!spots.length) return null
  return (
    <div className="nearby-carousel">
      <div className="nearby-carousel__title">📍 近くの見頃スポット</div>
      <div className="nearby-carousel__track">
        {spots.map(({ spot, distance, status }) => (
          <NearbySpotCard
            key={spot.id}
            spot={spot}
            distance={distance}
            status={status}
            onTap={() => onSpotTap(spot)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Props ────────────────────────────────────────────────────────
interface Props {
  onViewVarieties:   (spotName: string, varietyIds: string[]) => void
  onSelectVariety:   (id: string) => void
  focusSpotId?:      string
}

// ── メインコンポーネント ─────────────────────────────────────────
export function SakuraMapPage({ onViewVarieties, onSelectVariety, focusSpotId }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<L.Map | null>(null)
  const markerLayerRef    = useRef<L.LayerGroup | null>(null)

  // React state
  const [selectedSpot, setSelectedSpot] = useState<MapSpot | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  // 検索状態
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MapSpot[]>([])
  const [searchActive, setSearchActive] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs for Leaflet callbacks (avoid stale closures)
  const onSelectSpotRef  = useRef<(s: MapSpot) => void>(() => {})
  const activeFiltersRef = useRef<Set<string>>(new Set())
  const updateMarkersRef = useRef<(() => void) | null>(null)

  useEffect(() => { onSelectSpotRef.current = setSelectedSpot }, [])

  // activeFilters 変化時にマーカーを再描画
  useEffect(() => {
    activeFiltersRef.current = activeFilters
    updateMarkersRef.current?.()
  }, [activeFilters])

  // focusSpotId が変化したらそのスポットにフォーカス
  useEffect(() => {
    if (!focusSpotId) return
    const tryFocus = () => {
      if (!mapRef.current) { setTimeout(tryFocus, 100); return }
      const spot = allSpots.find(s => s.id === focusSpotId)
      if (spot?.lat && spot?.lng) {
        mapRef.current.setView([spot.lat, spot.lng], 14)
        setSelectedSpot(spot)
      }
    }
    tryFocus()
  }, [focusSpotId])

  // ── nearbySpots ──────────────────────────────────────────────
  const nearbySpots = useMemo(() => {
    if (!userLocation) return []
    const PRIORITY: Record<BloomStatus, number> = { in_bloom: 0, budding: 1, upcoming: 2, past_bloom: 99, off_season: 99 }
    return allSpots
      .filter(s => s.lat && s.lng)
      .map(s => ({
        spot: s,
        status: spotStatusMap.get(s.id) ?? ('off_season' as BloomStatus),
        distance: getDistance(userLocation.lat, userLocation.lng, s.lat!, s.lng!),
      }))
      .filter(x => PRIORITY[x.status] < 99)
      .sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status] || a.distance - b.distance)
      .slice(0, 10)
  }, [userLocation])

  // ── 地図初期化（1回のみ） ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [36.5, 137.5],
      zoom: 5,
      zoomControl: false,   // 検索バーと被らないよう topright に移動
    })
    L.control.zoom({ position: 'topright' }).addTo(map)

    L.tileLayer('https://tile.openstreetmap.jp/styles/osm-bright/512/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1,
    }).addTo(map)

    const layer = L.layerGroup().addTo(map)
    markerLayerRef.current = layer

    function updateMarkers() {
      layer.clearLayers()
      const zoom   = map.getZoom()
      const minPop = minPopForZoom(zoom)
      const filters = activeFiltersRef.current
      const seen   = new Set<string>()

      allSpots.forEach(spot => {
        const lat = spot.lat, lng = spot.lng
        if (!lat || !lng) return

        const pop = spot.popularity ?? 2
        if (pop < minPop) return

        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
        if (seen.has(key)) return
        seen.add(key)

        const status = spotStatusMap.get(spot.id) ?? 'off_season'
        const color  = BLOOM_COLOR[status]
        const radius = pinRadius(pop, status === 'in_bloom')

        // Determine if spot matches active filters
        let dimmed = false
        if (filters.size > 0) {
          const spotKeys = spotFilterKeysMap.get(spot.id) ?? new Set<string>()
          // ALL active filters must match
          for (const fk of filters) {
            if (!spotKeys.has(fk)) { dimmed = true; break }
          }
        }

        const marker = L.circleMarker([lat, lng], {
          radius,
          fillColor:   color,
          color:       status === 'in_bloom' ? 'rgba(220,0,80,0.4)' : 'rgba(0,0,0,0.18)',
          weight:      status === 'in_bloom' ? 2 : 1,
          fillOpacity: dimmed ? 0.12 : 0.85,
          opacity:     dimmed ? 0.3  : 1,
        }).addTo(layer)

        marker.on('click', () => onSelectSpotRef.current(spot))
      })
    }

    updateMarkers()
    updateMarkersRef.current = updateMarkers
    map.on('zoomend', updateMarkers)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = markerLayerRef.current = updateMarkersRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 現在地 ─────────────────────────────────────────────────────
  function handleLocate() {
    if (!mapRef.current) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords
        mapRef.current?.setView([latitude, longitude], 12)
        setUserLocation({ lat: latitude, lng: longitude })
      },
      () => {}
    )
  }

  // ── チップ トグル ─────────────────────────────────────────────
  function toggleChip(key: string) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function clearFilters() {
    setActiveFilters(new Set())
  }

  // ── 検索 ─────────────────────────────────────────────────────
  function handleSearchChange(val: string) {
    setSearchQuery(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setSearchResults(val.length >= 2 ? searchSpots(val) : [])
    }, 300)
  }

  const showCarousel = !selectedSpot && !!userLocation && nearbySpots.length > 0

  return (
    <div className="sakura-map-page">
      <div ref={containerRef} className="sakura-map-container" />

      {/* 検索バー */}
      <div className="map-search-bar">
        <span className="map-search-icon">🔍</span>
        <input
          className="map-search-input"
          type="text"
          placeholder="スポット名・品種名で検索..."
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => setSearchActive(true)}
        />
        {searchQuery && (
          <button className="map-search-clear" onClick={() => {
            setSearchQuery('')
            setSearchResults([])
            setSearchActive(false)
          }}>✕</button>
        )}
        {/* Search results dropdown */}
        {searchActive && searchResults.length > 0 && (
          <div className="map-search-results">
            {searchResults.map(spot => (
              <div
                key={spot.id}
                className="map-search-result-item"
                onClick={() => {
                  setSelectedSpot(spot)
                  if (spot.lat && spot.lng) {
                    mapRef.current?.setView([spot.lat, spot.lng], 14)
                  }
                  setSearchQuery('')
                  setSearchResults([])
                  setSearchActive(false)
                }}
              >
                <span className="map-search-result-dot" style={{ background: BLOOM_COLOR[spotStatusMap.get(spot.id) ?? 'off_season'] }} />
                <span className="map-search-result-name">{spot.name}</span>
                {spot.prefecture && <span className="map-search-result-pref">{spot.prefecture}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* フィルタチップバー */}
      <div className="map-chip-bar">
        {CHIPS.map(({ key, label }) => (
          <button
            key={key}
            className={`map-chip${activeFilters.has(key) ? ' active' : ''}`}
            onClick={() => toggleChip(key)}
          >
            {label}
            <span className="map-chip__count">({filterCounts[key]})</span>
          </button>
        ))}
        {activeFilters.size > 0 && (
          <button className="map-chip map-chip--clear" onClick={clearFilters}>
            ✕ クリア
          </button>
        )}
      </div>

      {/* 凡例：スポット選択中は非表示 */}
      {!selectedSpot && <MapLegend />}

      {/* オフセット情報バッジ（凡例の下） */}
      {!selectedSpot && hasOffsetData() && (
        <div className="map-offset-badge">
          🌡️ {OFFSET_UPDATED_AT} 更新
        </div>
      )}

      {/* 現在地ボタン */}
      <button
        className="sakura-map-locate-btn"
        onClick={handleLocate}
        title="現在地を表示"
        aria-label="現在地を表示"
      >
        📍
      </button>

      {/* Feature 2: 近くのスポットカルーセル */}
      {showCarousel && (
        <NearbyCarousel
          spots={nearbySpots}
          onSpotTap={(spot) => {
            setSelectedSpot(spot)
            mapRef.current?.setView([spot.lat!, spot.lng!], Math.max(mapRef.current.getZoom(), 12))
          }}
        />
      )}

      {/* ボトムシート */}
      {selectedSpot && (
        <SpotBottomSheet
          spot={selectedSpot}
          onClose={() => setSelectedSpot(null)}
          onViewAll={() => {
            onViewVarieties(selectedSpot.name, selectedSpot.varieties ?? [])
            setSelectedSpot(null)
          }}
          onSelectVariety={id => {
            onSelectVariety(id)
            setSelectedSpot(null)
          }}
        />
      )}
    </div>
  )
}
