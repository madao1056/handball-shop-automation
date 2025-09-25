# Shopify売上集計システム - 構築手順書

## 概要
Shopifyの注文データから商品ごとの累計売上を自動集計し、メタフィールドに保存してテーマで表示するシステムの構築手順です。

## システム構成
- **バックエンド**: Node.js + Shopify GraphQL API
- **自動実行**: GitHub Actions（毎日JST 03:00実行）
- **フロントエンド**: Shopify Liquid テンプレート
- **データ保存**: Shopify商品メタフィールド

## 手順1: Shopify側の設定

### 1.1 カスタムアプリの作成
1. Shopify管理画面 → **設定** → **アプリと販売チャネル**
2. **プライベートアプリを開発する** → **カスタムアプリを作成する**
3. アプリ名: `売上集計システム`

### 1.2 API権限の設定
以下の権限を有効化：
- `read_products` ✅
- `write_products` ✅
- `read_orders` ✅

### 1.3 メタフィールド定義の作成
Shopify管理画面 → **設定** → **メタフィールド** → **商品**

**メタフィールド1:**
- 名前空間とキー: `stats.lifetime_sales_cents`
- 型: **整数**
- 説明: 累計売上（セント単位）

**メタフィールド2:**  
- 名前空間とキー: `stats.lifetime_sales_amount`
- 型: **Money**
- 説明: 累計売上（表示用）

### 1.4 アクセストークンの取得
1. **アプリをインストール**
2. **Admin API アクセストークン**をコピーして保存

## 手順2: Node.jsプロジェクトの構築

### 2.1 プロジェクト初期化
```bash
mkdir handball-shop-automation
cd handball-shop-automation
npm init -y
```

### 2.2 依存関係のインストール
```bash
npm install node-fetch dotenv
```

### 2.3 環境変数の設定
`.env` ファイルを作成：
```env
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=your-access-token
SHOPIFY_API_VERSION=2025-04
```

### 2.4 スクリプトファイルの作成

**package.json の scripts セクションを更新:**
```json
{
  "scripts": {
    "aggregate": "node scripts/aggregate.js",
    "test": "node scripts/test.js"
  }
}
```

### 2.5 主要スクリプトファイル

**scripts/shopify.js** - GraphQL APIクライアント
```javascript
class ShopifyGraphQLClient {
  // GraphQLリクエスト処理
  // 商品データ取得（ページネーション対応）
  // 注文データ取得（financial_status=paid）
  // メタフィールド一括更新（25件制限対応）
}
```

**scripts/aggregate.js** - 売上集計メインスクリプト
```javascript
class SalesAggregator {
  // 注文データから商品ごとの売上を集計
  // 返金処理（比例配分）
  // メタフィールド更新
}
```

**scripts/test.js** - 接続テスト
```javascript
// API接続確認
// ショップ情報取得
// 商品・注文データのサンプル取得
```

## 手順3: GitHub Actionsの設定

### 3.1 ワークフローファイルの作成
`.github/workflows/daily.yml`:
```yaml
name: Daily Sales Aggregation

on:
  schedule:
    - cron: '0 18 * * *'  # JST 03:00
  workflow_dispatch:      # 手動実行

jobs:
  aggregate-sales:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
    - run: npm install
    - run: npm run aggregate
      env:
        SHOPIFY_SHOP_DOMAIN: ${{ secrets.SHOPIFY_SHOP_DOMAIN }}
        SHOPIFY_ADMIN_ACCESS_TOKEN: ${{ secrets.SHOPIFY_ADMIN_ACCESS_TOKEN }}
        SHOPIFY_API_VERSION: ${{ secrets.SHOPIFY_API_VERSION }}
```

### 3.2 GitHub Secrets の設定
リポジトリの **Settings** → **Secrets and variables** → **Actions**
- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_API_VERSION`

## 手順4: Shopifyテーマの実装

### 4.1 累計売上サマリーセクション
**sections/sales-summary.liquid**

**重要なポイント:**
```liquid
{%- assign grand_total = 0 -%}

{%- for product in collections[coll].products -%}
  <!-- セント値を取得 -->
  {%- assign cents = product.metafields.stats.lifetime_sales_cents.value | default: 0 -%}
  
  <!-- 合計計算（セント→円変換） -->
  {%- if cents and cents != 0 -%}
    {%- assign amount = cents | divided_by: 100 -%}
    {%- assign grand_total = grand_total | plus: amount -%}
  {%- endif -%}
  
  <!-- 個別商品表示（Money型メタフィールド使用） -->
  {%- if product.metafields.stats.lifetime_sales_amount.value -%}
    {{ product.metafields.stats.lifetime_sales_amount.value | money }}
  {%- endif -%}
{%- endfor -%}

<!-- 合計表示 -->
{{ grand_total | money }}
```

### 4.2 単品売上表示セクション  
**sections/ingle-product-sales.liquid**

**重要なポイント:**
```liquid
<!-- Money型メタフィールドを直接使用 -->
{% if p.metafields.stats.lifetime_sales_amount.value %}
  {% assign money_text = p.metafields.stats.lifetime_sales_amount.value | money %}
{% else %}
  {% assign money_text = nil %}
{% endif %}
```

### 4.3 テンプレートファイル
**templates/page.sales-summary.json**
```json
{
  "sections": {
    "main": {
      "type": "sales-summary",
      "settings": {
        "collection": "sales-summary",
        "title": "累計売上サマリー"
      }
    }
  }
}
```

## 手順5: 動作確認

### 5.1 接続テスト
```bash
npm run test
```
確認項目：
- ✅ 環境変数設定済み
- ✅ API接続成功
- ✅ ショップ情報取得
- ✅ 商品・注文データ取得

### 5.2 売上集計実行
```bash
npm run aggregate
```
確認項目：
- ✅ 支払済み注文の取得
- ✅ 商品ごとの売上集計
- ✅ メタフィールド更新成功

### 5.3 テーマでの表示確認
- 累計売上サマリーページ
- 単品売上表示セクション
- 金額の正確性

## 重要な実装ポイント

### メタフィールドアクセス
```liquid
<!-- ❌ 間違い -->
{{ product.metafields.stats.lifetime_sales_amount | money }}

<!-- ✅ 正しい -->
{{ product.metafields.stats.lifetime_sales_amount.value | money }}
```

### 合計金額の計算方法
1. **個別表示**: Money型メタフィールドを直接使用
2. **合計計算**: セント値を円に変換してから加算
3. **デバッグ**: HTMLコメントで値を確認

### 売上集計の処理フロー
1. **注文取得**: `financial_status=paid` の注文のみ
2. **売上計算**: `discountedTotalSet` から商品ごとに集計
3. **返金処理**: 比例配分で各商品から減算
4. **メタフィールド保存**: セント値（integer）とMoney型の両方

### エラーハンドリング
- GraphQL APIのレート制限対応
- 大量データのページネーション処理
- メタフィールド更新の25件制限対応

## 定期実行の設定

### GitHub Actions
- **自動実行**: 毎日JST 03:00
- **手動実行**: GitHub UIから可能
- **監視**: Actions タブでログ確認

### 運用のベストプラクティス
1. 初回実行は手動で行い、データ精度を確認
2. エラー発生時はログを確認してトラブルシューティング
3. 商品追加時は自動でメタフィールドが作成される
4. 定期的にデータの整合性をチェック

## トラブルシューティング

よくある問題と解決方法は `TROUBLESHOOTING.md` を参照してください。

## 次のステップ

1. **チップ合計の追加**: 注文のtipsAmountも集計対象に追加
2. **期間別集計**: 月次、年次の売上集計機能を追加  
3. **ダッシュボード**: 管理者向けの売上分析画面を作成
4. **通知機能**: 売上目標達成時の通知システム