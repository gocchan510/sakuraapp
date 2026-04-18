// Firestore クライアント＋購読情報のCRUD
import { Firestore, Timestamp, FieldValue } from '@google-cloud/firestore'
import { env } from './env.ts'
import { createHash } from 'crypto'
import type { BloomStatus } from '../../shared/spotBloom.ts'

// preferRest: true → esbuild bundle時の gRPC dynamic require 問題を回避
export const db = new Firestore({ projectId: env.GCP_PROJECT_ID, preferRest: true })

export type Lang = 'ja' | 'en' | 'zh-TW'

export interface Subscription {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  lang: Lang
  favoriteSpotIds: string[]
  lastNotified: Record<string, { status: BloomStatus; at: FirebaseFirestore.Timestamp }>
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
}

const COLLECTION = 'subscriptions'
export const FAVORITE_LIMIT = 50

// subscription.endpoint の sha256 を ID とする（ユニーク・安定）
export function subIdFromEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 32)
}

export async function upsertSubscription(args: {
  endpoint: string
  keys: { p256dh: string; auth: string }
  lang: Lang
  favoriteSpotIds: string[]
}): Promise<string> {
  const id = subIdFromEndpoint(args.endpoint)
  const ref = db.collection(COLLECTION).doc(id)
  const now = Timestamp.now()
  await ref.set(
    {
      id,
      endpoint: args.endpoint,
      keys: args.keys,
      lang: args.lang,
      favoriteSpotIds: args.favoriteSpotIds.slice(0, FAVORITE_LIMIT),
      updatedAt: now,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
  return id
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  const id = subIdFromEndpoint(endpoint)
  await db.collection(COLLECTION).doc(id).delete()
}

export async function deleteSubscriptionById(id: string): Promise<void> {
  await db.collection(COLLECTION).doc(id).delete()
}

export async function updateFavorites(endpoint: string, spotIds: string[]): Promise<void> {
  const id = subIdFromEndpoint(endpoint)
  await db.collection(COLLECTION).doc(id).update({
    favoriteSpotIds: spotIds.slice(0, FAVORITE_LIMIT),
    updatedAt: Timestamp.now(),
  })
}

export async function getSubscription(endpoint: string): Promise<Subscription | null> {
  const id = subIdFromEndpoint(endpoint)
  const doc = await db.collection(COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return doc.data() as Subscription
}

export async function* iterateSubscriptions(): AsyncGenerator<Subscription> {
  const snap = await db.collection(COLLECTION).get()
  for (const doc of snap.docs) {
    yield doc.data() as Subscription
  }
}

export async function updateLastNotified(
  id: string,
  spotId: string,
  status: BloomStatus
): Promise<void> {
  await db.collection(COLLECTION).doc(id).update({
    [`lastNotified.${spotId}`]: { status, at: Timestamp.now() },
    updatedAt: Timestamp.now(),
  })
}
