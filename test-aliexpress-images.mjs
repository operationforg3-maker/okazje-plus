// Test AliExpress API image URLs structure
import AliExpress from 'aliexpress-dropshipping-api';

const client = new AliExpress({
  appKey: process.env.ALIEXPRESS_APP_KEY || '',
  appSecret: process.env.ALIEXPRESS_APP_SECRET || '',
  session: process.env.ALIEXPRESS_SESSION || ''
});

async function testImageURLs() {
  console.log('Testing AliExpress API image URL structure...\n');
  
  try {
    // Test keyword search
    console.log('=== KEYWORD SEARCH TEST ===');
    const searchResults = await client.smartMatch('smartphone');
    
    if (searchResults?.products && searchResults.products.length > 0) {
      const firstProduct = searchResults.products[0];
      console.log('Product ID:', firstProduct.product_id);
      console.log('Title:', firstProduct.product_title?.substring(0, 60));
      console.log('\nImage fields available:');
      console.log('- image_urls:', firstProduct.image_urls);
      console.log('- product_main_image_url:', firstProduct.product_main_image_url);
      console.log('- product_small_image_urls:', firstProduct.product_small_image_urls);
      console.log('- product_video_url:', firstProduct.product_video_url);
      
      console.log('\nAll fields:', Object.keys(firstProduct));
    } else {
      console.log('No products returned');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testImageURLs();
