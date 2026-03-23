const PROMOTIONAL_PATTERNS: RegExp[] = [
  /(?:^|\s|[-|,:;])\d{1,3}%\s*(?:taniej|zni[zż]k[aię]?|off|discount)(?=$|\s|[-|,:;.!?])/gi,
  /\b(?:super|mega|extra|top|best|hot)\s+(?:okazj\w*|promocj\w*|deal\w*)\b/gi,
  /\b(?:okazj\w*|promocj\w*|kupon\w*|rabat\w*|voucher\w*|cashback|gratis|coupon|discount|promo(?:\s*code)?|kod\s*rabatowy)\b/gi,
  /\b(?:limited\s+offer|best\s+deal|hot\s+deal|flash\s+sale|sale\s+banner)\b/gi,
];

function cleanupSpacing(value: string): string {
  return value
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/\s*[-|,:;]\s*[-|,:;]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-|,:;\s]+/, '')
    .replace(/[-|,:;\s]+$/, '')
    .trim();
}

export function containsPromotionalTextForGoogle(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const input = value.trim();
  if (!input) {
    return false;
  }

  return PROMOTIONAL_PATTERNS.some((pattern) => pattern.test(input));
}

export function sanitizeTextForGoogleTitle(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  let sanitized = value;
  for (const pattern of PROMOTIONAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, ' ');
  }

  return cleanupSpacing(sanitized);
}

export function sanitizeTextForGoogleAttribute(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  let sanitized = value;
  for (const pattern of PROMOTIONAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, ' ');
  }

  sanitized = sanitized.replace(/[!]{2,}/g, '!');
  return cleanupSpacing(sanitized);
}