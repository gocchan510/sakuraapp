import { useState, useMemo } from 'react'
import type { Variety } from '../types'
import { useWikiImage } from '../hooks/useWikiImage'
import {
  bloomOrd,
  ALL_PERIODS,
  BLOOM_PRESETS,
  type BloomPreset,
} from '../utils/bloomFilter'
import { getSomeiyoshinoDate, getVarietyBloomWindow } from '../utils/bloomOffset'
import { getDiscoveredVarietyIds } from '../utils/discoveries'
import { useLang } from '../contexts/LangContext'

// カレンダーと同じ東京基準のソメイヨシノ開花日
const LIST_SOMEIYOSHINO_DATE = getSomeiyoshinoDate(35.6895, 139.6917)

/** bloomGroup ベースのフィルタ: 品種の開花ウィンドウが filter 期間と重なるか */
function varietyMatchesFilterByGroup(
  variety: Variety,
  filterStart: string,
  filterEnd: string,
): boolean {
  const win = getVarietyBloomWindow(
    variety.bloomGroup,
    variety.someiyoshinoOffset ?? null,
    LIST_SOMEIYOSHINO_DATE,
  )
  if (!win) return false

  function periodMidDate(p: string): Date {
    const [mStr, jun] = p.split('-')
    const m = parseInt(mStr)
    const day = jun === 'early' ? 5 : jun === 'mid' ? 15 : 25
    return new Date(LIST_SOMEIYOSHINO_DATE.getFullYear(), m - 1, day)
  }

  const fs = periodMidDate(filterStart)
  const fe = periodMidDate(filterEnd)

  const filterWraps = bloomOrd(filterEnd) < bloomOrd(filterStart)

  if (!filterWraps) {
    return win.start <= fe && win.end >= fs
  } else {
    const yearEnd = new Date(LIST_SOMEIYOSHINO_DATE.getFullYear(), 11, 31)
    const yearStart = new Date(LIST_SOMEIYOSHINO_DATE.getFullYear(), 0, 1)
    return (win.start <= yearEnd && win.end >= fs) ||
           (win.start <= fe    && win.end >= yearStart)
  }
}

// ── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  variety: Variety
  onClick: () => void
  discovered?: boolean
}

function VarietyCard({ variety, onClick, discovered }: CardProps) {
  const { lang, tVariety } = useLang()
  const tv = tVariety(variety)
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
        {variety.bloomGroup === 'fuyu' && (
          <span className="variety-card-seasonal">🔄</span>
        )}
      </div>
      <div className="variety-card-body">
        <div className="variety-card-name">{tv.name}</div>
        {lang !== 'ja' && (
          <div className="variety-card-name-ja">{variety.name}</div>
        )}
        {lang === 'ja' && (
          <div className="variety-card-reading">{variety.reading}</div>
        )}
        <div className="variety-card-bloom">{tv.bloomSeason}</div>
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
  start: string | null
  end: string | null
  activeKey: string | null
}

const INIT_FILTER: FilterState = { start: null, end: null, activeKey: null }

interface FilterPanelProps {
  filter: FilterState
  onChange: (f: FilterState) => void
}

function FilterPanel({ filter, onChange }: FilterPanelProps) {
  const { t } = useLang()
  const zukan = t('zukan')
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
      <div className="bloom-filter-presets">
        <button
          className={`bloom-preset-btn${filter.activeKey === null ? ' active' : ''}`}
          onClick={clearFilter}
        >
          {zukan.allBtn}
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

      <button
        className="bloom-custom-toggle"
        onClick={() => setShowCustom(v => !v)}
        aria-expanded={showCustom}
      >
        <span>{zukan.customRange}</span>
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
            aria-label="start"
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
            aria-label="end"
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
  const { t } = useLang()
  const zukan = t('zukan')
  const [filter, setFilter] = useState<FilterState>(INIT_FILTER)
  const [discoveredIds] = useState(() => getDiscoveredVarietyIds())

  const filtered = useMemo(() => {
    if (!filter.start || !filter.end) return varieties
    return varieties.filter(v =>
      varietyMatchesFilterByGroup(v, filter.start!, filter.end!)
    )
  }, [varieties, filter])

  const isFiltered = filter.start !== null

  return (
    <div>
      {/* Sticky header */}
      <div className="zukan-header">
        <div className="zukan-header-title">{zukan.title}</div>
        <div className="zukan-header-sub">
          {isFiltered
            ? <><span className="filter-count">{filtered.length}件</span> / {zukan.recordCount(varieties.length)}</>
            : <>{zukan.recordCount(varieties.length)}</>
          }
        </div>
      </div>

      {/* スポットフィルタバナー */}
      {spotFilter && (
        <div className="spot-filter-banner">
          <span className="spot-filter-text">
            {zukan.spotFilterBanner(spotFilter.name, varieties.length)}
          </span>
          <button className="spot-filter-clear" onClick={onClearSpotFilter}>{zukan.clearFilter}</button>
        </div>
      )}

      {/* Filter */}
      <FilterPanel filter={filter} onChange={setFilter} />

      {/* 発見進捗バー */}
      {discoveredIds.size > 0 && (
        <div className="discovery-progress">
          <div className="discovery-progress__text">
            {zukan.discovered(discoveredIds.size, varieties.length)}
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
          <div className="bloom-empty-msg">{zukan.empty}</div>
          <button className="bloom-empty-reset" onClick={() => setFilter(INIT_FILTER)}>
            {zukan.allBtn}
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
