// ── Haptic Feedback Utility ──────────────────────────────────────────────────
// navigator.vibrate ラッパー。iOS Safariは未対応のためsilent skip。
// 設定値はlocalStorageに保存（key: 'haptic_enabled'、デフォルトON）

const STORAGE_KEY = 'haptic_enabled'

let enabled: boolean = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
})()

export function isHapticEnabled(): boolean {
  return enabled
}

export function setHapticEnabled(v: boolean): void {
  enabled = v
  try {
    localStorage.setItem(STORAGE_KEY, v ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * 振動を発火。OFFまたは非対応なら何もしない。
 * @param pattern 単発なら ms、パターンなら配列（振動/停止/振動...）
 */
export function haptic(pattern: number | readonly number[] = 10): void {
  if (!enabled) return
  if (!isHapticSupported()) return
  try {
    navigator.vibrate(pattern as number | number[])
  } catch {
    /* ignore */
  }
}

// ── プリセット ───────────────────────────────────────────────────────────────
export const HapticPattern = {
  light: 5,              // chip ON/OFF、軽いタップ
  medium: 10,            // 一般的な操作
  strong: 15,            // お気に入り追加、スナップ確定
  success: [10, 30, 10], // 共有成功など「やった感」
} as const
