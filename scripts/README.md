# 桜図鑑スクリプト集

## collect-images.mjs — 品種画像の一括収集

Wikimedia Commons / iNaturalist / GBIF の3ソースから品種ごとに最大3枚の画像を収集し、
`public/images/{variety_id}/01.webp` 形式でローカル保存する。

### 前提

- Node.js 18以上（`fetch` 組み込み必須）
- `sharp` がインストール済み（プロジェクトの devDependencies に含まれる）

```bash
# sharp 未インストールの場合
npm install
```

### 使い方

```bash
# ── テスト（全量実行前に必ず確認） ──────────────────────────────────
# ドライラン: ダウンロードせず検索結果・URLだけ確認
node scripts/collect-images.mjs --dry-run --variety somei-yoshino
node scripts/collect-images.mjs --dry-run --variety kanzan
node scripts/collect-images.mjs --dry-run --variety rokko-kikuzakura

# ── 本番実行 ────────────────────────────────────────────────────────
# 全品種を収集（初回）
node scripts/collect-images.mjs

# 中断した地点から再開
node scripts/collect-images.mjs --resume

# 特定品種のみ再取得（既存ファイルを上書き）
node scripts/collect-images.mjs --variety somei-yoshino

# 特定ソースのみ使用
node scripts/collect-images.mjs --source wikimedia
node scripts/collect-images.mjs --source inaturalist
node scripts/collect-images.mjs --source gbif
```

### 出力ファイル

| パス | 内容 |
|------|------|
| `public/images/{id}/01.webp` | ダウンロードした画像（最大3枚） |
| `scripts/image_progress.json` | 品種ごとの処理状況（再開用） |
| `scripts/image_collection_report.csv` | 品種別取得枚数レポート |

### varieties.json への追加フィールド

収集後、各品種エントリに以下が追加される：

```json
{
  "images": [
    {
      "file": "images/somei-yoshino/01.webp",
      "source": "wikimedia",
      "author": "撮影者名",
      "license": "CC-BY-SA-4.0",
      "originalUrl": "https://commons.wikimedia.org/wiki/File:..."
    }
  ],
  "hasImage": true
}
```

### 所要時間の目安

775品種 × 約9秒/品種 ≒ **約115分**（1時間55分）

`--resume` で中断再開可能なので、複数回に分けて実行してよい。

### ライセンスについて

取得対象: CC0 / CC-BY / CC-BY-SA / CC-BY-NC / Public Domain のみ  
`cc-by-nc` は非商用限定だが、本アプリは非商用のため許容。

### 画像ソースの検索戦略

#### Wikimedia Commons（優先度1）
1. ja.wikipedia の品種記事内の画像を取得（最も品種に直結）
2. en.wikipedia の品種記事内の画像を取得
3. Commons でwikiTitleJaをFile名前空間検索
4. Commons でwikiTitleEnをFile名前空間検索
5. Commons で「品種名 桜」を検索（fallback）

#### iNaturalist（優先度2、Wikimedia で3枚未満の場合）
- `wikiTitleEn` から学名を抽出して観察記録を検索
- quality_grade=research の写真のみ

#### GBIF（優先度3、まだ3枚未満の場合）
- 学名でspecies matchしてusageKeyを取得
- taxonKey でStillImage付きoccurrenceを検索

### トラブルシューティング

**sharのインストールエラー**
```bash
npm install --include=dev
```

**特定品種の画像が見つからない場合**
```bash
# ドライランで検索クエリを確認
node scripts/collect-images.mjs --dry-run --variety {id}

# varieties.json の wikiTitleJa / wikiTitleEn を確認・修正してから再試行
node scripts/collect-images.mjs --variety {id}
```

**200MB超過の警告が出た場合**  
スクリプトが自動的に全WebPをquality=55で再変換する。
