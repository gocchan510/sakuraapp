import { useState, useEffect } from 'react'
import spotsData from './data/spots.json'
import varietiesData from './data/varieties.json'
import { SpotCard } from './components/SpotCard'
import { SpotList } from './components/SpotList'
import { AllSpotsMap } from './components/AllSpotsMap'
import { PlanView } from './components/PlanView'
import { TutorialOverlay } from './components/TutorialOverlay'
import { VarietyList } from './components/VarietyList'
import { VarietyDetail } from './components/VarietyDetail'
import { StationPicker } from './components/StationPicker'
import { getCurrentWeekIndex, getWeekLabel, ALL_WEEK_LABELS } from './utils/getWeek'
import { getSpotsForWeek, isOffSeason } from './utils/spotsByWeek'
import { getCalendarMonth, dateToWeekLabel, isSameDay, formatDateStr, formatDateDisplay } from './utils/calendarUtils'
import { DEFAULT_STATION } from './utils/travelTime'
import type { Station } from './utils/travelTime'
import { useLang } from './i18n'

type Tab = 'calendar' | 'map' | 'zukan'
type View = 'calendar' | 'spotlist' | 'detail' | 'map' | 'zukan' | 'zukan-detail' | 'plan'

const MONTH_NAMES_JA = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const MONTH_NAMES_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const DOW_LABELS_JA = ['日', '月', '火', '水', '木', '金', '土']
const DOW_LABELS_ZH = ['日', '一', '二', '三', '四', '五', '六']

function getVarietyClass(weekLabel: string): string {
  const spots = getSpotsForWeek(weekLabel)
  if (spots.length === 0) return 'cell-off'
  const v = spots[0].variety
  if (v.includes('カワヅザクラ')) return 'cell-kawazu'
  if (v.includes('フユザクラ') || v.includes('ジュウガツザクラ')) return 'cell-winter'
  return 'cell-spring'
}

function findVarietyId(varietyName: string): string | null {
  const found = varietiesData.find(
    (v) => v.name === varietyName || varietyName.includes(v.name) || v.name.includes(varietyName)
  )
  return found?.id ?? null
}

export default function App() {
  const { t, lang, setLang } = useLang()
  const todayWeek = getWeekLabel(getCurrentWeekIndex())
  const MONTH_NAMES = lang === 'zh-TW' ? MONTH_NAMES_ZH : MONTH_NAMES_JA

  const [tab, setTab] = useState<Tab>('calendar')
  const [view, setView] = useState<View>('calendar')
  const [selectedWeek, setSelectedWeek] = useState<string>(todayWeek)
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null)
  const [varietyId, setVarietyId] = useState<string | null>(null)
  const [mapFilterWeek, setMapFilterWeek] = useState<string | null>(null)
  const [fromStation, setFromStation] = useState<Station>(() => {
    try {
      const saved = localStorage.getItem('fromStation')
      return saved ? JSON.parse(saved) : DEFAULT_STATION
    } catch { return DEFAULT_STATION }
  })
  const [showStationPicker, setShowStationPicker] = useState(false)
  // planDates: { "2026-04-05": ["spot-id-1", ...], ... }
  const [planDates, setPlanDates] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('planDates')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  // 月ごとの展開状態（数字=月番号 1〜12）。localStorageに永続化
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    try { return !localStorage.getItem('tutorialSeen') } catch { return true }
  })
  const closeTutorial = () => {
    try { localStorage.setItem('tutorialSeen', '1') } catch { /* noop */ }
    setShowTutorial(false)
  }

  const [openMonths, setOpenMonths] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('openMonths')
      return saved ? new Set(JSON.parse(saved) as number[]) : new Set<number>()
    } catch { return new Set<number>() }
  })

  const handleSelectStation = (s: Station) => {
    setFromStation(s)
    localStorage.setItem('fromStation', JSON.stringify(s))
  }

  const togglePlanForDate = (dateStr: string, spotId: string) => {
    setPlanDates(prev => {
      const spots = prev[dateStr] ? [...prev[dateStr]] : []
      const idx = spots.indexOf(spotId)
      if (idx >= 0) spots.splice(idx, 1)
      else spots.push(spotId)
      const next = { ...prev }
      if (spots.length === 0) delete next[dateStr]
      else next[dateStr] = spots
      localStorage.setItem('planDates', JSON.stringify(next))
      return next
    })
  }

  // 計画済み日数（プラントグルのバッジ用）
  const plannedDayCount = Object.keys(planDates).length

  const toggleMonth = (m: number) => {
    setOpenMonths(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m); else next.add(m)
      localStorage.setItem('openMonths', JSON.stringify([...next]))
      return next
    })
  }

  const selectedSpot = selectedSpotId ? spotsData.find(s => s.id === selectedSpotId) ?? null : null
  const weekSpots = getSpotsForWeek(selectedWeek)

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const state = e.state
      if (!state) { setTab('calendar'); setView('calendar'); return }
      setView(state.view ?? 'calendar')
      setTab(state.tab ?? 'calendar')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const push = (v: View, newTab: Tab = tab) => {
    history.pushState({ view: v, tab: newTab }, '')
    setView(v)
    setTab(newTab)
  }

  const openWeek = (week: string, dateStr?: string) => {
    setSelectedWeek(week)
    setSelectedDate(dateStr ?? null)
    if (isOffSeason(week)) return
    push('spotlist', 'calendar')
  }

  const openPlan = () => push('plan', 'calendar')

  const editDateFromPlan = (dateStr: string, weekLabel: string) => {
    setSelectedDate(dateStr)
    setSelectedWeek(weekLabel)
    push('spotlist', 'calendar')
  }

  const openSpotDetail = (spotId: string) => {
    setSelectedSpotId(spotId)
    push('detail')
  }

  const openVariety = (id: string) => {
    setVarietyId(id)
    push('zukan-detail', 'zukan')
  }

  const openVarietyFromSpot = (varietyName: string) => {
    const id = findVarietyId(varietyName)
    if (!id) return
    setVarietyId(id)
    push('zukan-detail')
  }

  const switchTab = (newTab: Tab) => {
    setTab(newTab)
    setView(newTab as View)
    history.pushState({ view: newTab, tab: newTab }, '')
  }

  const LangToggle = () => (
    <button
      className="lang-toggle"
      onClick={() => setLang(lang === 'ja' ? 'zh-TW' : 'ja')}
    >
      {lang === 'ja' ? '繁中' : '日本語'}
    </button>
  )

  const HelpBtn = () => (
    <button className="help-btn" onClick={() => setShowTutorial(true)} aria-label="使い方">
      ？
    </button>
  )

  const StationBtn = () => (
    <button
      className="station-selector-btn"
      onClick={() => setShowStationPicker(true)}
    >
      🚉 {t.fromStation}: <strong>{fromStation.name}</strong> ▼
    </button>
  )

  const BottomNav = () => (
    <nav className="bottom-nav">
      <button className={`bottom-nav-btn ${tab === 'calendar' ? 'active' : ''}`} onClick={() => switchTab('calendar')}>
        <span className="bnav-icon">📅</span>
        <span className="bnav-label">{t.tabCalendar}</span>
      </button>
      <button className={`bottom-nav-btn ${tab === 'map' ? 'active' : ''}`} onClick={() => switchTab('map')}>
        <span className="bnav-icon">🗾</span>
        <span className="bnav-label">{t.tabMap}</span>
      </button>
      <button className={`bottom-nav-btn ${tab === 'zukan' ? 'active' : ''}`} onClick={() => switchTab('zukan')}>
        <span className="bnav-icon">📖</span>
        <span className="bnav-label">{t.tabZukan}</span>
      </button>
    </nav>
  )

  // Fix #5: 図鑑品種→カレンダー（見頃月を展開してスクロール）
  const goToVarietyCalendar = (month: number) => {
    setOpenMonths(prev => {
      const next = new Set(prev)
      next.add(month)
      localStorage.setItem('openMonths', JSON.stringify([...next]))
      return next
    })
    switchTab('calendar')
    setTimeout(() => {
      document.getElementById(`cal-month-${month}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }

  // Fix #6: 今週へジャンプ
  const jumpToToday = () => {
    const m = today.getMonth() + 1
    setOpenMonths(prev => {
      const next = new Set(prev)
      next.add(m)
      localStorage.setItem('openMonths', JSON.stringify([...next]))
      return next
    })
    setTimeout(() => {
      document.getElementById('cal-today')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }

  // ── 品種詳細 ──
  if (view === 'zukan-detail' && varietyId) {
    return (
      <div className="app">
        <VarietyDetail
          id={varietyId}
          onBack={() => setView('zukan')}
          onSelectSpot={openSpotDetail}
          onGoCalendar={goToVarietyCalendar}
        />
        <BottomNav />
      </div>
    )
  }

  // ── 図鑑一覧 ──
  if (view === 'zukan') {
    return (
      <div className="app">
        <VarietyList onSelect={openVariety} />
        <BottomNav />
      </div>
    )
  }

  // ── スポット詳細 ──
  if (view === 'detail' && selectedSpot) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-top-row">
            <button className="back-btn" onClick={() => history.back()}>{t.backButton}</button>
            <LangToggle />
          </div>
          <div className="header-petal">🌸</div>
          <p className="week-label">{selectedSpot.name}</p>
          <p className="app-subtitle">{selectedSpot.peakWeeks.join(' / ')}</p>
        </header>
        <main className="main-content">
          <section className="section">
            <SpotCard
              spot={selectedSpot}
              onVarietyClick={openVarietyFromSpot}
              fromStation={fromStation}
              planDates={planDates}
              selectedDate={selectedDate}
              onTogglePlan={togglePlanForDate}
              lang={lang}
            />
          </section>
        </main>
      </div>
    )
  }

  // ── スポット一覧 ──
  if (view === 'spotlist') {
    return (
      <div className="app">
        <SpotList
          weekLabel={selectedWeek}
          selectedDate={selectedDate}
          spots={weekSpots}
          onSelect={openSpotDetail}
          onBack={() => history.back()}
          fromStation={fromStation}
          planDates={planDates}
          onTogglePlan={togglePlanForDate}
          lang={lang}
        />
        <BottomNav />
      </div>
    )
  }

  // ── マップ ──
  if (view === 'map') {
    return (
      <div className="app app-map-view">
        <header className="app-header app-header-compact">
          <div className="header-row">
            <div className="header-petal-sm">🌸</div>
            <h1 className="app-title-sm">{t.mapTitle}</h1>
            <LangToggle />
          </div>
          <div className="map-week-filter">
            <select
              className="map-week-select"
              value={mapFilterWeek ?? ''}
              onChange={e => setMapFilterWeek(e.target.value || null)}
            >
              <option value="">{t.mapFilterAll}</option>
              {ALL_WEEK_LABELS.map(w => {
                const count = getSpotsForWeek(w).length
                if (count === 0) return null
                return (
                  <option key={w} value={w}>
                    {w}（{count}{t.mapFilterSuffix}）{w === todayWeek ? t.mapFilterToday : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="map-legend">
            <span className="legend-item"><span className="legend-dot dot-spring" />{t.legendSpringShort}</span>
            <span className="legend-item"><span className="legend-dot dot-kawazu" />{t.legendKawaziShort}</span>
            <span className="legend-item"><span className="legend-dot dot-winter" />{t.legendWinterShort}</span>
            <span className="legend-item"><span className="map-today-dot" />{t.legendThisWeek}</span>
          </div>
        </header>
        <AllSpotsMap
          spots={spotsData}
          filterWeek={mapFilterWeek}
          todayWeek={todayWeek}
          onSelectSpot={openSpotDetail}
        />
        <BottomNav />
      </div>
    )
  }

  // ── マイプラン一覧 ──
  if (view === 'plan') {
    return (
      <div className="app">
        <PlanView
          planDates={planDates}
          onBack={() => history.back()}
          onSelectSpot={openSpotDetail}
          onRemoveSpot={togglePlanForDate}
          onEditDate={editDateFromPlan}
          lang={lang}
        />
        <BottomNav />
      </div>
    )
  }

  // ── カレンダー ──
  const calYear = new Date().getFullYear()
  const today = new Date()
  const DOW_LABELS = lang === 'zh-TW' ? DOW_LABELS_ZH : DOW_LABELS_JA

  return (
    <div className="app">
      {showStationPicker && (
        <StationPicker
          current={fromStation}
          onSelect={handleSelectStation}
          onClose={() => setShowStationPicker(false)}
        />
      )}
      {showTutorial && <TutorialOverlay onClose={closeTutorial} />}
      <header className="app-header">
        <div className="header-top-row">
          <div className="header-petal">🌸</div>
          <div className="header-top-right">
            <HelpBtn />
            <LangToggle />
          </div>
        </div>
        <h1 className="app-title">{t.appTitle}</h1>
        <p className="app-subtitle">{calYear}年 — {t.appSubtitle}</p>
        <StationBtn />
        <button className="jump-today-btn" onClick={jumpToToday}>
          📅 {t.jumpToToday}
        </button>
        <button
          className={`plan-overview-btn${plannedDayCount > 0 ? ' plan-overview-btn-active' : ''}`}
          onClick={openPlan}
        >
          <span className="plan-overview-icon">⭐</span>
          <span className="plan-overview-label">
            {plannedDayCount > 0
              ? `${t.myPlan}　${plannedDayCount}${t.planViewDays} / ${Object.values(planDates).reduce((s, a) => s + a.length, 0)}${t.planViewSpots}`
              : t.myPlan}
          </span>
          <span className="plan-overview-arrow">›</span>
        </button>
      </header>

      <div className="legend">
        <span className="legend-item"><span className="legend-dot dot-spring" />{t.legendSpring}</span>
        <span className="legend-item"><span className="legend-dot dot-kawazu" />{t.legendKawazu}</span>
        <span className="legend-item"><span className="legend-dot dot-winter" />{t.legendWinter}</span>
        <span className="legend-item"><span className="legend-dot dot-off" />{t.legendOff}</span>
      </div>

      <main className="calendar">
        {MONTH_NAMES.map((monthLabel, mi) => {
          const month = mi + 1
          const isOpen = openMonths.has(month)
          const cells = getCalendarMonth(calYear, month)

          // この月に計画済み日があるか（バッジ表示用）
          const planCountInMonth = cells.filter(d => {
            if (!d) return false
            return (planDates[formatDateStr(d)] ?? []).length > 0
          }).length

          return (
            <div key={mi} id={`cal-month-${month}`} className="cal-month">
              {/* 月ヘッダー（タップで展開/折りたたみ） */}
              <button
                className={`cal-month-toggle${isOpen ? ' cal-month-open' : ''}`}
                onClick={() => toggleMonth(month)}
              >
                <span className="cal-month-label">{monthLabel}</span>
                {planCountInMonth > 0 && (
                  <span className="cal-month-plan-badge">★{planCountInMonth}</span>
                )}
                <span className="cal-month-chevron">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* 折りたたみコンテンツ */}
              <div className={`calendar-collapse${isOpen ? ' cal-open' : ''}`}>
                <div className="cal-month-inner">
                  {/* 曜日ヘッダー */}
                  <div className="cal-dow-row">
                    {DOW_LABELS.map((d, di) => (
                      <div
                        key={di}
                        className={`cal-dow${di === 0 ? ' cal-dow-sun' : di === 6 ? ' cal-dow-sat' : ''}`}
                      >{d}</div>
                    ))}
                  </div>

                  {/* 日付グリッド */}
                  <div className="cal-day-grid">
                    {cells.map((date, ci) => {
                      if (!date) return <div key={ci} className="cal-day-empty" />

                      const wl = dateToWeekLabel(date)
                      const dateStr = formatDateStr(date)
                      const allSpotsInWeek = getSpotsForWeek(wl)
                      const offSeason = allSpotsInWeek.length === 0
                      const plannedForDate = (planDates[dateStr] ?? []).length > 0
                      const isToday = isSameDay(date, today)
                      const varClass = getVarietyClass(wl)
                      const dow = date.getDay()

                      return (
                        <button
                          key={ci}
                          id={isToday ? 'cal-today' : undefined}
                          className={[
                            'cal-day-cell',
                            offSeason ? 'cal-day-off' : varClass,
                            isToday ? 'cal-day-today' : '',
                            offSeason ? 'cal-day-disabled' : '',
                            !offSeason && plannedForDate ? 'cal-day-has-plan' : '',
                            dow === 0 ? 'cal-day-sun' : '',
                            dow === 6 ? 'cal-day-sat' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => !offSeason && openWeek(wl, dateStr)}
                          disabled={offSeason}
                        >
                          <span className="cal-day-num">{date.getDate()}</span>
                          {!offSeason && plannedForDate && (
                            <span className="cal-day-star">★</span>
                          )}
                          {!offSeason && !plannedForDate && (
                            <span className="cal-day-bloom-dot" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </main>

      <BottomNav />
    </div>
  )
}
