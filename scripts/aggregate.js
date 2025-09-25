/**
 * Shopify売上集計・メタフィールド更新スクリプト
 * 注文データから商品ごとの累計売上を算出し、メタフィールドに保存
 */
const ShopifyGraphQLClient = require('./shopify');
require('dotenv').config();

class SalesAggregator {
  constructor() {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-04';

    if (!shopDomain || !accessToken) {
      throw new Error('環境変数 SHOPIFY_SHOP_DOMAIN と SHOPIFY_ADMIN_ACCESS_TOKEN を設定してください');
    }

    this.client = new ShopifyGraphQLClient(shopDomain, accessToken, apiVersion);
    this.productSales = new Map(); // productId -> { totalCents, refundCents }
  }

  /**
   * 注文データから商品ごとの売上を集計
   */
  async aggregateSales() {
    console.log('注文データを取得中...');
    const orders = await this.client.getAllPaidOrders();
    console.log(`${orders.length} 件の支払済み注文を取得しました`);

    console.log('売上データを集計中...');
    for (const order of orders) {
      await this.processOrder(order);
    }

    console.log(`${this.productSales.size} 個の商品の売上を集計しました`);
    return this.productSales;
  }

  /**
   * 単一の注文を処理
   */
  async processOrder(order) {
    // 注文のline itemsを処理
    for (const lineItemEdge of order.lineItems.edges) {
      const lineItem = lineItemEdge.node;
      const productId = lineItem.variant?.product?.id;
      
      if (!productId) continue;

      const discountedAmount = parseFloat(lineItem.discountedTotalSet.shopMoney.amount);
      const discountedCents = Math.round(discountedAmount * 100);

      if (!this.productSales.has(productId)) {
        this.productSales.set(productId, {
          totalCents: 0,
          refundCents: 0
        });
      }

      const sales = this.productSales.get(productId);
      sales.totalCents += discountedCents;
    }

    // 返金処理
    if (order.refunds && order.refunds.length > 0) {
      await this.processRefunds(order);
    }
  }

  /**
   * 返金を処理
   */
  async processRefunds(order) {
    for (const refund of order.refunds) {
      if (refund.transactions && refund.transactions.edges) {
        for (const transactionEdge of refund.transactions.edges) {
          const transaction = transactionEdge.node;
          if (transaction.kind === 'refund' && transaction.status === 'success') {
            const refundAmount = parseFloat(transaction.amount);
            const refundCents = Math.round(refundAmount * 100);

            // 注文のline itemsから比例配分で返金を各商品に割り当て
            await this.distributeRefund(order, refundCents);
          }
        }
      }
    }
  }

  /**
   * 返金を商品ごとに比例配分
   */
  async distributeRefund(order, totalRefundCents) {
    let totalOrderCents = 0;
    const lineItemAmounts = [];

    // 各line itemの金額を計算
    for (const lineItemEdge of order.lineItems.edges) {
      const lineItem = lineItemEdge.node;
      const productId = lineItem.variant?.product?.id;
      const amount = parseFloat(lineItem.discountedTotalSet.shopMoney.amount);
      const cents = Math.round(amount * 100);
      
      lineItemAmounts.push({ productId, cents });
      totalOrderCents += cents;
    }

    // 各商品に比例配分で返金を割り当て
    if (totalOrderCents > 0) {
      for (const item of lineItemAmounts) {
        if (item.productId && this.productSales.has(item.productId)) {
          const refundRatio = item.cents / totalOrderCents;
          const productRefundCents = Math.round(totalRefundCents * refundRatio);
          
          const sales = this.productSales.get(item.productId);
          sales.refundCents += productRefundCents;
        }
      }
    }
  }

  /**
   * メタフィールドを更新
   */
  async updateMetafields() {
    console.log('商品データを取得中...');
    const products = await this.client.getAllProducts();
    console.log(`${products.length} 個の商品を取得しました`);

    const metafieldUpdates = [];

    for (const product of products) {
      const sales = this.productSales.get(product.id);
      if (!sales) continue;

      const netSalesCents = sales.totalCents - sales.refundCents;
      const netSalesAmount = (netSalesCents / 100).toFixed(2);

      // stats.lifetime_sales_cents (整数型)
      metafieldUpdates.push({
        ownerId: product.id,
        namespace: 'stats',
        key: 'lifetime_sales_cents',
        type: 'number_integer',
        value: netSalesCents.toString()
      });

      // stats.lifetime_sales_amount (Money型)
      metafieldUpdates.push({
        ownerId: product.id,
        namespace: 'stats',
        key: 'lifetime_sales_amount',
        type: 'money',
        value: JSON.stringify({
          amount: netSalesAmount,
          currency_code: 'JPY'
        })
      });

      console.log(`商品: ${product.title} - 累計売上: ${netSalesCents}円 (${netSalesAmount}円)`);
    }

    if (metafieldUpdates.length > 0) {
      console.log(`${metafieldUpdates.length} 個のメタフィールドを更新中...`);
      const results = await this.client.updateProductMetafields(metafieldUpdates);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const result of results) {
        if (result.metafieldsSet.metafields) {
          successCount += result.metafieldsSet.metafields.length;
        }
        if (result.metafieldsSet.userErrors.length > 0) {
          errorCount += result.metafieldsSet.userErrors.length;
        }
      }
      
      console.log(`メタフィールド更新完了: 成功 ${successCount} 件, エラー ${errorCount} 件`);
    } else {
      console.log('更新するメタフィールドがありません');
    }
  }

  /**
   * メイン処理を実行
   */
  async run() {
    try {
      console.log('=== Shopify 売上集計開始 ===');
      console.log(`実行日時: ${new Date().toISOString()}`);
      
      // 売上を集計
      await this.aggregateSales();
      
      // メタフィールドを更新
      await this.updateMetafields();
      
      console.log('=== 売上集計完了 ===');
      
    } catch (error) {
      console.error('エラーが発生しました:', error);
      process.exit(1);
    }
  }
}

// スクリプトが直接実行された場合の処理
if (require.main === module) {
  const aggregator = new SalesAggregator();
  aggregator.run();
}

module.exports = SalesAggregator;