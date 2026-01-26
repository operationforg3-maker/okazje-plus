import { z } from 'zod';

/**
 * Product description formatting utilities
 * Converts plain text descriptions to richly formatted HTML with structure
 */

export const formatProductDescriptionInputSchema = z.object({
  title: z.string().describe('Product title'),
  plainDescription: z.string().describe('Plain text description'),
  specs: z.record(z.string()).optional().describe('Product specifications'),
  features: z.array(z.string()).optional().describe('Key features list'),
});

export type FormatProductDescriptionInput = z.infer<typeof formatProductDescriptionInputSchema>;

/**
 * Format plain product description into rich HTML
 * Includes:
 * - Main heading with title
 * - Introduction/hook
 * - Key features section
 * - Specifications table
 * - Structured data markup
 */
export function formatProductDescription(
  input: FormatProductDescriptionInput
): string {
  const { title, plainDescription, specs = {}, features = [] } = input;

  let html = `<article class="product-description">\n`;

  // Header with title
  html += `  <h1 class="product-title">${escapeHtml(title)}</h1>\n`;

  // Introduction
  if (plainDescription.trim()) {
    const intro = plainDescription.split('\n')[0] || plainDescription;
    html += `  <p class="product-intro">${escapeHtml(intro)}</p>\n`;
  }

  // Key Features Section
  if (features && features.length > 0) {
    html += `\n  <section class="features">\n`;
    html += `    <h2>Kluczowe Cechy</h2>\n`;
    html += `    <ul class="features-list">\n`;
    features.forEach((feature) => {
      html += `      <li>${escapeHtml(feature)}</li>\n`;
    });
    html += `    </ul>\n`;
    html += `  </section>\n`;
  }

  // Specifications Table
  if (Object.keys(specs).length > 0) {
    html += `\n  <section class="specifications">\n`;
    html += `    <h2>Specyfikacja Techniczna</h2>\n`;
    html += `    <table class="specs-table">\n`;
    html += `      <tbody>\n`;
    Object.entries(specs).forEach(([key, value]) => {
      html += `        <tr>\n`;
      html += `          <th>${escapeHtml(key)}</th>\n`;
      html += `          <td>${escapeHtml(String(value))}</td>\n`;
      html += `        </tr>\n`;
    });
    html += `      </tbody>\n`;
    html += `    </table>\n`;
    html += `  </section>\n`;
  }

  // Full description (if longer than intro)
  if (plainDescription.trim().length > 100) {
    html += `\n  <section class="full-description">\n`;
    html += `    <h2>Szczegółowy Opis</h2>\n`;
    // Split by paragraphs and wrap in <p> tags
    const paragraphs = plainDescription.split('\n\n').filter((p) => p.trim());
    paragraphs.forEach((para) => {
      html += `    <p>${escapeHtml(para)}</p>\n`;
    });
    html += `  </section>\n`;
  }

  html += `</article>\n`;

  return html;
}

/**
 * Format specifications for display
 * Groups specs by category and normalizes labels
 */
export function formatSpecs(specs: Record<string, string>): {
  formatted: Record<string, string>;
  groups: Record<string, Record<string, string>>;
} {
  const formatted: Record<string, string> = {};
  const groups: Record<string, Record<string, string>> = {
    physical: {},
    technical: {},
    connectivity: {},
    power: {},
    warranty: {},
    other: {},
  };

  const categoryPatterns = {
    physical: /size|dimensions|weight|color|material|finish/i,
    technical: /processor|cpu|gpu|ram|memory|storage|screen|display|resolution|refresh/i,
    connectivity: /bluetooth|wifi|usb|nfc|5g|4g|network/i,
    power: /battery|charge|watt|voltage|current/i,
    warranty: /warranty|guarantee|year|month/i,
  };

  for (const [key, value] of Object.entries(specs)) {
    // Normalize key (title case)
    const normalizedKey = key
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    formatted[normalizedKey] = value;

    // Categorize
    let category = 'other';
    for (const [cat, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(key)) {
        category = cat;
        break;
      }
    }

    groups[category][normalizedKey] = value;
  }

  return { formatted, groups };
}

/**
 * Generate bullet points from specifications
 * Highlights most important specs
 */
export function specsToFeatures(specs: Record<string, string>): string[] {
  const features: string[] = [];
  const priorityKeys = [
    'processor',
    'ram',
    'storage',
    'screen',
    'battery',
    'camera',
    'display',
  ];

  // High-priority specs first
  for (const priority of priorityKeys) {
    const key = Object.keys(specs).find((k) => k.toLowerCase().includes(priority));
    if (key && specs[key]) {
      features.push(`${key}: ${specs[key]}`);
    }
  }

  // Add remaining specs up to limit
  const limit = 6;
  for (const [key, value] of Object.entries(specs)) {
    if (features.length >= limit) break;
    if (!features.some((f) => f.startsWith(key))) {
      features.push(`${key}: ${value}`);
    }
  }

  return features;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}
