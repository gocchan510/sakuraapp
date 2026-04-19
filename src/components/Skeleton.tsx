// スケルトンローディング（ピンクシマー）
// 使い方:
//   <Skeleton variant="text" width="60%" />
//   <Skeleton variant="circle" width={40} height={40} />
//   <Skeleton variant="rect" height={90} />
//   <SpotCardSkeleton /> <SpotCardSkeletonList count={6} />
//   <WizardCardSkeletonList count={4} />

type Variant = 'rect' | 'text' | 'circle'

interface SkeletonProps {
  variant?: Variant
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ variant = 'rect', width, height, className, style }: SkeletonProps) {
  const cls = `skeleton${variant === 'circle' ? ' skeleton--circle' : ''}${variant === 'text' ? ' skeleton--text' : ''}${className ? ` ${className}` : ''}`
  const s: React.CSSProperties = { ...style }
  if (width !== undefined) s.width = typeof width === 'number' ? `${width}px` : width
  if (height !== undefined) s.height = typeof height === 'number' ? `${height}px` : height
  return <div className={cls} style={s} aria-hidden="true">.</div>
}

// スポットカード用
export function SpotCardSkeleton() {
  return (
    <div className="skeleton-spot-card" aria-hidden="true">
      <div className="skeleton skeleton-spot-card__thumb" />
      <div className="skeleton-spot-card__body">
        <div className="skeleton skeleton-spot-card__line1" />
        <div className="skeleton skeleton-spot-card__line2" />
        <div className="skeleton skeleton-spot-card__line3" />
      </div>
    </div>
  )
}

export function SpotCardSkeletonList({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SpotCardSkeleton key={i} />
      ))}
    </>
  )
}

// ウィザード結果カード用
export function WizardCardSkeleton() {
  return (
    <div className="skeleton-wizard-card" aria-hidden="true">
      <div className="skeleton skeleton-wizard-card__thumb" />
      <div className="skeleton-wizard-card__body">
        <div className="skeleton skeleton--text" style={{ width: '30%' }} />
        <div className="skeleton skeleton--text" style={{ width: '70%', height: 14 }} />
        <div className="skeleton skeleton--text" style={{ width: '50%' }} />
      </div>
    </div>
  )
}

export function WizardCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <WizardCardSkeleton key={i} />
      ))}
    </>
  )
}
