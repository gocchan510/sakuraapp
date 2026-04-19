// Web Push subscribe/unsubscribe + VAPID 取得 + Favorites 同期
// バックエンド: sakura-push (Cloud Run)
// env: VITE_PUSH_API_BASE="https://sakura-push-xxxxx-an.a.run.app"

import type { Lang } from '../contexts/LangContext'

// ── 定数 ─────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_PUSH_API_BASE || '').replace(/\/$/, '')

const LS_VAPID = 'sakura_push_vapid_key'
const LS_ENDPOINT = 'sakura_push_endpoint'

// ── 低レベルユーティリティ ────────────────────────────────────────
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Std = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Std)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  retries = 1
): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(input, init)
      if (res.ok) return res
      if (res.status >= 400 && res.status < 500) return res // 4xx はリトライ無意味
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    if (i < retries) await new Promise((r) => setTimeout(r, 400))
  }
  throw lastErr
}

function assertApiBase(): void {
  if (!API_BASE) {
    throw new Error('VITE_PUSH_API_BASE is not configured. Push notifications are disabled.')
  }
}

// ── 対応状況・許可状態 ────────────────────────────────────────────
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export function getNotificationPermission(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission as PushPermissionState
}

export async function requestNotificationPermission(): Promise<PushPermissionState> {
  if (!isPushSupported()) return 'unsupported'
  const result = await Notification.requestPermission()
  return result as PushPermissionState
}

// ── VAPID 公開鍵（localStorageキャッシュ） ───────────────────────
export async function fetchVapidPublicKey(forceRefresh = false): Promise<string> {
  assertApiBase()
  if (!forceRefresh) {
    const cached = localStorage.getItem(LS_VAPID)
    if (cached) return cached
  }
  const res = await fetchWithRetry(`${API_BASE}/api/vapid-public-key`)
  if (!res.ok) throw new Error(`fetchVapidPublicKey: HTTP ${res.status}`)
  const { publicKey } = (await res.json()) as { publicKey: string }
  if (!publicKey) throw new Error('fetchVapidPublicKey: empty publicKey')
  localStorage.setItem(LS_VAPID, publicKey)
  return publicKey
}

// ── 現在の subscription 取得 ─────────────────────────────────────
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// ── subscribe フロー ─────────────────────────────────────────────
export interface SubscribePayload {
  lang: Lang
  favoriteSpotIds: string[]
}

export async function subscribeToPush(payload: SubscribePayload): Promise<PushSubscription> {
  assertApiBase()
  if (!isPushSupported()) throw new Error('push not supported')

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()

  // 既に subscribe 済みならそのまま使う（バックに最新情報を送る）
  let sub = existing
  if (!sub) {
    const vapid = await fetchVapidPublicKey()
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    })
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('subscribe: invalid subscription object')
  }

  const res = await fetchWithRetry(`${API_BASE}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      lang: payload.lang,
      favoriteSpotIds: payload.favoriteSpotIds.slice(0, 50),
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`subscribe: HTTP ${res.status} ${text}`)
  }

  localStorage.setItem(LS_ENDPOINT, json.endpoint)
  return sub
}

// ── unsubscribe ──────────────────────────────────────────────────
export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getCurrentSubscription()
  const endpoint = sub?.endpoint || localStorage.getItem(LS_ENDPOINT)

  // ブラウザ側 unsubscribe（失敗してもバック側削除は試みる）
  if (sub) {
    try {
      await sub.unsubscribe()
    } catch {
      // ignore
    }
  }

  if (endpoint && API_BASE) {
    try {
      await fetchWithRetry(`${API_BASE}/api/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      })
    } catch {
      // サーバ側削除失敗は握りつぶす（410で自動削除されるので致命ではない）
    }
  }

  localStorage.removeItem(LS_ENDPOINT)
}

// ── Favorites 同期（debounce は呼び出し側 Provider で） ──────────
export async function syncFavorites(favoriteSpotIds: string[]): Promise<void> {
  if (!API_BASE) return
  const endpoint = localStorage.getItem(LS_ENDPOINT)
  if (!endpoint) return // subscribe していなければ送らない
  const res = await fetchWithRetry(
    `${API_BASE}/api/favorites`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, favoriteSpotIds: favoriteSpotIds.slice(0, 50) }),
    },
    1
  )
  if (!res.ok && res.status === 404) {
    // サーバ側に subscription が無い = 別端末でunsubscribe等。endpoint をクリア
    localStorage.removeItem(LS_ENDPOINT)
  }
}

// ── 現在の状態サマリ（UI表示用） ──────────────────────────────────
export interface PushStatus {
  supported: boolean
  permission: PushPermissionState
  subscribed: boolean
  apiConfigured: boolean
}

export async function getPushStatus(): Promise<PushStatus> {
  const supported = isPushSupported()
  const permission = getNotificationPermission()
  const sub = supported ? await getCurrentSubscription() : null
  return {
    supported,
    permission,
    subscribed: !!sub,
    apiConfigured: !!API_BASE,
  }
}
