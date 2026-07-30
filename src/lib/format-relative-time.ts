/**
 * Helper to format relative time using next-intl translations ('common' namespace).
 */
export function formatTimeAgo(
  when: Date | number | string | null | undefined | any,
  t: (key: string, values?: Record<string, any>) => string
): string {
  if (!when) return '';

  let ts = 0;
  if (typeof when === 'number') {
    ts = when;
  } else if (when instanceof Date) {
    ts = when.getTime();
  } else if (typeof when === 'string') {
    const parsed = new Date(when).getTime();
    if (!isNaN(parsed)) ts = parsed;
  } else if (typeof when === 'object' && when !== null && 'seconds' in when) {
    // Handle Firestore Timestamp objects
    ts = Number(when.seconds) * 1000;
  }

  if (!ts) return '';

  const now = Date.now();
  const diffMs = now - ts;
  if (diffMs < 0) return t('time.justNow');

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('time.justNow');
  if (diffMins < 60) return t('time.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('time.yesterday');
  if (diffDays < 7) return t('time.daysAgo', { count: diffDays });
  if (diffDays < 30) return t('time.weeksAgo', { count: Math.floor(diffDays / 7) });
  return t('time.monthsAgo', { count: Math.floor(diffDays / 30) });
}
