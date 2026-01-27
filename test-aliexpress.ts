import 'dotenv/config';
import { createAliExpressClient } from './src/integrations/aliexpress/client';

(async () => {
  try {
    console.log('Testing AliExpress API with new credentials...');
    const client = createAliExpressClient();
    const config = client.getConfig();
    console.log('Config:', { 
      appKey: config.appKey?.substring(0, 6) + '...', 
      hasSecret: !!config.appSecret,
      endpoint: config.apiEndpoint 
    });
    
    console.log('\nSearching for products...');
    const result = await client.searchProducts({ q: 'phone', limit: 1 });
    
    console.log('\nResult:', JSON.stringify({ 
      success: result.success, 
      total: result.total, 
      productsCount: result.products?.length,
      error: result.error 
    }, null, 2));
    
    if (result.success && result.products.length > 0) {
      console.log('\n✅ API TEST PASSED - Got product:', result.products[0].title);
    } else if (result.error) {
      console.error('\n❌ API TEST FAILED:', result.error.message);
    }
  } catch (e: any) {
    console.error('\n❌ ERROR:', e.message);
    if (e.stack) console.error(e.stack);
  }
})();
