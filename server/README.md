# sakura-push

桜アプリのPush通知バックエンド（Cloud Run）。

## ローカル起動

```bash
cd server
npm install

# 必要な環境変数を設定
export VAPID_PUBLIC_KEY=...
export VAPID_PRIVATE_KEY=...
export VAPID_SUBJECT=mailto:pc.yusuke.510@gmail.com
export DEBUG_API_TOKEN=your-secret
export GCP_PROJECT_ID=mymapbot
# Firestoreエミュレータ不使用時は gcloud auth application-default login 済みであること

npm run dev      # tsx watch
npm run typecheck
npm run build    # esbuild → dist/index.js
```

## エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/health` | Firestore疎通確認 |
| GET | `/api/vapid-public-key` | フロントがsubscribeに使う公開鍵 |
| GET | `/api/debug/ping` | 設定確認（VAPID鍵セット済みかだけ） |
| POST | `/api/subscribe` | 購読登録（upsert） |
| POST | `/api/unsubscribe` | 購読解除 |
| POST | `/api/favorites` | お気に入りリスト更新 |
| POST | `/api/cron/notify` | Cloud Schedulerが毎朝呼ぶ |
| POST | `/api/debug/test-push` | テスト通知（X-API-Token保護） |

## Firestore スキーマ

`subscriptions/{sha256(endpoint)[:32]}`

```ts
{
  id, endpoint, keys: { p256dh, auth },
  lang: 'ja' | 'en' | 'zh-TW',
  favoriteSpotIds: string[],   // 上限50
  lastNotified: { [spotId]: { status, at } },
  createdAt, updatedAt
}
```

## VAPID鍵生成（初回のみ）

```bash
npx web-push generate-vapid-keys
```
