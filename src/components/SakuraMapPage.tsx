import { useEffect, useMemo, useRef, useState } from 'react'
import { RecommendWizard } from './RecommendWizard'
import { useLang } from '../contexts/LangContext'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import spotsData from '../data/spots.json'
import varietiesData from '../data/varieties.json'
import type { Variety } from '../types'
import { getSomeiyoshinoDate, getVarietyBloomWindow, isFuyuAutumnBloom, hasOffsetData, OFFSET_UPDATED_AT } from '../utils/bloomOffset'
import { spotBloomCache, computeSpotBloom, getSortedVarieties, getVarietyBloomStatus, STATUS_PRIORITY, type BloomStatus } from '../utils/spotBloom'
import { fetchWeatherForSpots, dateKey } from '../utils/weather'
import type { ShareCardParams } from '../utils/shareCard'
import { ShareModal } from './ShareModal'
import { FavoriteHeart } from './FavoriteHeart'
import { useFavorites } from '../contexts/FavoritesContext'
import { haptic, HapticPattern } from '../utils/haptic'

// ── 型 ───────────────────────────────────────────────────────────
type RawSpot = typeof spotsData[number]
type MapSpot = Omit<RawSpot, 'varieties'> & {
  varieties?: string[]
  features?: string[]
  category?: string
}
const allSpots = spotsData as unknown as MapSpot[]
const allVarieties = varietiesData as unknown as Variety[]

// ── 前線レイヤー: グループ定義 ────────────────────────────────────
const FRONTIER_GROUPS = ['kanhizakura', 'edohigan', 'someiyoshino', 'yamazakura', 'kasumizakura', 'sato-early', 'sato-mid', 'sato-late'] as const
type FrontierGroup = typeof FRONTIER_GROUPS[number]
const GROUP_INFO: Record<FrontierGroup, { name: string; icon: string; color: string }> = {
  kanhizakura:  { name: 'カンヒザクラ系',  icon: '🌺', color: '#D81B60' },
  edohigan:     { name: 'エドヒガン系',    icon: '🌸', color: '#8E24AA' },
  someiyoshino: { name: 'ソメイヨシノ',    icon: '🌸', color: '#E91E8C' },
  yamazakura:   { name: 'ヤマザクラ系',    icon: '🌿', color: '#F57C00' },
  kasumizakura: { name: 'カスミザクラ系',  icon: '🌫️', color: '#0288D1' },
  'sato-early': { name: 'サトザクラ(早)',  icon: '🌷', color: '#388E3C' },
  'sato-mid':   { name: 'サトザクラ(中)',  icon: '🌷', color: '#5C6BC0' },
  'sato-late':  { name: 'サトザクラ(遅)',  icon: '🌹', color: '#C62828' },
}

// ── 開花状況 ─────────────────────────────────────────────────────
const BLOOM_COLOR: Record<BloomStatus, string> = {
  in_bloom:   '#FF69B4',
  opening:    '#FF9AB8',
  falling:    '#C8A870',
  leaf:       '#66BB6A',
  budding:    '#FFD54F',
  upcoming:   '#87CEEB',
  off_season: '#C8C8C8',
}

// ── 日付ユーティリティ ────────────────────────────────────────────
const MAP_DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function toInputDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
function formatMapDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日（${MAP_DAY_NAMES[d.getDay()]}）`
}

// ── 事前計算 ─────────────────────────────────────────────────────
const varietiesById = new Map(allVarieties.map(v => [v.id, v]))

// グループ別スポット一覧（varietiesById 定義後に構築）
const spotsByBloomGroup = new Map<string, typeof allSpots>()
allSpots.forEach(spot => {
  const groups = new Set<string>()
  ;(spot.varieties ?? []).forEach(id => {
    const v = varietiesById.get(id)
    if (v?.bloomGroup && (FRONTIER_GROUPS as readonly string[]).includes(v.bloomGroup)) {
      groups.add(v.bloomGroup)
    }
  })
  groups.forEach(g => {
    if (!spotsByBloomGroup.has(g)) spotsByBloomGroup.set(g, [])
    spotsByBloomGroup.get(g)!.push(spot)
  })
})

// spotBloom.tsのキャッシュを使用
const spotStatusMap = new Map<string, BloomStatus>(
  [...spotBloomCache.entries()].map(([id, { status }]) => [id, status])
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

// ── 咲き具合スコア 0〜1（前線補完用） ───────────────────────────
function bloomScoreFromWindow(win: { start: Date; end: Date } | null, today: Date): number {
  if (!win) return 0
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (t > win.end) return 0
  if (t < win.start) return 0
  const duration = (win.end.getTime() - win.start.getTime()) / 86400000
  const elapsed  = (t.getTime() - win.start.getTime()) / 86400000
  const ratio = duration > 0 ? elapsed / duration : 0.5
  if (ratio < 0.35) return 0.5 + (ratio / 0.35) * 0.5   // opening: 0.5→1.0
  if (ratio < 0.65) return 1.0                             // in_bloom: 1.0
  return 1.0 - ((ratio - 0.65) / 0.35) * 0.7              // falling: 1.0→0.3
}

function getGroupScoreAtSpot(spot: MapSpot, bloomGroup: string, date: Date): number {
  const soDate = (spot.lat && spot.lng && hasOffsetData())
    ? getSomeiyoshinoDate(spot.lat, spot.lng)
    : getSomeiyoshinoDate(35.6895, 139.6917)
  let best = 0
  for (const id of spot.varieties ?? []) {
    const v = varietiesById.get(id)
    if (!v || v.bloomGroup !== bloomGroup) continue
    if (isFuyuAutumnBloom(v.bloomGroup, date)) { best = Math.max(best, 1.0); continue }
    const win = getVarietyBloomWindow(v.bloomGroup, v.someiyoshinoOffset ?? null, soDate)
    best = Math.max(best, bloomScoreFromWindow(win, date))
  }
  return best
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

// ── 検索インデックス（インクリメンタルサーチ対応） ─────────────────
import { normalize, romajiToHiragana } from '../utils/searchNormalize'

// スポット: 正規化済み名前をキャッシュ
const spotNormIndex = allSpots.map(s => ({
  id:       s.id,
  nameNorm: normalize(s.name),
}))

// 品種: name / reading(ひらがな) / id(ローマ字) / id(ひらがな) / aliases の全キーを保持
interface VarietySearchEntry {
  variety:     Variety
  nameNorm:    string    // 御衣黄（漢字そのまま）
  readingHira: string    // ぎょいこう（カタカナ→ひらがな変換済み）
  idRomaji:    string    // gyoikou
  idHira:      string    // ぎょいこう（IDのローマ字変換）
  aliasNorms:  string[]  // aliases 正規化済み
  spotIds:     Set<string>
}

const varietySearchIndex: VarietySearchEntry[] = allVarieties.map(v => ({
  variety:     v,
  nameNorm:    normalize(v.name),
  readingHira: normalize(v.reading),   // normalize がカタカナ→ひらがな変換を含む
  idRomaji:    v.id.toLowerCase(),
  idHira:      romajiToHiragana(v.id),
  aliasNorms:  (v.aliases ?? []).map(a => normalize(a)),
  spotIds:     new Set((v.spots ?? []).map(s => s.spotId)),
}))

// ── インクリメンタルサーチ ────────────────────────────────────────
function searchAll(query: string): {
  varietyMatches: Variety[]
  spotMatches:    MapSpot[]
  pinFilter:      Set<string> | null
} {
  const q = query.trim()
  if (!q) return { varietyMatches: [], spotMatches: [], pinFilter: null }

  const norm     = normalize(q)  // カタカナ→ひらがな, 全角→半角, 小文字
  const isRomaji = /^[a-z]+$/.test(norm)          // 正規化後がASCIIのみ → ローマ字入力
  const hasKanji = /[\u4E00-\u9FFF]/.test(norm)   // 漢字を含む

  // 品種マッチ
  const pinFilterSet = new Set<string>()
  const varietyHits: Variety[] = []

  for (const entry of varietySearchIndex) {
    let matched = false
    if (isRomaji) {
      // ローマ字 → id前方一致
      matched = entry.idRomaji.startsWith(norm)
    } else if (hasKanji) {
      // 漢字 → name / aliases インクルード
      matched = entry.nameNorm.includes(norm)
        || entry.aliasNorms.some(a => a.includes(norm))
    } else {
      // ひらがな（カタカナ入力も正規化でひらがな化） → 全キーでインクルード
      matched = entry.readingHira.includes(norm)
        || entry.idHira.includes(norm)
        || entry.nameNorm.includes(norm)
        || entry.aliasNorms.some(a => a.includes(norm))
    }

    if (matched) {
      varietyHits.push(entry.variety)
      entry.spotIds.forEach(id => pinFilterSet.add(id))
      if (varietyHits.length >= 8) break
    }
  }

  // スポット名マッチ
  const spotHits: MapSpot[] = []
  for (const e of spotNormIndex) {
    if (e.nameNorm.includes(norm)) {
      const spot = allSpots.find(s => s.id === e.id)
      if (spot) {
        spotHits.push(spot)
        if (spotHits.length >= 6) break
      }
    }
  }

  return {
    varietyMatches: varietyHits,
    spotMatches:    spotHits,
    pinFilter:      pinFilterSet.size > 0 ? pinFilterSet : null,
  }
}

// ── BottomSheet 内の品種カード ────────────────────────────────────
interface MiniCardProps {
  variety: Variety
  status: BloomStatus
  onTap: () => void
}
function VarietyMiniCard({ variety, status, onTap }: MiniCardProps) {
  const imgSrc = variety.hasImage && variety.images?.[0]?.file
  const isPast = status === 'leaf' || status === 'off_season'

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
        {status === 'in_bloom'  && <span className="map-mini-card__badge">満開・見頃</span>}
        {status === 'opening'   && <span className="map-mini-card__badge map-mini-card__badge--opening">開花中</span>}
        {status === 'budding'   && <span className="map-mini-card__badge map-mini-card__badge--bud">間もなく</span>}
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
  onSelectVariety:   (id: string, fromDate?: string) => void
  onViewSpotList?:   (spotId: string) => void
  mapDate:           Date
}
function SpotBottomSheet({ spot, onClose, onViewAll, onSelectVariety, onViewSpotList, mapDate }: SheetProps) {
  const [expanded, setExpanded] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareParams, setShareParams] = useState<Omit<ShareCardParams, 'format'> | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStateRef = useRef<{
    startY: number
    startTime: number
    lastY: number
    lastTime: number
  } | null>(null)
  const { t } = useLang()
  const mapStr = t('map')

  async function handleShare() {
    if (sharing || shareParams) return
    setSharing(true)
    try {
      const targetDate = mapDate
      let weather = null
      if (spot.lat && spot.lng) {
        const weatherMap = await fetchWeatherForSpots(
          [{ id: spot.id, lat: spot.lat, lng: spot.lng }],
          [targetDate],
          false,
        )
        weather = weatherMap.get(spot.id)?.get(dateKey(targetDate)) ?? null
      }
      const bloom = computeSpotBloom(spot as Parameters<typeof computeSpotBloom>[0], targetDate)
      const dayNames = ['日', '月', '火', '水', '木', '金', '土']
      const dayLabel = `${targetDate.getMonth() + 1}/${targetDate.getDate()}(${dayNames[targetDate.getDay()]})`
      // 代表品種：ソメイヨシノ優先、なければ最上位
      const sorted = getSortedVarieties(spot as Parameters<typeof getSortedVarieties>[0], targetDate)
      let primaryVariety: string | null = null
      if (sorted.length > 0) {
        const topStatus = sorted[0].status
        const someiyoshino = sorted.find(x => x.variety.id === 'someiyoshino' && x.status === topStatus)
        primaryVariety = someiyoshino ? someiyoshino.variety.name : sorted[0].variety.name
      }
      setShareParams({
        name: spot.name,
        prefecture: spot.prefecture,
        city: spot.city ?? '',
        bloomStatus: bloom.status,
        weather,
        isNight: false,
        dayLabel,
        features: spot.features ?? [],
        varietyCount: spot.varietyCount ?? (spot.varieties?.length ?? 0),
        is100sen: (spot.features ?? []).includes('さくら名所100選'),
        imageUrl: (spot as any).imageUrl ?? null,
        primaryVariety,
        targetDate,
        spotId: spot.id,
      })
    } finally {
      setSharing(false)
    }
  }

  const ids = spot.varieties ?? []
  // getSortedVarieties を使って品種の開花ステータスを取得
  const sortedVars = getSortedVarieties(spot, mapDate)
  const variants: { variety: Variety; status: BloomStatus }[] = sortedVars

  const inBloom  = variants.filter(x => x.status === 'in_bloom' || x.status === 'opening' || x.status === 'falling')
  const budding  = variants.filter(x => x.status === 'budding')
  const others   = variants.filter(x => !['in_bloom','opening','falling','budding'].includes(x.status))

  const varCount  = spot.varietyCount ?? ids.length
  const peakShort = spot.peakMonth != null ? `${spot.peakMonth}月` : ''
  const spotStatus = computeSpotBloom(spot as Parameters<typeof computeSpotBloom>[0], mapDate).status

  const STATUS_LABEL = mapStr.statusLabel as Record<string, string>

  // ── ハンドルのドラッグ操作（指追従） ──
  function onHandleTouchStart(e: React.TouchEvent) {
    const tc = e.touches[0]
    const now = performance.now()
    dragStateRef.current = {
      startY: tc.clientY,
      startTime: now,
      lastY: tc.clientY,
      lastTime: now,
    }
    setDragging(true)
  }
  function onHandleTouchMove(e: React.TouchEvent) {
    const st = dragStateRef.current
    if (!st) return
    const tc = e.touches[0]
    st.lastY = tc.clientY
    st.lastTime = performance.now()
    setDragY(tc.clientY - st.startY)
  }
  function onHandleTouchEnd() {
    const st = dragStateRef.current
    if (!st) return
    dragStateRef.current = null
    const delta = st.lastY - st.startY
    const dt = Math.max(1, st.lastTime - st.startTime)
    const velocity = delta / dt  // px/ms 正=下方向

    setDragging(false)

    const FLICK = 0.6        // 速度しきい値 (px/ms)
    const CLOSE_FLICK = 1.3  // 即 close する勢い
    const CLOSE_DIST = 140   // 位置だけで close 判定

    if (expanded) {
      // full状態
      if (velocity > CLOSE_FLICK || delta > window.innerHeight * 0.45) {
        haptic(HapticPattern.medium)
        setDragY(0); onClose(); return
      }
      if (velocity > FLICK || delta > 160) {
        haptic(HapticPattern.strong)
        setExpanded(false)
      }
      // 上方向スワイプは何もしない（既に full）
    } else {
      // peek状態
      if (velocity < -FLICK || delta < -60) {
        haptic(HapticPattern.strong)
        setExpanded(true)
      } else if (velocity > FLICK || delta > CLOSE_DIST) {
        haptic(HapticPattern.medium)
        setDragY(0); onClose(); return
      }
    }
    setDragY(0)
  }

  return (
    <>
      {/* Backdrop — タップで閉じる */}
      {expanded && <div className="sheet-backdrop" onClick={onClose} />}

      <div
        className={`spot-sheet${expanded ? ' spot-sheet--full' : ' spot-sheet--peek'}${dragging ? ' spot-sheet--dragging' : ''}`}
        style={(dragging || dragY !== 0) ? ({ ['--drag-y' as any]: `${dragY}px` } as React.CSSProperties) : undefined}
      >
        {/* Handle */}
        <div
          className="spot-sheet__handle-wrap"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="spot-sheet__handle" />
        </div>

        {/* ヘッダー */}
        <div className="spot-sheet__header">
          <div className="spot-sheet__title-row">
            <h2 className="spot-sheet__name">🌸 {spot.name}</h2>
            <div className="spot-sheet__header-actions">
              <FavoriteHeart spotId={spot.id} variant="sheet" stopPropagation={false} />
              {spot.lat && spot.lng && (
                <button
                  className="spot-sheet__route-btn"
                  onClick={() => window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=transit`,
                    '_blank'
                  )}
                >
                  {mapStr.routeBtn}
                </button>
              )}
              <button
                className="spot-sheet__route-btn"
                aria-label={mapStr.shareBtn}
                onClick={handleShare}
                disabled={sharing}
              >
                {sharing ? (
                  <span style={{display:'inline-flex',alignItems:'center',gap:4}}>⏳ 生成中…</span>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle'}}>
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    {' '}{mapStr.shareBtn}
                  </>
                )}
              </button>
              <button className="spot-sheet__close" onClick={onClose} aria-label="閉じる">✕</button>
            </div>
          </div>
          <div className="spot-sheet__meta">
            <span className="spot-sheet__pref">{spot.prefecture}</span>
            {varCount > 0 && <span className="spot-sheet__count">{mapStr.varietyCount(varCount)}</span>}
            <span className="spot-sheet__status" style={{ color: BLOOM_COLOR[spotStatus] }}>
              {STATUS_LABEL[spotStatus]}
            </span>
          </div>
          {/* ソメイヨシノ指標 */}
          {(() => {
            const soStatus = spotBloomCache.get(spot.id)?.someiyoshinoStatus
            const soLabel = soStatus ? (mapStr.soLabel as Record<string, string>)[soStatus as string] : null
            if (!soLabel) return null
            return <div className="spot-sheet__someiyoshino-ref">🌸 {t('spots').someiyoshino}: {soLabel}</div>
          })()}
          {peakShort && (
            <div className="spot-sheet__peak">{mapStr.peakLabel} {peakShort}</div>
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

        {/* 品種リスト（常にレンダリング：ドラッグ中も中身が見える） */}
        {(
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
                      <VarietyMiniCard key={variety.id} variety={variety} status={status} onTap={() => onSelectVariety(variety.id, toInputDate(mapDate))} />
                    ))}
                  </div>
                </section>
              )
            })()}

            {inBloom.length > 0 && (
              <section className="spot-sheet__section">
                <div className="spot-sheet__section-title">{mapStr.nowBloomTitle}</div>
                <div className="spot-sheet__cards">
                  {inBloom.map(({ variety, status }) => (
                    <VarietyMiniCard
                      key={variety.id}
                      variety={variety}
                      status={status}
                      onTap={() => onSelectVariety(variety.id, toInputDate(mapDate))}
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
                      onTap={() => onSelectVariety(variety.id, toInputDate(mapDate))}
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
                      onTap={() => onSelectVariety(variety.id, toInputDate(mapDate))}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="spot-sheet__action-row">
              {ids.length > 0 && (
                <button className="spot-sheet__view-all" onClick={onViewAll}>
                  🌸 {t('tabs').zukan}
                </button>
              )}
              {onViewSpotList && (
                <button
                  className="spot-sheet__view-spot-list"
                  onClick={() => { onClose(); onViewSpotList(spot.id) }}
                >
                  {mapStr.spotListBtn}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {shareParams && (
        <ShareModal params={shareParams} onClose={() => setShareParams(null)} />
      )}
    </>
  )
}

// ── 凡例 ─────────────────────────────────────────────────────────
function MapLegend() {
  const { t } = useLang()
  const mapStr = t('map')
  const statusStr = t('status')
  return (
    <div className="map-legend">
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.in_bloom }} />{mapStr.legendInBloom}</span>
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.opening }} />{statusStr.opening}</span>
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.falling }} />{mapStr.legendFalling}</span>
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.budding }} />{mapStr.legendBudding}</span>
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.leaf }} />{statusStr.leaf}</span>
      <span><span className="map-legend__dot" style={{ background: BLOOM_COLOR.off_season }} />{statusStr.off_season}</span>
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
  const { t } = useLang()
  if (!spots.length) return null
  return (
    <div className="nearby-carousel">
      <div className="nearby-carousel__title">{t('map').nearbyTitle}</div>
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
  onSelectVariety:   (id: string, fromDate?: string) => void
  onViewSpotList?:   (spotId: string) => void
  focusSpotId?:      string
}

// ── メインコンポーネント ─────────────────────────────────────────
export function SakuraMapPage({ onViewVarieties, onSelectVariety, onViewSpotList, focusSpotId }: Props) {
  const { t } = useLang()
  const mapStr = t('map')
  const { favoriteIds, count: favCount } = useFavorites()

  const CHIPS = [
    { key: 'in_bloom',     label: mapStr.chips.in_bloom },
    { key: 'rare',         label: mapStr.chips.rare },
    { key: 'many',         label: mapStr.chips.many },
    { key: 'one_tree',     label: mapStr.chips.one_tree },
    { key: 'near_station', label: mapStr.chips.near_station },
    { key: 'free',         label: mapStr.chips.free },
  ]

  const containerRef      = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<L.Map | null>(null)
  const markerLayerRef    = useRef<L.LayerGroup | null>(null)
  const frontierLayerRef  = useRef<L.LayerGroup | null>(null)
  const mapDateRef        = useRef<Date>(new Date())
  const updateFrontierRef = useRef<(() => void) | null>(null)

  // React state
  const [selectedSpot, setSelectedSpot] = useState<MapSpot | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  // 日付ピッカー
  const [mapDate, setMapDate] = useState<Date>(() => new Date())
  const dateInputRef = useRef<HTMLInputElement>(null)
  const dateStatusMapRef = useRef<Map<string, BloomStatus>>(new Map(spotStatusMap))
  const [dateStatusMap, setDateStatusMap] = useState<Map<string, BloomStatus>>(() => new Map(spotStatusMap))

  // 検索状態
  const [searchQuery, setSearchQuery] = useState('')
  const [varietyResults, setVarietyResults] = useState<Variety[]>([])
  const [spotResults,    setSpotResults]    = useState<MapSpot[]>([])
  const [searchActive, setSearchActive] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs for Leaflet callbacks (avoid stale closures)
  const onSelectSpotRef    = useRef<(s: MapSpot) => void>(() => {})
  const activeFiltersRef   = useRef<Set<string>>(new Set())
  const searchPinFilterRef = useRef<Set<string> | null>(null)  // 品種検索ピンフィルタ
  const updateMarkersRef   = useRef<(() => void) | null>(null)
  const favoriteIdsRef     = useRef<Set<string>>(favoriteIds)

  useEffect(() => { onSelectSpotRef.current = setSelectedSpot }, [])

  // activeFilters 変化時にマーカーを再描画
  useEffect(() => {
    activeFiltersRef.current = activeFilters
    updateMarkersRef.current?.()
  }, [activeFilters])

  // お気に入り変化時にもマーカーを再描画
  useEffect(() => {
    favoriteIdsRef.current = favoriteIds
    updateMarkersRef.current?.()
  }, [favoriteIds])

  // mapDate 変化時: 全スポットのステータスを再計算してピンを更新
  useEffect(() => {
    const today = new Date()
    const newMap: Map<string, BloomStatus> = isSameDay(mapDate, today)
      ? new Map(spotStatusMap)
      : new Map(allSpots.map(s => [s.id, computeSpotBloom(s as Parameters<typeof computeSpotBloom>[0], mapDate).status]))
    dateStatusMapRef.current = newMap
    mapDateRef.current = mapDate
    setDateStatusMap(newMap)
    updateMarkersRef.current?.()
    updateFrontierRef.current?.()
  }, [mapDate])

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
    const PRIORITY: Record<BloomStatus, number> = { in_bloom: 0, opening: 1, falling: 2, budding: 3, leaf: 4, upcoming: 5, off_season: 99 }
    return allSpots
      .filter(s => s.lat && s.lng)
      .map(s => ({
        spot: s,
        status: dateStatusMap.get(s.id) ?? ('off_season' as BloomStatus),
        distance: getDistance(userLocation.lat, userLocation.lng, s.lat!, s.lng!),
      }))
      .filter(x => PRIORITY[x.status] < 99)
      .sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status] || a.distance - b.distance)
      .slice(0, 10)
  }, [userLocation, dateStatusMap])

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

    // ── 前線レイヤー（スポットマーカーより下のパネル） ──────────────
    const frontierPane = map.createPane('frontierPane')
    frontierPane.style.zIndex = '350'
    const frontierLayer = L.layerGroup().addTo(map)
    frontierLayerRef.current = frontierLayer

    function updateFrontier() {
      frontierLayer.clearLayers()
      const date = mapDateRef.current

      const SCORE_THRESHOLD = 0.25
      const BAND_WIDTH = 1.5

      FRONTIER_GROUPS.forEach(group => {
        const spots = spotsByBloomGroup.get(group) ?? []

        // スコア付きスポットを収集（閾値以上のみ）
        const scored = spots
          .filter(s => s.lat && s.lng)
          .map(s => ({ spot: s, score: getGroupScoreAtSpot(s, group, date) }))
          .filter(x => x.score >= SCORE_THRESHOLD)

        if (scored.length < 3) return

        const info = GROUP_INFO[group]

        // 経度帯ごとに「スコア加重で最も北寄りの点」を選んで前線を形成
        const lngMin = Math.min(...scored.map(x => x.spot.lng!))
        const lngMax = Math.max(...scored.map(x => x.spot.lng!))
        const frontPoints: [number, number][] = []

        for (let lng = lngMin; lng <= lngMax + BAND_WIDTH; lng += BAND_WIDTH) {
          const band = scored.filter(x => x.spot.lng! >= lng && x.spot.lng! < lng + BAND_WIDTH)
          if (band.length === 0) continue
          // スコアが高いほど北側に引き寄せる（加重）
          const weightedNorth = band.reduce((best, x) => {
            const adjustedLat = x.spot.lat! + x.score * 0.3  // スコアで少し北にずらす
            const bestAdj = best.spot.lat! + best.score * 0.3
            return adjustedLat > bestAdj ? x : best
          })
          frontPoints.push([weightedNorth.spot.lat!, weightedNorth.spot.lng!])
        }

        if (frontPoints.length < 2) return
        frontPoints.sort((a, b) => a[1] - b[1])

        L.polyline(frontPoints, {
          color: info.color,
          weight: 3,
          opacity: 0.85,
          dashArray: '10, 5',
          interactive: false,
          pane: 'frontierPane',
        }).addTo(frontierLayer)

        // ラベル: 最もスコアが高い帯の点
        const midIdx = Math.floor(frontPoints.length / 2)
        const [labelLat, labelLng] = frontPoints[midIdx]

        L.marker([labelLat, labelLng], {
          icon: L.divIcon({
            html: `<div class="frontier-label" style="color:${info.color};border-color:${info.color}">${info.icon} ${info.name}</div>`,
            className: 'frontier-label-wrapper',
            iconSize: [0, 0] as [number, number],
            iconAnchor: [0, 0] as [number, number],
          }),
          interactive: false,
          pane: 'frontierPane',
        }).addTo(frontierLayer)
      })
    }

    updateFrontier()
    updateFrontierRef.current = updateFrontier

    function updateMarkers() {
      layer.clearLayers()
      const zoom   = map.getZoom()
      const minPop = minPopForZoom(zoom)
      const filters = activeFiltersRef.current
      const favSet  = favoriteIdsRef.current
      const seen   = new Set<string>()

      allSpots.forEach(spot => {
        const lat = spot.lat, lng = spot.lng
        if (!lat || !lng) return

        const isFav = favSet.has(spot.id)
        const pop = spot.popularity ?? 2
        // お気に入りは popularity 低くても必ず表示
        if (pop < minPop && !isFav) return

        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
        if (seen.has(key)) return
        seen.add(key)

        const status = dateStatusMapRef.current.get(spot.id) ?? 'off_season'
        const color  = BLOOM_COLOR[status]
        const radius = pinRadius(pop, status === 'in_bloom' || status === 'opening')

        // チップフィルタ（AND）
        let dimmed = false
        if (filters.size > 0) {
          const spotKeys = spotFilterKeysMap.get(spot.id) ?? new Set<string>()
          for (const fk of filters) {
            if (fk === 'fav') {
              if (!isFav) { dimmed = true; break }
            } else if (!spotKeys.has(fk)) { dimmed = true; break }
          }
        }
        // 品種検索ピンフィルタ
        const pinFilter = searchPinFilterRef.current
        if (!dimmed && pinFilter !== null && !pinFilter.has(spot.id)) {
          dimmed = true
        }

        let marker: L.Layer
        if (isFav) {
          // ハート形ピン（bloom色で塗り、白縁）
          const size = Math.max(22, radius * 2 + 10)
          const stroke = (status === 'in_bloom' || status === 'opening') ? '#fff' : '#fff'
          const strokeW = 1.6
          const heartSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
                    fill="${color}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"
                    style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));" />
            </svg>`
          const icon = L.divIcon({
            html: heartSvg,
            className: `fav-map-pin${dimmed ? ' fav-map-pin--dim' : ''}`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          })
          marker = L.marker([lat, lng], { icon, keyboard: false, interactive: true }).addTo(layer)
        } else {
          marker = L.circleMarker([lat, lng], {
            radius,
            fillColor:   color,
            color:       (status === 'in_bloom' || status === 'opening') ? 'rgba(220,0,80,0.4)' : 'rgba(0,0,0,0.18)',
            weight:      (status === 'in_bloom' || status === 'opening') ? 2 : 1,
            fillOpacity: dimmed ? 0.12 : 0.85,
            opacity:     dimmed ? 0.3  : 1,
          }).addTo(layer)
        }

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
      frontierLayerRef.current = updateFrontierRef.current = null
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
  function clearSearch() {
    setSearchQuery('')
    setVarietyResults([])
    setSpotResults([])
    setSearchActive(false)
    searchPinFilterRef.current = null
    updateMarkersRef.current?.()
  }

  function handleSearchChange(val: string) {
    setSearchQuery(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!val.trim()) {
      setVarietyResults([])
      setSpotResults([])
      searchPinFilterRef.current = null
      updateMarkersRef.current?.()
      return
    }
    // 100ms debounce でインクリメンタルサーチ（1文字から）
    searchTimerRef.current = setTimeout(() => {
      const { varietyMatches, spotMatches, pinFilter } = searchAll(val)
      setVarietyResults(varietyMatches)
      setSpotResults(spotMatches)
      searchPinFilterRef.current = pinFilter
      updateMarkersRef.current?.()
    }, 100)
  }

  function handleVarietySelect(variety: Variety) {
    const entry = varietySearchIndex.find(e => e.variety.id === variety.id)
    if (entry && entry.spotIds.size > 0) {
      searchPinFilterRef.current = new Set(entry.spotIds)
      updateMarkersRef.current?.()
      // スポットが1つのみなら自動でフォーカス＋ボトムシート
      if (entry.spotIds.size === 1) {
        const spotId = [...entry.spotIds][0]
        const spot = allSpots.find(s => s.id === spotId)
        if (spot?.lat && spot?.lng) {
          mapRef.current?.setView([spot.lat, spot.lng], 14)
          setSelectedSpot(spot)
        }
      }
    }
    setSearchQuery(variety.name)
    setVarietyResults([])
    setSpotResults([])
    setSearchActive(false)
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
          placeholder={mapStr.searchPlaceholder}
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => setSearchActive(true)}
        />
        {searchQuery && (
          <button className="map-search-clear" onClick={clearSearch}>✕</button>
        )}
        {/* 検索候補ドロップダウン（品種 / スポット グループ表示） */}
        {searchActive && (varietyResults.length > 0 || spotResults.length > 0) && (
          <div className="map-search-results">
            {/* 🌸 品種グループ */}
            {varietyResults.length > 0 && (
              <>
                <div className="map-search-results-group">🌸 品種</div>
                {varietyResults.map(v => (
                  <div
                    key={v.id}
                    className="map-search-result-item"
                    onClick={() => handleVarietySelect(v)}
                  >
                    <span className="map-search-result-dot" style={{ background: v.colorCode }} />
                    <span className="map-search-result-name">{v.name}</span>
                    <span className="map-search-result-reading">{v.reading}</span>
                  </div>
                ))}
              </>
            )}
            {/* 🗺️ スポットグループ */}
            {spotResults.length > 0 && (
              <>
                <div className="map-search-results-group">🗺️ スポット</div>
                {spotResults.map(spot => (
                  <div
                    key={spot.id}
                    className="map-search-result-item"
                    onClick={() => {
                      setSelectedSpot(spot)
                      if (spot.lat && spot.lng) mapRef.current?.setView([spot.lat, spot.lng], 14)
                      clearSearch()
                    }}
                  >
                    <span className="map-search-result-dot" style={{ background: BLOOM_COLOR[spotStatusMap.get(spot.id) ?? 'off_season'] }} />
                    <span className="map-search-result-name">{spot.name}</span>
                    {spot.prefecture && <span className="map-search-result-pref">{spot.prefecture}</span>}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* 日付ピッカー */}
      <div className="map-date-bar">
        <button className="map-date-nav" onClick={() => setMapDate(d => addDays(d, -1))}>◀</button>
        <button
          className={`map-date-label${isSameDay(mapDate, new Date()) ? ' map-date-label--today' : ''}`}
          onClick={() => { try { dateInputRef.current?.showPicker() } catch { dateInputRef.current?.click() } }}
        >
          {isSameDay(mapDate, new Date()) ? `今日 ${formatMapDate(mapDate)}` : formatMapDate(mapDate)}
        </button>
        <button className="map-date-nav" onClick={() => setMapDate(d => addDays(d, 1))}>▶</button>
        <input
          ref={dateInputRef}
          type="date"
          value={toInputDate(mapDate)}
          onChange={e => { if (e.target.value) setMapDate(new Date(e.target.value + 'T00:00:00')) }}
          className="map-date-input-hidden"
        />
      </div>

      {/* フィルタチップバー */}
      <div className="map-chip-bar">
        <button
          className={`map-chip map-chip--fav${activeFilters.has('fav') ? ' active' : ''}`}
          onClick={() => toggleChip('fav')}
          aria-pressed={activeFilters.has('fav')}
        >
          ♥ お気に入り
          {favCount > 0 && <span className="map-chip__count">({favCount})</span>}
        </button>
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

      {/* 今週末バナー（スポット未選択時のみ表示） */}
      {!selectedSpot && (
        <button
          className="map-weekend-banner"
          onClick={() => setShowWizard(true)}
          aria-label="今週末のお花見どこいく？"
        >
          <span className="map-weekend-banner__text">🌸 今週末のお花見どこいく？</span>
          <span className="map-weekend-banner__arrow">→</span>
        </button>
      )}

      {/* おすすめウィザード */}
      {showWizard && (
        <RecommendWizard
          onClose={() => setShowWizard(false)}
          onNavigateToMap={(spotId) => {
            setShowWizard(false)
            const spot = allSpots.find(s => s.id === spotId)
            if (spot?.lat && spot?.lng) {
              mapRef.current?.setView([spot.lat, spot.lng], 14)
              setSelectedSpot(spot)
            }
          }}
        />
      )}

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
          mapDate={mapDate}
          onClose={() => setSelectedSpot(null)}
          onViewAll={() => {
            onViewVarieties(selectedSpot.name, selectedSpot.varieties ?? [])
            setSelectedSpot(null)
          }}
          onSelectVariety={(id, fromDate) => {
            onSelectVariety(id, fromDate)
            setSelectedSpot(null)
          }}
          onViewSpotList={onViewSpotList}
        />
      )}
    </div>
  )
}
