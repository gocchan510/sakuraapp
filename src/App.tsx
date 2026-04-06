import { useState, useEffect } from 'react'
import spotsData from './data/spots.json'
import varietiesData from './data/varieties.json'
import { SpotCard } from './components/SpotCard'
import { SpotList } from './components/SpotList'
import { AllSpotsMap } from './components/AllSpotsMap'
import { VarietyList } from './components/VarietyList'
import { VarietyDetail } from './components/VarietyDetail'
import { getCurrentWeekIndex, getWeekLabel, ALL_WEEK_LABELS } from './utils/getWeek'
import { getSpotsForWeek, isOffSeason } from './utils/spotsByWeek'

type Tab = 'calendar' | 'map' | 'zukan'
type View = 'calendar' | 'spotlist' | 'detail' | 'map' | 'zukan' | 'zukan-detail'

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

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
  const todayWeek = getWeekLabel(getCurrentWeekIndex())

  const [tab, setTab] = useState<Tab>('calendar')
  const [view, setView] = useState<View>('calendar')
  const [selectedWeek, setSelectedWeek] = useState<string>(todayWeek)
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null)
  const [varietyId, setVarietyId] = useState<string | null>(null)
  // マップで選択中の週フィルター（nullで全件）
  const [mapFilterWeek, setMapFilterWeek] = useState<string | null>(null)

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

  const push = (v: View, t: Tab = tab) => {
    history.pushState({ view: v, tab: t }, '')
    setView(v)
    setTab(t)
  }

  const openWeek = (week: string) => {
    setSelectedWeek(week)
    if (isOffSeason(week)) return  // オフシーズンはスポットなし→何もしない
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

  const switchTab = (t: Tab) => {
    setTab(t)
    setView(t as View)
    history.pushState({ view: t, tab: t }, '')
  }

  const BottomNav = () => (
    <nav className="bottom-nav">
      <button className={`bottom-nav-btn ${tab === 'calendar' ? 'active' : ''}`} onClick={() => switchTab('calendar')}>
        <span className="bnav-icon">📅</span>
        <span className="bnav-label">カレンダー</span>
      </button>
      <button className={`bottom-nav-btn ${tab === 'map' ? 'active' : ''}`} onClick={() => switchTab('map')}>
        <span className="bnav-icon">🗾</span>
        <span className="bnav-label">マップ</span>
      </button>
      <button className={`bottom-nav-btn ${tab === 'zukan' ? 'active' : ''}`} onClick={() => switchTab('zukan')}>
        <span className="bnav-icon">📖</span>
        <span className="bnav-label">図鑑</span>
      </button>
    </nav>
  )

  // ── 品種詳細 ──
  if (view === 'zukan-detail' && varietyId) {
    return (
      <div className="app">
        <VarietyDetail
          id={varietyId}
          onBack={() => { setView('zukan') }}
          onSelectSpot={(spotId) => openSpotDetail(spotId)}
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
          <button className="back-btn" onClick={() => history.back()}>← 戻る</button>
          <div className="header-petal">🌸</div>
          <p className="week-label">{selectedSpot.name}</p>
          <p className="app-subtitle">
            {selectedSpot.peakWeeks.join(' / ')}
          </p>
        </header>
        <main className="main-content">
          <section className="section">
            <SpotCard spot={selectedSpot} onVarietyClick={openVarietyFromSpot} />
          </section>
        </main>
      </div>
    )
  }

  // ── スポット一覧（週タップ後）──
  if (view === 'spotlist') {
    return (
      <div className="app">
        <SpotList
          weekLabel={selectedWeek}
          spots={weekSpots}
          onSelect={openSpotDetail}
          onBack={() => history.back()}
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
            <h1 className="app-title-sm">スポットマップ</h1>
          </div>
          {/* 週フィルター */}
          <div className="map-week-filter">
            <select
              className="map-week-select"
              value={mapFilterWeek ?? ''}
              onChange={e => setMapFilterWeek(e.target.value || null)}
            >
              <option value="">全スポット表示</option>
              {ALL_WEEK_LABELS.map(w => {
                const count = getSpotsForWeek(w).length
                if (count === 0) return null
                return (
                  <option key={w} value={w}>
                    {w}（{count}件）{w === todayWeek ? ' ← 今週' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="map-legend">
            <span className="legend-item"><span className="legend-dot dot-spring" />春</span>
            <span className="legend-item"><span className="legend-dot dot-kawazu" />河津</span>
            <span className="legend-item"><span className="legend-dot dot-winter" />冬・秋</span>
            <span className="legend-item"><span className="map-today-dot" />対象週</span>
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

  // ── カレンダー ──
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-petal">🌸</div>
        <h1 className="app-title">桜週末ガイド</h1>
        <p className="app-subtitle">週を選んで花見計画を立てよう</p>
      </header>

      <div className="legend">
        <span className="legend-item"><span className="legend-dot dot-spring" />春の桜</span>
        <span className="legend-item"><span className="legend-dot dot-kawazu" />河津桜</span>
        <span className="legend-item"><span className="legend-dot dot-winter" />冬・秋桜</span>
        <span className="legend-item"><span className="legend-dot dot-off" />オフ</span>
      </div>

      <main className="calendar">
        {MONTH_NAMES.map((monthLabel, mi) => {
          const weekLabels = ALL_WEEK_LABELS.slice(mi * 4, mi * 4 + 4)
          return (
            <div key={monthLabel} className="cal-month">
              <div className="cal-month-label">{monthLabel}</div>
              <div className="cal-week-row">
                {weekLabels.map((wl, wi) => {
                  const isToday = wl === todayWeek
                  const spots = getSpotsForWeek(wl)
                  const off = spots.length === 0
                  const varClass = getVarietyClass(wl)
                  return (
                    <button
                      key={wl}
                      className={`cal-cell ${varClass} ${isToday ? 'cal-cell-today' : ''} ${off ? 'cal-cell-disabled' : ''}`}
                      onClick={() => !off && openWeek(wl)}
                      disabled={off}
                    >
                      <span className="cal-week-num">第{wi + 1}週</span>
                      {isToday && <span className="cal-today-badge">今週</span>}
                      {off ? (
                        <span className="cal-spot-name" style={{ color: '#ccc' }}>—</span>
                      ) : (
                        <>
                          <span className="cal-spot-count">{spots.length}件</span>
                          <span className="cal-spot-name">{spots[0].name}</span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </main>

      <BottomNav />
    </div>
  )
}
