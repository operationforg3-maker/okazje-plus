/**
 * Comprehensive Test Service
 * Testy techniczne, funkcjonalne i biznesowe dla całej aplikacji
 */

import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getCountFromServer,
  doc,
  getDoc,
  limit,
  orderBy,
  documentId
} from 'firebase/firestore';
import { Deal } from './types';
import { getGoogleProductPublicationState } from './google-product-publication';

const REQUIRED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

export interface TestResult {
  id: string;
  name: string;
  category: 'technical' | 'functional' | 'business' | 'security';
  status: 'pass' | 'fail' | 'warning' | 'skip';
  message: string;
  duration: number; // ms
  details?: any;
}

export interface TestAuthOptions {
  userEmail?: string;
  userPassword?: string;
  adminEmail?: string;
  adminPassword?: string;
  preferAnonymous?: boolean; // spróbuj anon dla usera
}

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: Array<{
    name: string;
    slug: string;
  }>;
}

export interface TestSuiteResult {
  timestamp: string;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  results: TestResult[];
}

/**
 * Runner dla pojedynczego testu
 */
async function runTest(
  id: string,
  name: string,
  category: 'technical' | 'functional' | 'business' | 'security',
  testFn: () => Promise<{ status: TestResult['status']; message: string; details?: any }>
): Promise<TestResult> {
  const start = performance.now();
  try {
    const result = await testFn();
    const duration = performance.now() - start;
    return {
      id,
      name,
      category,
      ...result,
      duration: Math.round(duration)
    };
  } catch (error: any) {
    const duration = performance.now() - start;
    return {
      id,
      name,
      category,
      status: 'fail',
      message: `Error: ${error.message}`,
      duration: Math.round(duration),
      details: { error: error.stack }
    };
  }
}

/**
 * ===========================================
 * TESTY TECHNICZNE
 * ===========================================
 */

// Helper: logowanie opcjonalne dla testów technicznych (fallback guest)
async function withOptionalAuth<T>(
  testFn: () => Promise<T>,
  opts?: TestAuthOptions
): Promise<T> {
  // Próbuj zalogować jako user (preferowany) lub admin, ale jeśli nie udało się – kontynuuj jako guest
  if (opts?.userEmail && opts?.userPassword) {
    const login = await authLogin(opts.userEmail, opts.userPassword);
    if (login.ok) {
      await ensureTestUser(login.uid, 'user');
    }
  } else if (opts?.adminEmail && opts?.adminPassword) {
    const login = await authLogin(opts.adminEmail, opts.adminPassword);
    if (login.ok) {
      await ensureTestUser(login.uid, 'admin');
    }
  }
  const result = await testFn();
  await authLogout();
  return result;
}

async function testFirestoreConnection(): Promise<{ status: 'pass' | 'fail'; message: string }> {
  try {
    // Używamy tylko approved aby nie łamać reguł
    const testQuery = query(collection(db, 'deals'), where('status','==','approved'), limit(1));
    const snap = await getDocs(testQuery);
    if (snap) {} // noop
    return { status: 'pass', message: 'Firestore connection OK' };
  } catch (error: any) {
    return { status: 'fail', message: `Firestore error: ${error.message}` };
  }
}

async function testCollectionsExist(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  const collections = ['deals', 'product_cores', 'users', 'categories', 'notifications'];
  const results: Record<string, boolean> = {};
  
  for (const collName of collections) {
    try {
      const q = query(collection(db, collName), limit(1));
      const snapshot = await getDocs(q);
      results[collName] = true;
    } catch {
      results[collName] = false;
    }
  }
  
  const missing = Object.entries(results).filter(([_, exists]) => !exists).map(([name]) => name);
  
  if (missing.length === 0) {
    return { status: 'pass', message: 'All collections exist', details: results };
  } else {
    return { 
      status: 'warning', 
      message: `Missing collections: ${missing.join(', ')}`,
      details: results 
    };
  }
}

async function testIndexes(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string }> {
  try {
    // Test composite index: deals (status, temperature desc)
    const q = query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      orderBy('temperature', 'desc'),
      limit(1)
    );
    await getDocs(q);
    return { status: 'pass', message: 'Firestore indexes working' };
  } catch (error: any) {
    if (error.message.includes('index')) {
      return { 
        status: 'warning', 
        message: 'Missing Firestore index - check Firebase Console' 
      };
    }
    return { status: 'fail', message: `Index test failed: ${error.message}` };
  }
}

/**
 * ===========================================
 * TESTY FUNKCJONALNE
 * ===========================================
 */

async function testDealsCRUD(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    // Read test
    const dealsQuery = query(collection(db, 'deals'), where('status','==','approved'), limit(10));
    const dealsSnapshot = await getDocs(dealsQuery);
    const deals = dealsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
    
    if (deals.length === 0) {
      return { 
        status: 'warning', 
        message: 'No deals in database',
        details: { count: 0 }
      };
    }
    
    // Validate deal structure
    const sampleDeal = deals[0];
  // Akceptujemy nazewnictwo link lub dealUrl
  const requiredFields = ['title', 'price', 'mainCategorySlug', 'temperature', 'status'];
  const linkPresent = ('link' in sampleDeal) || ('dealUrl' in sampleDeal);
  const missingFields = requiredFields.filter(field => !(field in sampleDeal));
  if (!linkPresent) missingFields.push('link|dealUrl');
    
    if (missingFields.length > 0) {
      return {
        status: 'fail',
        message: `Deal missing fields: ${missingFields.join(', ')}`,
        details: { sampleDeal }
      };
    }
    
    return {
      status: 'pass',
      message: `Deals CRUD OK (${deals.length} deals found)`,
      details: { count: deals.length, sample: sampleDeal.title }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Deals test failed: ${error.message}` };
  }
}

async function testProductsCRUD(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const productsQuery = query(collection(db, 'product_cores'), where('status','==','approved'), limit(10));
    const productsSnapshot = await getDocs(productsQuery);
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    if (products.length === 0) {
      return { 
        status: 'warning', 
        message: 'No products in database',
        details: { count: 0 }
      };
    }
    
    // Validate product structure
    const sampleProduct = products[0];
    const requiredFields = ['identityHash', 'mainCategorySlug', 'status', 'title'];
    const missingFields = requiredFields.filter(field => !(field in sampleProduct));
    const hasLocalizedTitle = typeof sampleProduct.title === 'object'
      ? Boolean(sampleProduct.title?.pl || sampleProduct.title?.en || sampleProduct.title?.de)
      : Boolean(sampleProduct.title);
    if (!hasLocalizedTitle) missingFields.push('title[pl|en|de]');
    
    if (missingFields.length > 0) {
      return {
        status: 'fail',
        message: `Product missing fields: ${missingFields.join(', ')}`,
        details: { sampleProduct }
      };
    }
    
    return {
      status: 'pass',
      message: `ProductCores CRUD OK (${products.length} products found)`,
      details: { count: products.length, sample: sampleProduct.title?.pl || sampleProduct.title?.en || sampleProduct.title?.de || sampleProduct.id }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Products test failed: ${error.message}` };
  }
}

function hasLocalizedText(value: any): boolean {
  if (!value) return false;
  if (typeof value !== 'object') return false;
  return Boolean(value.pl || value.en || value.de);
}

function hasAllLocales(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  return REQUIRED_LOCALES.every((locale) => Boolean(String(value?.[locale] || '').trim()));
}

function isAbsoluteHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '#') return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getDealBasePriceValue(deal: any): number | null {
  const candidates: unknown[] = [
    deal?.price?.amount,
    deal?.smartPrice?.amount,
    deal?.price,
    deal?.legacyPrice,
    deal?.smartPrice?.basePrice,
  ];
  for (const candidate of candidates) {
    const parsed = toNumberOrNull(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

function getDealShippingValue(deal: any): number | null {
  const candidates: unknown[] = [
    deal?.shipping?.cost,
    deal?.shippingCost,
    deal?.smartPrice?.shippingCost,
    deal?.metadata?.shippingDetails?.cost,
  ];
  for (const candidate of candidates) {
    const parsed = toNumberOrNull(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

function getDealTotalValue(deal: any): number | null {
  const candidates: unknown[] = [
    deal?.totalPrice,
    deal?.price?.totalPrice,
    deal?.smartPrice?.totalPrice,
  ];
  for (const candidate of candidates) {
    const parsed = toNumberOrNull(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

function hasLocalizedContent(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  return REQUIRED_LOCALES.some((locale) => Boolean(String(value?.[locale] || '').trim()));
}

function hasAnyValidImage(data: any): boolean {
  const directCandidates: unknown[] = [
    data?.image,
    data?.imageUrl,
    data?.thumbnail,
    data?.thumbnailUrl,
  ];
  if (directCandidates.some((candidate) => isAbsoluteHttpUrl(candidate))) {
    return true;
  }

  const listCandidates: unknown[] = [data?.images, data?.gallery, data?.mediaUrls];
  for (const list of listCandidates) {
    if (Array.isArray(list) && list.some((item) => isAbsoluteHttpUrl(item))) {
      return true;
    }
  }

  return false;
}

async function testHarvesterLinkage(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const dealsQuery = query(collection(db, 'deals'), where('status','==','approved'), limit(10));
    const dealsSnapshot = await getDocs(dealsQuery);
    if (dealsSnapshot.empty) {
      return { status: 'warning', message: 'No approved deals to verify harvester linkage' };
    }

    const deals = dealsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const linkedDeal = deals.find(d => d.productCoreId);
    if (!linkedDeal) {
      return { status: 'warning', message: 'No deals linked to product cores (productCoreId missing)' };
    }

    const productSnap = await getDoc(doc(db, 'product_cores', linkedDeal.productCoreId));
    if (!productSnap.exists()) {
      return { status: 'fail', message: 'Deal linked to missing product core', details: { dealId: linkedDeal.id, productCoreId: linkedDeal.productCoreId } };
    }

    const product = productSnap.data() as any;
    const hasIdentity = Boolean(product.identityHash);
    const hasTitle = hasLocalizedText(product.title) || Boolean(product.title);

    if (!hasIdentity || !hasTitle) {
      return {
        status: 'fail',
        message: 'Product core missing identity or title',
        details: { productCoreId: linkedDeal.productCoreId, identityHash: product.identityHash, title: product.title }
      };
    }

    return {
      status: 'pass',
      message: 'Harvester linkage OK (deal -> product core)',
      details: { dealId: linkedDeal.id, productCoreId: linkedDeal.productCoreId }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Harvester linkage test failed: ${error.message}` };
  }
}

async function testRefinerProductLocalization(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const productsQuery = query(collection(db, 'product_cores'), where('status','==','approved'), limit(10));
    const productsSnapshot = await getDocs(productsQuery);
    if (productsSnapshot.empty) {
      return { status: 'warning', message: 'No approved product cores to verify refiner output' };
    }

    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const product = products[0];
    const description = product.description || product.fullDescription;
    const hasLocalizedDescription = hasAllLocales(description);
    const hasSpecs = product.specs && typeof product.specs === 'object' && Object.keys(product.specs).length > 0;

    if (!hasLocalizedDescription) {
      return {
        status: 'fail',
        message: 'Product core missing localized description (pl/en/de)',
        details: { productCoreId: product.id, description }
      };
    }

    if (!hasSpecs) {
      return {
        status: 'warning',
        message: 'Product core missing specs after refiner',
        details: { productCoreId: product.id }
      };
    }

    return {
      status: 'pass',
      message: 'Refiner product output OK (localized description + specs)',
      details: { productCoreId: product.id }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Refiner product test failed: ${error.message}` };
  }
}

async function testRefinerDealLocalization(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const dealsQuery = query(collection(db, 'deals'), where('status','==','approved'), limit(10));
    const dealsSnapshot = await getDocs(dealsQuery);
    if (dealsSnapshot.empty) {
      return { status: 'warning', message: 'No approved deals to verify refiner output' };
    }

    const deals = dealsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    const deal = deals[0];
    const hasLocalizedDescription = hasAllLocales(deal.description);
    const sellingPoints = deal?.metadata?.sellingPoints;
    const hasSellingPoints = hasAllLocales(sellingPoints);

    if (!hasLocalizedDescription) {
      return {
        status: 'fail',
        message: 'Deal missing localized description (pl/en/de)',
        details: { dealId: deal.id, description: deal.description }
      };
    }

    if (!hasSellingPoints) {
      return {
        status: 'warning',
        message: 'Deal missing sellingPoints localization (pl/en/de)',
        details: { dealId: deal.id, sellingPoints }
      };
    }

    return {
      status: 'pass',
      message: 'Refiner deal output OK (localized description + sellingPoints)',
      details: { dealId: deal.id }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Refiner deal test failed: ${error.message}` };
  }
}

async function testSixLocalesCoverage(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const [productsSnapshot, dealsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'product_cores'), where('status', '==', 'approved'), limit(50))),
      getDocs(query(collection(db, 'deals'), where('status', '==', 'approved'), limit(50))),
    ]);

    if (productsSnapshot.empty && dealsSnapshot.empty) {
      return { status: 'warning', message: 'Brak danych do testu pokrycia 6 języków' };
    }

    let checked = 0;
    let missing = 0;

    for (const docSnap of productsSnapshot.docs) {
      const product = docSnap.data() as any;
      checked += 1;
      const hasTitle = hasAllLocales(product?.title);
      const hasDescription = hasAllLocales(product?.description || product?.fullDescription);
      if (!hasTitle || !hasDescription) {
        missing += 1;
      }
    }

    for (const docSnap of dealsSnapshot.docs) {
      const deal = docSnap.data() as any;
      checked += 1;
      if (!hasAllLocales(deal?.description)) {
        missing += 1;
      }
    }

    const ratio = checked > 0 ? Math.round((missing / checked) * 100) : 0;
    if (ratio > 30) {
      return {
        status: 'fail',
        message: `Niskie pokrycie 6 języków: ${missing}/${checked} rekordów bez pełnego zestawu locale`,
        details: { checked, missing, requiredLocales: REQUIRED_LOCALES },
      };
    }

    if (missing > 0) {
      return {
        status: 'warning',
        message: `Częściowe pokrycie 6 języków: ${missing}/${checked} rekordów wymaga uzupełnienia`,
        details: { checked, missing, requiredLocales: REQUIRED_LOCALES },
      };
    }

    return {
      status: 'pass',
      message: `Pokrycie 6 języków OK (${checked} rekordów)` ,
      details: { checked, requiredLocales: REQUIRED_LOCALES },
    };
  } catch (error: any) {
    return { status: 'fail', message: `Test pokrycia 6 języków nie powiódł się: ${error.message}` };
  }
}

async function testM6PriceConsistency(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const dealsSnapshot = await getDocs(query(collection(db, 'deals'), where('status', '==', 'approved'), limit(300)));
    if (dealsSnapshot.empty) {
      return { status: 'warning', message: 'Brak ofert approved do testu spójności cen' };
    }

    let analyzed = 0;
    let withPriceAndShipping = 0;
    let checked = 0;
    let mismatches = 0;

    for (const docSnap of dealsSnapshot.docs) {
      const deal = docSnap.data() as any;
      analyzed += 1;

      const base = getDealBasePriceValue(deal);
      const shipping = getDealShippingValue(deal);
      if (base === null || shipping === null) continue;
      withPriceAndShipping += 1;

      const expected = Number((base + shipping).toFixed(2));
      const comparableRaw = getDealTotalValue(deal);
      if (comparableRaw === null) continue;

      const comparable = Number(comparableRaw.toFixed(2));
      checked += 1;
      if (Math.abs(expected - comparable) > 0.05) {
        mismatches += 1;
      }
    }

    if (checked === 0) {
      return {
        status: 'warning',
        message: 'Brak rekordów z pełnym zestawem pól cenowych do porównania (base+shipping+total)',
        details: { analyzed, withPriceAndShipping, checked },
      };
    }

    const ratio = Math.round((mismatches / checked) * 100);
    const coverage = analyzed > 0 ? Math.round((checked / analyzed) * 100) : 0;
    if (ratio > 10) {
      return {
        status: 'fail',
        message: `Niespójność cen M6: ${mismatches}/${checked} ofert ma rozjazd price+shipping vs total`,
        details: { analyzed, withPriceAndShipping, checked, mismatches, coverage },
      };
    }

    if (coverage < 20) {
      return {
        status: 'warning',
        message: `Niska pokrywalność testu cen: ${checked}/${analyzed} (${coverage}%)`,
        details: { analyzed, withPriceAndShipping, checked, mismatches, coverage },
      };
    }

    if (mismatches > 0) {
      return {
        status: 'warning',
        message: `Wykryto drobne rozjazdy cen M6: ${mismatches}/${checked}`,
        details: { analyzed, withPriceAndShipping, checked, mismatches, coverage },
      };
    }

    return {
      status: 'pass',
      message: `Spójność cen M6 OK (${checked} ofert, coverage ${coverage}%)`,
      details: { analyzed, withPriceAndShipping, checked, mismatches, coverage },
    };
  } catch (error: any) {
    return { status: 'fail', message: `Test spójności cen nie powiódł się: ${error.message}` };
  }
}

async function testOfferLinksValidity(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const dealsSnapshot = await getDocs(query(collection(db, 'deals'), where('status', '==', 'approved'), limit(120)));
    if (dealsSnapshot.empty) {
      return { status: 'warning', message: 'Brak ofert approved do testu linków' };
    }

    let invalid = 0;
    const total = dealsSnapshot.docs.length;

    for (const docSnap of dealsSnapshot.docs) {
      const deal = docSnap.data() as any;
      const candidate = deal.affiliateLink || deal.affiliateUrl || deal.dealUrl || deal.link || '';
      if (!isAbsoluteHttpUrl(candidate)) {
        invalid += 1;
      }
    }

    const ratio = Math.round((invalid / total) * 100);
    if (ratio > 10) {
      return {
        status: 'fail',
        message: `Niepoprawne linki ofert: ${invalid}/${total}`,
        details: { total, invalid },
      };
    }

    if (invalid > 0) {
      return {
        status: 'warning',
        message: `Część linków ofert wymaga poprawy: ${invalid}/${total}`,
        details: { total, invalid },
      };
    }

    return { status: 'pass', message: `Linki ofert OK (${total} sprawdzonych)` , details: { total } };
  } catch (error: any) {
    return { status: 'fail', message: `Test linków ofert nie powiódł się: ${error.message}` };
  }
}

async function testProductImagesPresence(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const productsSnapshot = await getDocs(query(collection(db, 'product_cores'), where('status', '==', 'approved'), limit(120)));
    if (productsSnapshot.empty) {
      return { status: 'warning', message: 'Brak produktów approved do testu obrazów' };
    }

    let missing = 0;
    const total = productsSnapshot.docs.length;

    for (const docSnap of productsSnapshot.docs) {
      const product = docSnap.data() as any;
      const imageUrl = typeof product?.imageUrl === 'string' ? product.imageUrl : '';
      const gallery = Array.isArray(product?.images) ? product.images : [];
      const hasPrimary = isAbsoluteHttpUrl(imageUrl);
      const hasAnyGallery = gallery.some((img: unknown) => isAbsoluteHttpUrl(img));
      if (!hasPrimary && !hasAnyGallery) {
        missing += 1;
      }
    }

    const ratio = Math.round((missing / total) * 100);
    if (ratio > 10) {
      return {
        status: 'fail',
        message: `Brak poprawnych zdjęć produktów: ${missing}/${total}`,
        details: { total, missing },
      };
    }

    if (missing > 0) {
      return {
        status: 'warning',
        message: `Część produktów bez poprawnych zdjęć: ${missing}/${total}`,
        details: { total, missing },
      };
    }

    return { status: 'pass', message: `Zdjęcia produktów OK (${total} sprawdzonych)` , details: { total } };
  } catch (error: any) {
    return { status: 'fail', message: `Test zdjęć produktów nie powiódł się: ${error.message}` };
  }
}

async function testGooglePublicationEligibility(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const productsSnapshot = await getDocs(query(collection(db, 'product_cores'), where('status', '==', 'approved'), limit(120)));
    if (productsSnapshot.empty) {
      return { status: 'warning', message: 'Brak produktów approved do testu eligibility (Google)' };
    }

    let eligible = 0;
    const reasons: Record<string, number> = {};

    for (const docSnap of productsSnapshot.docs) {
      const product = { id: docSnap.id, ...docSnap.data() } as any;
      const state = getGoogleProductPublicationState({ product, isM6: true, deals: [] });
      if (state.eligible) {
        eligible += 1;
      } else {
        for (const reason of state.reasons) {
          reasons[reason] = (reasons[reason] || 0) + 1;
        }
      }
    }

    const total = productsSnapshot.docs.length;
    const ratio = Math.round((eligible / total) * 100);

    if (ratio < 70) {
      return {
        status: 'fail',
        message: `Niska gotowość publikacyjna Google: ${eligible}/${total} (${ratio}%)`,
        details: { total, eligible, ineligible: total - eligible, reasons },
      };
    }

    if (ratio < 90) {
      return {
        status: 'warning',
        message: `Gotowość publikacyjna Google do poprawy: ${eligible}/${total} (${ratio}%)`,
        details: { total, eligible, ineligible: total - eligible, reasons },
      };
    }

    return {
      status: 'pass',
      message: `Gotowość publikacyjna Google OK: ${eligible}/${total} (${ratio}%)`,
      details: { total, eligible, ineligible: total - eligible },
    };
  } catch (error: any) {
    return { status: 'fail', message: `Test eligibility Google nie powiódł się: ${error.message}` };
  }
}

async function testCommentsCount(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    // Znajdź deal z komentarzami
    const dealsQuery = query(
      collection(db, 'deals'),
      where('status','==','approved'),
      where('commentsCount', '>', 0),
      limit(1)
    );
    const dealsSnapshot = await getDocs(dealsQuery);
    
    if (dealsSnapshot.empty) {
      return {
        status: 'skip',
        message: 'No deals with comments to test',
        details: { reason: 'no_data' }
      };
    }
    
    const deal = { id: dealsSnapshot.docs[0].id, ...dealsSnapshot.docs[0].data() } as Deal;
    const commentsQuery = collection(db, `deals/${deal.id}/comments`);
    const commentsSnapshot = await getDocs(commentsQuery);
    const actualCount = commentsSnapshot.size;
    const storedCount = deal.commentsCount || 0;
    
    if (actualCount === storedCount) {
      return {
        status: 'pass',
        message: `Comments count accurate (${actualCount})`,
        details: { dealId: deal.id, count: actualCount }
      };
    } else {
      return {
        status: 'fail',
        message: `Comments count mismatch: stored=${storedCount}, actual=${actualCount}`,
        details: { dealId: deal.id, stored: storedCount, actual: actualCount }
      };
    }
  } catch (error: any) {
    if (String(error.message).includes('index')) {
      return { status: 'warning', message: 'Comments count requires index (status + commentsCount)', details: { error: error.message } };
    }
    return { status: 'fail', message: `Comments count test failed: ${error.message}` };
  }
}

async function testVotingSystem(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    // Znajdź deal z głosami
    const dealsQuery = query(
      collection(db, 'deals'),
      where('status','==','approved'),
      where('voteCount', '>', 0),
      limit(1)
    );
    const dealsSnapshot = await getDocs(dealsQuery);
    
    if (dealsSnapshot.empty) {
      return {
        status: 'skip',
        message: 'No deals with votes to test',
        details: { reason: 'no_data' }
      };
    }
    
    const deal = { id: dealsSnapshot.docs[0].id, ...dealsSnapshot.docs[0].data() } as Deal;
    
    // Sprawdź temperature ratio (10 pkt per vote)
    const expectedMinTemp = deal.voteCount * 10;
    const expectedMaxTemp = deal.voteCount * 10 + 100; // Buffer for down votes
    
    if (deal.temperature >= expectedMinTemp && deal.temperature <= expectedMaxTemp) {
      return {
        status: 'pass',
        message: `Voting system OK (temp=${deal.temperature}, votes=${deal.voteCount})`,
        details: { dealId: deal.id, temperature: deal.temperature, voteCount: deal.voteCount }
      };
    } else {
      return {
        status: 'warning',
        message: `Temperature unusual: ${deal.temperature} for ${deal.voteCount} votes`,
        details: { dealId: deal.id, temperature: deal.temperature, voteCount: deal.voteCount }
      };
    }
  } catch (error: any) {
    if (String(error.message).includes('index')) {
      return { status: 'warning', message: 'Voting test requires index (status + voteCount)', details: { error: error.message } };
    }
    return { status: 'fail', message: `Voting test failed: ${error.message}` };
  }
}

async function testCategoriesStructure(): Promise<{ status: TestResult['status']; message: string; details?: any }> {
  try {
    const categoriesQuery = query(collection(db, 'categories'));
    const categoriesSnapshot = await getDocs(categoriesQuery);
    
    if (categoriesSnapshot.empty) {
      return {
        status: 'fail',
        message: 'No categories found - critical for navigation',
        details: { count: 0 }
      };
    }
    
    const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    let totalSubcategories = 0;
    const sampleCats = categories.slice(0, 5);
    const subCounts = await Promise.all(sampleCats.map(async (cat: any) => {
      const subSnap = await getDocs(collection(db, `categories/${cat.id}/subcategories`));
      return subSnap.size;
    }));
    totalSubcategories = subCounts.reduce((sum, v) => sum + v, 0);
    
    return {
      status: 'pass',
      message: `Categories OK (${categories.length} main, ${totalSubcategories} sub in sample)`,
      details: { mainCategories: categories.length, subcategoriesSample: totalSubcategories }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Categories test failed: ${error.message}` };
  }
}

/**
 * ===========================================
 * TESTY BIZNESOWE
 * ===========================================
 */

async function testApprovedContent(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const [dealsCount, productsCount] = await Promise.all([
      getCountFromServer(query(collection(db, 'deals'), where('status', '==', 'approved'))),
      getCountFromServer(query(collection(db, 'product_cores'), where('status', '==', 'approved')))
    ]);
    
    const approvedDeals = dealsCount.data().count;
    const approvedProducts = productsCount.data().count;
    
    if (approvedDeals === 0 && approvedProducts === 0) {
      return {
        status: 'warning',
        message: 'No approved content - users will see empty pages',
        details: { deals: 0, products: 0 }
      };
    }
    
    return {
      status: 'pass',
      message: `Approved content OK (${approvedDeals} deals, ${approvedProducts} product cores)`,
      details: { deals: approvedDeals, productCores: approvedProducts }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Approved content test failed: ${error.message}` };
  }
}

async function testPendingModeration(opts?: TestAuthOptions): Promise<{ status: 'pass' | 'fail' | 'warning' | 'skip'; message: string; details?: any }> {
  // Wymaga admin uprawnień do odczytu draft/pending
  const login = await authLogin(opts?.adminEmail, opts?.adminPassword);
  if (!login.ok) {
    return { status: 'skip', message: 'Moderation queue requires admin credentials' };
  }
  await ensureTestUser(login.uid, 'admin');
  
  try {
    const [dealsCount, productsCount] = await Promise.all([
      getCountFromServer(query(collection(db, 'deals'), where('status', 'in', ['draft', 'pending']))),
      getCountFromServer(query(collection(db, 'product_cores'), where('status', 'in', ['draft', 'pending'])))
    ]);
    
    const pendingDeals = dealsCount.data().count;
    const pendingProducts = productsCount.data().count;
    const total = pendingDeals + pendingProducts;
    
    await authLogout();
    
    if (total > 50) {
      return {
        status: 'warning',
        message: `High moderation queue: ${total} items waiting`,
        details: { deals: pendingDeals, productCores: pendingProducts }
      };
    }
    
    return {
      status: 'pass',
      message: `Moderation queue OK (${total} items)`,
      details: { deals: pendingDeals, productCores: pendingProducts }
    };
  } catch (error: any) {
    await authLogout();
    if (String(error.message).includes('Missing or insufficient permissions')) {
      return { status: 'warning', message: 'Moderation queue requires admin permissions' };
    }
    return { status: 'fail', message: `Moderation test failed: ${error.message}` };
  }
}

async function testUserActivity(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const usersCount = await getCountFromServer(collection(db, 'users'));
    const totalUsers = usersCount.data().count;
    
    if (totalUsers === 0) {
      return {
        status: 'warning',
        message: 'No users registered',
        details: { count: 0 }
      };
    }
    
    // Sprawdź aktywność (deals dodane przez użytkowników)
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentDealsQuery = query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      where('postedAt', '>=', last30Days.toISOString()),
      limit(100)
    );
    const recentDealsSnapshot = await getDocs(recentDealsQuery);
    const recentDeals = recentDealsSnapshot.size;
    
    return {
      status: 'pass',
      message: `User activity OK (${totalUsers} users, ${recentDeals} deals/30d)`,
      details: { users: totalUsers, recentDeals }
    };
  } catch (error: any) {
    if (String(error.message).includes('permission')) {
      return { status: 'warning', message: 'User activity requires read permissions for approved deals', details: { error: error.message } };
    }
    return { status: 'fail', message: `User activity test failed: ${error.message}` };
  }
}

async function testHotDeals(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    const hotDealsQuery = query(
      collection(db, 'deals'),
      where('status', '==', 'approved'),
      where('temperature', '>=', 300),
      limit(10)
    );
    const hotDealsSnapshot = await getDocs(hotDealsQuery);
    const hotDeals = hotDealsSnapshot.size;
    
    if (hotDeals === 0) {
      return {
        status: 'warning',
        message: 'No hot deals (temp >= 300) - homepage may look empty',
        details: { count: 0 }
      };
    }
    
    return {
      status: 'pass',
      message: `Hot deals OK (${hotDeals} deals with temp >= 300)`,
      details: { count: hotDeals }
    };
  } catch (error: any) {
    if (String(error.message).includes('index')) {
      return { status: 'warning', message: 'Hot deals query requires index (status + temperature)', details: { error: error.message } };
    }
    return { status: 'fail', message: `Hot deals test failed: ${error.message}` };
  }
}

async function testDataQuality(): Promise<{ status: 'pass' | 'fail' | 'warning'; message: string; details?: any }> {
  try {
    // Sprawdź jakość danych ofert z fallbackiem obrazów do ProductCore (M6)
    const dealsQuery = query(collection(db, 'deals'), where('status', '==', 'approved'), limit(100));
    const dealsSnapshot = await getDocs(dealsQuery);
    const deals = dealsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Deal));

    const productCoreIdsToCheck = new Set<string>();
    for (const deal of deals as any[]) {
      if (!hasAnyValidImage(deal) && typeof deal?.productCoreId === 'string' && deal.productCoreId) {
        productCoreIdsToCheck.add(deal.productCoreId);
      }
    }

    const productCoreHasImage = new Map<string, boolean>();
    const ids = Array.from(productCoreIdsToCheck);
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      if (chunk.length === 0) continue;
      const coresSnapshot = await getDocs(
        query(collection(db, 'product_cores'), where(documentId(), 'in', chunk))
      );
      for (const coreDoc of coresSnapshot.docs) {
        productCoreHasImage.set(coreDoc.id, hasAnyValidImage(coreDoc.data()));
      }
    }

    let withoutImages = 0;
    let withoutDescriptions = 0;
    let recoveredByProductCoreImage = 0;

    for (const deal of deals as any[]) {
      const directImage = hasAnyValidImage(deal);
      const coreImage = typeof deal?.productCoreId === 'string' ? (productCoreHasImage.get(deal.productCoreId) || false) : false;
      if (!directImage && !coreImage) {
        withoutImages += 1;
      }
      if (!directImage && coreImage) {
        recoveredByProductCoreImage += 1;
      }

      if (!hasLocalizedContent(deal?.description)) {
        withoutDescriptions += 1;
      }
    }

    const percentage = deals.length > 0 ? Math.round((withoutImages / deals.length) * 100) : 0;
    
    if (percentage > 30) {
      return {
        status: 'warning',
        message: `${percentage}% deals without images, ${withoutDescriptions} without descriptions`,
        details: {
          total: deals.length,
          noImages: withoutImages,
          noDescriptions: withoutDescriptions,
          recoveredByProductCoreImage,
        }
      };
    }
    
    return {
      status: 'pass',
      message: `Data quality OK (${percentage}% without images)`,
      details: {
        total: deals.length,
        noImages: withoutImages,
        noDescriptions: withoutDescriptions,
        recoveredByProductCoreImage,
      }
    };
  } catch (error: any) {
    return { status: 'fail', message: `Data quality test failed: ${error.message}` };
  }
}

/**
 * ===========================================
 * GŁÓWNY TEST RUNNER
 * ===========================================
 */

// ==============================
// SECURITY TEST HELPERS & TESTS
// ==============================
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, setDoc, deleteDoc } from 'firebase/firestore';

type SecurityResult = { status: TestResult['status']; message: string; details?: any };

async function securityGuestApprovedDeal(): Promise<SecurityResult> {
  try {
    // guest (no auth) should read at least one approved deal
    const q = query(collection(db,'deals'), where('status','==','approved'), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return { status:'pass', message:'Guest can read approved deal', details:{dealId:snap.docs[0].id} };
    return { status:'warning', message:'No approved deals present to test' };
  } catch (e:any) {
    return { status:'fail', message:`Guest read failed: ${e.message}` };
  }
}

async function securityGuestDraftDeal(): Promise<SecurityResult> {
  try {
    const q = query(collection(db,'deals'), where('status','==','draft'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { status:'skip', message:'No draft deal to attempt read' };
    // Try to read directly (already read if snap succeeded) – if rules block, we wouldn't get here.
    // If we read a draft, rules are too permissive.
    return { status:'fail', message:'Guest could read draft deal', details:{dealId:snap.docs[0].id} };
  } catch (e:any) {
    // Expected failure
    return { status:'pass', message:'Guest blocked from reading draft deal' };
  }
}

type AuthLoginResult = { ok: true; uid: string } | { ok: false; reason: string };

async function authLogin(email?: string, password?: string): Promise<AuthLoginResult> {
  if (!email || !password) return { ok: false, reason: 'missing_credentials' };
  try {
    const auth = getAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, uid: cred.user.uid };
  } catch (e: any) {
    return { ok: false, reason: e.message };
  }
}

async function authLogout() {
  try { const auth = getAuth(); await signOut(auth); } catch {}
}

async function ensureTestUser(uid:string, role:'user'|'admin') {
  try {
    await setDoc(doc(db,'users',uid), { role, updatedAt:new Date().toISOString() }, { merge:true });
  } catch {}
}

async function createEphemeralDraftDeal(ownerUid:string) {
  const data = {
    title:'SEC TEST DEAL', price:1, postedBy:ownerUid, status:'draft', temperature:0, voteCount:0, commentsCount:0,
    mainCategorySlug:'test', postedAt:new Date().toISOString(),
    dealUrl:'https://example.com/test', link:'https://example.com/test'
  };
  const ref = await addDoc(collection(db,'deals'), data);
  return ref.id;
}

async function securityUserCreateDraftDeal(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials provided' };
  await ensureTestUser(login.uid,'user');
  try {
    const dealId = await createEphemeralDraftDeal(login.uid);
    await authLogout();
    return { status:'pass', message:'User created draft deal', details:{dealId} };
  } catch (e:any) {
    await authLogout();
    if (e.message.includes('Missing or insufficient permissions')) {
      return { status:'fail', message:'Permissions blocked user draft create' };
    }
    return { status:'fail', message:e.message };
  }
}

async function securityUserUpdateOwnDeal(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials' };
  await ensureTestUser(login.uid,'user');
  const dealId = await createEphemeralDraftDeal(login.uid);
  try {
    const ref = doc(db,'deals',dealId);
    await setDoc(ref,{ title:'SEC UPDATED', status:'draft' }, { merge:true });
    await authLogout();
    return { status:'pass', message:'User updated own draft deal' };
  } catch (e:any) {
    await authLogout();
    return { status:'fail', message:`Update failed: ${e.message}` };
  }
}

async function securityUserCannotDeleteDeal(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials' };
  await ensureTestUser(login.uid,'user');
  const dealId = await createEphemeralDraftDeal(login.uid);
  try {
    await deleteDoc(doc(db,'deals',dealId));
    await authLogout();
    return { status:'fail', message:'User managed to delete deal (should be blocked)' };
  } catch (e:any) {
    await authLogout();
    if (e.message.includes('Missing or insufficient permissions')) {
      return { status:'pass', message:'User correctly blocked from deleting deal' };
    }
    return { status:'warning', message:`Delete produced different error: ${e.message}` };
  }
}

async function securityAdminReadDraftDeal(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.adminEmail, opts?.adminPassword);
  if (!login.ok) return { status:'skip', message:'No admin credentials' };
  await ensureTestUser(login.uid,'admin');
  try {
    const q = query(collection(db,'deals'), where('status','==','draft'), limit(1));
    const snap = await getDocs(q);
    await authLogout();
    if (snap.empty) return { status:'skip', message:'No draft deal to read' };
    return { status:'pass', message:'Admin read draft deal', details:{dealId:snap.docs[0].id} };
  } catch (e:any) {
    await authLogout();
    return { status:'fail', message:e.message };
  }
}

async function securityAdminModerateDeal(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.adminEmail, opts?.adminPassword);
  if (!login.ok) return { status:'skip', message:'No admin credentials' };
  await ensureTestUser(login.uid,'admin');
  const dealId = await createEphemeralDraftDeal(login.uid); // owner admin
  try {
    await setDoc(doc(db,'deals',dealId), { status:'approved' }, { merge:true });
    await authLogout();
    return { status:'pass', message:'Admin moderated deal to approved', details:{dealId} };
  } catch (e:any) {
    await authLogout();
    return { status:'fail', message:`Moderation failed: ${e.message}` };
  }
}

async function securityUserVoteUpdate(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials' };
  await ensureTestUser(login.uid,'user');
  const dealId = await createEphemeralDraftDeal(login.uid);
  try {
    // attempt to update temperature directly (allowed via limited keys rule?)
    await setDoc(doc(db,'deals',dealId), { temperature:5, voteCount:1 }, { merge:true });
    await authLogout();
    return { status:'pass', message:'User updated temperature/voteCount' };
  } catch (e:any) {
    await authLogout();
    return { status:'fail', message:`Vote update blocked: ${e.message}` };
  }
}

async function securityUserAddComment(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials' };
  await ensureTestUser(login.uid,'user');
  // Need approved deal to comment – find one
  const q = query(collection(db,'deals'), where('status','==','approved'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) { await authLogout(); return { status:'skip', message:'No approved deal for comment test' }; }
  const dealId = snap.docs[0].id;
  try {
    const ref = collection(db,`deals/${dealId}/comments`);
    await addDoc(ref,{ userId:login.uid, content:'SEC COMMENT', createdAt:new Date().toISOString() });
    await authLogout();
    return { status:'pass', message:'User added comment' };
  } catch (e:any) {
    await authLogout();
    return { status:'fail', message:`Comment add failed: ${e.message}` };
  }
}

async function securityUserCannotEditOthersComment(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials' };
  await ensureTestUser(login.uid,'user');
  const q = query(collection(db,'deals'), where('status','==','approved'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) { await authLogout(); return { status:'skip', message:'No approved deal' }; }
  const dealId = snap.docs[0].id;
  // create comment as admin to attempt edit by user
  const adminLogin = await authLogin(opts?.adminEmail, opts?.adminPassword);
  if (!adminLogin.ok) { await authLogout(); return { status:'skip', message:'No admin creds for other-comment test' }; }
  await ensureTestUser(adminLogin.uid,'admin');
  const commentRef = await addDoc(collection(db,`deals/${dealId}/comments`), { userId:adminLogin.uid, content:'ADMIN COMMENT', createdAt:new Date().toISOString() });
  await authLogout(); // logout admin
  // user tries update foreign comment
  const relog = await authLogin(opts?.userEmail, opts?.userPassword);
  try {
    await setDoc(doc(db,`deals/${dealId}/comments/${commentRef.id}`), { content:'HACK' }, { merge:true });
    await authLogout();
    return { status:'fail', message:'User edited others comment (should be blocked)' };
  } catch (e:any) {
    await authLogout();
    if (e.message.includes('Missing or insufficient permissions')) {
      return { status:'pass', message:'User blocked from editing others comment' };
    }
    return { status:'warning', message:`Unexpected error: ${e.message}` };
  }
}

async function securityFavoritesIsolation(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials' };
  await ensureTestUser(login.uid,'user');
  // create favorite
  try {
    const favRef = await addDoc(collection(db,'favorites'), { userId:login.uid, dealId:'fake-deal', createdAt:new Date().toISOString() });
    await authLogout();
    // attempt guest read
    try {
      const favSnap = await getDoc(doc(db,'favorites', favRef.id));
      if (favSnap.exists()) {
        return { status:'fail', message:'Guest could read private favorite' };
      }
      return { status:'pass', message:'Guest cannot read favorite (expected)' };
    } catch (e:any) {
      if (String(e.message).includes('Missing or insufficient permissions')) {
        return { status:'pass', message:'Guest blocked by security rules' };
      }
      return { status:'fail', message:`Favorite test error: ${e.message}` };
    }
  } catch (e:any) {
    await authLogout();
    return { status:'fail', message:`Favorite test error: ${e.message}` };
  }
}

async function securityNotificationsIsolation(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials' };
  await ensureTestUser(login.uid,'user');
  try {
    const notRef = await addDoc(collection(db,'notifications'), { userId:login.uid, type:'info', message:'Test', createdAt:new Date().toISOString() });
    await authLogout();
    // guest cannot read
    try {
      const snap = await getDoc(doc(db,'notifications',notRef.id));
      if (snap.exists()) return { status:'fail', message:'Guest could read notification' };
      return { status:'pass', message:'Guest blocked from reading notification' };
    } catch (e:any) {
      if (String(e.message).includes('Missing or insufficient permissions')) {
        return { status:'pass', message:'Guest blocked by security rules' };
      }
      return { status:'fail', message:`Notification isolation error: ${e.message}` };
    }
  } catch (e:any) {
    await authLogout();
    return { status:'fail', message:`Notification isolation error: ${e.message}` };
  }
}

async function securityProductRatingOwnDoc(opts?: TestAuthOptions): Promise<SecurityResult> {
  const login = await authLogin(opts?.userEmail, opts?.userPassword);
  if (!login.ok) return { status:'skip', message:'No user credentials' };
  await ensureTestUser(login.uid,'user');
  // find approved product core
  const q = query(collection(db,'product_cores'), where('status','==','approved'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) { await authLogout(); return { status:'skip', message:'No approved product core' }; }
  const productId = snap.docs[0].id;
  try {
    await setDoc(doc(db,`product_cores/${productId}/ratings/${login.uid}`), { value:5, updatedAt:new Date().toISOString() }, { merge:true });
    await authLogout();
    return { status:'pass', message:'User set own rating' };
  } catch (e:any) {
    await authLogout();
    return { status:'fail', message:`Rating set failed: ${e.message}` };
  }
}

export async function runAllTests(options?: TestAuthOptions): Promise<TestSuiteResult> {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  console.log('🚀 Starting comprehensive test suite...');
  
  const results: TestResult[] = [];
  
  // TECHNICAL TESTS
  console.log('⚙️  Running technical tests...');
  results.push(await runTest('tech-001', 'Firestore Connection', 'technical', () => withOptionalAuth(testFirestoreConnection, options)));
  results.push(await runTest('tech-002', 'Collections Exist', 'technical', () => withOptionalAuth(testCollectionsExist, options)));
  results.push(await runTest('tech-003', 'Firestore Indexes', 'technical', () => withOptionalAuth(testIndexes, options)));
  
  // FUNCTIONAL TESTS
  console.log('🔧 Running functional tests...');
  results.push(await runTest('func-001', 'Deals CRUD Operations', 'functional', () => withOptionalAuth(testDealsCRUD, options)));
  results.push(await runTest('func-002', 'ProductCores CRUD Operations', 'functional', () => withOptionalAuth(testProductsCRUD, options)));
  results.push(await runTest('func-003', 'Harvester Linkage (Deal -> ProductCore)', 'functional', () => withOptionalAuth(testHarvesterLinkage, options)));
  results.push(await runTest('func-004', 'Refiner Product Localization', 'functional', () => withOptionalAuth(testRefinerProductLocalization, options)));
  results.push(await runTest('func-005', 'Refiner Deal Localization', 'functional', () => withOptionalAuth(testRefinerDealLocalization, options)));
  results.push(await runTest('func-006', 'Translations Coverage (6 locales)', 'functional', () => withOptionalAuth(testSixLocalesCoverage, options)));
  results.push(await runTest('func-007', 'M6 Price Consistency', 'functional', () => withOptionalAuth(testM6PriceConsistency, options)));
  results.push(await runTest('func-008', 'Offer Links Validity', 'functional', () => withOptionalAuth(testOfferLinksValidity, options)));
  results.push(await runTest('func-009', 'Product Images Presence', 'functional', () => withOptionalAuth(testProductImagesPresence, options)));
  results.push(await runTest('func-010', 'Comments Counter Accuracy', 'functional', () => withOptionalAuth(testCommentsCount, options)));
  results.push(await runTest('func-011', 'Voting System Logic', 'functional', () => withOptionalAuth(testVotingSystem, options)));
  results.push(await runTest('func-012', 'Categories Structure', 'functional', testCategoriesStructure));
  
  // BUSINESS TESTS
  console.log('💼 Running business logic tests...');
  results.push(await runTest('biz-001', 'Approved Content Availability', 'business', () => withOptionalAuth(testApprovedContent, options)));
  results.push(await runTest('biz-002', 'Moderation Queue Status', 'business', () => testPendingModeration(options)));
  results.push(await runTest('biz-003', 'User Activity Metrics', 'business', () => withOptionalAuth(testUserActivity, options)));
  results.push(await runTest('biz-004', 'Hot Deals Presence', 'business', () => withOptionalAuth(testHotDeals, options)));
  results.push(await runTest('biz-005', 'Data Quality Check', 'business', () => withOptionalAuth(testDataQuality, options)));
  results.push(await runTest('biz-006', 'Google Publication Eligibility', 'business', () => withOptionalAuth(testGooglePublicationEligibility, options)));

  // SECURITY TESTS (read/write matrix)
  console.log('🔐 Running security rules tests...');
  results.push(await runTest('sec-001', 'Guest Read Approved Deal', 'security', async () => securityGuestApprovedDeal()));
  results.push(await runTest('sec-002', 'Guest Read Draft Deal Should Fail', 'security', async () => securityGuestDraftDeal()));
  results.push(await runTest('sec-003', 'User Create Draft Deal', 'security', async () => securityUserCreateDraftDeal(options)));
  results.push(await runTest('sec-004', 'User Update Own Deal', 'security', async () => securityUserUpdateOwnDeal(options)));
  results.push(await runTest('sec-005', 'User Cannot Delete Deal', 'security', async () => securityUserCannotDeleteDeal(options)));
  results.push(await runTest('sec-006', 'Admin Read Draft Deal', 'security', async () => securityAdminReadDraftDeal(options)));
  results.push(await runTest('sec-007', 'Admin Moderate Deal (status change)', 'security', async () => securityAdminModerateDeal(options)));
  results.push(await runTest('sec-008', 'User Vote Updates temperature/voteCount', 'security', async () => securityUserVoteUpdate(options)));
  results.push(await runTest('sec-009', 'User Add Comment To Approved Deal', 'security', async () => securityUserAddComment(options)));
  results.push(await runTest('sec-010', 'User Cannot Edit Someone Else Comment', 'security', async () => securityUserCannotEditOthersComment(options)));
  results.push(await runTest('sec-011', 'Favorites Isolation (read only own)', 'security', async () => securityFavoritesIsolation(options)));
  results.push(await runTest('sec-012', 'Notifications Isolation (read only own)', 'security', async () => securityNotificationsIsolation(options)));
  results.push(await runTest('sec-013', 'Product Rating Only Own Doc', 'security', async () => securityProductRatingOwnDoc(options)));

  const duration = Math.round(performance.now() - startTime);
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  console.log(`✅ Tests completed in ${duration}ms`);
  console.log(`   Passed: ${passed}, Failed: ${failed}, Warnings: ${warnings}, Skipped: ${skipped}`);
  
  return {
    timestamp,
    duration,
    totalTests: results.length,
    passed,
    failed,
    warnings,
    skipped,
    results
  };
}
