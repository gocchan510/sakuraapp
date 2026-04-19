import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { generateShareCard, shareSpot } from '../utils/shareCard'
import type { ShareCardParams, ShareFormat } from '../utils/shareCard'
import '../styles/shareModal.css'

const STORAGE_KEY = 'sakura_share_format'

const FORMAT_TABS: { key: ShareFormat; label: string; sub: string }[] = [
  { key: 'square', label: '正方形', sub: '1:1' },
  { key: 'x',      label: 'X',      sub: '16:9' },
  { key: 'story',  label: 'Stories', sub: '9:16' },
]

function getInitialFormat(): ShareFormat {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'square' || v === 'x' || v === 'story') return v
  } catch {}
  return 'square'
}

type Props = {
  /** format は内部で付与するため不要 */
  params: Omit<ShareCardParams, 'format'>
  onClose: () => void
}

export function ShareModal({ params, onClose }: Props) {
  const [format, setFormat] = useState<ShareFormat>(getInitialFormat)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const reqIdRef = useRef(0)
  const lastUrlRef = useRef<string | null>(null)

  // format 変更時にプレビュー再生成
  useEffect(() => {
    const id = ++reqIdRef.current
    setLoading(true)
    let cancelled = false

    ;(async () => {
      try {
        const blob = await generateShareCard({ ...params, format })
        if (cancelled || id !== reqIdRef.current) return
        if (blob) {
          const url = URL.createObjectURL(blob)
          // 古いURLを解放
          if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
          lastUrlRef.current = url
          setPreviewUrl(url)
        } else {
          setPreviewUrl(null)
        }
      } catch {
        if (!cancelled) setPreviewUrl(null)
      } finally {
        if (!cancelled && id === reqIdRef.current) setLoading(false)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format])

  // unmount 時に URL 解放
  useEffect(() => {
    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current)
        lastUrlRef.current = null
      }
    }
  }, [])

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      try { localStorage.setItem(STORAGE_KEY, format) } catch {}
      const result = await shareSpot({ ...params, format })
      // 失敗時はモーダル残してリトライさせる
      if (result === 'shared' || result === 'downloaded') {
        onClose()
      }
    } finally {
      setSharing(false)
    }
  }

  // 戻るボタン（Android）/ ESC（デスクトップ）/ body スクロールロック
  useEffect(() => {
    // pushState でダミー履歴を積み、popstate でモーダル閉じる
    const historyMark = { __shareModal: Date.now() }
    try { window.history.pushState(historyMark, '') } catch {}
    let closedByBack = false
    const onPop = () => {
      closedByBack = true
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)

    // body スクロールロック
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // 戻るで閉じた場合は既に履歴が消費済み。通常クローズなら push した履歴を戻す
      if (!closedByBack) {
        try { window.history.back() } catch {}
      }
    }
  }, [onClose])

  return createPortal(
    <div
      className="share-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="share-modal" role="dialog" aria-modal="true" aria-label="共有">
        <div className="share-modal__header">
          <span className="share-modal__title">画像を共有</span>
          <button className="share-modal__close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <div className="share-modal__tabs" role="tablist">
          {FORMAT_TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={format === tab.key}
              className={`share-modal__tab${format === tab.key ? ' active' : ''}`}
              onClick={() => setFormat(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="share-modal__tab-sub">{tab.sub}</span>
            </button>
          ))}
        </div>

        <div className="share-modal__preview-wrap">
          {loading && !previewUrl ? (
            <div className="share-modal__preview-loading">プレビュー生成中…</div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="プレビュー"
              className="share-modal__preview"
              style={loading ? { opacity: 0.6 } : undefined}
            />
          ) : (
            <div className="share-modal__preview-loading">プレビューを生成できませんでした</div>
          )}
        </div>

        <div className="share-modal__footer">
          <button className="share-modal__cancel" onClick={onClose} disabled={sharing}>
            キャンセル
          </button>
          <button
            className="share-modal__share"
            onClick={handleShare}
            disabled={sharing || loading}
          >
            {sharing ? '共有中…' : '共有する'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
