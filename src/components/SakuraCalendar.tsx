import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import varietiesData from '../data/varieties.json'
import type { Variety } from '../types'
import { bloomOrd } from '../utils/bloomFilter'
import { getSomeiyoshinoDate, getVarietyBloomWindow } from '../utils/bloomOffset'
import { statusFromWindow } from '../utils/spotBloom'

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

// 東京のソメイヨシノ日（カレンダーは地点非依存なのでTokyo基準）
const TOKYO_LAT = 35.6895, TOKYO_LNG = 139.6917
const CALENDAR_SOMEIYOSHINO_DATE = getSomeiyoshinoDate(TOKYO_LAT, TOKYO_LNG)
const CALENDAR_TODAY = new Date()

// Build period → varieties mapping
function buildPeriodMap() {
  const map = new Map<string, Variety[]>()
  PERIODS.forEach(p => map.set(p.key, []))

  varieties.forEach(v => {
    const window = getVarietyBloomWindow(
      v.bloomGroup,
      v.someiyoshinoOffset ?? null,
      CALENDAR_SOMEIYOSHINO_DATE
    )
    if (!window) return

    // 二季咲きの秋側も登録
    const isFuyu = v.bloomGroup === 'fuyu'

    PERIODS.forEach(p => {
      // 旬の中日でチェック（中旬なら15日）
      const [mStr, jun] = p.key.split('-')
      const m = parseInt(mStr)
      const day = jun === 'early' ? 5 : jun === 'mid' ? 15 : 25
      const periodDate = new Date(CALENDAR_SOMEIYOSHINO_DATE.getFullYear(), m - 1, day)
      const inSpringBloom = periodDate >= window.start && periodDate <= window.end
      const inAutumnBloom = isFuyu && m >= 10 && m <= 11
      if (inSpringBloom || inAutumnBloom) map.get(p.key)!.push(v)
    })
  })
  return map
}

const PERIOD_MAP = buildPeriodMap()
const MAX_COUNT = Math.max(...PERIODS.map(p => PERIOD_MAP.get(p.key)!.length))

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
                const nowInBloom = (() => {
                  if (!v.bloomGroup) return false
                  const w = getVarietyBloomWindow(v.bloomGroup, v.someiyoshinoOffset ?? null, CALENDAR_SOMEIYOSHINO_DATE)
                  return statusFromWindow(w, CALENDAR_TODAY) === 'in_bloom'
                })()
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
