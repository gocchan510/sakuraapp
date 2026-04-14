# 技術的決定事項ログ

---

## [2026-04] v3 品種エンリッチメント設計

### 決定: LLMエージェントによるウェブ検索（v3）を採用

**背景:**
- v1（ルールベース）はスポット名パターンとpeakMonth推測のみで精度に限界
- v2（Python + DuckDuckGo + キーワードマッチング）を試みたが**偽陽性多発**で廃棄
  - 原因: ページ本文内の「一般的な品種説明」を「そのスポットに植栽」と誤判定
  - 例: 「天都山桜公園」が407品種という異常値に

**v3設計:**
- 29バッチ × 50スポット に分割
- general-purpose エージェントが WebSearch + WebFetch で各スポットを個別調査
- LLMが「そのスポットに明示的に植わっている品種」のみをHIGH/MEDIUMで判定
- エージェントは Read/Write/WebSearch/WebFetch のみ使用（Bash/Python不可）

---

## [2026-04] MEDIUM確信度の採用ルール

### 決定: メジャー品種はMEDIUMでも無条件採用、上限20品種

**背景:**
- 当初: 上限15品種、MEDIUM確信度は上限チェックのみ
- 上限フィルタが厳しすぎて有用な品種情報を大量却下していた

**確定ルール:**
```
HIGH確信度 → 無条件採用
MEDIUM確信度 → メジャー品種は無条件採用、その他は上限20品種まで
```

**MEDIUMで無条件採用するメジャー品種 (MAJOR_VARIETIES):**
someiyoshino, yamazakura, shidarezakura, oshimazakura, ooyamazakura,
higan-zakura, edohigan-zakura, kohigan, kanzan, ichiyou, fugenzou,
ukon, gyoikou, kawaduzakura, kanhizakura, jindai-akebono, yoko,
shirotae, taihaku, amanogawa, kasumizakura 等

---

## [2026-04] 生態的バリデーション

### 決定: 地理的に不可能な品種組み合わせを拒否

| 地域 | 拒否品種 | 理由 |
|------|----------|------|
| 北海道 | カンヒザクラ、カワヅザクラ | 暖地性、北海道では生育不可 |
| 沖縄 | エゾヤマザクラ、チシマザクラ | 寒冷地性 |

---

## [2026-04] データ復元基準点

### 決定: spot_variety_enrichment_log.csv を v1の正規ベースラインとする

**背景:** v2スクリプトがプロセスキル後も動き続け、spots.jsonを汚染した。
正確なv1状態の参照ソースが必要だった。

**運用:** spots.jsonが疑わしい場合は必ずこのCSVから復元してからv3マージを再適用。

---

## [2026-04] ルーター選択

### 決定: HashRouter（BrowserRouterではない）

**理由:** GitHub Pagesは静的配信のため、`/variety/someiyoshino` 等のパスを直接
リクエストすると404になる。`#/variety/someiyoshino` のHash形式で回避。

---

## [2026-04] varieties.json 管理方針

### 決定: varieties.jsonは読み取り専用・追加は都度ユーザー承認

**理由:** 品種データは調査・検証が必要な専門情報。スクリプトによる自動追加は品質リスクがある。
新品種追加（花の会データ等）は都度コミットを分けて管理する。

---

## [2026-04] デプロイフロー

### 決定: ローカルビルド → gh-pages プッシュ（CI不使用）

```bash
npm run build   # tsc && vite build
npm run deploy  # gh-pages -d dist
```

origin/mainへのpushはデプロイとは別管理（git pushは手動）。

---

## [2026-04] PWAインストールバナー

### 決定: CSSを先行追加、JSロジックは別タスク（B-03）

`.install-banner` 等のCSSクラスをApp.cssに追加済み。
`beforeinstallprompt` イベントハンドリング等の実装は次セッションのタスクB-03。

---

## [2026-04] バンドルサイズ

### 決定: 1.8MB警告は現状許容

spots.json + varieties.jsonの静的importが原因。
dynamic import検討はタスクB-04として先送り。PWA的にはキャッシュされるため実用上問題なし。
