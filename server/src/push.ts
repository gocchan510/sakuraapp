// Web Push 送信ラッパー
import webpush from 'web-push'
import { env } from './env.ts'
import { deleteSubscriptionById } from './firestore.ts'

let initialized = false
function ensureInit() {
  if (initialized) return
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys are not set')
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  initialized = true
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string           // 通知クリック時の遷移先
  tag?: string           // 同タグは最新で置き換えられる
}

export async function sendPush(args: {
  subId: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  payload: PushPayload
}): Promise<{ ok: boolean; gone: boolean; error?: unknown }> {
  ensureInit()
  try {
    await webpush.sendNotification(
      { endpoint: args.endpoint, keys: args.keys },
      JSON.stringify(args.payload),
      { TTL: 60 * 60 * 12 } // 12時間
    )
    return { ok: true, gone: false }
  } catch (e: unknown) {
    const statusCode = (e as { statusCode?: number })?.statusCode
    if (statusCode === 404 || statusCode === 410) {
      // 購読期限切れ・無効 → Firestoreから削除
      await deleteSubscriptionById(args.subId).catch(() => {})
      return { ok: false, gone: true, error: e }
    }
    return { ok: false, gone: false, error: e }
  }
}
