import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import spotsData from '../data/spots.json'
import type { BloomStatus } from '../utils/spotBloom'
import { spotBloomCache } from '../utils/spotBloom'
import { normalize } from '../utils/searchNormalize'
import { SpotListCard } from './SpotListCard'
import { useLang } from '../contexts/LangContext'
import { useFavorites } from '../contexts/FavoritesContext'

type RawSpot = typeof spotsData[number]
const allSpots = spotsData as unknown as RawSpot[]

// ── 都道府県リスト ───────────────────────────────────────────────
const PREFS = [...new Set(allSpots.map(s => s.prefecture).filter(Boolean))].sort()

type SortKey = 'bloom' | 'popular' | 'distance'

// ── 検索インデックス ─────────────────────────────────────────────
const searchIndex = new Map(
  allSpots.map(s => [
    s.id,
    normalize([s.name, s.prefecture, s.city, s.address].filter(Boolean).join(' ')),
  ])
)

// ── Haversine ────────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const PAGE_SIZE = 50

export function SpotListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLang()
  const spotsStr = t('spots')
  const statusStr = t('status')
  const { favoriteIds, count: favCount } = useFavorites()

  const BLOOM_CHIPS: { key: BloomStatus | 'all'; label: string }[] = [
    { key: 'all',        label: statusStr.all },
    { key: 'in_bloom',   label: `🌸 ${statusStr.in_bloom}` },
    { key: 'opening',    label: `🌷 ${statusStr.opening}` },
    { key: 'falling',    label: `🍃 ${statusStr.falling}` },
    { key: 'leaf',       label: `🌿 ${statusStr.leaf}` },
    { key: 'budding',    label: `🌱 ${statusStr.budding}` },
    { key: 'off_season', label: `⬜ ${statusStr.off_season}` },
  ]

  const highlightSpotId = (location.state as { highlightSpotId?: string } | null)?.highlightSpotId

  // ── フィルタ状態（sessionStorage で保持） ───────────────────────
  const [bloomFilter, setBloomFilter] = useState<BloomStatus | 'all'>(
    () => (sessionStorage.getItem('spots-bloomFilter') as BloomStatus | 'all') ?? 'all'
  )
  const [prefFilter, setPrefFilter] = useState(
    () => sessionStorage.getItem('spots-prefFilter') ?? ''
  )
  const [sortKey, setSortKey] = useState<SortKey>(
    () => (sessionStorage.getItem('spots-sortKey') as SortKey) ?? 'bloom'
  )
  const [searchQuery, setSearchQuery] = useState(
    () => sessionStorage.getItem('spots-searchQuery') ?? ''
  )
  const [favOnly, setFavOnly] = useState<boolean>(
    () => sessionStorage.getItem('spots-favOnly') === '1'
  )

  useEffect(() => { sessionStorage.setItem('spots-bloomFilter', bloomFilter) }, [bloomFilter])
  useEffect(() => { sessionStorage.setItem('spots-prefFilter', prefFilter) }, [prefFilter])
  useEffect(() => { sessionStorage.setItem('spots-sortKey', sortKey) }, [sortKey])
  useEffect(() => { sessionStorage.setItem('spots-searchQuery', searchQuery) }, [searchQuery])
  useEffect(() => { sessionStorage.setItem('spots-favOnly', favOnly ? '1' : '0') }, [favOnly])

  // ── 検索デバウンス ───────────────────────────────────────────────
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ── 位置情報 ─────────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [geoDialogOpen, setGeoDialogOpen] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const requestGeo = useCallback(() => {
    setGeoDialogOpen(false)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError(null)
      },
      () => {
        setGeoError(spotsStr.locationDenied)
        setSortKey('bloom')
      },
      { timeout: 10000 }
    )
  }, [])

  const handleSortChange = useCallback((key: SortKey) => {
    setSortKey(key)
    if (key === 'distance' && !userLocation) {
      setGeoDialogOpen(true)
    }
  }, [userLocation])

  // ── 無限スクロール ───────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setPage(1) }, [bloomFilter, prefFilter, sortKey, debouncedQuery, favOnly])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setPage(p => p + 1) },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ── フィルタ・ソート ──────────────────────────────────────────────
  const filteredSpots = useMemo(() => {
    const q = normalize(debouncedQuery.trim())

    let spots = allSpots.filter(s => {
      // お気に入りフィルタ（AND）
      if (favOnly && !favoriteIds.has(s.id)) return false
      // 見頃フィルタ
      if (bloomFilter !== 'all') {
        const status = spotBloomCache.get(s.id)?.status ?? 'off_season'
        if (bloomFilter === 'off_season') {
          if (status !== 'off_season' && status !== 'upcoming') return false
        } else {
          if (status !== bloomFilter) return false
        }
      }
      // 都道府県フィルタ
      if (prefFilter && s.prefecture !== prefFilter) return false
      // 検索
      if (q) {
        const norm = searchIndex.get(s.id) ?? ''
        if (!norm.includes(q)) return false
      }
      return true
    })

    // ソート
    if (sortKey === 'popular') {
      spots = [...spots].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    } else if (sortKey === 'distance' && userLocation) {
      spots = [...spots].sort((a, b) => {
        const da = (a.lat && a.lng) ? haversine(userLocation.lat, userLocation.lng, a.lat, a.lng) : 99999
        const db = (b.lat && b.lng) ? haversine(userLocation.lat, userLocation.lng, b.lat, b.lng) : 99999
        return da - db
      })
    } else {
      // bloom: 見頃が近い順 → 人気順
      spots = [...spots].sort((a, b) => {
        const da = spotBloomCache.get(a.id)?.daysScore ?? 99999
        const db = spotBloomCache.get(b.id)?.daysScore ?? 99999
        if (da !== db) return da - db
        return (b.popularity ?? 0) - (a.popularity ?? 0)
      })
    }

    // ハイライトスポットを先頭へ
    if (highlightSpotId) {
      const idx = spots.findIndex(s => s.id === highlightSpotId)
      if (idx > 0) {
        const item = spots.splice(idx, 1)[0]
        spots = [item, ...spots]
      }
    }

    return spots
  }, [bloomFilter, prefFilter, sortKey, debouncedQuery, userLocation, highlightSpotId, favOnly, favoriteIds])

  const visible = filteredSpots.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filteredSpots.length

  return (
    <div className="spot-list-page">
      {/* 検索バー */}
      <div className="spot-list-page__search-wrap">
        <div className="spot-list-page__search-inner">
          <span className="spot-list-page__search-icon">🔍</span>
          <input
            className="spot-list-page__search"
            type="search"
            placeholder={spotsStr.searchPlaceholder}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="spot-list-page__search-clear" onClick={() => setSearchQuery('')} aria-label="clear">✕</button>
          )}
        </div>
      </div>

      {/* 見頃フィルタチップ */}
      <div className="spot-list-page__chips-row">
        <button
          className={`spot-list-page__chip spot-list-page__chip--fav${favOnly ? ' active' : ''}`}
          onClick={() => setFavOnly(v => !v)}
          aria-pressed={favOnly}
        >
          ♥ お気に入り{favCount > 0 ? ` (${favCount})` : ''}
        </button>
        {BLOOM_CHIPS.map(({ key, label }) => (
          <button
            key={key}
            className={`spot-list-page__chip${bloomFilter === key ? ' active' : ''}`}
            onClick={() => setBloomFilter(key as BloomStatus | 'all')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 都道府県・ソート */}
      <div className="spot-list-page__controls">
        <select
          className="spot-list-page__select"
          value={prefFilter}
          onChange={e => setPrefFilter(e.target.value)}
        >
          <option value="">{spotsStr.allPref}</option>
          {PREFS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          className="spot-list-page__select"
          value={sortKey}
          onChange={e => handleSortChange(e.target.value as SortKey)}
        >
          <option value="bloom">{spotsStr.sortBloom}</option>
          <option value="popular">{spotsStr.sortPopular}</option>
          <option value="distance">{spotsStr.sortDistance}{userLocation ? ' ✓' : ''}</option>
        </select>
      </div>

      {/* 件数 */}
      <div className="spot-list-page__meta">
        <span className="spot-list-page__count">{filteredSpots.length.toLocaleString()}件</span>
        {geoError && <span className="spot-list-page__geo-error">{geoError}</span>}
      </div>

      {/* 一覧 */}
      <div className="spot-list-page__list">
        {visible.map(spot => (
          <SpotListCard
            key={spot.id}
            spot={spot}
            highlighted={spot.id === highlightSpotId}
            onMapClick={() => navigate('/map', { state: { focusSpotId: spot.id } })}
            onVarietyClick={id => navigate(`/variety/${id}`)}
          />
        ))}
        {filteredSpots.length === 0 && (
          <div className="spot-list-page__empty">
            {favOnly && favCount === 0 ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>♡</div>
                <p>まだお気に入りがありません。<br/>ハートマークで保存してみよう 🌸</p>
                <button
                  className="spot-list-page__reset-btn"
                  onClick={() => setFavOnly(false)}
                >
                  すべて表示
                </button>
              </>
            ) : (
              <>
                <p>{spotsStr.empty}</p>
                <button
                  className="spot-list-page__reset-btn"
                  onClick={() => { setBloomFilter('all'); setPrefFilter(''); setSearchQuery(''); setFavOnly(false) }}
                >
                  {statusStr.all}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {hasMore && <div ref={sentinelRef} className="spot-list-page__sentinel" />}

      {/* 位置情報ダイアログ */}
      {geoDialogOpen && (
        <div
          className="spot-list-page__geo-backdrop"
          onClick={() => { setGeoDialogOpen(false); setSortKey('bloom') }}
        >
          <div className="spot-list-page__geo-dialog" onClick={e => e.stopPropagation()}>
            <div className="spot-list-page__geo-icon">📍</div>
            <h3 className="spot-list-page__geo-title">{spotsStr.locating}</h3>
            <p className="spot-list-page__geo-desc">{spotsStr.sortDistance}</p>
            <div className="spot-list-page__geo-actions">
              <button
                className="spot-list-page__geo-cancel"
                onClick={() => { setGeoDialogOpen(false); setSortKey('bloom') }}
              >
                {t('detail').reportCancel}
              </button>
              <button
                className="spot-list-page__geo-confirm"
                onClick={requestGeo}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
