/**
 * テスト・動作確認用スクリプト
 * 環境変数の確認とAPI接続テストを行う
 */
const ShopifyGraphQLClient = require('./shopify');
require('dotenv').config();

async function testConnection() {
  console.log('=== Shopify API 接続テスト ===\n');
  
  // 環境変数チェック
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-04';
  
  console.log('環境変数確認:');
  console.log(`SHOPIFY_SHOP_DOMAIN: ${shopDomain ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`SHOPIFY_ADMIN_ACCESS_TOKEN: ${accessToken ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`SHOPIFY_API_VERSION: ${apiVersion}\n`);
  
  if (!shopDomain || !accessToken) {
    console.error('❌ 必要な環境変数が設定されていません');
    console.log('\n.env ファイルを作成して以下を設定してください:');
    console.log('SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com');
    console.log('SHOPIFY_ADMIN_ACCESS_TOKEN=your-access-token');
    console.log('SHOPIFY_API_VERSION=2025-04');
    return;
  }
  
  try {
    const client = new ShopifyGraphQLClient(shopDomain, accessToken, apiVersion);
    
    // ショップ情報を取得してAPI接続をテスト
    console.log('API接続テスト中...');
    const shopInfoQuery = `
      query {
        shop {
          id
          name
          myshopifyDomain
          currencyCode
          products(first: 5) {
            edges {
              node {
                id
                title
                handle
              }
            }
          }
          orders(first: 5, query: "financial_status:paid") {
            edges {
              node {
                id
                name
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const result = await client.query(shopInfoQuery);
    
    console.log('✅ API接続成功!\n');
    console.log('ショップ情報:');
    console.log(`名前: ${result.shop.name}`);
    console.log(`ドメイン: ${result.shop.myshopifyDomain}`);
    console.log(`通貨: ${result.shop.currencyCode}\n`);
    
    console.log(`商品数: ${result.shop.products.edges.length} 件（最初の5件）`);
    result.shop.products.edges.forEach((edge, index) => {
      console.log(`  ${index + 1}. ${edge.node.title} (${edge.node.handle})`);
    });
    
    console.log(`\n注文数: ${result.shop.orders.edges.length} 件（支払済み・最初の5件）`);
    result.shop.orders.edges.forEach((edge, index) => {
      const order = edge.node;
      console.log(`  ${index + 1}. ${order.name} - ${order.totalPriceSet.shopMoney.amount} ${order.totalPriceSet.shopMoney.currencyCode}`);
    });
    
    console.log('\n=== テスト完了 ===');
    console.log('✅ APIアクセスが正常に動作しています');
    console.log('\n次のステップ:');
    console.log('1. npm run aggregate を実行して売上集計を開始');
    console.log('2. GitHub Actionsの設定でSecretsを追加');
    console.log('3. 定期実行の動作確認');
    
  } catch (error) {
    console.error('❌ API接続エラー:', error.message);
    console.log('\n考えられる原因:');
    console.log('- ショップドメインが間違っている');
    console.log('- アクセストークンが無効または権限不足');
    console.log('- ネットワーク接続の問題');
    console.log('- APIバージョンが対応していない');
  }
}

// スクリプトが直接実行された場合の処理
if (require.main === module) {
  testConnection();
}

module.exports = { testConnection };