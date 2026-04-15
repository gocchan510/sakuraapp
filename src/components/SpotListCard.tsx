import type { BloomStatus } from '../utils/spotBloom'
import { spotBloomCache, getSortedVarieties } from '../utils/spotBloom'

type Spot = {
  id: string
  name: string
  prefecture: string
  city: string
  lat?: number | null
  lng?: number | null
  varieties?: string[]
  imageUrl?: string | null
}

const BLOOM_DISPLAY: Record<BloomStatus, { label: string; emoji: string; color: string; bg: string }> = {
  in_bloom:   { label: '見頃',    emoji: '🌸', color: '#c2185b', bg: '#fce4ec' },
  budding:    { label: 'もうすぐ', emoji: '🌱', color: '#2e7d32', bg: '#e8f5e9' },
  past_bloom: { label: '散り頃',  emoji: '🍃', color: '#795548', bg: '#efebe9' },
  upcoming:   { label: '時期外',  emoji: '⬜', color: '#9e9e9e', bg: '#f5f5f5' },
  off_season: { label: '時期外',  emoji: '⬜', color: '#9e9e9e', bg: '#f5f5f5' },
}

interface Props {
  spot: Spot
  highlighted?: boolean
  onMapClick: () => void
  onVarietyClick: (id: string) => void
}

export function SpotListCard({ spot, highlighted, onMapClick, onVarietyClick }: Props) {
  const bloom = spotBloomCache.get(spot.id) ?? { status: 'off_season' as BloomStatus, daysScore: 99999 }
  const bd = BLOOM_DISPLAY[bloom.status]

  const sortedVarieties = getSortedVarieties(spot as Parameters<typeof getSortedVarieties>[0])
  const visible = sortedVarieties.slice(0, 3)
  const extra = Math.max(0, sortedVarieties.length - 3)

  return (
    <div className={`spot-list-card${highlighted ? ' spot-list-card--highlighted' : ''}`}>
      {/* サムネイル */}
      <div className="spot-list-card__thumb">
        {spot.imageUrl
          ? <img src={spot.imageUrl} alt={spot.name} className="spot-list-card__img" loading="lazy" />
          : <div className="spot-list-card__img-placeholder">🌸</div>
        }
      </div>

      {/* コンテンツ */}
      <div className="spot-list-card__body">
        <div className="spot-list-card__header">
          <div className="spot-list-card__name-wrap">
            <span className="spot-list-card__pref">{spot.prefecture}</span>
            <h3 className="spot-list-card__name">{spot.name}</h3>
          </div>
          <button
            className="spot-list-card__map-btn"
            onClick={e => { e.stopPropagation(); onMapClick() }}
            aria-label="地図で見る"
          >
            🗺
          </button>
        </div>

        <div className="spot-list-card__city">{spot.city}</div>

        {/* 見頃バッジ */}
        <span
          className="spot-list-card__bloom"
          style={{ color: bd.color, background: bd.bg }}
        >
          {bd.emoji} {bd.label}
        </span>

        {/* 品種バッジ */}
        {visible.length > 0 && (
          <div className="spot-list-card__varieties">
            {visible.map(({ id, variety }) => (
              <button
                key={id}
                className="spot-list-card__variety-chip"
                onClick={e => { e.stopPropagation(); onVarietyClick(id) }}
                style={{
                  borderColor: (variety.colorCode ?? '#FFB7C5') + '90',
                  background:  (variety.colorCode ?? '#FFB7C5') + '22',
                }}
              >
                {variety.name}
              </button>
            ))}
            {extra > 0 && (
              <span className="spot-list-card__variety-more">+{extra}種</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
