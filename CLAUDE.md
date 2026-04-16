# 桜週末ガイド — CLAUDE.md

> 次のセッションで即作業開始するための情報源。
> 作業前にこのファイルを必ず読むこと。

---

## 1. プロジェクト概要

**アプリ名**: 桜週末ガイド  
**一言説明**: 今週末どこで桜を見ればいい？を答えるPWA  
**本番URL**: https://gocchan510.github.io/sakuraapp/  
**リポジトリ**: https://github.com/gocchan510/sakuraapp  
**デプロイ**: `npm run deploy`（gh-pages → GitHub Pages）

---

## 2. 技術スタック

| 項目 | 内容 |
|------|------|
| フロント | React 18 + TypeScript + Vite |
| ルーター | React Router v6（**HashRouter**） |
| スタイル | 素のCSS（`src/App.css`） |
| 地図 | Leaflet（SakuraMapPage.tsx） |
| PWA | vite-plugin-pwa（autoUpdate, workbox） |
| デプロイ | gh-pages (`npm run deploy`) |
| ベースパス | `/sakuraapp/` |

---

## 3. ディレクトリ構成

```
sakura-app/
├── src/
│   ├── App.tsx               # ルート定義・TabLayout
│   ├── App.css               # 全スタイル（単一ファイル）
│   ├── types.ts              # Spot / Variety 型定義
│   ├── data/
│   │   ├── spots.json        # 1,433スポット（メインデータ）
│   │   ├── varieties.json    # 806品種（読み取り専用）
│   │   ├── bloom-offset.json # 都道府県ごとの開花オフセット
│   │   ├── sakura_status.json
│   │   └── stations.json
│   ├── components/
│   │   ├── VarietyList.tsx   # 図鑑タブ（検索・一覧）
│   │   ├── VarietyDetail.tsx # 品種詳細（タブバーなし）
│   │   ├── SakuraMapPage.tsx # 地図タブ
│   │   ├── SakuraCalendar.tsx# カレンダータブ
│   │   ├── SpotCard.tsx      # スポットカード
│   │   ├── SpotList.tsx      # スポット一覧
│   │   ├── SpotMap.tsx       # Leafletマップ本体
│   │   ├── AllSpotsMap.tsx
│   │   ├── PlanView.tsx
│   │   ├── StationPicker.tsx
│   │   └── TutorialOverlay.tsx
│   ├── hooks/
│   │   └── useWikiImage.ts
│   └── utils/
│       ├── bloomFilter.ts
│       ├── bloomOffset.ts
│       ├── calendarUtils.ts
│       ├── discoveries.ts
│       ├── getWeek.ts
│       ├── sakuraStatus.ts
│       ├── searchNormalize.ts
│       ├── spotsByWeek.ts
│       └── travelTime.ts
├── scripts/                  # データ処理スクリプト（本番無関係）
│   ├── spot_variety_enrichment_log.csv  # v1ベースライン（復元用）
│   ├── deepdive_v3_merge.py            # v3マージスクリプト
│   ├── deepdive_v3_batches/            # バッチ入出力JSON
│   ├── variety_candidates_v3.csv      # 要人間レビューの品種候補
│   ├── unmatched_classified.json      # pattern3の117品種マッチング結果
│   ├── p3_result.json                 # pattern3のmatched/unmatched分割ビュー
│   ├── extracted_batch_results.json   # Batch1-4,6-7のWeb調査結果（抽出済み）
│   ├── new_varieties_kanto.json       # Batch5（関東10品種）の調査結果
│   └── add_new_varieties.py           # varieties.jsonへの56品種一括追加スクリプト
├── docs/
│   ├── DECISIONS.md
│   └── REVIEW_LOG.md
├── CLAUDE.md                 # このファイル
└── vite.config.ts
```

---

## 4. データ構成

### spots.json（1,433件）

```ts
{
  id: string,           // "spot_0001" 等
  name: string,         // スポット名
  prefecture: string,   // 都道府県
  city: string,
  address: string,
  lat: number,
  lng: number,
  varieties: string[],  // 品種IDの配列（enrichmentで付与）
  varietyCount: number,
  varietyNote: string,
  peakMonth: number,    // 1-12
  popularity: number,
  category: string,
  features: string[],
  sources: string[],
  imageUrl: string
}
```

**現在の品種数統計（v3エンリッチメント後）:**
- 平均: 3.21品種/スポット
- 0品種: 0件
- 1品種: 684件
- 2品種: 270件
- 3品種: 158件
- 4品種以上: 321件（22.4%）

### varieties.json（862品種・読み取り専用）

```ts
{
  id: string,           // "someiyoshino" 等（スラッグ）
  no: number,
  name: string,         // 品種名（日本語）
  reading: string,      // ひらがな読み
  bloomSeason: string,
  color: string,
  colorCode: string,
  flowerShape: string,
  tags: string[],
  summary: string,
  features: string,
  history: string,
  background: string,
  trivia: string,
  wikiTitleJa: string,
  wikiTitleEn: string,
  emoji: string,
  bloomPeriod: { start: string, end: string },
  images: string[],
  hasImage: boolean,
  rarity: string,
  spots: string[]       // このファイルはspots.jsonとは独立管理
}
```

> **重要**: varieties.jsonは原則読み取り専用。新品種追加は慎重に（ユーザー承認必須）。

### varieties.json 品種追加履歴

| バージョン | 件数 | 内容 |
|-----------|------|------|
| 初期 | 806 | オリジナルデータ |
| v3エンリッチ後 | 806 | spots.json品種付与のみ（varieties.json変更なし） |
| **B-01完了（2026-04）** | **862** | **Walker+アンマッチ品種56種を追加（no.960〜1015）** |

**B-01で追加した品種（56種）:**
- 野生種・亜種: シウリザクラ, ヤブザクラ, マメザクラ, カスミザクラ, ノムラベニヤマザクラ
- 松前・弘前系: 南殿桜, 青葉枝垂, 魁桜, 金剛桜, 松前あこや山錦, 大枝垂れ, 白糸枝垂れ
- 弘前公園・山形固有: 紅芳遊, 衣縫, 西山エドヒガン, おとぎ桜, 康寿ざくら, 家昌桜
- 東北固有: 大河原紅桜, おおがわら千年桜, 鹽竈桜, 駒見桜, 神代桜（会津美里）
- 関東固有: 元朝桜, 駿河桜, 駿河小町, ワシントンザクラ, 祐天桜, シドモア桜, ショウカワザクラ, ヤナイヅタカクワホシザクラ, 大磯小桜, タマノホシザクラ
- 中部・東海: 誓願桜, 小諸八重紅しだれ, 土肥桜, あらさわ紅桜, おおぐち観鋭桜, 江戸彼岸大島, 劫初の桜, 笹目桜（ササメザクラ）, 笹目桜（ヨウヘイ）, 春月花
- 京都・九州他: 御会式桜, 渓仙桜, 観音桜, 千眼桜, ギオンシダレ, ヒョウタンザクラ, 紅八重枝垂桜, ミョウヨウジザクラ, オモイカワザクラ, 福聚桜, ニドザキザクラ, 秋色桜, 知恵桜

**除外・統合した品種:**
- 非桜: テルテモモ（花桃）, 魯桃桜（Prunus davidiana）
- 既存IDへ統合: 行仙→gyoikou, 大東陳→ojochin, エゾヒガンザクラ→edohigan-zakura, 蝦夷桜（懐古園）→ezoyamazakura
- エイリアス追加のみ: ガンタンザクラ→kanhizakura の aliases[] に追加済み

---

## 5. ルート構成

### 現状（実装済み）

| パス | コンポーネント | タブバー |
|------|--------------|--------|
| `/` | ZukanRoute → VarietyList | あり |
| `/map` | MapRoute → SakuraMapPage | あり |
| `/calendar` | SakuraCalendar | あり |
| `/variety/:id` | VarietyDetailRoute → VarietyDetail | なし |
| `*` | Navigate to `/` | - |

- **HashRouter使用**（GitHub Pages静的配信のため）
- `usePreventBackOnRoot()`：トップで戻るボタンを押してもアプリが閉じない

### B-10実装後（スポットタブ追加）

| パス | コンポーネント | タブバー |
|------|--------------|--------|
| `/map` | MapRoute → SakuraMapPage | あり |
| `/spots` | SpotListPage（新規） | あり |
| `/calendar` | SakuraCalendar | あり |
| `/` | ZukanRoute → VarietyList | あり |
| `/variety/:id` | VarietyDetailRoute → VarietyDetail | なし |
| `*` | Navigate to `/map` | - |

**タブ順**: 地図 → スポット → カレンダー → 図鑑（左から右）  
**デフォルト表示**: `/map`（アプリ起動時は地図タブ）

---

## 6. 品種エンリッチメントの仕組み

### v1（ルールベース・完了）
- スポット名パターン + peakMonth推定で品種付与
- ログ: `scripts/spot_variety_enrichment_log.csv`（1,432行）
- **これが復元基準点**。spots.jsonが壊れた場合はここから復元。

### v3（LLMウェブ検索・完了）
- 29バッチ × 50スポット、WebSearch+WebFetch でエージェントが品種を調査
- HIGH確信度 → 無条件採用
- MEDIUM確信度 → メジャー品種は無条件採用、その他は上限20品種まで
- 生態的バリデーション：北海道+カンヒザクラ、沖縄+エゾヤマザクラ 等を拒否
- マージスクリプト: `scripts/deepdive_v3_merge.py`
- バッチ結果: `scripts/deepdive_v3_batches/result_000.json` 〜 `result_028.json`

### spots.json 復元手順（緊急時）
```bash
# 1. v1状態に戻す
python scripts/restore_v1.py  # または手動でCSVからリストア

# 2. v3マージ再適用
python scripts/deepdive_v3_merge.py
```

---

## 7. ビルド・デプロイ

```bash
# 開発
npm run dev

# ビルド
npm run build   # tsc && vite build → dist/

# デプロイ（GitHub Pages）
npm run deploy  # gh-pages -d dist → gocchan510.github.io/sakuraapp/
```

> **注意**: `npm run build` で 1.8MB チャンク警告が出るが現状許容。

---

## 8. 作業モードのルール

| モード | 概要 | 注意 |
|--------|------|------|
| **調査** | 実装前の情報収集・影響範囲確認 | コード変更しない |
| **実装** | コード変更・データ更新 | 1タスク完了後に必ずビルド確認 |
| **レビュー** | 変更内容の確認・品質チェック | REVIEW_LOG.mdに記録 |

---

## 9. セッション運用ルール

1. **1セッション1タスク**: 1つのタスクを完結させてからコミット
2. **完了後の報告**: 「完了。次タスク候補: ◯◯」で終了
3. **コミット粒度**: 論理的に独立した変更ごと（データ/コード/スクリプトを分離）
4. **spots.json変更前**: 必ずv1ログからの復元手順を確認してから作業
5. **varieties.json**: 直接編集禁止。追加は必ずユーザー承認を得てから

---

## 10. タスクバックログ（優先度順）

### 高優先度

| # | タスク | 詳細 |
|---|--------|------|
| ~~B-01~~ | ~~unmatched品種の新規追加検討~~ | **完了（2026-04）** 56品種追加、varieties.json 806→862件 |
| B-02 | variety_candidates_v3.csvの人間レビュー | MEDIUM却下ログの内容確認（現状0件だが将来用） |
| B-03 | PWAインストールバナー実装 | App.cssにスタイルは追加済み。JSロジック（beforeinstallpromptイベント等）が未実装の可能性あり |
| ~~B-10~~ | ~~スポットタブ新規実装~~ | **完了（2026-04）** SpotListPage・SpotListCard実装、bloomキャッシュ・時刻バグ修正済み |
| ~~B-11~~ | ~~3タップおすすめウィザード~~ | **完了（2026-04）** RecommendWizard実装、地図タブFABから起動 |
| **B-12** | **bloomGroup全体リファクタリング** | **仕様確定済み（下記参照）。実装中** |

### 中優先度

| # | タスク | 詳細 |
|---|--------|------|
| B-04 | バンドルサイズ削減 | spots.json + varieties.jsonが巨大。dynamic import検討 |
| B-05 | 品種詳細ページ: 関連スポット地図表示 | VarietyDetailからそのスポットを地図で見られる機能 |
| B-06 | 開花カレンダー精度向上 | bloom-offset.jsonの見直し・実績データ反映 |

### 低優先度

| # | タスク | 詳細 |
|---|--------|------|
| B-07 | i18n対応 | `src/i18n/` ディレクトリあり。英語化の可能性 |
| B-08 | Lighthouseスコア改善 | lighthouse-report.json確認済み |
| B-09 | 検索UX改善 | 現状1文字からインクリメンタル検索。読み仮名・エイリアス対応強化 |

---

---

## 11. B-10 スポットタブ 仕様書（確定）

### 概要
スポット一覧を閲覧できる新タブ `/spots`。図鑑タブと似たUXで、地図・図鑑との連携を重視。

### カード表示
```
┌─────────────────────────────────┐
│ [画像]  🌸 弘前公園          🗺 │  ← 🗺 で地図タブへ（/map?spot=xxx）
│         青森県弘前市            │
│                                  │
│  ████████░░░░  見頃 🟢          │  ← 見頃バー（後述）
│                                  │
│  [染井吉野] [枝垂桜] +5種       │  ← 品種バッジ → タップで図鑑へ
└─────────────────────────────────┘
```
- 画像: `spot.imageUrl` がある場合は表示（精度不問）
- 品種バッジ: 見頃が近い順 → レア度高い順、超過分は `+N種`
- 🗺ボタン: `/map` に `location.state = { focusSpotId }` で遷移

### 見頃表示ロジック
- **計算ベース**: スポットの `varieties[]` → 各品種の `bloomPeriod` を参照
- **代表値**: 最も見頃に近い品種の状態をスポット全体の状態とする
- **4段階ラベル**: 🟢 見頃 / 🟡 もうすぐ / 🔴 散り頃 / ⚪ 時期外
- 地域オフセットは `bloomOffset.ts` の `getTotalOffset(lat, lng)` を使用

### フィルタ・ソート
| 機能 | 仕様 |
|------|------|
| 見頃フィルタ | 🟢見頃 / 🟡もうすぐ / 🔴散り頃 / ⚪時期外 の横スクロールチップス |
| 都道府県 | ドロップダウン（47都道府県） |
| ソート | 見頃が近い順 → 人気順（デフォルト）/ 人気順 / 距離順 |
| 検索 | スポット名 + 都道府県名 + 市区町村名を対象 |
| 状態保持 | タブを離れて戻っても絞り込み状態を維持 |

### 表示パフォーマンス
- 初期50件表示 + 無限スクロール（Intersection Observer）

### 距離順ソート
- 選択時に自前Geolocationダイアログを表示して位置情報を取得
- 拒否・失敗時は人気順にフォールバック

### 地図連携（SakuraMapPage改修も必要）
- スポットカードの 🗺 → `navigate('/map', { state: { focusSpotId: spot.id } })`
- SakuraMapPage のポップアップに「📋 スポット一覧で見る」ボタンを追加
  - クリックで `navigate('/spots', { state: { highlightSpotId: spot.id } })`

### 図鑑連携
- 品種バッジタップ → `navigate('/variety/:id')`

### スポット詳細ページ
- **今回は実装しない**（将来 `/spots/:id` として追加予定）

### 新規作成ファイル
- `src/components/SpotListPage.tsx` — スポットタブのメインコンポーネント
- `src/components/SpotListCard.tsx` — スポット一覧用カード（既存SpotCardとは別）

### 既存ファイルの改修
- `src/App.tsx` — タブ順変更、`/spots` ルート追加、デフォルト `*` を `/map` に変更
- `src/components/SakuraMapPage.tsx` — ポップアップに「スポット一覧で見る」追加
- `src/App.css` — スポットタブ用スタイル追加

---

## 13. B-11 おすすめウィザード 仕様書（確定）

### 概要
地図タブのフローティングボタンから起動する3ステップウィザード。
Q1〜Q3に答えるとおすすめスポットを最大20件表示（ウィザード内のStep4として表示）。

### 配置
- 地図タブ（SakuraMapPage）にフローティングボタン「✨ おすすめを探す」を追加
- クリックでウィザードモーダルを開く
- 新規ファイル: `src/components/RecommendWizard.tsx`

### Q1: いつ行く？
| 選択肢 | フィルタ条件 |
|--------|------------|
| 今日 | `in_bloom` のみ |
| 今週末 | `in_bloom` + `budding`（daysScore ≤ 7） |
| 来週以降 | `budding`（daysScore > 7）|

「来週以降」を選んだ場合、結果の各スポットカードに信頼度★を表示。

### Q2: こだわりは？（複数選択・AND条件）
| チップ | フィルタ条件 |
|--------|------------|
| 🌙 夜桜 | `features` に `ライトアップ` or `夜桜` |
| 🎪 屋台 | `features` に `屋台あり` or `桜祭り` |
| 🅿️ 駐車場あり | `features` に `駐車場あり` |
| 💎 穴場 | `varietyCount > 3` かつ `popularity ≤ 2` |
| 🌸 品種が多い | `varietyCount > 3` |

複数選択はAND（全条件を満たすスポットのみ）。選択なしは全件対象。

### Q3: どうやって行く？
| 選択肢 | 条件 |
|--------|------|
| 🚶 歩いて行ける | 現在地から直線2km以内 |
| 🚃 電車で1時間以内 | 現在地から直線50km以内 |
| 🚗 車で1時間以内 | 現在地から直線80km以内 |
| 🎒 日帰り旅行 | 距離制限なし |

- 歩いて/電車/車を選んだ場合はGeolocationダイアログ表示
- 取得した位置情報はlocalStorageに保存（有効期限1ヶ月）
- 拒否・失敗時は「日帰り旅行」にフォールバック

### 結果表示（Step4）
- 上位20件を人気順で表示
- 各スポットはSpotListCardに近いカードUIで表示
- 「地図で見る」ボタン → `/map?spot=xxx` で地図タブへ遷移
- Q1で「来週以降」を選んだ場合のみ、各カードに信頼度★表示

### 信頼度計算（来週以降のみ）
bloom-offset.jsonのデータ品質に基づく：
- ★★★★★（5）: スポットから200km以内にobservedデータあり
- ★★★☆☆（3）: 200km超にobservedデータあり
- ★☆☆☆☆（1）: observedデータなし（平年値のみ）

### 新規作成ファイル
- `src/components/RecommendWizard.tsx` — ウィザード本体
- `src/styles/wizard.css` — ウィザード用スタイル

### 既存ファイルの改修
- `src/components/SakuraMapPage.tsx` — フローティングボタン追加・ウィザード組み込み

---

## 14. B-12 bloomGroup全体リファクタリング 仕様書（確定）

### 背景・目的
現行の `bloomPeriod: { start: "04-mid", end: "05-early" }` は旬（10日）単位で粗すぎ、AI推定精度も低い。
**ソメイヨシノ基準の相対オフセット**に一本化することで、bloom-offset.jsonの実測データを最大限に活用する。

### 基本設計

```
品種の開花日 = ソメイヨシノ開花日(地点) + bloomGroup.offset日
```

- ソメイヨシノ開花日(地点) = 東京平年値(3/24) + getTotalOffset(lat,lng).totalOffset
- これにより地域差・今年のズレを自動適用
- `bloomPeriod` フィールドは **完全廃止**（types.tsから削除）

### bloomGroups定義（src/data/bloomGroups.json）

| グループキー | 系統 | ソメイヨシノ比（開花開始） | 開花期間 |
|------------|------|------------------------|--------|
| `kanhizakura` | カンヒザクラ系・河津桜 | −55日（min-60, max-50） | 21日 |
| `edohigan` | エドヒガン・シダレ系 | −8日（min-10, max-7） | 14日 |
| `someiyoshino` | ソメイヨシノ | 0日（min-2, max+2） | 14日 |
| `yamazakura` | ヤマザクラ・オオシマ系 | +5日（min+3, max+7） | 14日 |
| `kasumizakura` | カスミザクラ・遅咲き野生種 | +12日（min+10, max+15） | 14日 |
| `sato-early` | サトザクラ早咲き（ウコン・御衣黄） | +9日（min+7, max+12） | 18日 |
| `sato-mid` | サトザクラ標準（関山・普賢象） | +15日（min+13, max+18） | 18日 |
| `sato-late` | サトザクラ遅咲き（松月・楊貴妃） | +22日（min+19, max+25） | 18日 |
| `fuyu` | 二季咲き（十月桜・不断桜）| 春:0〜−5日 | 例外処理 |
| `unknown` | 分類不明 | フォールバック → off_season | - |

### varieties.jsonの変更

```diff
- "bloomPeriod": { "start": "04-mid", "end": "05-early" }
+ "bloomGroup": "sato-mid"
+ "someiyoshinoOffset": null   // 個別研究済みの場合のみ数値（任意フィールド）
```

- `bloomGroup` : 全862品種に必須
- `someiyoshinoOffset` : 個別に実測値がある場合のみ設定。nullならグループ中央値を使用

### 分類方法

Python スクリプト `scripts/assign_bloom_groups.py` で半自動化：
1. tags・name・既存bloomPeriod を元にルールベースで分類
2. サトザクラ系の早/中/遅 細分類は既存bloomPeriod.startを利用（移行後に削除）
3. 分類不明は `unknown` → 手動確認推奨

### 二季咲き（fuyu）の例外処理

- **春の開花**：通常計算（ソメイヨシノ±0〜−5日）
- **秋の開花**：bloomGroupsに `secondaryBloom: { startMonth, startDay, endMonth, endDay }` で固定定義
- 10月〜11月の期間は別途ハードコード判定

### 計算エンジンの変更（bloomOffset.ts）

新規エクスポート：
```ts
getSomeiyoshinoDate(lat, lng, year): Date
// 東京平年値(3/24) + totalOffset → その地点の今年のソメイヨシノ開花日

getVarietyBloomWindow(bloomGroup, someiyoshinoOffset, someiyoshinoDate): { start: Date, end: Date } | null
// start = someiyoshinoDate + offset - duration/2
// end   = someiyoshinoDate + offset + duration/2
```

旧関数（`adjustBloomPeriod`, `isInBloomAdjusted`）は削除。

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/data/bloomGroups.json` | **新規作成** |
| `src/data/varieties.json` | bloomGroup追加・bloomPeriod削除 |
| `src/types.ts` | Variety型の bloomPeriod削除・bloomGroup追加 |
| `src/utils/bloomOffset.ts` | 新計算関数追加・旧関数削除 |
| `src/utils/spotBloom.ts` | 新エンジン対応 |
| `src/components/SakuraCalendar.tsx` | buildPeriodMap を新エンジンで書き直し |
| `src/components/SakuraMapPage.tsx` | bloom計算を新エンジンに切り替え |
| `scripts/assign_bloom_groups.py` | **新規作成**（分類スクリプト） |

---

## 15. B-13 カレンダー都道府県フィルタ 仕様書（確定）

### 概要
カレンダータブに都道府県フィルタを追加。選択した都道府県の開花タイミングと品種一覧を表示する。

### UI
- ドロップダウン（`<select>`）で都道府県選択
- 初期値: 現在地から自動検出（後述）
- 「全国（東京基準）」オプションを先頭に追加（フォールバック兼リセット用）

### 動作
| 変更内容 | 詳細 |
|---------|------|
| ソメイヨシノ基準日 | 選択都道府県の代表座標で `getSomeiyoshinoDate(lat, lng)` を再計算 |
| 表示品種 | `prefectureVarieties.json` で該当都道府県に登録されている品種のみ |
| カレンダーの旬マッピング | 上記2つで `buildPeriodMap()` を再計算 |

### 位置情報からの都道府県特定
1. Geolocation API で lat/lng 取得
2. `bloom-offset.json` の `prefecture` フィールドで最寄り地点の都道府県名を特定
3. その都道府県をドロップダウンの初期値にセット
4. 位置情報 → `sakura_wizard_geo` キャッシュを流用（有効期限1ヶ月）
5. 取得失敗時は「全国（東京基準）」にフォールバック

### prefectureVarieties.json の生成方法
- `scripts/generate_prefecture_varieties.py` で自動生成
- spots.json の品種×都道府県を集計してベース作成
- ソメイヨシノ・ヤエザクラ（関山・普賢象）・シダレザクラなど主要品種は全47都道府県に必ず含める
- 将来手動で追加・修正していく想定

### 代表座標（都道府県 → lat/lng）
bloom-offset.json の地点データから都道府県ごとに最初に見つかった地点の座標を使用。
なければ都道府県庁の座標をハードコードしたフォールバックを用意。

### 新規作成ファイル
- `src/data/prefectureVarieties.json` — 都道府県×品種IDリスト
- `scripts/generate_prefecture_varieties.py` — 生成スクリプト

### 既存ファイルの改修
- `src/components/SakuraCalendar.tsx` — ドロップダウン追加・`buildPeriodMap` をuseMemoに変換

---

## 12. 既知の問題・注意事項

- `src/App.tsx` の `<Routes>` が `<>...</>` で囲まれているが、現状機能上の問題なし
- `scripts/deepdive_enrich.py.DISABLED` は v2の失敗スクリプト。絶対に実行しないこと
- WorkboxのprecacheからJS(1.8MB)が除外されている（maximumFileSizeToCacheInBytes超過）
