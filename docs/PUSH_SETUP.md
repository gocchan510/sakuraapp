# sakura-push GCP 初期セットアップ手順

Push通知バックエンド `sakura-push` を Cloud Run にデプロイするための手順書。
全てローカル Windows の **git bash** から `gcloud` で実行できる。CloudShell不要。

- **Project**: `mymapbot`
- **Region**: `asia-northeast1`
- **Service**: `sakura-push`

> ✅ ... 印はこの手順で進める際に Claude に教えて欲しい出力（バインドに使うため）

---

## 📋 前提

```bash
# Windowsローカルから（Cloud Shell不要）
gcloud auth login
gcloud config set project mymapbot
gcloud auth application-default login  # SDK経由のFirestoreアクセス用
```

---

## Step 1: GCP API 有効化

```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project=mymapbot
```

---

## Step 2: Firestore DB 作成（Native mode, asia-northeast1）

```bash
gcloud firestore databases create \
  --location=asia-northeast1 \
  --type=firestore-native \
  --project=mymapbot
```

**既に作成済みなら** `ALREADY_EXISTS` エラーが出る。その場合はスキップ。

---

## Step 3: VAPID鍵生成（ローカル）

```bash
cd /c/Users/pcyus/Documents/sakura-app/server
npx web-push generate-vapid-keys
```

出力例：
```
=======================================
Public Key:
BLB...（長い文字列）
Private Key:
x1y2...（長い文字列）
=======================================
```

✅ **両方メモする**（特にPrivate Keyは1度しか表示されない。Public Keyはこの後フロントとCloud Runの両方で使う）

---

## Step 4: Secret Manager に機密データ格納

### 4-1. VAPID Private Key を Secret化

```bash
# 直前のPrivate Keyをコピー貼り付け
echo -n "PASTE_YOUR_VAPID_PRIVATE_KEY_HERE" | \
  gcloud secrets create vapid-private-key \
  --data-file=- \
  --replication-policy=automatic \
  --project=mymapbot
```

### 4-2. Debug API Token を生成・Secret化

```bash
# 32バイトのランダムトークン生成して直接Secret化
openssl rand -hex 32 | tr -d '\n' | \
  gcloud secrets create debug-api-token \
  --data-file=- \
  --replication-policy=automatic \
  --project=mymapbot

# 値を確認（テスト時にcurlで使う）
gcloud secrets versions access latest --secret=debug-api-token --project=mymapbot
```

✅ **出力されたtokenをメモ**（テスト通知送信時に `X-API-Token` ヘッダで使う）

---

## Step 5: Cloud Run 実行SAへの権限付与

Cloud Runはデフォルトで Compute Engine SA で動く。そこにFirestoreとSecret Manager権限を付与。

```bash
PROJECT_NUMBER=$(gcloud projects describe mymapbot --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Compute SA: ${COMPUTE_SA}"

# Firestore読み書き
gcloud projects add-iam-policy-binding mymapbot \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/datastore.user"

# Secret Manager読み取り
gcloud secrets add-iam-policy-binding vapid-private-key \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=mymapbot

gcloud secrets add-iam-policy-binding debug-api-token \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=mymapbot
```

---

## Step 6: 初回手動デプロイ

ローカルでビルドしてから Cloud Run にデプロイ。

```bash
cd /c/Users/pcyus/Documents/sakura-app/server
npm ci
npm run build   # dist/index.js が生成される

# ↓ VAPID_PUBLIC_KEY は Step 3 で出力した公開鍵に置換
gcloud run deploy sakura-push \
  --source . \
  --region=asia-northeast1 \
  --project=mymapbot \
  --platform=managed \
  --allow-unauthenticated \
  --memory=256Mi \
  --cpu=1 \
  --concurrency=80 \
  --max-instances=5 \
  --min-instances=0 \
  --timeout=300 \
  --set-env-vars="VAPID_PUBLIC_KEY=PASTE_YOUR_VAPID_PUBLIC_KEY_HERE,VAPID_SUBJECT=mailto:pc.yusuke.510@gmail.com,GCP_PROJECT_ID=mymapbot,ALLOWED_ORIGINS=https://gocchan510.github.io^,http://localhost:5173" \
  --set-secrets="VAPID_PRIVATE_KEY=vapid-private-key:latest,DEBUG_API_TOKEN=debug-api-token:latest" \
  --quiet
```

> ※ `ALLOWED_ORIGINS` のカンマは `^,` でエスケープ（gcloud の delimiter 衝突回避）

完了後、サービスURLをメモ：
```bash
SERVICE_URL=$(gcloud run services describe sakura-push --region=asia-northeast1 --project=mymapbot --format='value(status.url)')
echo "Service URL: ${SERVICE_URL}"
```

✅ **Service URL教えて**（例: `https://sakura-push-123456-an.a.run.app`）

---

## Step 7: 動作確認

```bash
curl "${SERVICE_URL}/health"
# → {"ok":true,"status":"healthy"}

curl "${SERVICE_URL}/api/debug/ping"
# → {"ok":true,"hasVapid":true,"env":"production"}

curl "${SERVICE_URL}/api/vapid-public-key"
# → {"publicKey":"BLB..."}
```

✅ **3つとも200返ってきたか教えて**

---

## Step 8: Cloud Scheduler ジョブ作成（毎朝8時 JST）

### 8-1. Scheduler呼び出し用SA作成

```bash
gcloud iam service-accounts create scheduler-invoker \
  --project=mymapbot \
  --display-name="Cloud Scheduler invoker for sakura-push"

SCHEDULER_SA="scheduler-invoker@mymapbot.iam.gserviceaccount.com"

# Cloud Run を OIDC で呼び出す権限
gcloud run services add-iam-policy-binding sakura-push \
  --region=asia-northeast1 \
  --project=mymapbot \
  --member="serviceAccount:${SCHEDULER_SA}" \
  --role="roles/run.invoker"
```

### 8-2. Scheduler ジョブ作成

```bash
SERVICE_URL=$(gcloud run services describe sakura-push --region=asia-northeast1 --project=mymapbot --format='value(status.url)')

gcloud scheduler jobs create http sakura-push-daily \
  --location=asia-northeast1 \
  --project=mymapbot \
  --schedule="0 8 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="${SERVICE_URL}/api/cron/notify" \
  --http-method=POST \
  --oidc-service-account-email="${SCHEDULER_SA}" \
  --oidc-token-audience="${SERVICE_URL}" \
  --attempt-deadline="300s"
```

### 8-3. 手動トリガで動作確認

```bash
gcloud scheduler jobs run sakura-push-daily \
  --location=asia-northeast1 \
  --project=mymapbot

# ログ確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sakura-push" \
  --project=mymapbot \
  --limit=20 \
  --format='value(textPayload,httpRequest.requestUrl)'
```

✅ **「/api/cron/notify が200で返って、subscriptionsProcessed が出てる」ことを確認**（購読が0でも200になる）

---

## Step 9: GitHub Actions 用デプロイSA作成

```bash
DEPLOY_SA_NAME="github-actions-deployer"
DEPLOY_SA_EMAIL="${DEPLOY_SA_NAME}@mymapbot.iam.gserviceaccount.com"

gcloud iam service-accounts create ${DEPLOY_SA_NAME} \
  --project=mymapbot \
  --display-name="GitHub Actions deployer for sakura-push"

# デプロイに必要なロール
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/storage.admin \
  roles/cloudbuild.builds.editor \
  roles/logging.viewer ; do
  gcloud projects add-iam-policy-binding mymapbot \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="${ROLE}"
done

# Compute SA に "actAs" 権限（Cloud Runのruntime SAを指定するため）
PROJECT_NUMBER=$(gcloud projects describe mymapbot --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding ${COMPUTE_SA} \
  --project=mymapbot \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

---

## Step 10: Workload Identity Federation セットアップ

```bash
POOL_ID="github-pool"
PROVIDER_ID="github-provider"

# 1. Pool作成
gcloud iam workload-identity-pools create ${POOL_ID} \
  --location=global \
  --project=mymapbot \
  --display-name="GitHub Actions Pool"

# 2. Provider作成（gocchan510/sakuraapp 以外からはアクセス不可）
gcloud iam workload-identity-pools providers create-oidc ${PROVIDER_ID} \
  --project=mymapbot \
  --location=global \
  --workload-identity-pool=${POOL_ID} \
  --display-name="GitHub Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == 'gocchan510/sakuraapp'"

# 3. デプロイSAに WorkloadIdentityUser 権限
PROJECT_NUMBER=$(gcloud projects describe mymapbot --format='value(projectNumber)')

gcloud iam service-accounts add-iam-policy-binding ${DEPLOY_SA_EMAIL} \
  --project=mymapbot \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/gocchan510/sakuraapp"

# 4. GitHub Secrets登録用の値を出力
WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo "==================="
echo "GCP_PROJECT_ID=mymapbot"
echo "GCP_WIF_PROVIDER=${WIF_PROVIDER}"
echo "GCP_SA_EMAIL=${DEPLOY_SA_EMAIL}"
echo "==================="
```

✅ **最後の3行の値を教えて**（GitHub Secretsに登録するため）

---

## Step 11: GitHub Secrets 登録

GitHub の `gocchan510/sakuraapp` リポジトリ → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** から以下3つを登録：

| Name | Value |
|------|-------|
| `GCP_PROJECT_ID` | `mymapbot` |
| `GCP_WIF_PROVIDER` | Step 10 で出力された `projects/.../providers/github-provider` |
| `GCP_SA_EMAIL` | `github-actions-deployer@mymapbot.iam.gserviceaccount.com` |

---

## Step 12: GitHub Actions 自動デプロイ確認

ダミーの変更を commit & push して GH Actions が走ることを確認：

```bash
cd /c/Users/pcyus/Documents/sakura-app
# 軽微な変更をserverに加えてpush
git add server/ docs/ shared/ src/ .github/
git commit -m "feat(server): push notification backend (B-16 PR2)"
git push origin main
```

GitHub Actions タブで `Deploy sakura-push` ワークフローの成功を確認。

または手動実行：
- GitHub リポジトリ → **Actions** → `Deploy sakura-push` → **Run workflow**

✅ **動作OKか教えて**

---

## 🎉 完了

以降、`server/**` `shared/**` `src/data/**` の変更を main に push すると自動デプロイされる。

### 運用コマンド集

```bash
# サービス状態確認
gcloud run services describe sakura-push --region=asia-northeast1 --project=mymapbot

# 最新ログ
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sakura-push" \
  --project=mymapbot --limit=30 --format='value(textPayload)'

# リビジョン一覧
gcloud run revisions list --service=sakura-push --region=asia-northeast1 --project=mymapbot

# 前リビジョンへ手動ロールバック（revisionName は上で確認）
gcloud run services update-traffic sakura-push \
  --region=asia-northeast1 --project=mymapbot \
  --to-revisions=REVISION_NAME=100

# Scheduler を一時停止
gcloud scheduler jobs pause sakura-push-daily --location=asia-northeast1 --project=mymapbot

# Firestore の購読数確認
gcloud firestore export gs://mymapbot.appspot.com/subscriptions-backup --collection-ids=subscriptions --project=mymapbot
```

### トラブルシュート

- **`--source` デプロイ失敗** → Cloud Build のログ: `gcloud builds list --project=mymapbot --limit=3`
- **通知が届かない** → `/api/debug/test-push` で単発テスト（下記）
- **410 Goneで購読消える** → 正常。iOS/Androidでブラウザ側で通知を拒否すると発生

### テスト通知（手動）

```bash
# 自分の購読endpointを取得（ブラウザDevToolsから or Firestore直接）
ENDPOINT="https://fcm.googleapis.com/fcm/send/xxxxx..."
TOKEN=$(gcloud secrets versions access latest --secret=debug-api-token --project=mymapbot)

curl -X POST "${SERVICE_URL}/api/debug/test-push" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: ${TOKEN}" \
  -d "{\"endpoint\":\"${ENDPOINT}\",\"title\":\"テスト\",\"body\":\"届いてる？\"}"
```
