import { useMemo, useState } from 'react'
import varietiesData from '../data/varieties.json'
import { useLang } from '../i18n'

type SortKey = 'bloom' | 'name'

interface Props {
  onSelect: (id: string) => void
}

export function VarietyList({ onSelect }: Props) {
  const { t } = useLang()
  const [sort, setSort] = useState<SortKey>('bloom')

  const sorted = useMemo(() => {
    const arr = [...varietiesData]
    if (sort === 'name') {
      arr.sort((a, b) => a.reading.localeCompare(b.reading, 'ja'))
    } else {
      arr.sort((a, b) => a.bloomOrder - b.bloomOrder)
    }
    return arr
  }, [sort])

  return (
    <div className="variety-list-wrap">
      <header className="app-header">
        <div className="header-petal">🌸</div>
        <h1 className="app-title">{t.zukanTitle}</h1>
        <p className="app-subtitle">{t.zukanSubtitle} {varietiesData.length}{t.zukanVarietyUnit}</p>
      </header>

      {/* ソートバー */}
      <div className="sort-bar zukan-sort-bar">
        <button
          className={`sort-chip${sort === 'bloom' ? ' sort-chip-active' : ''}`}
          onClick={() => setSort('bloom')}
        >
          {t.zukanSortBloom}
        </button>
        <button
          className={`sort-chip${sort === 'name' ? ' sort-chip-active' : ''}`}
          onClick={() => setSort('name')}
        >
          {t.zukanSortName}
        </button>
      </div>

      <main className="variety-list">
        {sorted.map((v) => (
          <button
            key={v.id}
            className="variety-card"
            onClick={() => onSelect(v.id)}
          >
            <div className="variety-card-left">
              <span className="variety-emoji">{v.emoji}</span>
              <div className="variety-color-bar" style={{ background: v.color }} />
            </div>
            <div className="variety-card-body">
              <div className="variety-card-header">
                <span className="variety-name">{v.name}</span>
                <span className="variety-season">{v.season}</span>
              </div>
              <p className="variety-summary">{v.summary}</p>
              <div className="variety-tags">
                {v.tags.map((tag) => (
                  <span key={tag} className="variety-tag">{tag}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </main>
    </div>
  )
}
