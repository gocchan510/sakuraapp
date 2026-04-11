import { useState } from 'react'
import varietiesData from './data/varieties.json'
import { VarietyList } from './components/VarietyList'
import { VarietyDetail } from './components/VarietyDetail'
import { SakuraMapPage } from './components/SakuraMapPage'
import type { Variety } from './types'

const varieties = varietiesData as Variety[]

type Page = 'zukan' | 'map'

export default function App() {
  const [page, setPage]                       = useState<Page>('zukan')
  const [selectedId, setSelectedId]           = useState<string | null>(null)
  const [spotFilter, setSpotFilter]           = useState<{ name: string; ids: string[] } | null>(null)

  const selected = selectedId ? varieties.find(v => v.id === selectedId) ?? null : null

  const displayedVarieties = spotFilter
    ? varieties.filter(v => spotFilter.ids.includes(v.id))
    : varieties

  function handleViewVarieties(spotName: string, ids: string[]) {
    setSpotFilter({ name: spotName, ids })
    setPage('zukan')
  }

  function handleSelectVariety(id: string) {
    setSelectedId(id)
    setPage('zukan')
  }

  function handleBack() {
    setSelectedId(null)
  }

  return (
    <div className={`app${page === 'map' && !selected ? ' app--map' : ''}`}>
      {/* ── メインコンテンツ ── */}
      {selected ? (
        <VarietyDetail variety={selected} onBack={handleBack} />
      ) : page === 'map' ? (
        <SakuraMapPage
          onViewVarieties={handleViewVarieties}
          onSelectVariety={handleSelectVariety}
        />
      ) : (
        <VarietyList
          varieties={displayedVarieties}
          onSelect={setSelectedId}
          spotFilter={spotFilter}
          onClearSpotFilter={() => setSpotFilter(null)}
        />
      )}

      {/* ── タブバー（詳細表示中は非表示） ── */}
      {!selected && (
        <nav className="tab-bar">
          <button
            className={`tab-btn${page === 'zukan' ? ' active' : ''}`}
            onClick={() => setPage('zukan')}
          >
            <span className="tab-icon">🌸</span>
            <span className="tab-label">図鑑</span>
          </button>
          <button
            className={`tab-btn${page === 'map' ? ' active' : ''}`}
            onClick={() => setPage('map')}
          >
            <span className="tab-icon">🗺️</span>
            <span className="tab-label">地図</span>
          </button>
        </nav>
      )}
    </div>
  )
}
