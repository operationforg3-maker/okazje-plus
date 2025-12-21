import crypto from 'crypto';

/**
 * Calculate SHA-256 hash of text (normalized)
 */
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Normalize text for consistent hashing
 * - lowercase
 * - trim whitespace
 * - remove special characters
 * - collapse multiple spaces
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

/**
 * Calculate hash for a product title
 * Used to identify similar products
 */
export function calculateTitleHash(title: string): string {
  const normalized = normalizeText(title);
  return sha256(normalized);
}

/**
 * Calculate hash for an image (using URL as proxy)
 * In production, you'd extract actual image bytes
 */
export function calculateImageHash(imageUrl: string): string {
  // Normalize URL (remove query params, protocols)
  const normalized = new URL(imageUrl).pathname + new URL(imageUrl).search;
  return sha256(normalized);
}

/**
 * Calculate combined identity hash for a product
 * IdentityHash = SHA256(titleHash + imageHash)
 * This is the PRIMARY KEY for product deduplication
 */
export function calculateIdentityHash(title: string, imageUrl: string): string {
  const titleHash = calculateTitleHash(title);
  const imageHash = calculateImageHash(imageUrl);
  const combined = titleHash + imageHash;
  return sha256(combined);
}

/**
 * Normalize product identifier (SKU/EAN/GTIN/UPC) for matching
 * - Remove whitespace, dashes, dots
 * - Uppercase
 * - Validate format if applicable
 */
export function normalizeProductIdentifier(identifier: string): string {
  return identifier
    .replace(/[\s\-\.]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Check if two products match by standard identifiers (SKU/EAN/GTIN/UPC)
 * Returns true if ANY identifier matches (exact match after normalization)
 * This is the STRONGEST deduplication signal - should be checked FIRST
 */
export function matchByIdentifiers(
  identifiers1: { sku?: string; ean?: string; gtin?: string; upc?: string; mpn?: string },
  identifiers2: { sku?: string; ean?: string; gtin?: string; upc?: string; mpn?: string }
): boolean {
  // Check EAN (most universal for European products)
  if (identifiers1.ean && identifiers2.ean) {
    if (normalizeProductIdentifier(identifiers1.ean) === normalizeProductIdentifier(identifiers2.ean)) {
      return true;
    }
  }
  
  // Check GTIN (global standard)
  if (identifiers1.gtin && identifiers2.gtin) {
    if (normalizeProductIdentifier(identifiers1.gtin) === normalizeProductIdentifier(identifiers2.gtin)) {
      return true;
    }
  }
  
  // Check UPC (North American standard)
  if (identifiers1.upc && identifiers2.upc) {
    if (normalizeProductIdentifier(identifiers1.upc) === normalizeProductIdentifier(identifiers2.upc)) {
      return true;
    }
  }
  
  // Check MPN (Manufacturer Part Number - unique per manufacturer)
  if (identifiers1.mpn && identifiers2.mpn) {
    if (normalizeProductIdentifier(identifiers1.mpn) === normalizeProductIdentifier(identifiers2.mpn)) {
      return true;
    }
  }
  
  // SKU is seller-specific, only match if from same source
  // (handled separately in harvester logic)
  
  return false;
}

/**
 * Calculate similarity score between two text strings (0-1)
 * Uses Levenshtein distance normalized to 0-1
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  
  if (norm1 === norm2) return 1;
  
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(norm1, norm2);
  return 1 - (distance / maxLen);
}

/**
 * Levenshtein distance between two strings
 * Used for fuzzy matching
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Find potential duplicates by comparing title similarity
 * Returns similarity score (0-1)
 */
export function findDuplicateByTitle(title1: string, title2: string, threshold: number = 0.85): boolean {
  const similarity = calculateTextSimilarity(title1, title2);
  return similarity >= threshold;
}

/**
 * Extract key dimensions from title (e.g., "16GB", "1TB", "15.6 inch")
 * Used for spec extraction from raw titles
 */
export function extractDimensionsFromTitle(title: string): Record<string, string> {
  const dimensions: Record<string, string> = {};
  
  // RAM patterns: XGB, X GB
  const ramMatch = title.match(/(\d+)\s*GB\s+(RAM|memory|SDRAM)?/i);
  if (ramMatch) dimensions['RAM'] = `${ramMatch[1]}GB`;
  
  // Storage patterns: XGB, XTB
  const storageMatch = title.match(/(\d+)\s*(GB|TB)\s+(SSD|HDD|storage|memory)?/i);
  if (storageMatch) dimensions['Storage'] = `${storageMatch[1]}${storageMatch[2]}`;
  
  // Screen size patterns: X.X inch, X"
  const screenMatch = title.match(/(\d+\.?\d*)\s*(?:inch|"|\")/i);
  if (screenMatch) dimensions['Screen'] = `${screenMatch[1]}"`;
  
  // Weight patterns: XKG, XG, Xkg
  const weightMatch = title.match(/(\d+\.?\d*)\s*(kg|g)/i);
  if (weightMatch) dimensions['Weight'] = `${weightMatch[1]}${weightMatch[2]}`;
  
  return dimensions;
}
