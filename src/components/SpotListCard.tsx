import { useState } from 'react'
import type { BloomStatus } from '../utils/spotBloom'
import { spotBloomCache, getSortedVarieties } from '../utils/spotBloom'
import { useLang } from '../contexts/LangContext'
import { FavoriteHeart } from './FavoriteHeart'

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

const BLOOM_COLORS: Record<BloomStatus, { color: string; bg: string; emoji: string }> = {
  in_bloom:   { emoji: '🌸', color: '#c2185b', bg: '#fce4ec' },
  opening:    { emoji: '🌷', color: '#e91e63', bg: '#fce4ec' },
  falling:    { emoji: '🍃', color: '#795548', bg: '#efebe9' },
  leaf:       { emoji: '🌿', color: '#558b2f', bg: '#f1f8e9' },
  budding:    { emoji: '🌱', color: '#2e7d32', bg: '#e8f5e9' },
  upcoming:   { emoji: '⬜', color: '#9e9e9e', bg: '#f5f5f5' },
  off_season: { emoji: '⬜', color: '#9e9e9e', bg: '#f5f5f5' },
}

interface Props {
  spot: Spot
  highlighted?: boolean
  onMapClick: () => void
  onVarietyClick: (id: string) => void
}

export function SpotListCard({ spot, highlighted, onMapClick, onVarietyClick }: Props) {
  const { t, tSpot, lang } = useLang()
  const statusStr = t('status')
  const spotsStr = t('spots')
  const mapStr = t('map')

  const ts = tSpot(spot)
  const bloom = spotBloomCache.get(spot.id) ?? { status: 'off_season' as BloomStatus, daysScore: 99999, someiyoshinoStatus: 'off_season' as BloomStatus }
  const bc = BLOOM_COLORS[bloom.status]
  const bloomLabel = statusStr[bloom.status as keyof typeof statusStr] ?? statusStr.off_season

  const sortedVarieties = getSortedVarieties(spot as Parameters<typeof getSortedVarieties>[0])
  const visible = sortedVarieties.slice(0, 3)
  const extra = Math.max(0, sortedVarieties.length - 3)

  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div className={`spot-list-card${highlighted ? ' spot-list-card--highlighted' : ''}`}>
      {/* サムネイル */}
      <div className="spot-list-card__thumb">
        {spot.imageUrl ? (
          <>
            {!imgLoaded && <div className="skeleton skeleton--img" aria-hidden="true" />}
            <img
              src={spot.imageUrl}
              alt={spot.name}
              className="spot-list-card__img"
              loading="lazy"
              style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.25s' }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="spot-list-card__img-placeholder">🌸</div>
        )}
        <FavoriteHeart spotId={spot.id} variant="overlay" />
      </div>

      {/* コンテンツ */}
      <div className="spot-list-card__body">
        <div className="spot-list-card__header">
          <div className="spot-list-card__name-wrap">
            <span className="spot-list-card__pref">{ts.prefecture}</span>
            <h3 className="spot-list-card__name">{ts.name}</h3>
          </div>
          <button
            className="spot-list-card__map-btn"
            onClick={e => { e.stopPropagation(); onMapClick() }}
            aria-label={spotsStr.mapBtn}
          >
            🗺
          </button>
        </div>

        <div className="spot-list-card__city">{ts.city}</div>

        {/* 見頃バッジ */}
        <span
          className="spot-list-card__bloom"
          style={{ color: bc.color, background: bc.bg }}
        >
          {bc.emoji} {bloomLabel}
        </span>

        {/* ソメイヨシノ指標 */}
        {bloom.someiyoshinoStatus !== 'off_season' && (() => {
          const soStatus = bloom.someiyoshinoStatus as string
          const soLabelMap = mapStr.soLabel as Record<string, string>
          const soLabel = soLabelMap[soStatus]
          if (!soLabel) return null
          const soName = lang === 'en' ? 'Somei Yoshino' : lang === 'zh-TW' ? '染井吉野' : 'ソメイヨシノ'
          return <div className="spot-someiyoshino-ref">🌸 {soName}: {soLabel}</div>
        })()}

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
              <span className="spot-list-card__variety-more">+{extra}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
