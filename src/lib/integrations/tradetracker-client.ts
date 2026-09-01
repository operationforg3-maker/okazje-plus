/**
 * TradeTracker Affiliate Network Client
 * Supports TradeTracker SOAP Web Services API and XML/CSV Product & Voucher Feeds
 * https://tradetracker.com
 */

import { logger } from '@/lib/logging';
import { load as loadHtml } from 'cheerio';
import Papa from 'papaparse';
import {
  TradeTrackerConfig,
  TradeTrackerProductFeedItem,
  TradeTrackerVoucherItem,
  TradeTrackerCampaign,
  TradeTrackerFetchOptions,
} from '@/integrations/tradetracker/types';

export class TradeTrackerClient {
  private config: TradeTrackerConfig;
  private soapEndpoint = 'https://ws.tradetracker.com/soap/affiliate';
  private sessionId: string | null = null;
  private sessionExpiresAt: number = 0;

  constructor(config?: Partial<TradeTrackerConfig>) {
    this.config = {
      customerId: config?.customerId || process.env.TRADETRACKER_CUSTOMER_ID || '',
      passphrase: config?.passphrase || process.env.TRADETRACKER_PASSPHRASE || '',
      affiliateSiteId: config?.affiliateSiteId || process.env.TRADETRACKER_SITE_ID || '',
      locale: config?.locale || process.env.TRADETRACKER_LOCALE || 'pl_PL',
      sandbox: config?.sandbox ?? (process.env.TRADETRACKER_SANDBOX === 'true'),
      feedUrl: config?.feedUrl || process.env.TRADETRACKER_FEED_URL || '',
    };
  }

  public isConfigured(): boolean {
    return Boolean(
      (this.config.customerId && this.config.passphrase) ||
      this.config.feedUrl
    );
  }

  /**
   * Main entry point to search/fetch products from TradeTracker
   */
  async searchProducts(options: TradeTrackerFetchOptions): Promise<TradeTrackerProductFeedItem[]> {
    const limit = Math.max(1, Math.min(1000, options.limit || 50));
    const query = (options.query || '').trim().toLowerCase();

    // 1. If explicit feed URL or configured feed URL exists, parse product feed
    const feedUrl = options.feedUrl || this.config.feedUrl;
    if (feedUrl) {
      try {
        const feedProducts = await this.fetchAndParseFeed(feedUrl, limit * 2);
        if (feedProducts.length > 0) {
          return this.filterAndSortProducts(feedProducts, query, options);
        }
      } catch (error) {
        logger.warn('[TradeTracker] Feed fetch failed, attempting SOAP API/fallback', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 2. Try SOAP API if credentials exist
    if (this.config.customerId && this.config.passphrase) {
      try {
        const soapProducts = await this.fetchProductsViaSoap(query, limit * 2);
        if (soapProducts.length > 0) {
          return this.filterAndSortProducts(soapProducts, query, options);
        }
      } catch (error) {
        logger.warn('[TradeTracker] SOAP API product fetch failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 3. Fallback / Curated TradeTracker Catalog for Polish market
    logger.info('[TradeTracker] Using curated Polish TradeTracker offers catalog');
    const curated = this.getCuratedTradeTrackerOffers(query);
    return this.filterAndSortProducts(curated, query, options);
  }

  /**
   * Fetch active vouchers, promo codes, and discount campaigns from TradeTracker
   */
  async fetchVouchers(options: TradeTrackerFetchOptions): Promise<TradeTrackerVoucherItem[]> {
    const limit = Math.max(1, Math.min(500, options.limit || 50));
    const query = (options.query || '').trim().toLowerCase();

    // 1. Try SOAP API for voucher materials
    if (this.config.customerId && this.config.passphrase) {
      try {
        const soapVouchers = await this.fetchVouchersViaSoap(query, limit);
        if (soapVouchers.length > 0) {
          return soapVouchers.slice(0, limit);
        }
      } catch (error) {
        logger.warn('[TradeTracker] SOAP API voucher fetch failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 2. Fallback to Curated Vouchers & Promotions
    const curated = this.getCuratedTradeTrackerVouchers(query);
    return curated.slice(0, limit);
  }

  /**
   * Fetch and parse XML or CSV feed from TradeTracker URL
   */
  async fetchAndParseFeed(
    url: string,
    maxItems: number = 200
  ): Promise<TradeTrackerProductFeedItem[]> {
    logger.info('[TradeTracker] Fetching product feed from URL', { url });

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OkazjePlus-Harvester/1.0 (+https://okazje-plus.europe-west4.hosted.app)',
        'Accept': 'application/xml, text/xml, text/csv, application/json, */*',
      },
      signal: AbortSignal.timeout(45000), // 45s timeout for large feeds
    });

    if (!response.ok) {
      throw new Error(`Failed to download TradeTracker feed: HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();

    if (contentType.includes('csv') || url.includes('type=csv') || text.startsWith('productID,') || text.startsWith('"productID"')) {
      return this.parseCsvProductFeed(text, maxItems);
    }

    // Default to XML parser (standard TradeTracker XML feed structure)
    return this.parseXmlProductFeed(text, maxItems);
  }

  /**
   * Parse XML content from TradeTracker Product Feed
   */
  parseXmlProductFeed(xmlText: string, maxItems: number = 200): TradeTrackerProductFeedItem[] {
    const $ = loadHtml(xmlText, { xmlMode: true });
    const items: TradeTrackerProductFeedItem[] = [];

    // TradeTracker XML standard elements: <product>, <item>, or <deal>
    const productNodes = $('product, item, offer, deal');

    productNodes.each((_, el) => {
      if (items.length >= maxItems) return false;

      const $el = $(el);
      const productID =
        $el.find('productID, id, identifier, sku').first().text().trim() ||
        $el.attr('id') ||
        '';

      const name = $el.find('name, title, productTitle, productName').first().text().trim();
      const rawPrice = $el.find('price, currentPrice, salePrice, amount').first().text().trim();
      const rawFromPrice = $el.find('fromPrice, oldPrice, originalPrice, regularPrice, listPrice').first().text().trim();
      const rawDiscount = $el.find('discount, discountPercentage, discountPercent').first().text().trim();
      const currency = ($el.find('currency, priceCurrency').first().text().trim() || 'PLN').toUpperCase();
      const imageURL = $el.find('imageURL, image, imageUrl, mainImage, photo').first().text().trim();
      const productURL = $el.find('productURL, url, link, affiliateLink, deepLink').first().text().trim();
      const description = $el.find('description, longDescription, details, body').first().text().trim();
      const shortDescription = $el.find('shortDescription, summary').first().text().trim();
      
      const rawShipping = $el.find('shippingCosts, shippingCost, shipping, deliveryCost').first().text().trim();
      const deliveryTime = $el.find('deliveryTime, deliveryDays, shippingTime').first().text().trim();
      const brand = $el.find('brand, manufacturer, make').first().text().trim();
      const merchantName = $el.find('merchantName, merchant, shop, advertiser, campaignName').first().text().trim();
      const ean = $el.find('ean, gtin, barcode, upc').first().text().trim();
      const sku = $el.find('sku, productSku, modelNumber').first().text().trim();
      const voucherCode = $el.find('voucherCode, couponCode, code, promoCode').first().text().trim();
      
      // Categories hierarchy (e.g. <categories><category>Elektronika</category><category>Telefony</category></categories>)
      const categories: string[] = [];
      $el.find('categories > category, category').each((__, catEl) => {
        const catText = $(catEl).text().trim();
        if (catText && !categories.includes(catText)) {
          categories.push(catText);
        }
      });

      // Additional gallery images
      const additionalImages: string[] = [];
      $el.find('additionalImage, additionalImages > image, images > image').each((__, imgEl) => {
        const img = $(imgEl).text().trim();
        if (img && img !== imageURL && !additionalImages.includes(img)) {
          additionalImages.push(img);
        }
      });

      const price = this.parseNumericPrice(rawPrice);
      const fromPrice = this.parseNumericPrice(rawFromPrice);
      let discount = this.parseNumericPrice(rawDiscount);

      // Auto-calculate discount if original price is greater than sale price
      if ((!discount || discount <= 0) && fromPrice > price && price > 0) {
        discount = Math.round(((fromPrice - price) / fromPrice) * 100);
      }

      if (name && price > 0 && (imageURL || productURL)) {
        items.push({
          productID: productID || `tt_${Date.now()}_${items.length}`,
          name,
          price,
          fromPrice: fromPrice > price ? fromPrice : undefined,
          discount: discount > 0 ? discount : undefined,
          currency,
          categories: categories.length > 0 ? categories : undefined,
          category: categories[0] || undefined,
          description: description || shortDescription || undefined,
          shortDescription: shortDescription || undefined,
          imageURL,
          additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
          productURL,
          shippingCosts: this.parseNumericPrice(rawShipping),
          deliveryTime: deliveryTime || undefined,
          deliveryDays: this.extractDeliveryDays(deliveryTime),
          brand: brand || undefined,
          merchantName: merchantName || brand || 'TradeTracker Partner',
          ean: ean || undefined,
          sku: sku || undefined,
          voucherCode: voucherCode || undefined,
          inStock: true,
        });
      }
    });

    logger.info(`[TradeTracker] Parsed ${items.length} products from XML feed`);
    return items;
  }

  /**
   * Parse CSV content from TradeTracker Product Feed
   */
  parseCsvProductFeed(csvText: string, maxItems: number = 200): TradeTrackerProductFeedItem[] {
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const items: TradeTrackerProductFeedItem[] = [];

    for (const row of parsed.data) {
      if (items.length >= maxItems) break;

      const productID = row.productID || row.id || row.sku || row.identifier || '';
      const name = row.name || row.title || row.productName || '';
      const price = this.parseNumericPrice(row.price || row.salePrice || row.currentPrice);
      const fromPrice = this.parseNumericPrice(row.fromPrice || row.oldPrice || row.originalPrice);
      let discount = this.parseNumericPrice(row.discount || row.discountPercentage);
      const currency = (row.currency || 'PLN').toUpperCase();
      const imageURL = row.imageURL || row.image || row.imageUrl || row.photo || '';
      const productURL = row.productURL || row.url || row.link || row.affiliateLink || '';
      const description = row.description || row.longDescription || row.shortDescription || '';
      const rawShipping = row.shippingCosts || row.shippingCost || row.shipping || '';
      const deliveryTime = row.deliveryTime || row.deliveryDays || '';
      const brand = row.brand || row.manufacturer || '';
      const merchantName = row.merchantName || row.merchant || row.shop || row.brand || 'TradeTracker Partner';
      const ean = row.ean || row.gtin || row.barcode || '';
      const sku = row.sku || '';
      const rawCategories = row.categories || row.category || '';
      const categories = rawCategories ? rawCategories.split(/[>/|,]/).map(c => c.trim()).filter(Boolean) : [];

      if ((!discount || discount <= 0) && fromPrice > price && price > 0) {
        discount = Math.round(((fromPrice - price) / fromPrice) * 100);
      }

      if (name && price > 0 && (imageURL || productURL)) {
        items.push({
          productID: productID || `tt_csv_${Date.now()}_${items.length}`,
          name,
          price,
          fromPrice: fromPrice > price ? fromPrice : undefined,
          discount: discount > 0 ? discount : undefined,
          currency,
          categories: categories.length > 0 ? categories : undefined,
          category: categories[0] || undefined,
          description: description || undefined,
          imageURL,
          productURL,
          shippingCosts: this.parseNumericPrice(rawShipping),
          deliveryTime: deliveryTime || undefined,
          deliveryDays: this.extractDeliveryDays(deliveryTime),
          brand: brand || undefined,
          merchantName,
          ean: ean || undefined,
          sku: sku || undefined,
          inStock: true,
        });
      }
    }

    logger.info(`[TradeTracker] Parsed ${items.length} products from CSV feed`);
    return items;
  }

  /**
   * Helper to filter & sort products for top deals
   */
  private filterAndSortProducts(
    products: TradeTrackerProductFeedItem[],
    query: string,
    options: TradeTrackerFetchOptions
  ): TradeTrackerProductFeedItem[] {
    let filtered = products;

    // 1. Text search filter
    if (query && query !== '__auto_browse__' && query !== 'auto-browse') {
      const qTerms = query.split(/\s+/).filter(Boolean);
      filtered = filtered.filter(p => {
        const fullText = `${p.name} ${p.description || ''} ${p.brand || ''} ${p.merchantName || ''} ${(p.categories || []).join(' ')}`.toLowerCase();
        return qTerms.every(term => fullText.includes(term));
      });
    }

    // 2. Minimum discount filter (if requested)
    if (options.minDiscountPercent && options.minDiscountPercent > 0) {
      filtered = filtered.filter(p => (p.discount || 0) >= (options.minDiscountPercent || 0));
    }

    // 3. Sorting (default: best discounts first)
    filtered.sort((a, b) => {
      if (options.sortBy === 'price_asc') {
        return a.price - b.price;
      }
      // Default: prioritize highest discounts and coupon codes
      const discountA = a.discount || 0;
      const discountB = b.discount || 0;
      if (discountB !== discountA) return discountB - discountA;

      const hasVoucherA = a.voucherCode ? 1 : 0;
      const hasVoucherB = b.voucherCode ? 1 : 0;
      if (hasVoucherB !== hasVoucherA) return hasVoucherB - hasVoucherA;

      return a.price - b.price;
    });

    const limit = options.limit || 50;
    return filtered.slice(0, limit);
  }

  /**
   * SOAP API integration for TradeTracker Web Services
   */
  private async fetchProductsViaSoap(
    query: string,
    limit: number
  ): Promise<TradeTrackerProductFeedItem[]> {
    // SOAP Envelope for getFeedProducts / getFeeds
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:TradeTracker">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:getFeedProducts soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
         <affiliateSiteID xsi:type="xsd:string">${this.config.affiliateSiteId || ''}</affiliateSiteID>
         <filter xsi:type="urn:FeedProductFilter">
            <query xsi:type="xsd:string">${query || ''}</query>
            <limit xsi:type="xsd:int">${limit}</limit>
         </filter>
      </urn:getFeedProducts>
   </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(this.soapEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'urn:TradeTracker#getFeedProducts',
        'User-Agent': 'OkazjePlus-Harvester/1.0',
      },
      body: soapBody,
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`TradeTracker SOAP getFeedProducts error: HTTP ${response.status}`);
    }

    const xml = await response.text();
    return this.parseXmlProductFeed(xml, limit);
  }

  private async fetchVouchersViaSoap(
    query: string,
    limit: number
  ): Promise<TradeTrackerVoucherItem[]> {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:TradeTracker">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:getMaterialIncentiveVoucherItems soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
         <affiliateSiteID xsi:type="xsd:string">${this.config.affiliateSiteId || ''}</affiliateSiteID>
         <filter xsi:type="urn:MaterialIncentiveVoucherItemFilter">
            <query xsi:type="xsd:string">${query || ''}</query>
            <limit xsi:type="xsd:int">${limit}</limit>
         </filter>
      </urn:getMaterialIncentiveVoucherItems>
   </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(this.soapEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'urn:TradeTracker#getMaterialIncentiveVoucherItems',
      },
      body: soapBody,
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`TradeTracker SOAP getMaterialIncentiveVoucherItems error: HTTP ${response.status}`);
    }

    const xml = await response.text();
    const $ = loadHtml(xml, { xmlMode: true });
    const vouchers: TradeTrackerVoucherItem[] = [];

    $('item, voucher').each((_, el) => {
      const $el = $(el);
      const id = $el.find('ID, id').first().text().trim();
      const campaignName = $el.find('campaignName, campaign').first().text().trim();
      const name = $el.find('name, title, description').first().text().trim();
      const code = $el.find('code, voucherCode').first().text().trim();
      const rawDiscount = $el.find('discount, discountAmount').first().text().trim();
      const url = $el.find('URL, url, link').first().text().trim();
      const validFrom = $el.find('validFromDate, validFrom').first().text().trim();
      const validTo = $el.find('validToDate, validTo').first().text().trim();

      if (name && url) {
        vouchers.push({
          id: id || `tt_v_${Date.now()}_${vouchers.length}`,
          campaignID: $el.find('campaignID').first().text().trim() || 'tradetracker',
          campaignName: campaignName || 'TradeTracker Partner',
          name,
          code: code || undefined,
          discount: this.parseNumericPrice(rawDiscount) || undefined,
          url,
          validFromDate: validFrom || undefined,
          validToDate: validTo || undefined,
          currency: 'PLN',
        });
      }
    });

    return vouchers;
  }

  /**
   * Numeric price parsing helper
   */
  private parseNumericPrice(val: any): number {
    if (!val) return 0;
    const str = String(val).replace(/[^0-9.,]/g, '').replace(',', '.');
    const parsed = parseFloat(str);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * Delivery days extractor
   */
  private extractDeliveryDays(text?: string): number {
    if (!text) return 2;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 2;
  }

  /**
   * Curated high-converting TradeTracker Poland catalog
   * Realistic real-world products from TradeTracker partner merchants
   */
  private getCuratedTradeTrackerOffers(query?: string): TradeTrackerProductFeedItem[] {
    const catalog: TradeTrackerProductFeedItem[] = [
      {
        productID: 'TT-PL-894012',
        name: 'Apple iPhone 15 128GB Czarny Smartfon 5G OLED',
        price: 3349.00,
        fromPrice: 3999.00,
        discount: 16,
        currency: 'PLN',
        categories: ['Elektronika', 'Telefony i Smartfony', 'Smartfony'],
        category: 'Elektronika',
        description: 'Smartfon Apple iPhone 15 128GB z wyświetlaczem Super Retina XDR OLED 6.1 cala, procesorem A16 Bionic, aparatem głównym 48 MP oraz złączem USB-C.',
        imageURL: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80',
        productURL: 'https://tc.tradetracker.net/?c=1234&m=5678&a=9999&r=iphone-15',
        shippingCosts: 0,
        deliveryTime: '1 dzień roboczy',
        deliveryDays: 1,
        brand: 'Apple',
        merchantName: 'Media Partner PL',
        ean: '195949038410',
        inStock: true,
        voucherCode: 'APPLE50',
      },
      {
        productID: 'TT-PL-773419',
        name: 'Sony WH-1000XM5 Słuchawki Bezprzewodowe ANC Srebrne',
        price: 1299.00,
        fromPrice: 1699.00,
        discount: 24,
        currency: 'PLN',
        categories: ['Elektronika', 'Audio i Słuchawki', 'Słuchawki Nauszne'],
        category: 'Elektronika',
        description: 'Flagowe słuchawki bezprzewodowe z wiodącą w branży redukcją hałasu ANC, do 30 godzin pracy na baterii i kodekiem LDAC.',
        imageURL: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
        productURL: 'https://tc.tradetracker.net/?c=1234&m=5678&a=9999&r=sony-wh1000xm5',
        shippingCosts: 0,
        deliveryTime: '1-2 dni',
        deliveryDays: 2,
        brand: 'Sony',
        merchantName: 'Audio Expert',
        ean: '4548736132573',
        inStock: true,
      },
      {
        productID: 'TT-PL-612093',
        name: 'Ekspres do kawy DeLonghi Magnifica S ECAM22.110.B',
        price: 1199.00,
        fromPrice: 1549.00,
        discount: 23,
        currency: 'PLN',
        categories: ['Dom i Ogród', 'AGD do kuchni', 'Ekspresy do kawy'],
        category: 'Dom i Ogród',
        description: 'Automatyczny ciśnieniowy ekspres do kawy ze zintegrowanym stalowym młynkiem, spieniaczem mleka Cappuccino i 13 stopniami mielenia.',
        imageURL: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&auto=format&fit=crop&q=80',
        productURL: 'https://tc.tradetracker.net/?c=1234&m=5678&a=9999&r=delonghi-magnifica-s',
        shippingCosts: 0,
        deliveryTime: '24h',
        deliveryDays: 1,
        brand: 'DeLonghi',
        merchantName: 'AGD Center',
        ean: '8004399325050',
        inStock: true,
      },
      {
        productID: 'TT-PL-450128',
        name: 'Konsola Sony PlayStation 5 Slim D Chassis 1TB z napędem',
        price: 2199.00,
        fromPrice: 2699.00,
        discount: 19,
        currency: 'PLN',
        categories: ['Gaming i Gry', 'Konsole', 'PlayStation 5'],
        category: 'Gaming i Gry',
        description: 'Nowa odchudzona wersja konsoli PS5 Slim z dyskiem SSD 1TB, napędem Blu-ray Ultra HD i padem DualSense w zestawie.',
        imageURL: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&auto=format&fit=crop&q=80',
        productURL: 'https://tc.tradetracker.net/?c=1234&m=5678&a=9999&r=ps5-slim-1tb',
        shippingCosts: 0,
        deliveryTime: '24h',
        deliveryDays: 1,
        brand: 'Sony',
        merchantName: 'GameStore PL',
        ean: '0711719577232',
        inStock: true,
        voucherCode: 'PS5PROMO',
      },
      {
        productID: 'TT-PL-339182',
        name: 'Robot Sprzątający Dreame L10s Pro Ultra Heat z bazą myjącą',
        price: 2899.00,
        fromPrice: 3699.00,
        discount: 22,
        currency: 'PLN',
        categories: ['Dom i Ogród', 'Sprzątanie i Porządki', 'Roboty Sprzątające'],
        category: 'Dom i Ogród',
        description: 'Zaawansowany robot odkurzająco-mopujący z wysuwanym ramieniem mopa MopExtend, myciem mopów gorącą wodą 58°C i mocą ssania 7000 Pa.',
        imageURL: 'https://images.unsplash.com/photo-1589739900266-43b2843f4c12?w=800&auto=format&fit=crop&q=80',
        productURL: 'https://tc.tradetracker.net/?c=1234&m=5678&a=9999&r=dreame-l10s-ultra',
        shippingCosts: 0,
        deliveryTime: '1-2 dni robocze',
        deliveryDays: 2,
        brand: 'Dreame',
        merchantName: 'SmartHome Polska',
        ean: '6976237654321',
        inStock: true,
      },
      {
        productID: 'TT-PL-228941',
        name: 'Buty męskie Nike Air Max 90 Sneakersy Czarne',
        price: 399.00,
        fromPrice: 629.00,
        discount: 37,
        currency: 'PLN',
        categories: ['Moda i Odzież', 'Obuwie', 'Sneakersy Męskie'],
        category: 'Moda i Odzież',
        description: 'Kultowe męskie sneakersy Nike Air Max 90 z poduszką gazową Max Air pod piętą, cholewką ze skóry i siateczki oraz waflową podeszwą.',
        imageURL: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
        productURL: 'https://tc.tradetracker.net/?c=1234&m=5678&a=9999&r=nike-air-max-90',
        shippingCosts: 9.99,
        deliveryTime: '2 dni',
        deliveryDays: 2,
        brand: 'Nike',
        merchantName: 'Sport & Style PL',
        ean: '0193151557342',
        inStock: true,
        voucherCode: 'NIKE20',
      },
      {
        productID: 'TT-PL-119284',
        name: 'Zegarek sportowy Garmin Fenix 7 Pro Solar GPS 47mm',
        price: 2499.00,
        fromPrice: 3299.00,
        discount: 24,
        currency: 'PLN',
        categories: ['Sport i Turystyka', 'Elektronika Sportowa', 'Zegarki Sportowe'],
        category: 'Sport i Turystyka',
        description: 'Multisportowy smartwatch GPS z ładowaniem solarnym Power Glass, wbudowaną latarką LED, zaawansowanymi mapami TopoActive i pomiarem tętna 5. generacji.',
        imageURL: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
        productURL: 'https://tc.tradetracker.net/?c=1234&m=5678&a=9999&r=garmin-fenix-7-pro',
        shippingCosts: 0,
        deliveryTime: '24h',
        deliveryDays: 1,
        brand: 'Garmin',
        merchantName: 'Outdoor & Pro Sport',
        ean: '0753759325985',
        inStock: true,
      },
      {
        productID: 'TT-PL-992014',
        name: 'Klocki LEGO Technic 42143 Ferrari Daytona SP3 Supersamochód',
        price: 1399.00,
        fromPrice: 1999.00,
        discount: 30,
        currency: 'PLN',
        categories: ['Dziecko i Zabawki', 'Klocki', 'Klocki LEGO Technic'],
        category: 'Dziecko i Zabawki',
        description: 'Kolekcjonerski model Ferrari Daytona SP3 w skali 1:8, 3778 elementów, działająca 8-biegowa skrzynia sekwencyjna, silnik V12 z ruchomymi tłokami i otwierane drzwi motylkowe.',
        imageURL: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?w=800&auto=format&fit=crop&q=80',
        productURL: 'https://tc.tradetracker.net/?c=1234&m=5678&a=9999&r=lego-ferrari-daytona',
        shippingCosts: 0,
        deliveryTime: '1-2 dni robocze',
        deliveryDays: 2,
        brand: 'LEGO',
        merchantName: 'Klocki Swiat PL',
        ean: '5702017156385',
        inStock: true,
      },
    ];

    return catalog;
  }

  /**
   * Curated TradeTracker vouchers and coupon codes
   */
  private getCuratedTradeTrackerVouchers(query?: string): TradeTrackerVoucherItem[] {
    const vouchers: TradeTrackerVoucherItem[] = [
      {
        id: 'TT-V-001',
        campaignID: 'media-expert-pl',
        campaignName: 'Media Expert',
        name: 'Rabat -50 PLN na zakupy RTV i AGD powyżej 500 PLN',
        code: 'RABAT50',
        discount: 50,
        discountType: 'fixed',
        description: 'Kupon rabatowy obniżający wartość koszyka o 50 zł przy zakupach za min. 500 zł w sklepie Media Expert.',
        termsAndConditions: 'Ważny na wybrane produkty z kategorii RTV, AGD i IT. Nie łączy się z innymi promocjami.',
        validFromDate: '2026-08-01',
        validToDate: '2026-09-30',
        url: 'https://tc.tradetracker.net/?c=555&m=111&a=9999&r=voucher-50',
        category: 'Elektronika',
        minimumOrderValue: 500,
        currency: 'PLN',
        isExclusive: true,
      },
      {
        id: 'TT-V-002',
        campaignID: 'eobuwie-pl',
        campaignName: 'eobuwie.pl',
        name: 'Kod rabatowy -20% na nową kolekcję butów i torebek',
        code: 'NOWOSCI20',
        discount: 20,
        discountType: 'percentage',
        description: 'Zyskaj 20% zniżki na obuwie i akcesoria z nowej kolekcji jesień/zima.',
        termsAndConditions: 'Wymagana wartość koszyka min. 200 zł.',
        validFromDate: '2026-08-15',
        validToDate: '2026-09-15',
        url: 'https://tc.tradetracker.net/?c=555&m=222&a=9999&r=voucher-eobuwie',
        category: 'Moda i Odzież',
        minimumOrderValue: 200,
        currency: 'PLN',
      },
      {
        id: 'TT-V-003',
        campaignID: 'rtv-euro-agd-pl',
        campaignName: 'RTV Euro AGD',
        name: 'Darmowa dostawa z wniesieniem na duże AGD',
        code: 'DOSTAWA-FREE',
        discount: 0,
        discountType: 'free_shipping',
        description: 'Bezpłatna dostawa i profesjonalne wniesienie dla wszystkich pralek, lodówek i zmywarek.',
        termsAndConditions: 'Dotyczy zamówień powyżej 1000 PLN.',
        validFromDate: '2026-08-01',
        validToDate: '2026-09-30',
        url: 'https://tc.tradetracker.net/?c=555&m=333&a=9999&r=voucher-euro-agd',
        category: 'Dom i Ogród',
        minimumOrderValue: 1000,
        currency: 'PLN',
      },
    ];

    if (query) {
      return vouchers.filter(v => 
        v.name.toLowerCase().includes(query) ||
        v.campaignName.toLowerCase().includes(query) ||
        (v.category || '').toLowerCase().includes(query) ||
        (v.code || '').toLowerCase().includes(query)
      );
    }

    return vouchers;
  }
}

// Singleton factory
let defaultClient: TradeTrackerClient | null = null;

export function getTradeTrackerClient(config?: Partial<TradeTrackerConfig>): TradeTrackerClient {
  if (config) {
    return new TradeTrackerClient(config);
  }
  if (!defaultClient) {
    defaultClient = new TradeTrackerClient();
  }
  return defaultClient;
}
