/**
 * Synonym mapping for better search results
 * Maps common search terms to their variations
 */

export const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Electronics & Displays
  'monitor': ['screen', 'display', 'lcd', 'led'],
  'screen': ['monitor', 'display'],
  'display': ['monitor', 'screen'],
  
  // Computing
  'laptop': ['notebook', 'ultrabook', 'macbook'],
  'notebook': ['laptop', 'ultrabook'],
  'computer': ['pc', 'desktop'],
  'pc': ['computer', 'desktop'],
  
  // Mobile
  'phone': ['smartphone', 'mobile', 'cellphone'],
  'smartphone': ['phone', 'mobile'],
  'mobile': ['phone', 'smartphone'],
  
  // Audio
  'headphones': ['earphones', 'earbuds', 'headset'],
  'earphones': ['headphones', 'earbuds'],
  'earbuds': ['headphones', 'earphones'],
  
  // Storage
  'ssd': ['solid state drive', 'nvme'],
  'hdd': ['hard drive', 'hard disk'],
  
  // Peripherals
  'keyboard': ['keypad'],
  'mouse': ['mice'],
  
  // Smart devices
  'smartwatch': ['smart watch', 'fitness tracker'],
  'tablet': ['ipad'],
  
  // Home
  'vacuum': ['hoover', 'cleaner'],
  'tv': ['television'],
};

/**
 * Expands search query with synonyms
 * @param query Original search query
 * @returns Array of search terms including synonyms
 */
export function expandQueryWithSynonyms(query: string): string[] {
  const terms = new Set<string>();
  const normalizedQuery = query.toLowerCase().trim();
  
  terms.add(normalizedQuery); // Always include original
  
  // Check each word in the query
  const words = normalizedQuery.split(/\s+/);
  
  for (const word of words) {
    // Add synonyms if found
    if (SEARCH_SYNONYMS[word]) {
      SEARCH_SYNONYMS[word].forEach(synonym => terms.add(synonym));
    }
  }
  
  return Array.from(terms);
}

/**
 * Generates a combined search query from original + synonyms
 * Useful for API queries that support multiple keywords
 */
export function getCombinedSearchQuery(query: string): string {
  const terms = expandQueryWithSynonyms(query);
  return terms.join(' OR ');
}

/**
 * Simple fuzzy match score (0-1) based on Levenshtein distance
 * @param a First string
 * @param b Second string
 * @returns Similarity score (0 = no match, 1 = perfect match)
 */
export function fuzzyMatchScore(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  // Exact match
  if (aLower === bLower) return 1;
  
  // Contains match
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return 0.8;
  }
  
  // Levenshtein distance
  const distance = levenshteinDistance(aLower, bLower);
  const maxLen = Math.max(a.length, b.length);
  
  return 1 - (distance / maxLen);
}

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Ranks products by relevance to search query
 * @param products Array of products with title
 * @param query Search query
 * @returns Sorted array with relevance scores
 */
export function rankProductsByRelevance<T extends { title: string }>(
  products: T[],
  query: string
): Array<T & { relevanceScore: number }> {
  const queryTerms = expandQueryWithSynonyms(query);
  
  return products
    .map(product => {
      // Calculate max relevance across all query terms
      const scores = queryTerms.map(term => 
        fuzzyMatchScore(product.title, term)
      );
      const relevanceScore = Math.max(...scores);
      
      return {
        ...product,
        relevanceScore,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
