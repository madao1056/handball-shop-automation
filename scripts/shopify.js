/**
 * Shopify GraphQL API Client
 * 商品のメタフィールド更新とデータ取得を行うクライアント
 */
const fetch = require('node-fetch');

class ShopifyGraphQLClient {
  constructor(shopDomain, accessToken, apiVersion = '2025-04') {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
  }

  /**
   * GraphQL リクエストを実行
   */
  async query(query, variables = {}) {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error('GraphQL request failed:', error);
      throw error;
    }
  }

  /**
   * 全ての商品を取得（ページネーション対応）
   */
  async getAllProducts() {
    const products = [];
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
      const query = `
        query getProducts($cursor: String) {
          products(first: 250, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                variants(first: 250) {
                  edges {
                    node {
                      id
                      title
                      sku
                    }
                  }
                }
                metafields(first: 250) {
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

      const variables = cursor ? { cursor } : {};
      const result = await this.query(query, variables);
      
      products.push(...result.products.edges.map(edge => edge.node));
      
      hasNextPage = result.products.pageInfo.hasNextPage;
      cursor = result.products.pageInfo.endCursor;
    }

    return products;
  }

  /**
   * 注文データを取得（financial_status=paid のみ）
   */
  async getAllPaidOrders() {
    const orders = [];
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
      const query = `
        query getOrders($cursor: String) {
          orders(first: 250, after: $cursor, query: "financial_status:paid") {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                name
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                lineItems(first: 250) {
                  edges {
                    node {
                      id
                      quantity
                      variant {
                        id
                        product {
                          id
                        }
                      }
                      discountedTotalSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
                refunds {
                  id
                  createdAt
                  transactions(first: 250) {
                    edges {
                      node {
                        id
                        amount
                        kind
                        status
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const variables = cursor ? { cursor } : {};
      const result = await this.query(query, variables);
      
      orders.push(...result.orders.edges.map(edge => edge.node));
      
      hasNextPage = result.orders.pageInfo.hasNextPage;
      cursor = result.orders.pageInfo.endCursor;
    }

    return orders;
  }

  /**
   * 商品のメタフィールドを一括更新（25件制限対応）
   */
  async updateProductMetafields(metafieldUpdates) {
    const BATCH_SIZE = 25;
    const results = [];

    for (let i = 0; i < metafieldUpdates.length; i += BATCH_SIZE) {
      const batch = metafieldUpdates.slice(i, i + BATCH_SIZE);
      
      const mutation = `
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        metafields: batch
      };

      console.log(`バッチ ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(metafieldUpdates.length / BATCH_SIZE)} を実行中...`);
      
      const result = await this.query(mutation, variables);
      
      if (result.metafieldsSet.userErrors.length > 0) {
        console.error('メタフィールド更新エラー:', result.metafieldsSet.userErrors);
      }
      
      results.push(result);
      
      // レート制限対策として少し待機
      if (i + BATCH_SIZE < metafieldUpdates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

module.exports = ShopifyGraphQLClient;