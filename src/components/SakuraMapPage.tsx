import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import spotsData from '../data/spots.json'
import varietiesData from '../data/varieties.json'
import type { Variety } from '../types'
import { bloomOrd, periodsOverlap } from '../utils/bloomFilter'

// ── 型 ───────────────────────────────────────────────────────────
type RawSpot = typeof spotsData[number]
type MapSpot = Omit<RawSpot, 'varieties'> & { varieties?: string[] }
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
  bp: { start?: string; end?: string; secondary: { start: string; end: string } | null } | null | undefined
): BloomStatus {
  if (!bp?.start || !bp?.end) return 'off_season'

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
  const statuses = ids.map(id => varietyBloomStatus(varietiesById.get(id)?.bloomPeriod))
  for (const s of ['in_bloom', 'budding', 'upcoming', 'past_bloom'] as BloomStatus[]) {
    if (statuses.includes(s)) return s
  }
  return 'off_season'
}

// モジュールロード時に1回だけ計算
const spotStatusMap = new Map<string, BloomStatus>(
  allSpots.map(s => [s.id, computeSpotStatus(s)])
)

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
            <button className="spot-sheet__close" onClick={onClose} aria-label="閉じる">✕</button>
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
        </div>

        {/* 品種リスト（expanded時のみ） */}
        {expanded && (
          <div className="spot-sheet__body">
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

// ── Props ────────────────────────────────────────────────────────
interface Props {
  onViewVarieties:   (spotName: string, varietyIds: string[]) => void
  onSelectVariety:   (id: string) => void
}

// ── メインコンポーネント ─────────────────────────────────────────
export function SakuraMapPage({ onViewVarieties, onSelectVariety }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<L.Map | null>(null)
  const markerLayerRef    = useRef<L.LayerGroup | null>(null)

  // React state
  const [selectedSpot, setSelectedSpot] = useState<MapSpot | null>(null)
  const [onlyInBloom,  setOnlyInBloom]  = useState(false)

  // Refs for Leaflet callbacks (avoid stale closures)
  const onSelectSpotRef  = useRef<(s: MapSpot) => void>(() => {})
  const onlyInBloomRef   = useRef(false)
  const updateMarkersRef = useRef<(() => void) | null>(null)

  useEffect(() => { onSelectSpotRef.current = setSelectedSpot }, [])

  // onlyInBloom 変化時にマーカーを再描画
  useEffect(() => {
    onlyInBloomRef.current = onlyInBloom
    updateMarkersRef.current?.()
  }, [onlyInBloom])

  // ── 地図初期化（1回のみ） ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [36.5, 137.5],
      zoom: 5,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const layer = L.layerGroup().addTo(map)
    markerLayerRef.current = layer

    function updateMarkers() {
      layer.clearLayers()
      const zoom      = map.getZoom()
      const minPop    = minPopForZoom(zoom)
      const inBloomOnly = onlyInBloomRef.current
      const seen      = new Set<string>()

      allSpots.forEach(spot => {
        const lat = spot.lat, lng = spot.lng
        if (!lat || !lng) return

        const pop    = spot.popularity ?? 2
        if (pop < minPop) return

        const status = spotStatusMap.get(spot.id) ?? 'off_season'
        if (inBloomOnly && status !== 'in_bloom') return

        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
        if (seen.has(key)) return
        seen.add(key)

        const color  = BLOOM_COLOR[status]
        const radius = pinRadius(pop, status === 'in_bloom')

        const marker = L.circleMarker([lat, lng], {
          radius,
          fillColor:   color,
          color:       status === 'in_bloom' ? 'rgba(220,0,80,0.4)' : 'rgba(0,0,0,0.18)',
          weight:      status === 'in_bloom' ? 2 : 1,
          fillOpacity: 0.85,
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
      ({ coords }) => mapRef.current?.setView([coords.latitude, coords.longitude], 12),
      () => {}
    )
  }

  return (
    <div className="sakura-map-page">
      <div ref={containerRef} className="sakura-map-container" />

      {/* 「今見頃」フィルタチップ */}
      <div className="map-filter-bar">
        <button
          className={`map-filter-chip${onlyInBloom ? ' active' : ''}`}
          onClick={() => setOnlyInBloom(v => !v)}
        >
          🌸 今見頃だけ表示
        </button>
      </div>

      {/* 凡例：スポット選択中は非表示 */}
      {!selectedSpot && <MapLegend />}

      {/* 現在地ボタン */}
      <button
        className="sakura-map-locate-btn"
        onClick={handleLocate}
        title="現在地を表示"
        aria-label="現在地を表示"
      >
        📍
      </button>

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
