import { useState, useCallback } from 'react'
import { haptic, HapticPattern } from '../utils/haptic'

export const APP_BASE = 'https://gocchan510.github.io/sakuraapp/'

export interface ShareOptions {
  title: string
  text?: string
  url: string
}

export function useShare() {
  const [toast, setToast] = useState(false)

  const share = useCallback(async (opts: ShareOptions) => {
    // Web Share API（主にモバイル）
    if (navigator.share) {
      try {
        await navigator.share(opts)
        haptic(HapticPattern.success)
        return
      } catch (e) {
        // ユーザーがキャンセルした場合は何もしない
        if ((e as DOMException).name === 'AbortError') return
        // それ以外のエラーはクリップボードにフォールバック
      }
    }
    // クリップボードコピー（デスクトップ等）
    try {
      await navigator.clipboard.writeText(opts.url)
      haptic(HapticPattern.success)
      setToast(true)
      setTimeout(() => setToast(false), 2400)
    } catch {
      // clipboard APIも使えない環境（非HTTPS等）では何もしない
    }
  }, [])

  return { share, toast }
}
