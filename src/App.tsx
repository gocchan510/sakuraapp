import { useState, useEffect } from 'react'
import spotsData from './data/spots.json'
import { SpotCard } from './components/SpotCard'
import { getCurrentWeekIndex } from './utils/getWeek'

type View = 'calendar' | 'detail'

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 各スポットに色クラスを付ける
function getVarietyClass(variety: string): string {
  if (variety === 'オフシーズン') return 'cell-off'
  if (['ソメイヨシノ', 'オオカンザクラ', 'ケイオウザクラ・シダレザクラ', 'ヤマザクラ', 'カンザン（八重）', 'ギョイコウ・ウコン', 'サトザクラ系（遅咲き）', 'ヤマザクラ系'].includes(variety)) return 'cell-spring'
  if (['カワヅザクラ'].includes(variety)) return 'cell-kawazu'
  return 'cell-winter' // フユザクラ・ジュウガツザクラ系
}

export default function App() {
  const [view, setView] = useState<View>('calendar')
  const [index, setIndex] = useState(getCurrentWeekIndex)
  const todayIndex = getCurrentWeekIndex()

  const spot = spotsData[index]
  const isOffSeason = spot.variety === 'オフシーズン'

  const openDetail = (i: number) => {
    setIndex(i)
    setView('detail')
    history.pushState({ view: 'detail' }, '')
  }

  const backToCalendar = () => {
    setView('calendar')
  }

  useEffect(() => {
    const onPopState = () => {
      setView('calendar')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const goPrev = () => setIndex((i) => (i - 1 + spotsData.length) % spotsData.length)
  const goNext = () => setIndex((i) => (i + 1) % spotsData.length)

  // ── カレンダービュー ──
  if (view === 'calendar') {
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
                        onClick={() => openDetail(i)}
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
      </div>
    )
  }

  // ── 詳細ビュー ──
  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={backToCalendar}>
          ← カレンダー
        </button>
        <div className="header-petal">🌸</div>
        <h1 className="app-title">今週末の桜</h1>
        <p className="week-label">{spot.week}</p>
      </header>

      <main className="main-content">
        <section className="section">
          <div className="section-title">今週のイチオシ</div>
          <SpotCard spot={spot} />
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
        <span className="week-counter">{index + 1} / {spotsData.length}</span>
        <button className="nav-btn" onClick={goNext}>次週 →</button>
      </nav>
    </div>
  )
}
