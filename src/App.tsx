import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import {
  Routes, Route, Navigate,
  Outlet, NavLink,
  useNavigate, useParams, useLocation,
} from 'react-router-dom'
import varietiesData from './data/varieties.json'
import { LangProvider, useLang, type Lang } from './contexts/LangContext'
import { FavoritesProvider } from './contexts/FavoritesContext'
import type { Variety } from './types'

// ── コード分割：ルート単位で lazy load ──────────────────────────────────
const VarietyList    = lazy(() => import('./components/VarietyList').then(m => ({ default: m.VarietyList })))
const VarietyDetail  = lazy(() => import('./components/VarietyDetail').then(m => ({ default: m.VarietyDetail })))
const SakuraMapPage  = lazy(() => import('./components/SakuraMapPage').then(m => ({ default: m.SakuraMapPage })))
const SakuraCalendar = lazy(() => import('./components/SakuraCalendar').then(m => ({ default: m.SakuraCalendar })))
const SpotListPage   = lazy(() => import('./components/SpotListPage').then(m => ({ default: m.SpotListPage })))

// ── Suspense フォールバック（桜マークの簡素なスピナー） ──────────────
function RouteFallback() {
  return (
    <div className="route-fallback" aria-label="loading">
      <div className="route-fallback__petal">🌸</div>
    </div>
  )
}

const varieties = varietiesData as Variety[]

// ── スポットフィルタの型（location.state で受け渡し） ──────────
interface SpotFilter { name: string; ids: string[] }

// ── PWAインストールバナー ─────────────────────────────────────
type BannerMode = 'android' | 'ios' | null

function useInstallBanner(): {
  mode: BannerMode
  onInstall: () => void
  onDismiss: () => void
} {
  const [mode, setMode] = useState<BannerMode>(null)
  const deferredPrompt = useRef<any>(null)

  useEffect(() => {
    // 訪問回数カウント（セッション単位で重複排除）
    if (!sessionStorage.getItem('pwa_visit_counted')) {
      const prev = Number(localStorage.getItem('pwa_visit_count') || '0')
      localStorage.setItem('pwa_visit_count', String(prev + 1))
      sessionStorage.setItem('pwa_visit_counted', '1')
    }
    const visitCount = Number(localStorage.getItem('pwa_visit_count') || '0')
    if (visitCount < 2) return

    const dismissed = localStorage.getItem('pwa_banner_dismissed')
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((navigator as any).standalone) return

    const ua = navigator.userAgent
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', handler)

    const isIos = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|chrome/i.test(ua)
    if (isIos && isSafari) setMode('ios')

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function onInstall() {
    if (mode === 'android' && deferredPrompt.current) {
      deferredPrompt.current.prompt()
      deferredPrompt.current.userChoice.then(() => {
        deferredPrompt.current = null
        setMode(null)
      })
    }
  }

  function onDismiss() {
    localStorage.setItem('pwa_banner_dismissed', String(Date.now()))
    setMode(null)
  }

  return { mode, onInstall, onDismiss }
}

function InstallBanner({ mode, onInstall, onDismiss }: {
  mode: BannerMode
  onInstall: () => void
  onDismiss: () => void
}) {
  const { t } = useLang()
  const s = t('install')
  if (!mode) return null

  return (
    <div className={`install-banner${mode === 'ios' ? ' install-banner--manual' : ''}`}>
      <span className="install-banner__text">
        {mode === 'android' ? s.android : s.ios}
      </span>
      {mode === 'android' && (
        <button className="install-banner__btn" onClick={onInstall}>{s.addBtn}</button>
      )}
      <button className="install-banner__close" onClick={onDismiss} aria-label="close">{s.closeBtn}</button>
    </div>
  )
}

// ── 言語選択ローディングオーバーレイ ──────────────────────────────────────
function LangLoadingOverlay() {
  const { loading, t } = useLang()
  if (!loading) return null
  return (
    <div className="lang-loading">
      <div className="lang-loading__spinner" />
      <div className="lang-loading__text">{t('loading').text}</div>
    </div>
  )
}

// ── 初回起動 言語選択画面 ─────────────────────────────────────────────────
function FirstLaunchScreen({ onSelect }: { onSelect: (l: Lang) => void }) {
  return (
    <div className="first-launch">
      <div className="first-launch__content">
        <div className="first-launch__logo">🌸</div>
        <h1 className="first-launch__title">花見どき</h1>
        <p className="first-launch__sub">Choose your language / 選擇語言 / 言語を選んでください</p>
        <div className="first-launch__langs">
          <button className="first-launch__lang-btn" onClick={() => onSelect('ja')}>
            <span className="first-launch__flag">🇯🇵</span>
            <span className="first-launch__lang-name">日本語</span>
          </button>
          <button className="first-launch__lang-btn" onClick={() => onSelect('zh-TW')}>
            <span className="first-launch__flag">🇹🇼</span>
            <span className="first-launch__lang-name">繁體中文</span>
          </button>
          <button className="first-launch__lang-btn" onClick={() => onSelect('en')}>
            <span className="first-launch__flag">🇬🇧</span>
            <span className="first-launch__lang-name">English</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── タブ付きレイアウト ────────────────────────────────────────────────────
function TabLayout() {
  const { t } = useLang()
  const tabs = t('tabs')
  const location = useLocation()
  const isMap    = location.pathname === '/map'
  const { mode, onInstall, onDismiss } = useInstallBanner()

  return (
    <div className={`app${isMap ? ' app--map' : ''}`}>
      <Outlet />
      <InstallBanner mode={mode} onInstall={onInstall} onDismiss={onDismiss} />

      <nav className="tab-bar">
        <NavLink
          to="/map"
          className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          </span>
          <span className="tab-label">{tabs.map}</span>
        </NavLink>
        <NavLink
          to="/spots"
          className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </span>
          <span className="tab-label">{tabs.spots}</span>
        </NavLink>
        <NavLink
          to="/calendar"
          className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          <span className="tab-label">{tabs.calendar}</span>
        </NavLink>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `tab-btn${isActive ? ' active' : ''}`}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </span>
          <span className="tab-label">{tabs.zukan}</span>
        </NavLink>
      </nav>
    </div>
  )
}

// ── 図鑑タブ ─────────────────────────────────────────────────────────────
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

// ── 地図タブ ─────────────────────────────────────────────────────────────
function MapRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  // location.state 優先、次に URL クエリ（?spot=xxx）からディープリンク
  const stateFocus = (location.state as any)?.focusSpotId as string | undefined
  const queryFocus = (() => {
    try {
      const qs = location.search || ''
      const params = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs)
      return params.get('spot') || undefined
    } catch { return undefined }
  })()
  const focusSpotId = stateFocus || queryFocus

  return (
    <SakuraMapPage
      onViewVarieties={(name, ids) =>
        navigate('/', { state: { spotFilter: { name, ids } } })
      }
      onSelectVariety={(id, fromDate) => navigate(`/variety/${id}`, { state: { fromDate } })}
      onViewSpotList={(spotId) => navigate('/spots', { state: { highlightSpotId: spotId } })}
      focusSpotId={focusSpotId}
    />
  )
}

// ── 品種詳細（タブバーなし） ──────────────────────────────────────────────
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

// ── トップページで戻るボタンをアプリ終了させないフック ────────────────────
function usePreventBackOnRoot() {
  useEffect(() => {
    if (window.location.hash === '#/') {
      window.history.pushState(null, '', window.location.href)
    }

    function handlePopState() {
      if (window.location.hash === '#/' || window.location.hash === '') {
        window.history.pushState(null, '', window.location.href)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
}

// ── アプリ本体（LangProvider 内） ─────────────────────────────────────────
function AppContent() {
  const { langSelected, setLang, markLangSelected } = useLang()

  if (!langSelected) {
    return (
      <FirstLaunchScreen
        onSelect={(l) => {
          setLang(l)
          markLangSelected()
        }}
      />
    )
  }

  return (
    <>
      <LangLoadingOverlay />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* タブバーあり */}
          <Route element={<TabLayout />}>
            <Route index           element={<ZukanRoute />} />
            <Route path="map"      element={<MapRoute />} />
            <Route path="spots"    element={<SpotListPage />} />
            <Route path="calendar" element={<SakuraCalendar />} />
          </Route>

          {/* タブバーなし */}
          <Route path="variety/:id" element={<VarietyDetailRoute />} />

          {/* 不明パスは地図へ */}
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

// ── ルート定義 ────────────────────────────────────────────────────────────
export default function App() {
  usePreventBackOnRoot()
  return (
    <LangProvider>
      <FavoritesProvider>
        <AppContent />
      </FavoritesProvider>
    </LangProvider>
  )
}
