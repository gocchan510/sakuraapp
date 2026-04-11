import { useState } from 'react'
import type { Variety } from '../types'
import { useWikiImage } from '../hooks/useWikiImage'

type DetailTab = 'basic' | 'detail'

interface Props {
  variety: Variety
  onBack: () => void
}

export function VarietyDetail({ variety, onBack }: Props) {
  const [tab, setTab] = useState<DetailTab>('basic')
  const imageUrl = useWikiImage(variety.wikiTitleJa, variety.wikiTitleEn)

  const gradientStyle = {
    background: `linear-gradient(160deg, ${variety.colorCode}44 0%, ${variety.colorCode}bb 100%)`,
  }

  return (
    <div className="detail-page">
      {/* Hero image */}
      <div className="detail-hero" style={!imageUrl ? gradientStyle : {}}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={variety.name}
            onError={(e) => {
              const target = e.currentTarget
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) Object.assign(parent.style, gradientStyle)
              const fb = document.querySelector('.detail-hero-fallback') as HTMLElement | null
              if (fb) fb.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="detail-hero-fallback"
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          {variety.emoji}
        </div>
        <button className="detail-back-btn" onClick={onBack}>‹</button>
        <span className="detail-no-badge">No.{variety.no}</span>
      </div>

      {/* Name & tags */}
      <div className="detail-info">
        <div className="detail-name">{variety.name}</div>
        <div className="detail-reading">{variety.reading}</div>
        <div className="detail-tags">
          {variety.tags.map(tag => (
            <span key={tag} className="detail-tag">{tag}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs">
        <button
          className={`detail-tab-btn ${tab === 'basic' ? 'active' : ''}`}
          onClick={() => setTab('basic')}
        >
          基本情報
        </button>
        <button
          className={`detail-tab-btn ${tab === 'detail' ? 'active' : ''}`}
          onClick={() => setTab('detail')}
        >
          詳細
        </button>
      </div>

      {/* Tab content */}
      {tab === 'basic' ? (
        <div className="detail-tab-content">
          <div className="detail-info-row">
            <span className="detail-info-label">開花時期</span>
            <span className="detail-info-value">
              {variety.bloomSeason}
              {variety.bloomPeriod?.secondary && (
                <span className="bloom-secondary-badge" title="二季咲き">🔄</span>
              )}
              {variety.bloomPeriod?.regionNote &&
                !variety.bloomPeriod.regionNote.startsWith('PARSE_ERROR') && (
                <span className="bloom-region-note">📍 {variety.bloomPeriod.regionNote}</span>
              )}
            </span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-label">花の色</span>
            <span className="detail-info-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: variety.colorCode,
                  border: '1.5px solid rgba(0,0,0,0.12)',
                  flexShrink: 0,
                }}
              />
              {variety.color}
            </span>
          </div>
          <div className="detail-info-row">
            <span className="detail-info-label">花の形</span>
            <span className="detail-info-value">{variety.flowerShape}</span>
          </div>
          {variety.rarity && (
            <div className="detail-info-row">
              <span className="detail-info-label">レア度</span>
              <span className="detail-info-value detail-rarity-value">
                <span>
                  <span className="detail-rarity-stars" data-score={variety.rarity.score}>
                    {variety.rarity.stars}
                  </span>
                  <span className="detail-rarity-label">{variety.rarity.label}</span>
                </span>
                {variety.rarity.reasons.length > 0 && (
                  <span className="detail-rarity-reasons">
                    {variety.rarity.reasons.map(r => (
                      <span key={r} className="detail-rarity-reason">{r}</span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="detail-features-text">{variety.features}</div>
        </div>
      ) : (
        <div className="detail-tab-content">
          <div className="detail-section">
            <div className="detail-section-title">
              <span>📜</span> 歴史
            </div>
            <div className="detail-section-text">{variety.history}</div>
          </div>
          <div className="detail-section">
            <div className="detail-section-title">
              <span>🌍</span> 背景
            </div>
            <div className="detail-section-text">{variety.background}</div>
          </div>
          <div className="detail-section">
            <div className="detail-section-title">
              <span>💡</span> トリビア
            </div>
            <div className="detail-section-text">{variety.trivia}</div>
          </div>
        </div>
      )}
    </div>
  )
}
