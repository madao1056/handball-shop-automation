# Shopify売上集計システム - トラブルシューティングメモ

## 合計金額の表示方法（解決済み）

### 問題の概要
Shopifyテーマのsales-summary.liquidで累計売上の合計金額が正しく表示されない問題が発生しました。

### 発生した問題
1. **個別商品の金額表示エラー**: `could not convert Metafields::MetafieldDrop into money`
2. **合計金額の計算ミス**: 実際の合計186,670円が1,867円と表示される
3. **単品表示の金額ミス**: 44,000円が440円と表示される

### 根本原因
1. **メタフィールドへのアクセス方法**: `.value`を付けずにメタフィールドにアクセスしていた
2. **データ型の理解不足**: Money型メタフィールドとセント値（integer型）の使い分けができていない
3. **Liquidの数値計算制限**: 大きなセント値の加算でLiquidが正しく処理できない場合がある

### 解決方法

#### 1. メタフィールドアクセスの修正
```liquid
<!-- ❌ 間違い -->
{{ product.metafields.stats.lifetime_sales_amount | money }}

<!-- ✅ 正しい -->
{{ product.metafields.stats.lifetime_sales_amount.value | money }}
```

#### 2. 合計金額の正しい計算方法

**最終的な解決コード:**
```liquid
{%- assign grand_total = 0 -%}

{%- for product in collections[coll].products -%}
  {%- assign cents = product.metafields.stats.lifetime_sales_cents.value | default: 0 -%}
  {%- if cents and cents != 0 -%}
    {%- assign amount = cents | divided_by: 100 -%}
    {%- assign grand_total = grand_total | plus: amount -%}
  {%- endif -%}
  
  <!-- 個別商品表示 -->
  {{ product.metafields.stats.lifetime_sales_amount.value | money }}
{%- endfor -%}

<!-- 合計表示 -->
{{ grand_total | money }}
```

#### 3. 単品商品の表示修正

**ingle-product-sales.liquid の修正:**
```liquid
{% comment %}
セント値を100で割る処理を削除し、Money型メタフィールドを直接使用
{% endcomment %}

{% if p.metafields.stats.lifetime_sales_amount.value %}
  {% assign money_text = p.metafields.stats.lifetime_sales_amount.value | money %}
{% else %}
  {% assign money_text = nil %}
{% endif %}
```

### 重要なポイント・注意事項

#### 1. メタフィールドの型について
- **`stats.lifetime_sales_cents`**: number_integer型（例：4400000セント）
- **`stats.lifetime_sales_amount`**: money型（例：`{"amount":"44000","currency_code":"JPY"}`）

#### 2. Liquidでの金額処理のベストプラクティス
- **個別表示**: Money型メタフィールドを直接使用 `{{ metafield.value | money }}`
- **合計計算**: セント値を円に変換してから加算 `cents | divided_by: 100`

#### 3. デバッグ時の確認ポイント
```liquid
<!-- デバッグコメントを使った値の確認 -->
<!-- セント値 = {{ cents }}, 計算金額 = {{ amount }} -->
<!-- 合計金額 = {{ grand_total }} -->
```

#### 4. よくあるミス
- メタフィールドアクセス時に`.value`を忘れる
- セント値と円の変換を間違える（100で割るのを忘れる、または余計に割る）
- Money型JSONの構造を理解せずに値を取得しようとする

### 売上集計スクリプトとの連携

**Node.js側でのメタフィールド保存形式:**
```javascript
// セント値（整数）
{
  ownerId: product.id,
  namespace: 'stats',
  key: 'lifetime_sales_cents',
  type: 'number_integer',
  value: netSalesCents.toString() // 例: "4400000"
}

// Money型
{
  ownerId: product.id,
  namespace: 'stats', 
  key: 'lifetime_sales_amount',
  type: 'money',
  value: JSON.stringify({
    amount: netSalesAmount, // 例: "44000.00"
    currency_code: 'JPY'
  })
}
```

### 検証方法

#### 1. API側での確認
```bash
cd /Users/hashiguchimasaki/shopify/handball-shop-automation
node scripts/debug.js
```

#### 2. テーマ側での確認
- HTMLコメントでデバッグ情報を確認
- ブラウザの開発者ツールでコメント内の値をチェック

### 今後気をつけるべき点

1. **メタフィールド定義時**: 型を明確に理解してから実装する
2. **Liquid実装時**: `.value`を必ず付ける
3. **数値計算時**: セント⇔円の変換を正確に行う
4. **テスト時**: 個別値と合計値の両方を必ず確認する
5. **デバッグ時**: コメントでの値確認を活用する

### 参考情報

- Shopify GraphQL Admin API: https://shopify.dev/api/admin-graphql
- Liquid テンプレート言語: https://shopify.dev/themes/liquid
- Shopify メタフィールド: https://shopify.dev/apps/metafields