import { useState, useEffect } from 'react'
import spotsData from './data/spots.json'
import varietiesData from './data/varieties.json'
import { SpotCard } from './components/SpotCard'
import { AllSpotsMap } from './components/AllSpotsMap'
import { VarietyList } from './components/VarietyList'
import { VarietyDetail } from './components/VarietyDetail'
import { getCurrentWeekIndex } from './utils/getWeek'

type Tab = 'calendar' | 'map' | 'zukan'
type View = 'calendar' | 'map' | 'detail' | 'zukan' | 'zukan-detail'

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function getVarietyClass(variety: string): string {
  if (variety === 'オフシーズン') return 'cell-off'
  if (['ソメイヨシノ', 'オオカンザクラ', 'ケイオウザクラ・シダレザクラ', 'ヤマザクラ', 'カンザン（八重）', 'ギョイコウ・ウコン', 'サトザクラ系（遅咲き）', 'ヤマザクラ系'].includes(variety)) return 'cell-spring'
  if (variety === 'カワヅザクラ') return 'cell-kawazu'
  return 'cell-winter'
}

// 品種名からidを検索（前方一致・部分一致）
function findVarietyId(varietyName: string): string | null {
  const found = varietiesData.find(
    (v) => v.name === varietyName || varietyName.includes(v.name) || v.name.includes(varietyName)
  )
  return found?.id ?? null
}

export default function App() {
  const [tab, setTab] = useState<Tab>('calendar')
  const [view, setView] = useState<View>('calendar')
  const [spotIndex, setSpotIndex] = useState(getCurrentWeekIndex)
  const [varietyId, setVarietyId] = useState<string | null>(null)
  const todayIndex = getCurrentWeekIndex()

  const spot = spotsData[spotIndex]
  const isOffSeason = spot.variety === 'オフシーズン'

  const openDetail = (i: number, fromTab: Tab = 'calendar') => {
    setSpotIndex(i)
    setView('detail')
    history.pushState({ view: 'detail', fromTab }, '')
  }

  const openVariety = (id: string, fromView: View = 'zukan') => {
    setVarietyId(id)
    setView('zukan-detail')
    history.pushState({ view: 'zukan-detail', fromView }, '')
  }

  const openVarietyFromSpot = (varietyName: string) => {
    const id = findVarietyId(varietyName)
    if (!id) return
    openVariety(id, 'detail')
  }

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const state = e.state
      if (!state) { setTab('calendar'); setView('calendar'); return }
      if (state.view === 'detail') { setTab(state.fromTab); setView(state.fromTab) }
      else if (state.view === 'zukan-detail') { setTab('zukan'); setView(state.fromView ?? 'zukan') }
      else { setView(state.view ?? 'calendar') }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const switchTab = (t: Tab) => {
    setTab(t)
    setView(t)
  }

  const goPrev = () => setSpotIndex((i) => (i - 1 + spotsData.length) % spotsData.length)
  const goNext = () => setSpotIndex((i) => (i + 1) % spotsData.length)

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

  // ── 品種詳細ビュー ──
  if (view === 'zukan-detail' && varietyId) {
    return (
      <div className="app">
        <VarietyDetail
          id={varietyId}
          onBack={() => { setView('zukan') }}
          onSelectSpot={(i) => openDetail(i, 'zukan' as Tab)}
        />
        <BottomNav />
      </div>
    )
  }

  // ── 図鑑一覧ビュー ──
  if (view === 'zukan') {
    return (
      <div className="app">
        <VarietyList onSelect={(id) => openVariety(id, 'zukan')} />
        <BottomNav />
      </div>
    )
  }

  // ── スポット詳細ビュー ──
  if (view === 'detail') {
    const fromTab = (history.state?.fromTab ?? tab) as Tab
    return (
      <div className="app">
        <header className="app-header">
          <button className="back-btn" onClick={() => { setView(fromTab) }}>
            ← {fromTab === 'map' ? 'マップ' : fromTab === 'zukan' ? '図鑑' : 'カレンダー'}
          </button>
          <div className="header-petal">🌸</div>
          <h1 className="app-title">今週末の桜</h1>
          <p className="week-label">{spot.week}</p>
        </header>

        <main className="main-content">
          <section className="section">
            <div className="section-title">今週のイチオシ</div>
            <SpotCard spot={spot} onVarietyClick={openVarietyFromSpot} />
          </section>

          {!isOffSeason && (
            <section className="section">
              <div className="section-title">尻手から1時間圏内の代替</div>
              {spot.within1hour ? (
                <div className="alternative-card in-range">
                  <span className="alt-check">✅</span>
                  <div>
                    <p className="alt-main">現スポットが圏内です</p>
                    <p className="alt-sub">尻手から{spot.travelTime}でアクセス可能</p>
                  </div>
                </div>
              ) : (
                <div className="alternative-card">
                  <span className="alt-icon">🗺</span>
                  <p className="alt-main">{spot.alternative}</p>
                </div>
              )}
            </section>
          )}
        </main>

        <nav className="navigation">
          <button className="nav-btn" onClick={goPrev}>← 前週</button>
          <span className="week-counter">{spotIndex + 1} / {spotsData.length}</span>
          <button className="nav-btn" onClick={goNext}>次週 →</button>
        </nav>
      </div>
    )
  }

  // ── マップビュー ──
  if (view === 'map') {
    return (
      <div className="app app-map-view">
        <header className="app-header app-header-compact">
          <div className="header-row">
            <div className="header-petal-sm">🌸</div>
            <h1 className="app-title-sm">スポットマップ</h1>
          </div>
          <div className="map-legend">
            <span className="legend-item"><span className="legend-dot dot-spring" />春</span>
            <span className="legend-item"><span className="legend-dot dot-kawazu" />河津</span>
            <span className="legend-item"><span className="legend-dot dot-winter" />冬・秋</span>
            <span className="legend-item"><span className="map-today-dot" />今週</span>
          </div>
        </header>

        <AllSpotsMap
          spots={spotsData}
          todayIndex={todayIndex}
          onSelectSpot={(i) => openDetail(i, 'map')}
        />
        <BottomNav />
      </div>
    )
  }

  // ── カレンダービュー ──
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
          const monthSpots = spotsData.slice(mi * 4, mi * 4 + 4)
          return (
            <div key={monthLabel} className="cal-month">
              <div className="cal-month-label">{monthLabel}</div>
              <div className="cal-week-row">
                {monthSpots.map((s, wi) => {
                  const i = mi * 4 + wi
                  const isToday = i === todayIndex
                  const varClass = getVarietyClass(s.variety)
                  return (
                    <button
                      key={i}
                      className={`cal-cell ${varClass} ${isToday ? 'cal-cell-today' : ''}`}
                      onClick={() => openDetail(i, 'calendar')}
                    >
                      <span className="cal-week-num">第{wi + 1}週</span>
                      {isToday && <span className="cal-today-badge">今週</span>}
                      <span className="cal-spot-name">
                        {s.variety === 'オフシーズン' ? '—' : s.spot}
                      </span>
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
