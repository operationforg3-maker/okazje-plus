import { adminDb } from '../src/lib/firebase-admin';
import { DealM6, ProductCore, LocalizedText } from '../src/lib/types';

interface CsvRow {
  language: string;
  categoryName: string;
  categoryId: string;
  productName: string;
  imageUrl: string;
  productUrl: string;
  originalPriceStr: string;
  salePriceStr: string;
  discountStr: string;
  clickUrl: string;
  orders: string;
}

const RAW_CSV_ROWS: CsvRow[] = [
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '201886710',
    productName: 'Feyree 22KW 32A 3-fazowa przenośna ładowarka EV Typu 2 z kontrolą przez Wi-Fi i aplikację, stacja ładująca EVSE do samochodów elektrycznych',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/Sc2292453044b4003ad120569c9ee9909a.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005006103250871.html',
    originalPriceStr: 'PLN 927.11',
    salePriceStr: 'PLN 837.14',
    discountStr: '9%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c2Q4WQAx',
    orders: '315',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '201889206',
    productName: 'Kabel do ładowarki EV Feyree Typ 2 32A 7.6kW z dynamicznym równoważeniem obciążenia, stacja ładowania EVSE Wallbox z funkcją aplikacji, 11kW 22kW, stacja ładowania samochodów elektrycznych.',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/Sfff44e613f5047c6844bbb4a512ce9338.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005007280486717.html',
    originalPriceStr: 'PLN 946.07',
    salePriceStr: 'PLN 886.97',
    discountStr: '6%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c4N0Ie3d',
    orders: '181',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '200000213',
    productName: 'Akumulator LiFePO4 Foursun 12V 100Ah/200Ah/300Ah z ochroną BMS na niskie temperatury, ponad 4500 cykli do kamperów/solarów/kempingów',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/A1f7c975111644e7d937889c5bcfb5e4eW.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005012391291006.html',
    originalPriceStr: 'PLN 650.99',
    salePriceStr: 'PLN 542.99',
    discountStr: '16%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c4C34asR',
    orders: '836',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '200004070',
    productName: 'Akumulator litowo-żelazowo-fosforanowy LiFePO4 KEPWORTH 12V 24V z BMS 50 100 120 135 300Ah do wózków golfowych, pojazdów elektrycznych, kamperów, magazynowania energii słonecznej',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/Seb917a32b9ad4e1f8aadff5e36dc7306x.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005002565454420.html',
    originalPriceStr: 'PLN 708.05',
    salePriceStr: 'PLN 707.39',
    discountStr: '1%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c3y0whdz',
    orders: '163',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '200000213',
    productName: 'Akumulator Foursun CALB 314Ah LiFePO4 4 SZT. 3.2V Klasa A 8000 Cykli DIY 12V 24V do Magazynowania Energii Słonecznej, Kamperów i RV',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/Ae6530bc2098a436bbbfc9a99acd31927Z.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005012463605611.html',
    originalPriceStr: 'PLN 1326.63',
    salePriceStr: 'PLN 1230.19',
    discountStr: '7%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c4VDvKWT',
    orders: '71',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '200000213',
    productName: 'Akumulator Humsienk 12V 200Ah LiFePO4, wbudowany BMS 250A, 15000 cykli, 2560Wh, ochrona przed niską temperaturą, akumulator litowo-żelazowo-fosforanowy do zastosowań domowych, kamperów, silników trollingowych, łodzi, solarnych, off-grid.',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/A73ff149dbc694a93960520410991d168a.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005012600852151.html',
    originalPriceStr: 'PLN 1171.36',
    salePriceStr: 'PLN 1169.19',
    discountStr: '1%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c30PXJ2J',
    orders: '60',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '200000213',
    productName: 'Akumulator litowo-żelazowo-fosforanowy (LiFePO4) Humsienk 12V 314Ah z aplikacją Bluetooth, zabezpieczeniem przed niską temperaturą, wbudowanym BMS 200A, energią 4019Wh, mini rozmiar, do 15000 cykli głębokich rozładowań, do systemów off-grid, kamperów, systemów solarnych, zasilania domowego.',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/Ac033f0b3610d4cb69f7895f356325b28N.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005012645087379.html',
    originalPriceStr: 'PLN 4591.03',
    salePriceStr: 'PLN 1744.59',
    discountStr: '62%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c3DPaq4J',
    orders: '40',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '201886710',
    productName: 'dé Ładowarka EV Typ 2 11kW z aplikacją 16A 3-fazowa 5,5m 7m 10m 15m 20m 25m Kabel do ładowania pojazdów elektrycznych Wtyczka CEE do Typu 2 z regulowanym prądem Przenośna stacja ładująca',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/S5790a891c6d3479180f14c8f1b331abc6.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005012287498054.html',
    originalPriceStr: 'PLN 803.60',
    salePriceStr: 'PLN 714.59',
    discountStr: '11%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c3XDguP5',
    orders: '830',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '200000213',
    productName: 'KEPWORTH Akumulator litowo-żelazowo-fosforanowy 12V 180Ah 300Ah z ulepszonym systemem BMS 6000 cykli do kamperów RV Wózek golfowy Off-Road Off-Grid',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/S6aca6d31bc774aaf9e1f6146498656487.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005007791619161.html',
    originalPriceStr: 'PLN 3273.92',
    salePriceStr: 'PLN 2160.79',
    discountStr: '34%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c3RXDCjV',
    orders: '578',
  },
  {
    language: 'pl',
    categoryName: 'Motoryzacja oraz części i akcesoria motoryzacyjne',
    categoryId: '201883809',
    productName: 'Feyree Type2 32A 7KW Jednofazowy z Wi-Fi i sterowaniem przez aplikację, kabel Type1 / GBT / TS-NACS do użytku domowego i na zewnątrz',
    imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/S32f15588343946139af5276316e8250ff.jpg',
    productUrl: 'https://pl.aliexpress.com/item/1005008365642512.html',
    originalPriceStr: 'PLN 566.89',
    salePriceStr: 'PLN 543.75',
    discountStr: '4%',
    clickUrl: 'https://s.click.aliexpress.com/e/_c2JOqvN9',
    orders: '1000',
  },
];

function parsePrice(str: string): number {
  const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function extractProductId(url: string): string {
  const match = url.match(/\/item\/(\d+)\.html/i);
  return match ? match[1] : '';
}

function determineCategory(name: string): { mainCategorySlug: string; subCategorySlug: string; subSubCategorySlug: string } {
  const lower = name.toLowerCase();
  if (
    lower.includes('ładowark') ||
    lower.includes('kabel') ||
    lower.includes('wallbox') ||
    lower.includes('evse') ||
    lower.includes('ev ') ||
    lower.includes('type2') ||
    lower.includes('type 2') ||
    lower.includes('stacja ładując')
  ) {
    return {
      mainCategorySlug: 'motoryzacja',
      subCategorySlug: 'akcesoria-samochodowe',
      subSubCategorySlug: 'ladowarki-samochodowe',
    };
  }
  return {
    mainCategorySlug: 'motoryzacja',
    subCategorySlug: 'czesci-samochodowe',
    subSubCategorySlug: 'akumulatory',
  };
}

export async function importDeals(dryRun: boolean = true) {
  console.log(`=== START IMPORT DEALS (dryRun=${dryRun}) ===`);
  const now = new Date().toISOString();
  let createdCount = 0;

  for (const row of RAW_CSV_ROWS) {
    const externalId = extractProductId(row.productUrl);
    const salePrice = parsePrice(row.salePriceStr);
    const originalPrice = parsePrice(row.originalPriceStr);
    const discountAmount = originalPrice > salePrice ? originalPrice - salePrice : 0;
    const discountPercent = discountAmount > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;

    const cat = determineCategory(row.productName);

    console.log(`\nProcessing: "${row.productName.slice(0, 60)}..."`);
    console.log(`  ID: ${externalId} | Price: ${salePrice} PLN (was ${originalPrice} PLN, -${discountPercent}%)`);
    console.log(`  Category: ${cat.mainCategorySlug} > ${cat.subCategorySlug} > ${cat.subSubCategorySlug}`);

    // Check existing
    const existingSnap = await adminDb.collection('deals').where('sourceProductId', '==', externalId).limit(1).get();
    if (!existingSnap.empty) {
      console.log(`  ⚠️ Deal already exists with ID: ${existingSnap.docs[0].id}, skipping.`);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY-RUN] Would create Deal + ProductCore`);
      createdCount++;
      continue;
    }

    // Create ProductCore
    const productRef = adminDb.collection('product_cores').doc();
    const productCoreData: ProductCore = {
      id: productRef.id,
      title: { pl: row.productName, en: row.productName },
      description: { pl: row.productName, en: row.productName },
      imageUrl: row.imageUrl,
      images: [row.imageUrl],
      mainCategorySlug: cat.mainCategorySlug,
      subCategorySlug: cat.subCategorySlug,
      subSubCategorySlug: cat.subSubCategorySlug,
      bestPrice: salePrice,
      bestTotalPrice: salePrice,
      rating: 4.8,
      status: 'approved',
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: 'aliexpress',
        originalId: externalId,
        importedVia: 'aliexpress_csv',
      } as any,
    } as any;

    await productRef.set(productCoreData);

    // Create DealM6
    const dealRef = adminDb.collection('deals').doc();
    const dealData: DealM6 = {
      id: dealRef.id,
      productId: productRef.id,
      productCoreId: productRef.id,
      linkedProductIds: [productRef.id],
      mainCategorySlug: cat.mainCategorySlug,
      subCategorySlug: cat.subCategorySlug,
      subSubCategorySlug: cat.subSubCategorySlug,
      image: row.imageUrl,
      images: [row.imageUrl],
      gallery: [row.imageUrl],
      price: {
        amount: salePrice,
        currency: 'PLN',
      },
      originalPrice: originalPrice > salePrice ? originalPrice : undefined,
      discount: discountAmount > 0 ? { amount: discountAmount, percentage: discountPercent } : undefined,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      shipping: {
        cost: 0,
        timeDays: 7,
        method: 'Standard',
        fromCountry: 'CN',
      },
      totalPrice: salePrice,
      source: 'aliexpress',
      affiliateLink: row.clickUrl,
      affiliateUrl: row.clickUrl,
      dealUrl: row.clickUrl,
      sourceUrl: row.productUrl,
      sourceProductId: externalId,
      merchantName: 'AliExpress',
      title: { pl: row.productName, en: row.productName },
      description: { pl: row.productName, en: row.productName },
      dealType: discountPercent > 0 ? 'sale' : 'regular',
      freeShipping: true,
      stockStatus: 'in_stock',
      isActive: true,
      priceHistory: [
        {
          date: now.substring(0, 10),
          price: salePrice,
          currency: 'PLN',
        },
      ],
      voteCount: 1,
      temperature: 100,
      commentsCount: 0,
      status: 'approved',
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: 'aliexpress',
        originalId: externalId,
        importedVia: 'aliexpress_csv',
        ordersCount: parseInt(row.orders) || 0,
      } as any,
    };

    await dealRef.set(dealData);
    console.log(`  ✅ Created ProductCore (${productRef.id}) and Deal (${dealRef.id})`);
    createdCount++;
  }

  console.log(`\n=== FINISHED: ${createdCount} deals processed ===`);
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--run') ? false : true;
  importDeals(isDryRun)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
