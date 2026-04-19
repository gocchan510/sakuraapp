/// <reference lib="webworker" />
// Service Worker for 花見どき
// - precache: Workbox (generateSW 時と同等の挙動)
// - push: web-push 経由の通知表示
// - notificationclick: /#/map?spot=xxx への遷移（既存 MapRoute がクエリを拾う）

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// ── Precache (Vite PWA が注入) ───────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// skipWaiting: 新SWを即時アクティブに。autoUpdate と組み合わせて
// 「ページ開いたら次回読み込みで即反映」を実現する。
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ── Push 通知受信 ────────────────────────────────────────────────────
interface PushPayload {
  title: string
  body: string
  url?: string       // クリック時遷移先（base 相対 or 絶対URL）
  spotId?: string    // 任意: 地図タブで focus させたい spotId
  icon?: string
  badge?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    // 文字列のみのペイロードにもフォールバック
    payload = { title: '🌸 花見どき', body: event.data.text() || '' }
  }

  const baseUrl = '/sakuraapp/'
  const icon = payload.icon || `${baseUrl}icon-192.png`
  const badge = payload.badge || `${baseUrl}icon-192.png`

  const options: NotificationOptions = {
    body: payload.body,
    icon,
    badge,
    tag: payload.tag || 'hanami-doki',
    data: {
      url: payload.url || (payload.spotId ? `${baseUrl}#/map?spot=${encodeURIComponent(payload.spotId)}` : baseUrl),
    },
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

// ── Notification クリック ────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = (event.notification.data || {}) as { url?: string }
  const target = data.url || '/sakuraapp/'

  event.waitUntil(
    (async () => {
      // 既に開いているタブがあればフォーカス + URL 更新
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        // scope 内のタブが既に開いていれば navigate してフォーカス
        if ('focus' in client) {
          try {
            await (client as WindowClient).navigate(target)
            return (client as WindowClient).focus()
          } catch {
            // navigate は同一オリジンのみ。失敗時は openWindow にフォールバック
          }
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
