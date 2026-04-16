import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import varietiesData from '../data/varieties.json'
import prefectureVarietiesData from '../data/prefectureVarieties.json'
import type { Variety } from '../types'
import { bloomOrd } from '../utils/bloomFilter'
import { getSomeiyoshinoDate, getVarietyBloomWindow, isFuyuAutumnBloom } from '../utils/bloomOffset'
import { statusFromWindow } from '../utils/spotBloom'
import { PREFS_LIST, PREF_COORDS, detectPrefecture, getCachedPrefecture } from '../utils/prefectureUtils'

const varieties = varietiesData as unknown as Variety[]

// ── 月旬 definitions ──────────────────────────────────────────
const PERIODS: { key: string; label: string; month: number; jun: 'early' | 'mid' | 'late' }[] = []
for (let m = 1; m <= 12; m++) {
  for (const jun of ['early', 'mid', 'late'] as const) {
    const mm = String(m).padStart(2, '0')
    PERIODS.push({
      key: `${mm}-${jun}`,
      label: `${m}月${jun === 'early' ? '上' : jun === 'mid' ? '中' : '下'}旬`,
      month: m,
      jun,
    })
  }
}

function getCurrentPeriodKey(): string {
  const d = new Date()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const jun = day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late'
  return `${String(m).padStart(2, '0')}-${jun}`
}

function periodOrd(key: string): number {
  return bloomOrd(key)
}
// periodOrd is used implicitly through bloomOrd for consistency
void periodOrd

const CALENDAR_TODAY = new Date()


export function SakuraCalendar() {
  const navigate = useNavigate()
  const todayKey = getCurrentPeriodKey()
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [selectedPref, setSelectedPref] = useState<string>('全国')
  const [geoLoading, setGeoLoading] = useState(false)

  // ── 位置情報から都道府県を自動検出（初回のみ） ────────────────
  useEffect(() => {
    const cached = getCachedPrefecture()
    if (cached) { setSelectedPref(cached); return }
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        localStorage.setItem('sakura_wizard_geo', JSON.stringify({ lat: coords.latitude, lng: coords.longitude, ts: Date.now() }))
        setSelectedPref(detectPrefecture(coords.latitude, coords.longitude))
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { timeout: 8000, maximumAge: 300000 }
    )
  }, [])

  // ── Scroll today marker into view on mount ───────────────────
  useEffect(() => {
    document.querySelector('.calendar-cell.today')?.scrollIntoView({
      inline: 'center',
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [])

  // ── buildPeriodMap（都道府県別） ─────────────────────────────
  const { periodMap, someiyoshinoDate } = useMemo(() => {
    // 選択都道府県の代表座標でソメイヨシノ基準日を計算
    const coords = PREF_COORDS[selectedPref] ?? { lat: 35.6895, lng: 139.6917 }
    const soDate = getSomeiyoshinoDate(coords.lat, coords.lng)

    // 表示対象の品種を絞り込む
    const prefData = prefectureVarietiesData as Record<string, string[]>
    const allowedIds = new Set<string>(
      prefData[selectedPref] ?? prefData['全国'] ?? []
    )
    const filteredVarieties = varieties.filter(v => allowedIds.has(v.id))

    // buildPeriodMap
    const map = new Map<string, Variety[]>()
    PERIODS.forEach(p => map.set(p.key, []))

    filteredVarieties.forEach(v => {
      const window = getVarietyBloomWindow(v.bloomGroup, v.someiyoshinoOffset ?? null, soDate)
      if (!window) return
      const isFuyu = v.bloomGroup === 'fuyu'

      PERIODS.forEach(p => {
        const [mStr, jun] = p.key.split('-')
        const m = parseInt(mStr)
        const day = jun === 'early' ? 5 : jun === 'mid' ? 15 : 25
        const pDate = new Date(soDate.getFullYear(), m - 1, day)
        const inSpring = pDate >= window.start && pDate <= window.end
        const inAutumn = isFuyu && m >= 10 && m <= 11
        if (inSpring || inAutumn) map.get(p.key)!.push(v)
      })
    })

    return { periodMap: map, someiyoshinoDate: soDate }
  }, [selectedPref])

  // ── MAX_COUNT（periodMapから計算） ──────────────────────────
  const maxCount = useMemo(() => {
    return Math.max(...PERIODS.map(p => periodMap.get(p.key)!.length), 1)
  }, [periodMap])

  const selectedVarieties = useMemo(() => {
    const arr = periodMap.get(selectedKey) ?? []
    return [...arr].sort((a, b) => (b.rarity?.score ?? 0) - (a.rarity?.score ?? 0))
  }, [selectedKey, periodMap])

  // ── Group by rarity score ─────────────────────────────────
  const grouped = useMemo(() => {
    const groups = new Map<number, Variety[]>()
    selectedVarieties.forEach(v => {
      const score = v.rarity?.score ?? 1
      if (!groups.has(score)) groups.set(score, [])
      groups.get(score)!.push(v)
    })
    return [...groups.entries()].sort((a, b) => b[0] - a[0])
  }, [selectedVarieties])

  const RARITY_LABELS: Record<number, string> = {
    5: '★★★★★ 超レア',
    4: '★★★★ とても珍しい',
    3: '★★★ 珍しい',
    2: '★★ やや珍しい',
    1: '★ よく見る',
  }

  const selectedPeriod = PERIODS.find(p => p.key === selectedKey)!

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1 className="calendar-title">🗓️ 桜カレンダー</h1>
        <p className="calendar-subtitle">月旬をタップして品種を確認</p>
      </div>

      {/* 都道府県フィルタ */}
      <div className="calendar-pref-row">
        <select
          className="calendar-pref-select"
          value={selectedPref}
          onChange={e => setSelectedPref(e.target.value)}
        >
          <option value="全国">🌸 全国（東京基準）</option>
          {PREFS_LIST.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {geoLoading && <span className="calendar-pref-loading">📍 検出中...</span>}
      </div>

      {/* Heatmap timeline */}
      <div className="calendar-heatmap-wrap">
        <div className="calendar-heatmap">
          {PERIODS.map(p => {
            const count = periodMap.get(p.key)!.length
            const intensity = maxCount > 0 ? count / maxCount : 0
            const isSelected = p.key === selectedKey
            const isToday = p.key === todayKey
            return (
              <div
                key={p.key}
                className={`calendar-cell${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                onClick={() => setSelectedKey(p.key)}
                title={`${p.label}: ${count}品種`}
              >
                <div
                  className="calendar-cell__bar"
                  style={{ height: `${Math.max(4, intensity * 48)}px`, opacity: 0.3 + intensity * 0.7 }}
                />
                {p.jun === 'early' && (
                  <div className="calendar-cell__month">{p.month}月</div>
                )}
                {isToday && <div className="calendar-cell__today-marker">▼</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected period info */}
      <div className="calendar-period-header">
        <span className="calendar-period-label">{selectedPeriod.label}</span>
        <span className="calendar-period-count">{selectedVarieties.length}品種</span>
        {selectedKey === todayKey && <span className="calendar-period-now">← 今ここ</span>}
      </div>

      {/* Variety list grouped by rarity */}
      <div className="calendar-variety-list">
        {grouped.map(([score, vars]) => (
          <div key={score} className="calendar-rarity-group">
            <div className="calendar-rarity-label">{RARITY_LABELS[score] ?? `★${score}`}</div>
            <div className="calendar-variety-cards">
              {vars.map(v => {
                const nowInBloom = (() => {
                  if (!v.bloomGroup) return false
                  const w = getVarietyBloomWindow(v.bloomGroup, v.someiyoshinoOffset ?? null, someiyoshinoDate)
                  return statusFromWindow(w, CALENDAR_TODAY) === 'in_bloom'
                    || isFuyuAutumnBloom(v.bloomGroup, CALENDAR_TODAY)
                })()
                return (
                  <div
                    key={v.id}
                    className={`calendar-variety-card${nowInBloom ? ' calendar-variety-card--bloom' : ''}`}
                    onClick={() => navigate(`/variety/${v.id}`, { state: { fromPref: selectedPref } })}
                  >
                    <div
                      className="calendar-variety-card__color"
                      style={{ background: v.colorCode + '88' }}
                    >
                      {v.hasImage && v.images?.[0]?.file ? (
                        <img src={v.images[0].file} alt={v.name} className="calendar-variety-card__img" />
                      ) : (
                        <span className="calendar-variety-card__dot" style={{ background: v.colorCode }} />
                      )}
                      {nowInBloom && <span className="calendar-variety-card__now">今見頃</span>}
                    </div>
                    <div className="calendar-variety-card__name">{v.name}</div>
                    {v.rarity && (
                      <div className="calendar-variety-card__stars" data-score={v.rarity.score}>
                        {v.rarity.stars}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {selectedVarieties.length === 0 && (
          <p className="calendar-empty">この時期は開花データがありません</p>
        )}
      </div>
    </div>
  )
}
