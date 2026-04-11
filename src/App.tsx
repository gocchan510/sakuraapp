import {
  Routes, Route, Navigate,
  Outlet, NavLink,
  useNavigate, useParams, useLocation,
} from 'react-router-dom'
import varietiesData from './data/varieties.json'
import { VarietyList }   from './components/VarietyList'
import { VarietyDetail } from './components/VarietyDetail'
import { SakuraMapPage } from './components/SakuraMapPage'
import { SakuraCalendar } from './components/SakuraCalendar'
import type { Variety } from './types'

const varieties = varietiesData as Variety[]

// ── スポットフィルタの型（location.state で受け渡し） ──────────
interface SpotFilter { name: string; ids: string[] }

// ── タブ付きレイアウト（図鑑 / 地図 / カレンダー） ────────────────────────
function TabLayout() {
  const location = useLocation()
  const isMap    = location.pathname === '/map'

  return (
    <div className={`app${isMap ? ' app--map' : ''}`}>
      <Outlet />

      <nav className="tab-bar">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}
        >
          <span className="tab-icon">🌸</span>
          <span className="tab-label">図鑑</span>
        </NavLink>
        <NavLink
          to="/map"
          className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}
        >
          <span className="tab-icon">🗺️</span>
          <span className="tab-label">地図</span>
        </NavLink>
        <NavLink
          to="/calendar"
          className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}
        >
          <span className="tab-icon">🗓️</span>
          <span className="tab-label">カレンダー</span>
        </NavLink>
      </nav>
    </div>
  )
}

// ── 図鑑タブ ─────────────────────────────────────────────────────
function ZukanRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const spotFilter = (location.state as { spotFilter?: SpotFilter } | null)?.spotFilter ?? null

  const displayed = spotFilter
    ? varieties.filter(v => spotFilter.ids.includes(v.id))
    : varieties

  return (
    <VarietyList
      varieties={displayed}
      onSelect={(id) => navigate(`/variety/${id}`)}
      spotFilter={spotFilter}
      onClearSpotFilter={() => navigate('/', { replace: true, state: null })}
    />
  )
}

// ── 地図タブ ─────────────────────────────────────────────────────
function MapRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const focusSpotId = (location.state as any)?.focusSpotId as string | undefined

  return (
    <SakuraMapPage
      onViewVarieties={(name, ids) =>
        navigate('/', { state: { spotFilter: { name, ids } } })
      }
      onSelectVariety={(id) => navigate(`/variety/${id}`)}
      focusSpotId={focusSpotId}
    />
  )
}

// ── 品種詳細（タブバーなし） ──────────────────────────────────────
function VarietyDetailRoute() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const variety  = varieties.find(v => v.id === id)

  if (!variety) return <Navigate to="/" replace />

  return (
    <div className="app">
      <VarietyDetail
        variety={variety}
        onBack={() => navigate(-1)}
        onShowOnMap={(spotId) => navigate('/map', { state: { focusSpotId: spotId } })}
      />
    </div>
  )
}

// ── ルート定義 ────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      {/* タブバーあり */}
      <Route element={<TabLayout />}>
        <Route index           element={<ZukanRoute />} />
        <Route path="map"      element={<MapRoute />} />
        <Route path="calendar" element={<SakuraCalendar />} />
      </Route>

      {/* タブバーなし */}
      <Route path="variety/:id" element={<VarietyDetailRoute />} />

      {/* 不明パスは図鑑へ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
