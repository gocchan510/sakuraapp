// sakura-push Cloud Run エントリポイント
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { env } from './env.ts'
import {
  upsertSubscription,
  deleteSubscription,
  updateFavorites,
  getSubscription,
  FAVORITE_LIMIT,
  type Lang,
} from './firestore.ts'
import { sendPush } from './push.ts'
import { runDailyNotify } from './notify.ts'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (origin) => (origin && env.ALLOWED_ORIGINS.includes(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Token'],
    maxAge: 600,
  })
)

// ── Health ──────────────────────────────────────────────────────
app.get('/health', async (c) => {
  // Firestore 簡易疎通（無購読でもinsertListは成功するのでOK）
  try {
    const { db } = await import('./firestore.ts')
    await db.listCollections()
    return c.json({ ok: true, status: 'healthy' })
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500)
  }
})

// VAPID公開鍵配布（フロントから GET してsubscribeに使う）
app.get('/api/vapid-public-key', (c) => {
  return c.json({ publicKey: env.VAPID_PUBLIC_KEY })
})

app.get('/api/debug/ping', (c) => {
  const hasVapid = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
  return c.json({ ok: true, hasVapid, env: env.NODE_ENV })
})

// ── Subscribe ───────────────────────────────────────────────────
interface SubscribeBody {
  endpoint: string
  keys: { p256dh: string; auth: string }
  lang?: Lang
  favoriteSpotIds?: string[]
}
app.post('/api/subscribe', async (c) => {
  let body: SubscribeBody
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid json' }, 400) }
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return c.json({ error: 'endpoint / keys required' }, 400)
  }
  const lang: Lang = body.lang === 'en' || body.lang === 'zh-TW' ? body.lang : 'ja'
  const favoriteSpotIds = Array.isArray(body.favoriteSpotIds) ? body.favoriteSpotIds : []
  if (favoriteSpotIds.length > FAVORITE_LIMIT) {
    return c.json({ error: `favoriteSpotIds exceeds limit ${FAVORITE_LIMIT}` }, 400)
  }
  const id = await upsertSubscription({
    endpoint: body.endpoint,
    keys: body.keys,
    lang,
    favoriteSpotIds,
  })
  return c.json({ ok: true, id })
})

// ── Unsubscribe ─────────────────────────────────────────────────
app.post('/api/unsubscribe', async (c) => {
  const body = await c.req.json().catch(() => null) as { endpoint?: string } | null
  if (!body?.endpoint) return c.json({ error: 'endpoint required' }, 400)
  await deleteSubscription(body.endpoint)
  return c.json({ ok: true })
})

// ── Favorites update ────────────────────────────────────────────
app.post('/api/favorites', async (c) => {
  const body = await c.req.json().catch(() => null) as { endpoint?: string; favoriteSpotIds?: string[] } | null
  if (!body?.endpoint || !Array.isArray(body.favoriteSpotIds)) {
    return c.json({ error: 'endpoint and favoriteSpotIds required' }, 400)
  }
  if (body.favoriteSpotIds.length > FAVORITE_LIMIT) {
    return c.json({ error: `favoriteSpotIds exceeds limit ${FAVORITE_LIMIT}` }, 400)
  }
  try {
    await updateFavorites(body.endpoint, body.favoriteSpotIds)
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: 'subscription not found' }, 404)
  }
})

// ── Cron: OIDC認証 ──────────────────────────────────────────────
// Cloud Scheduler から OIDC トークン付きで叩く想定。
// Hono 側では Authorization ヘッダの有無＋issuer検証は Cloud Run の IAM で実施するため、
// ここではシンプルに「Cloud Run invoker 権限のある SA からの呼び出し」を信頼する。
// 追加で X-CloudScheduler ヘッダチェックを入れて軽く多層防御。
app.post('/api/cron/notify', async (c) => {
  // Cloud Scheduler は X-CloudScheduler: true ヘッダを付ける。
  // UA は "Google-Cloud-Scheduler" を含む。どちらかが立っていれば許可。
  const hasSchedulerHeader = !!c.req.header('x-cloudscheduler')
  const ua = c.req.header('user-agent') || ''
  const isCloudScheduler = hasSchedulerHeader || ua.includes('Google-Cloud-Scheduler')
  if (!isCloudScheduler && env.NODE_ENV === 'production') {
    return c.json({ error: 'unauthorized' }, 403)
  }
  const result = await runDailyNotify()
  return c.json({ ok: true, ...result })
})

// ── Debug: 自分に向けてテストpushを送る ────────────────────────
app.post('/api/debug/test-push', async (c) => {
  const token = c.req.header('x-api-token') || ''
  if (!env.DEBUG_API_TOKEN || token !== env.DEBUG_API_TOKEN) {
    return c.json({ error: 'forbidden' }, 403)
  }
  const body = await c.req.json().catch(() => null) as { endpoint?: string; title?: string; body?: string } | null
  if (!body?.endpoint) return c.json({ error: 'endpoint required' }, 400)
  const sub = await getSubscription(body.endpoint)
  if (!sub) return c.json({ error: 'subscription not found' }, 404)
  const res = await sendPush({
    subId: sub.id,
    endpoint: sub.endpoint,
    keys: sub.keys,
    payload: {
      title: body.title || '🌸 テスト通知',
      body: body.body || 'これはテストです。桜の開花通知が届きます。',
      icon: 'https://gocchan510.github.io/sakuraapp/icon-192.png',
      badge: 'https://gocchan510.github.io/sakuraapp/icon-192.png',
      url: 'https://gocchan510.github.io/sakuraapp/',
      tag: 'debug-test',
    },
  })
  return c.json(res)
})

// Debug: per-spot variety status
app.get('/api/debug/spot-varieties/:id', async (c) => {
  const token = c.req.header('x-api-token') || ''
  if (!env.DEBUG_API_TOKEN || token !== env.DEBUG_API_TOKEN) {
    return c.json({ error: 'forbidden' }, 403)
  }
  const id = c.req.param('id')
  const { getSpot } = await import('./spotLookup.ts')
  const { varietiesById, getVarietyBloomStatus, computeSpotBloom } = await import('../../shared/spotBloom.ts')
  const { getSomeiyoshinoDate, hasOffsetData } = await import('../../shared/bloomOffset.ts')
  const spot = getSpot(id)
  if (!spot) return c.json({ error: 'not found' }, 404)
  const today = new Date()
  const soDate = (spot.lat && spot.lng && hasOffsetData())
    ? getSomeiyoshinoDate(spot.lat, spot.lng)
    : getSomeiyoshinoDate(35.6895, 139.6917)
  const vs = (spot.varieties ?? []).map(vid => {
    const v = varietiesById.get(vid)
    if (!v) return { id: vid, found: false }
    const status = getVarietyBloomStatus(v.bloomGroup, v.someiyoshinoOffset, soDate, today)
    return { id: vid, name: v.name, bloomGroup: v.bloomGroup, offset: v.someiyoshinoOffset, status }
  })
  return c.json({
    today: today.toISOString(),
    spot: { id: spot.id, name: spot.name, lat: spot.lat, lng: spot.lng },
    someiyoshinoDate: soDate.toISOString(),
    spotBloom: computeSpotBloom(spot, today),
    varieties: vs,
  })
})

const port = env.PORT
console.log(`[sakura-push] listening on :${port}`)
serve({ fetch: app.fetch, port })
