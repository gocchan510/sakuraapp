import { useState } from 'react'
import { useFavorites } from '../contexts/FavoritesContext'
import { haptic, HapticPattern } from '../utils/haptic'
import '../styles/favoriteHeart.css'

type Variant = 'overlay' | 'inline' | 'sheet'

type Props = {
  spotId: string
  variant?: Variant
  /** イベント伝播を止める（カード全体クリックと分離したい時） */
  stopPropagation?: boolean
  size?: number
  className?: string
  ariaLabel?: string
}

/**
 * お気に入りハートボタン
 * - overlay: カード画像左上に重ねる用（影付き円形背景）
 * - inline : 小さいボタン（テキスト並び）
 * - sheet  : ボトムシートヘッダー用（ルート/シェアと並ぶサイズ感）
 */
export function FavoriteHeart({
  spotId,
  variant = 'overlay',
  stopPropagation = true,
  size,
  className,
  ariaLabel,
}: Props) {
  const { isFavorite, toggle } = useFavorites()
  const fav = isFavorite(spotId)
  const [pulse, setPulse] = useState(false)

  function onClick(e: React.MouseEvent | React.TouchEvent) {
    if (stopPropagation) {
      e.stopPropagation()
      ;(e as React.MouseEvent).preventDefault?.()
    }
    const newState = toggle(spotId)
    if (newState) {
      // 追加時のみアニメ＋ハプティック
      haptic(HapticPattern.strong)
      setPulse(false)
      requestAnimationFrame(() => setPulse(true))
      window.setTimeout(() => setPulse(false), 320)
    } else {
      haptic(HapticPattern.light)
    }
  }

  const iconSize = size ?? (variant === 'sheet' ? 14 : variant === 'inline' ? 16 : 18)

  return (
    <button
      type="button"
      className={[
        'fav-heart',
        `fav-heart--${variant}`,
        fav ? 'fav-heart--on' : 'fav-heart--off',
        pulse ? 'fav-heart--pulse' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-pressed={fav}
      aria-label={ariaLabel ?? (fav ? 'お気に入りから外す' : 'お気に入りに追加')}
    >
      <svg
        className="fav-heart__icon"
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={fav ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={fav ? 1.6 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  )
}
