import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import varietiesData from '../data/varieties.json'
import prefectureVarietiesData from '../data/prefectureVarieties.json'
import type { Variety } from '../types'
import { getSomeiyoshinoDate, getVarietyBloomWindow, isFuyuAutumnBloom } from '../utils/bloomOffset'
import { statusFromWindow, type BloomStatus } from '../utils/spotBloom'
import { PREFS_LIST, PREF_COORDS, detectPrefecture, getCachedPrefecture } from '../utils/prefectureUtils'
import { useLang } from '../contexts/LangContext'

const varieties = varietiesData as unknown as Variety[]

// ── 2026年 日本の祝日 ──────────────────────────────────────────
const JAPAN_HOLIDAYS_2026 = new Set<string>([
  '2026-01-01', // 元日
  '2026-01-12', // 成人の日
  '2026-02-11', // 建国記念日
  '2026-02-23', // 天皇誕生日
  '2026-03-20', // 春分の日
  '2026-04-29', // 昭和の日
  '2026-05-03', // 憲法記念日
  '2026-05-04', // みどりの日
  '2026-05-05', // こどもの日
  '2026-05-06', // 振替休日
  '2026-07-20', // 海の日
  '2026-08-11', // 山の日
  '2026-09-21', // 敬老の日
  '2026-09-23', // 秋分の日
  '2026-10-12', // スポーツの日
  '2026-11-03', // 文化の日
  '2026-11-23', // 勤労感謝の日
])

// ── 365日の日付配列（2026年） ──────────────────────────────────
const YEAR = 2026
const DAYS: Date[] = []
for (let m = 0; m < 12; m++) {
  const daysInMonth = new Date(YEAR, m + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    DAYS.push(new Date(YEAR, m, d))
  }
}

// ── ユーティリティ ─────────────────────────────────────────────
function toDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${YEAR}-${mm}-${dd}`
}

function getTodayKey(): string {
  const t = new Date()
  if (t.getFullYear() !== YEAR) return `${YEAR}-04-01`
  return toDateKey(t)
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function isHoliday(key: string): boolean {
  return JAPAN_HOLIDAYS_2026.has(key)
}

function getDayType(d: Date, key: string): 'sun' | 'sat' | 'holiday' | 'weekday' {
  if (isHoliday(key)) return 'holiday'
  const dow = d.getDay()
  if (dow === 0) return 'sun'
  if (dow === 6) return 'sat'
  return 'weekday'
}

function formatDateLabel(d: Date): string {
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dow = DAY_NAMES[d.getDay()]
  return `${m}月${day}日（${dow}）`
}

// RARITY_LABELS and PHASE_OPTIONS are now derived from useLang() inside the component

type DayEntry = { variety: Variety; phase: BloomStatus }

export function SakuraCalendar() {
  const navigate = useNavigate()
  const { t, tVariety } = useLang()
  const cal = t('calendar')

  const RARITY_LABELS = cal.rarityLabels
  const PHASE_OPTIONS: { key: string; label: string }[] = [
    { key: 'opening',  label: cal.phaseOpening },
    { key: 'in_bloom', label: cal.phaseInBloom },
    { key: 'falling',  label: cal.phaseFalling },
  ]

  const todayKey = getTodayKey()
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [selectedPref, setSelectedPref] = useState<string>('全国')
  const [geoLoading, setGeoLoading] = useState(false)
  const [phaseFilter, setPhaseFilter] = useState<Set<string>>(() => new Set(['in_bloom']))

  function togglePhase(phase: string) {
    setPhaseFilter(prev => {
      const next = new Set(prev)
      if (next.has(phase)) {
        if (next.size === 1) return prev // 最低1つ選択
        next.delete(phase)
      } else {
        next.add(phase)
      }
      return next
    })
  }

  const heatmapRef = useRef<HTMLDivElement>(null)

  // ── 位置情報から都道府県を自動検出（初回のみ） ─────────────
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

  // ── 今日のセルを初期スクロール ────────────────────────────
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-date="${todayKey}"]`)
    el?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
  }, [todayKey])

  // ── 日付→品種マップ（都道府県別） ─────────────────────────
  const { dayMap, someiyoshinoDate } = useMemo(() => {
    const coords = PREF_COORDS[selectedPref] ?? { lat: 35.6895, lng: 139.6917 }
    const soDate = getSomeiyoshinoDate(coords.lat, coords.lng)

    const prefData = prefectureVarietiesData as Record<string, string[]>
    const allowedIds = new Set<string>(
      prefData[selectedPref] ?? prefData['全国'] ?? []
    )
    const filteredVarieties = varieties.filter(v => allowedIds.has(v.id))

    const map = new Map<string, DayEntry[]>()

    filteredVarieties.forEach(v => {
      const win = getVarietyBloomWindow(v.bloomGroup, v.someiyoshinoOffset ?? null, soDate)
      if (!win) {
        // fuyu 品種の秋の開花（10〜11月）は満開扱い
        if (v.bloomGroup === 'fuyu') {
          DAYS.forEach(d => {
            const m = d.getMonth() + 1
            if (m >= 10 && m <= 11) {
              const key = toDateKey(d)
              if (!map.has(key)) map.set(key, [])
              map.get(key)!.push({ variety: v, phase: 'in_bloom' })
            }
          })
        }
        return
      }
      DAYS.forEach(d => {
        if (d >= win.start && d <= win.end) {
          const key = toDateKey(d)
          const phase = statusFromWindow(win, d)
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push({ variety: v, phase })
        }
      })
    })

    return { dayMap: map, someiyoshinoDate: soDate }
  }, [selectedPref])

  // ── フェーズフィルタ適用後の最大品種数（ヒートマップ強度計算用） ─
  const maxCount = useMemo(() => {
    let max = 1
    for (const arr of dayMap.values()) {
      const filtered = arr.filter(x => phaseFilter.has(x.phase)).length
      if (filtered > max) max = filtered
    }
    return max
  }, [dayMap, phaseFilter])

  // ── 選択日の品種リスト（フェーズフィルタ適用） ───────────────
  const selectedVarieties = useMemo(() => {
    const arr = (dayMap.get(selectedKey) ?? []).filter(x => phaseFilter.has(x.phase))
    return [...arr].sort((a, b) => (b.variety.rarity?.score ?? 0) - (a.variety.rarity?.score ?? 0))
  }, [selectedKey, dayMap, phaseFilter])

  // ── レア度グループ ────────────────────────────────────────
  const grouped = useMemo(() => {
    const groups = new Map<number, DayEntry[]>()
    selectedVarieties.forEach(entry => {
      const score = entry.variety.rarity?.score ?? 1
      if (!groups.has(score)) groups.set(score, [])
      groups.get(score)!.push(entry)
    })
    return [...groups.entries()].sort((a, b) => b[0] - a[0])
  }, [selectedVarieties])

  // ── 月タブ: 月をクリックしたときにスクロール ────────────────
  function handleMonthClick(month: number) {
    // その月の1日に対応するセルにスクロール
    const mm = String(month).padStart(2, '0')
    const key = `${YEAR}-${mm}-01`
    const el = document.querySelector<HTMLElement>(`[data-date="${key}"]`)
    if (el) {
      el.scrollIntoView({ inline: 'start', behavior: 'smooth', block: 'nearest' })
    }
    // 選択日もその月1日に変更
    setSelectedKey(key)
  }

  // 選択中の月（表示用）
  const selectedMonth = parseInt(selectedKey.split('-')[1])

  // 選択日のDateオブジェクト
  const selectedDate = useMemo(() => {
    const [, mm, dd] = selectedKey.split('-').map(Number)
    return new Date(YEAR, mm - 1, dd)
  }, [selectedKey])

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1 className="calendar-title">{cal.title}</h1>
        <p className="calendar-subtitle">{cal.subtitle}</p>
      </div>

      {/* 都道府県フィルタ */}
      <div className="calendar-pref-row">
        <select
          className="calendar-pref-select"
          value={selectedPref}
          onChange={e => setSelectedPref(e.target.value)}
        >
          <option value="全国">🌸 {cal.prefecture}</option>
          {PREFS_LIST.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {geoLoading && <span className="calendar-pref-loading">{cal.loadingPref}</span>}
      </div>

      {/* 月タブ */}
      <div className="calendar-month-tabs-wrap">
        <div className="calendar-month-tabs">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <button
              key={m}
              className={`calendar-month-tab${selectedMonth === m ? ' active' : ''}`}
              onClick={() => handleMonthClick(m)}
            >
              {m}月
            </button>
          ))}
        </div>
      </div>

      {/* フェーズフィルタ */}
      <div className="calendar-phase-filter">
        {PHASE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            className={`cal-phase-chip${phaseFilter.has(key) ? ' active' : ''}`}
            onClick={() => togglePhase(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 日単位ヒートマップ */}
      <div className="calendar-heatmap-wrap" ref={heatmapRef}>
        <div className="calendar-heatmap">
          {DAYS.map(d => {
            const key = toDateKey(d)
            const count = (dayMap.get(key) ?? []).filter(x => phaseFilter.has(x.phase)).length
            const intensity = maxCount > 0 ? count / maxCount : 0
            const isSelected = key === selectedKey
            const isToday = key === todayKey
            const dayType = getDayType(d, key)
            const isMonthFirst = d.getDate() === 1

            return (
              <div
                key={key}
                data-date={key}
                className={[
                  'cal-day-cell',
                  isSelected ? 'selected' : '',
                  isToday ? 'today' : '',
                  `day-type-${dayType}`,
                ].filter(Boolean).join(' ')}
                onClick={() => setSelectedKey(key)}
                title={`${formatDateLabel(d)}: ${cal.varietyCount(count)}`}
              >
                {/* バー */}
                <div
                  className="cal-day-cell__bar"
                  style={{
                    height: `${Math.max(2, intensity * 44)}px`,
                    opacity: count === 0 ? 0.08 : 0.25 + intensity * 0.75,
                  }}
                />
                {/* 日付数字 */}
                <div className="cal-day-cell__day">{d.getDate()}</div>
                {/* 曜日ラベル（月初のみ） */}
                {isMonthFirst && (
                  <div className="cal-day-cell__month-label">{d.getMonth() + 1}月</div>
                )}
                {/* 今日マーカー */}
                {isToday && <div className="cal-day-cell__today-dot" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 選択日ヘッダー */}
      <div className="calendar-date-header">
        <span className="calendar-date-label">{formatDateLabel(selectedDate)}</span>
        <span className="calendar-date-count">{cal.varietyCount(selectedVarieties.length)}</span>
        {selectedKey === todayKey && <span className="calendar-date-now">{cal.nowHere}</span>}
      </div>

      {/* 品種リスト */}
      <div className="calendar-variety-list">
        {grouped.map(([score, entries]) => (
          <div key={score} className="calendar-rarity-group">
            <div className="calendar-rarity-label">{RARITY_LABELS[score] ?? `★${score}`}</div>
            <div className="calendar-variety-cards">
              {entries.map(({ variety: v, phase }) => {
                const tv = tVariety(v)
                const phaseBadge = cal.phaseBadge as Record<string, string>
                const PHASE_BADGE: Partial<Record<string, { label: string; cls: string }>> = {
                  in_bloom: { label: phaseBadge.in_bloom, cls: 'cal-phase--inbloom' },
                  opening:  { label: phaseBadge.opening,  cls: 'cal-phase--opening' },
                  falling:  { label: phaseBadge.falling,  cls: 'cal-phase--falling' },
                }
                const badge = PHASE_BADGE[phase]
                return (
                  <div
                    key={v.id}
                    className={`calendar-variety-card${phase === 'in_bloom' ? ' calendar-variety-card--bloom' : ''}`}
                    onClick={() => navigate(`/variety/${v.id}`, { state: { fromPref: selectedPref, fromDate: selectedKey } })}
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
                      {badge && <span className={`calendar-variety-card__now ${badge.cls}`}>{badge.label}</span>}
                    </div>
                    <div className="calendar-variety-card__name">{tv.name}</div>
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
          <p className="calendar-empty">{cal.noVarieties}</p>
        )}
      </div>
    </div>
  )
}
