import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import varietiesData from '../data/varieties.json'
import type { Variety } from '../types'
import { bloomOrd } from '../utils/bloomFilter'
import { getTotalOffset, isInBloomAdjusted } from '../utils/bloomOffset'

const varieties = varietiesData as unknown as Variety[]

// 月旬 definitions
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

// Build period → varieties mapping
function buildPeriodMap() {
  const map = new Map<string, Variety[]>()
  PERIODS.forEach(p => map.set(p.key, []))

  varieties.forEach(v => {
    const bp = v.bloomPeriod
    if (!bp?.start || !bp?.end) return

    const startOrd = periodOrd(bp.start)
    const endOrd   = periodOrd(bp.end)

    PERIODS.forEach(p => {
      const ord = periodOrd(p.key)
      let inRange = false
      if (startOrd <= endOrd) {
        inRange = ord >= startOrd && ord <= endOrd
      } else {
        // wrap-around (e.g. Oct-Feb)
        inRange = ord >= startOrd || ord <= endOrd
      }
      if (inRange) map.get(p.key)!.push(v)
    })

    // secondary bloom period
    if (bp.secondary) {
      const s2 = periodOrd(bp.secondary.start)
      const e2 = periodOrd(bp.secondary.end)
      PERIODS.forEach(p => {
        const ord = periodOrd(p.key)
        if (ord >= s2 && ord <= e2) {
          const arr = map.get(p.key)!
          if (!arr.find(x => x.id === v.id)) arr.push(v)
        }
      })
    }
  })
  return map
}

const PERIOD_MAP = buildPeriodMap()
const MAX_COUNT = Math.max(...PERIODS.map(p => PERIOD_MAP.get(p.key)!.length))

// カレンダーの「今見頃」判定 — 東京の今年のズレを参照値として使用
// （カレンダーは場所非依存のため、地域差は含めず yearlyOffset のみ適用）
const _tokyoResult = getTotalOffset(35.6895, 139.6917)
const CALENDAR_OFFSET = _tokyoResult.yearlyOffset   // 今年の全国的なズレ（東京基準）
const CALENDAR_TODAY  = new Date()

export function SakuraCalendar() {
  const navigate = useNavigate()
  const todayKey = getCurrentPeriodKey()
  const [selectedKey, setSelectedKey] = useState(todayKey)

  // Scroll today marker into view on mount
  useEffect(() => {
    document.querySelector('.calendar-cell.today')?.scrollIntoView({
      inline: 'center',
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [])

  const selectedVarieties = useMemo(() => {
    const arr = PERIOD_MAP.get(selectedKey) ?? []
    return [...arr].sort((a, b) => (b.rarity?.score ?? 0) - (a.rarity?.score ?? 0))
  }, [selectedKey])

  // Group by rarity score
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

      {/* Heatmap timeline */}
      <div className="calendar-heatmap-wrap">
        <div className="calendar-heatmap">
          {PERIODS.map(p => {
            const count = PERIOD_MAP.get(p.key)!.length
            const intensity = MAX_COUNT > 0 ? count / MAX_COUNT : 0
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
                // 東京オフセット（今年のズレ）で今見頃かを判定
                const nowInBloom = !!v.bloomPeriod
                  && isInBloomAdjusted(v.bloomPeriod, CALENDAR_OFFSET, CALENDAR_TODAY)
                return (
                  <div
                    key={v.id}
                    className={`calendar-variety-card${nowInBloom ? ' calendar-variety-card--bloom' : ''}`}
                    onClick={() => navigate(`/variety/${v.id}`)}
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
