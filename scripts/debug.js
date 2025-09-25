/**
 * メタフィールドのデバッグスクリプト
 * 特定の商品のメタフィールド値を詳しく確認
 */
const ShopifyGraphQLClient = require('./shopify');
require('dotenv').config();

async function debugMetafields() {
  console.log('=== メタフィールドデバッグ ===\n');
  
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-04';
  
  const client = new ShopifyGraphQLClient(shopDomain, accessToken, apiVersion);
  
  try {
    // 特定の商品のメタフィールドを確認
    const query = `
      query {
        products(first: 10) {
          edges {
            node {
              id
              title
              handle
              metafields(first: 250, namespace: "stats") {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const result = await client.query(query);
    
    console.log('商品とメタフィールドの詳細:');
    for (const productEdge of result.products.edges) {
      const product = productEdge.node;
      console.log(`\n商品: ${product.title} (${product.handle})`);
      console.log(`ID: ${product.id}`);
      
      if (product.metafields.edges.length > 0) {
        for (const metafieldEdge of product.metafields.edges) {
          const metafield = metafieldEdge.node;
          console.log(`  ${metafield.key}: ${metafield.value} (型: ${metafield.type})`);
        }
      } else {
        console.log('  メタフィールドなし');
      }
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

if (require.main === module) {
  debugMetafields();
}