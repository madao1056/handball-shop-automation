# Handball Shop - 売上集計自動化システム

Shopifyの注文データから商品ごとの累計売上を自動集計し、メタフィールドに保存するシステムです。

## 機能

- 支払済み注文（`financial_status=paid`）を取得
- 各商品の売上を集計（割引後価格、返金も考慮）
- 商品メタフィールドに累計売上データを保存
- GitHub Actionsで毎日自動実行

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、以下を設定:

```env
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=your-admin-access-token
SHOPIFY_API_VERSION=2025-04
```

### 3. Shopifyカスタムアプリの設定

Shopify管理画面でカスタムアプリを作成し、以下の権限を付与:

- `read_products`
- `write_products` 
- `read_orders`
- `write_product_metafields`

### 4. メタフィールド定義の作成

Shopify管理画面で以下のメタフィールドを作成:

**商品メタフィールド:**
- `stats.lifetime_sales_cents` (整数型)
- `stats.lifetime_sales_amount` (Money型)

## 使用方法

### 動作テスト

```bash
npm run test
```

### 売上集計実行

```bash
npm run aggregate
```

### GitHub Actionsでの自動実行

1. リポジトリのSecretsに以下を設定:
   - `SHOPIFY_SHOP_DOMAIN`
   - `SHOPIFY_ADMIN_ACCESS_TOKEN`
   - `SHOPIFY_API_VERSION`

2. 毎日JST 03:00に自動実行（GitHub Actions）
3. 手動実行も可能（workflow_dispatch）

## ファイル構成

```
handball-shop-automation/
├── scripts/
│   ├── shopify.js       # Shopify GraphQL APIクライアント
│   ├── aggregate.js     # 売上集計・メタフィールド更新
│   └── test.js          # 接続テスト用スクリプト
├── .github/
│   └── workflows/
│       └── daily.yml    # GitHub Actions設定
├── .env.example         # 環境変数テンプレート
├── package.json         # Node.js設定
└── README.md           # このファイル
```

## 処理フロー

1. **注文データ取得**: 支払済み注文を全て取得
2. **売上集計**: 商品ごとに売上を合計（返金も考慮）
3. **メタフィールド更新**: 各商品のメタフィールドに結果を保存
4. **バッチ処理**: 25件ずつバッチでメタフィールドを更新

## 注意事項

- Shopify GraphQL APIのレート制限に配慮した実装
- 返金は注文のline itemに比例配分で各商品に割り当て
- メタフィールドはセンチ単位（整数）とMoney型の両方で保存

## トラブルシューティング

### よくあるエラー

**環境変数が設定されていません**
- `.env` ファイルが正しく作成されているか確認
- 環境変数名に誤字がないか確認

**API接続エラー**
- ショップドメインが正しいか確認
- アクセストークンの有効性を確認
- カスタムアプリの権限設定を確認

**メタフィールド更新エラー**
- Shopify管理画面でメタフィールド定義が作成済みか確認
- メタフィールドの型が正しいか確認（整数型、Money型）