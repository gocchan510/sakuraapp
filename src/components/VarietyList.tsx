import { useState, useMemo } from 'react'
import type { Variety } from '../types'
import { useWikiImage } from '../hooks/useWikiImage'
import {
  varietyMatchesFilter,
  ALL_PERIODS,
  BLOOM_PRESETS,
  type BloomPreset,
} from '../utils/bloomFilter'
import { getDiscoveredVarietyIds } from '../utils/discoveries'

// ── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  variety: Variety
  onClick: () => void
  discovered?: boolean
}

function VarietyCard({ variety, onClick, discovered }: CardProps) {
  const imageUrl = useWikiImage(variety.wikiTitleJa, variety.wikiTitleEn)

  const gradientStyle = {
    background: `linear-gradient(135deg, ${variety.colorCode}55 0%, ${variety.colorCode}cc 100%)`,
  }

  return (
    <div className="variety-card" onClick={onClick}>
      <div className="variety-card-image" style={!imageUrl ? gradientStyle : {}}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={variety.name}
            onError={(e) => {
              const target = e.currentTarget
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                Object.assign(parent.style, gradientStyle)
                const fb = parent.querySelector('.variety-card-image-fallback') as HTMLElement | null
                if (fb) fb.style.display = 'flex'
              }
            }}
          />
        ) : null}
        <div
          className="variety-card-image-fallback"
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          {variety.emoji}
        </div>
        <span className="variety-card-no">No.{variety.no}</span>
        {variety.bloomPeriod?.secondary && (
          <span className="variety-card-seasonal">🔄</span>
        )}
      </div>
      <div className="variety-card-body">
        <div className="variety-card-name">{variety.name}</div>
        <div className="variety-card-reading">{variety.reading}</div>
        <div className="variety-card-bloom">{variety.bloomSeason}</div>
        <div className="variety-card-footer">
          {variety.rarity && (
            <span className="variety-card-rarity" data-score={variety.rarity.score}>
              {variety.rarity.stars}
            </span>
          )}
          <span
            className="variety-card-colordot"
            style={{ background: variety.colorCode }}
          />
          {discovered && (
            <span className="variety-card-discovered">✓</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterState {
  start: string | null   // null = 全件
  end: string | null
  activeKey: string | null  // preset key or 'custom'
}

const INIT_FILTER: FilterState = { start: null, end: null, activeKey: null }

interface FilterPanelProps {
  filter: FilterState
  onChange: (f: FilterState) => void
}

function FilterPanel({ filter, onChange }: FilterPanelProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customStart, setCustomStart] = useState('04-early')
  const [customEnd,   setCustomEnd]   = useState('04-late')

  function applyPreset(p: BloomPreset) {
    onChange({ start: p.start, end: p.end, activeKey: p.key })
  }

  function clearFilter() {
    onChange(INIT_FILTER)
  }

  function applyCustom(s: string, e: string) {
    onChange({ start: s, end: e, activeKey: 'custom' })
  }

  return (
    <div className="bloom-filter">
      {/* Preset chips */}
      <div className="bloom-filter-presets">
        <button
          className={`bloom-preset-btn${filter.activeKey === null ? ' active' : ''}`}
          onClick={clearFilter}
        >
          すべて
        </button>
        {BLOOM_PRESETS.map(p => (
          <button
            key={p.key}
            className={`bloom-preset-btn${filter.activeKey === p.key ? ' active' : ''}`}
            onClick={() => applyPreset(p)}
          >
            {p.emoji} {p.label}
          </button>
        ))}
      </div>

      {/* Custom range toggle */}
      <button
        className="bloom-custom-toggle"
        onClick={() => setShowCustom(v => !v)}
        aria-expanded={showCustom}
      >
        <span>🗓 期間を指定</span>
        <span className="bloom-custom-arrow">{showCustom ? '▲' : '▼'}</span>
      </button>

      {showCustom && (
        <div className="bloom-custom-range">
          <select
            value={customStart}
            onChange={e => {
              setCustomStart(e.target.value)
              applyCustom(e.target.value, customEnd)
            }}
            aria-label="開花開始時期"
          >
            {ALL_PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <span className="bloom-range-sep">〜</span>
          <select
            value={customEnd}
            onChange={e => {
              setCustomEnd(e.target.value)
              applyCustom(customStart, e.target.value)
            }}
            aria-label="開花終了時期"
          >
            {ALL_PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── List ─────────────────────────────────────────────────────────────────────

interface Props {
  varieties: Variety[]
  onSelect: (id: string) => void
  spotFilter?: { name: string; ids: string[] } | null
  onClearSpotFilter?: () => void
}

export function VarietyList({ varieties, onSelect, spotFilter, onClearSpotFilter }: Props) {
  const [filter, setFilter] = useState<FilterState>(INIT_FILTER)
  const [discoveredIds] = useState(() => getDiscoveredVarietyIds())

  const filtered = useMemo(() => {
    if (!filter.start || !filter.end) return varieties
    return varieties.filter(v =>
      varietyMatchesFilter(v.bloomPeriod, filter.start!, filter.end!)
    )
  }, [varieties, filter])

  const isFiltered = filter.start !== null

  return (
    <div>
      {/* Sticky header */}
      <div className="zukan-header">
        <div className="zukan-header-title">🌸 桜図鑑</div>
        <div className="zukan-header-sub">
          {isFiltered
            ? <><span className="filter-count">{filtered.length}件</span> / {varieties.length}品種収録</>
            : <>{varieties.length}品種収録</>
          }
        </div>
      </div>

      {/* スポットフィルタバナー */}
      {spotFilter && (
        <div className="spot-filter-banner">
          <span className="spot-filter-text">
            📍 {spotFilter.name} の品種 ({varieties.length}件)
          </span>
          <button className="spot-filter-clear" onClick={onClearSpotFilter}>✕ 解除</button>
        </div>
      )}

      {/* Filter */}
      <FilterPanel filter={filter} onChange={setFilter} />

      {/* 発見進捗バー */}
      {discoveredIds.size > 0 && (
        <div className="discovery-progress">
          <div className="discovery-progress__text">
            発見済み: {discoveredIds.size}/{varieties.length}品種
          </div>
          <div className="discovery-progress__bar">
            <div
              className="discovery-progress__fill"
              style={{ width: `${(discoveredIds.size / varieties.length * 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bloom-empty">
          <div className="bloom-empty-icon">🌸</div>
          <div className="bloom-empty-msg">この時期に咲く品種は見つかりませんでした</div>
          <button className="bloom-empty-reset" onClick={() => setFilter(INIT_FILTER)}>
            すべて表示
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="zukan-grid">
        {filtered.map(v => (
          <VarietyCard key={v.id} variety={v} onClick={() => onSelect(v.id)} discovered={discoveredIds.has(v.id)} />
        ))}
      </div>
    </div>
  )
}
