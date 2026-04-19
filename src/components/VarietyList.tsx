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
import { useLang, type Lang } from '../contexts/LangContext'
import { isHapticEnabled, setHapticEnabled, isHapticSupported, haptic, HapticPattern } from '../utils/haptic'

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

// ── Lang Modal ───────────────────────────────────────────────────────────────

function LangModal({ onClose }: { onClose: () => void }) {
  const { lang, setLang, t } = useLang()
  const s = t('lang')
  const [hapticOn, setHapticOn] = useState(isHapticEnabled())
  const hapticSupported = isHapticSupported()

  // i18n（設定モーダル用のローカル文字列。LangContextに追加せずインラインで管理）
  const L = {
    title: lang === 'en' ? 'Settings' : lang === 'zh-TW' ? '設定' : '設定',
    sectionLang: lang === 'en' ? 'Language' : lang === 'zh-TW' ? '語言' : '言語',
    sectionHaptic: lang === 'en' ? 'Haptic Feedback' : lang === 'zh-TW' ? '震動回饋' : 'ハプティック（振動）',
    hapticDesc: lang === 'en' ? 'Subtle vibration on taps' : lang === 'zh-TW' ? '點擊時輕微震動' : 'タップ時に軽く振動',
    hapticUnsupported: lang === 'en' ? 'Not supported on this device' : lang === 'zh-TW' ? '此裝置不支援' : 'この端末では利用できません',
    on: lang === 'en' ? 'ON' : lang === 'zh-TW' ? '開啟' : 'ON',
    off: lang === 'en' ? 'OFF' : lang === 'zh-TW' ? '關閉' : 'OFF',
  }

  function select(l: Lang) {
    haptic(HapticPattern.light)
    setLang(l)
    onClose()
  }

  function toggleHaptic() {
    const next = !hapticOn
    setHapticEnabled(next)
    setHapticOn(next)
    if (next) haptic(HapticPattern.strong) // ONにした瞬間フィードバック
  }

  return (
    <div className="lang-modal-backdrop" onClick={onClose}>
      <div className="lang-modal" onClick={e => e.stopPropagation()}>
        <div className="lang-modal__header">
          <span className="lang-modal__title">{L.title}</span>
          <button className="lang-modal__close" onClick={onClose}>{s.close}</button>
        </div>

        {/* 言語セクション */}
        <div className="settings-section-label">{L.sectionLang}</div>
        <div className="lang-modal__list">
          {(['ja', 'zh-TW', 'en'] as Lang[]).map(l => (
            <button
              key={l}
              className={`lang-modal__item${lang === l ? ' active' : ''}`}
              onClick={() => select(l)}
            >
              <span className="lang-modal__flag">
                {l === 'ja' ? '🇯🇵' : l === 'zh-TW' ? '🇹🇼' : '🇬🇧'}
              </span>
              <span className="lang-modal__name">{s[l]}</span>
              {lang === l && <span className="lang-modal__check">✓</span>}
            </button>
          ))}
        </div>

        {/* ハプティックセクション */}
        <div className="settings-section-label">{L.sectionHaptic}</div>
        <div className="settings-row">
          <div className="settings-row__text">
            <div className="settings-row__title">📳 {L.sectionHaptic}</div>
            <div className="settings-row__desc">
              {hapticSupported ? L.hapticDesc : L.hapticUnsupported}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hapticOn}
            disabled={!hapticSupported}
            onClick={toggleHaptic}
            className={`settings-toggle${hapticOn ? ' on' : ''}${!hapticSupported ? ' disabled' : ''}`}
          >
            <span className="settings-toggle__thumb" />
            <span className="settings-toggle__label">{hapticOn ? L.on : L.off}</span>
          </button>
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
  const [langModalOpen, setLangModalOpen] = useState(false)

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
        <button
          className="lang-gear-btn"
          onClick={() => setLangModalOpen(true)}
          aria-label="Language"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
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

      {/* Lang Modal */}
      {langModalOpen && <LangModal onClose={() => setLangModalOpen(false)} />}
    </div>
  )
}
