/**
 * Server Actions: Harmonogram i Kalendarz Publikacji Social Media
 * Agreguje zaplanowane posty, sloty czasowe autopilota oraz historię publikacji
 * dla wszystkich 3 profili (Ogólne Okazje Plus, Wędkarskie, Maluch i Mama)
 * z widokiem na co najmniej 12-48 godzin do przodu oraz widokiem miesięcznym.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import { getGeneralAutopilotConfig } from '@/app/actions/general-autopilot';
import { getFishingAutopilotConfig } from '@/app/actions/fishing-autopilot';
import { getBabyAutopilotConfig } from '@/app/actions/baby-autopilot';

export interface CalendarTimelineItem {
  id: string;
  niche: 'general' | 'fishing' | 'baby';
  nicheLabel: string;
  nicheIcon: string;
  botName: string;
  botAvatar: string;
  botRole: string;
  title: string;
  content: string;
  firstComment?: string;
  scheduledTime: string; // ISO date-time string
  timeDisplay: string; // e.g. "Dziś, 21:30" or "Jutro, 06:30"
  dateKey: string; // e.g. "2026-09-30"
  hoursFromNow: number;
  countdownText: string; // e.g. "za 25 min", "za 3h 15 min"
  status: 'pending' | 'approved' | 'posted' | 'scheduled_slot' | 'failed';
  imageUrl?: string;
  linkUrl?: string;
  dealId?: string;
  queueItemId?: string;
  fbPostUrl?: string;
}

export interface UnifiedCalendarData {
  success: boolean;
  timeline12h: CalendarTimelineItem[];
  timeline24h: CalendarTimelineItem[];
  allScheduled: CalendarTimelineItem[];
  publishedRecent: CalendarTimelineItem[];
  calendarDaysMap: Record<string, CalendarTimelineItem[]>;
  stats: {
    nextPostInMinutes: number | null;
    totalNext12h: number;
    totalNext24h: number;
    totalApprovedInQueue: number;
    totalPendingModeration: number;
  };
  error?: string;
}

function formatCountdown(targetTime: Date, now: Date): { hours: number; text: string } {
  const diffMs = targetTime.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = diffMins / 60;

  if (diffMins < 0) {
    const agoMins = Math.abs(diffMins);
    if (agoMins < 60) return { hours: diffHours, text: `${agoMins} min temu` };
    const agoH = Math.floor(agoMins / 60);
    return { hours: diffHours, text: `${agoH}h temu` };
  }

  if (diffMins === 0) return { hours: 0, text: 'Właśnie teraz' };
  if (diffMins < 60) return { hours: diffHours, text: `Za ${diffMins} min` };
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return { hours: diffHours, text: m > 0 ? `Za ${h}h ${m}m` : `Za ${h}h` };
}

function formatDisplayDate(d: Date, now: Date): string {
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const hoursStr = String(d.getHours()).padStart(2, '0');
  const minsStr = String(d.getMinutes()).padStart(2, '0');
  const timeOnly = `${hoursStr}:${minsStr}`;

  if (isToday) return `Dziś, ${timeOnly}`;
  if (isTomorrow) return `Jutro, ${timeOnly}`;

  const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const dayName = dayNames[d.getDay()];
  const dateStr = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${dayName} (${dateStr}), ${timeOnly}`;
}

export async function getUnifiedCalendarDataAction(options?: {
  daysAhead?: number;
  filterNiche?: 'all' | 'general' | 'fishing' | 'baby';
}): Promise<UnifiedCalendarData> {
  try {
    const now = new Date();
    const daysAhead = options?.daysAhead || 14;
    const filterNiche = options?.filterNiche || 'all';

    // 1. Fetch configs for all niches
    const [genConfigRes, fishConfigRes, babyConfigRes] = await Promise.all([
      getGeneralAutopilotConfig(true),
      getFishingAutopilotConfig(true),
      getBabyAutopilotConfig(true),
    ]);

    const genConfig = genConfigRes.config;
    const fishConfig = fishConfigRes.config;
    const babyConfig = babyConfigRes.config;

    // 2. Fetch Queued Items from all 3 collections
    const [genQueueSnap, fishQueueSnap, babyQueueSnap] = await Promise.all([
      adminDb.collection('generalPostQueue').orderBy('createdAt', 'desc').limit(50).get(),
      adminDb.collection('fishingPostQueue').orderBy('createdAt', 'desc').limit(50).get(),
      adminDb.collection('babyPostQueue').orderBy('createdAt', 'desc').limit(50).get(),
    ]);

    const genQueue = genQueueSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const fishQueue = fishQueueSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const babyQueue = babyQueueSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    // 3. Generate Scheduled Slot Timeline (Next 14 Days)
    const timelineItems: CalendarTimelineItem[] = [];

    // Niches definition
    const nichesConfig = [
      {
        key: 'general' as const,
        label: 'Okazje Plus',
        icon: '🎯',
        config: genConfig,
        defaultBot: 'Łowca Perełek',
        defaultAvatar: '🔥',
        queue: genQueue,
        scheduleTimes: genConfig.schedule?.scheduleTimes || ['09:00', '12:00', '15:00', '18:00', '21:00'],
      },
      {
        key: 'fishing' as const,
        label: 'Wędkarskie ("Żona nie widzi")',
        icon: '🎣',
        config: fishConfig,
        defaultBot: 'Żona Nie Widzi',
        defaultAvatar: '🤫',
        queue: fishQueue,
        scheduleTimes: fishConfig.schedule?.scheduleTimes || ['06:30', '12:00', '17:30', '21:30'],
      },
      {
        key: 'baby' as const,
        label: 'Perełki dla Malucha i Mamy',
        icon: '👶',
        config: babyConfig,
        defaultBot: 'Oszczędna Mama Ania',
        defaultAvatar: '🛍️',
        queue: babyQueue,
        scheduleTimes: babyConfig.schedule?.scheduleTimes || ['08:00', '11:00', '14:00', '17:00', '20:00'],
      },
    ];

    for (const n of nichesConfig) {
      if (filterNiche !== 'all' && filterNiche !== n.key) continue;

      // Extract pending/approved queue items for this niche
      const readyQueueItems = n.queue.filter(
        item => item.status === 'pending' || item.status === 'approved'
      );
      let queueCursor = 0;

      // Generate future slots
      for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + dayOffset);
        const dateKey = targetDate.toISOString().split('T')[0];

        for (const timeStr of n.scheduleTimes) {
          const [hours, mins] = timeStr.split(':').map(Number);
          const slotDateTime = new Date(targetDate);
          slotDateTime.setHours(hours, mins, 0, 0);

          // Only future slots or slots in the current day
          if (slotDateTime.getTime() <= now.getTime() - 1000 * 60 * 30) {
            continue; // Skip slots older than 30 mins
          }

          const countdown = formatCountdown(slotDateTime, now);

          // Check if there is an item in the queue explicitly scheduled for this time or assign FIFO
          let matchedQueueItem = readyQueueItems.find(
            item => item.scheduledFor && item.scheduledFor.startsWith(dateKey) && item.scheduledFor.includes(timeStr)
          );

          if (!matchedQueueItem && queueCursor < readyQueueItems.length) {
            matchedQueueItem = readyQueueItems[queueCursor];
            queueCursor++;
          }

          if (matchedQueueItem) {
            timelineItems.push({
              id: matchedQueueItem.id,
              niche: n.key,
              nicheLabel: n.label,
              nicheIcon: n.icon,
              botName: matchedQueueItem.botName || n.defaultBot,
              botAvatar: matchedQueueItem.botAvatar || n.defaultAvatar,
              botRole: matchedQueueItem.botRole || 'autopilot',
              title: matchedQueueItem.title || `${n.label} - Gotowy do publikacji`,
              content: matchedQueueItem.content || '',
              firstComment: matchedQueueItem.firstComment,
              scheduledTime: slotDateTime.toISOString(),
              timeDisplay: formatDisplayDate(slotDateTime, now),
              dateKey,
              hoursFromNow: countdown.hours,
              countdownText: countdown.text,
              status: matchedQueueItem.status,
              imageUrl: matchedQueueItem.imageUrl,
              linkUrl: matchedQueueItem.linkUrl,
              dealId: matchedQueueItem.dealId,
              queueItemId: matchedQueueItem.id,
            });
          } else {
            // Autopilot Automated Slot (no manual item in queue -> bot will harvest/generate automatically)
            timelineItems.push({
              id: `slot-${n.key}-${dateKey}-${timeStr.replace(':', '')}`,
              niche: n.key,
              nicheLabel: n.label,
              nicheIcon: n.icon,
              botName: n.defaultBot,
              botAvatar: n.defaultAvatar,
              botRole: 'autopilot',
              title: `${n.label} (Autopilot)`,
              content: `Zaplanowany slot publikacji. Autopilot automatycznie pobierze najnowszą ofertę z bazy okazji lub feeda partnerskiego i wygeneruje post na fanpage Facebooka.`,
              scheduledTime: slotDateTime.toISOString(),
              timeDisplay: formatDisplayDate(slotDateTime, now),
              dateKey,
              hoursFromNow: countdown.hours,
              countdownText: countdown.text,
              status: 'scheduled_slot',
            });
          }
        }
      }

      // Add already posted items from the last 7 days
      const postedItems = n.queue.filter(item => item.status === 'posted');
      for (const p of postedItems) {
        const pubDate = new Date(p.publishedAt || p.createdAt || now);
        const countdown = formatCountdown(pubDate, now);
        const dateKey = pubDate.toISOString().split('T')[0];

        timelineItems.push({
          id: p.id,
          niche: n.key,
          nicheLabel: n.label,
          nicheIcon: n.icon,
          botName: p.botName || n.defaultBot,
          botAvatar: p.botAvatar || n.defaultAvatar,
          botRole: p.botRole || 'autopilot',
          title: p.title || 'Opublikowany post',
          content: p.content || '',
          firstComment: p.firstComment,
          scheduledTime: pubDate.toISOString(),
          timeDisplay: formatDisplayDate(pubDate, now),
          dateKey,
          hoursFromNow: countdown.hours,
          countdownText: countdown.text,
          status: 'posted',
          imageUrl: p.imageUrl,
          linkUrl: p.linkUrl,
          dealId: p.dealId,
          queueItemId: p.id,
          fbPostUrl: p.fbPostUrl,
        });
      }
    }

    // Sort all timeline items chronologically
    timelineItems.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

    // 4. Break into 12h, 24h, calendarDaysMap
    const timeline12h = timelineItems.filter(
      item => item.hoursFromNow >= 0 && item.hoursFromNow <= 12 && item.status !== 'posted'
    );
    const timeline24h = timelineItems.filter(
      item => item.hoursFromNow >= 0 && item.hoursFromNow <= 24 && item.status !== 'posted'
    );
    const allScheduled = timelineItems.filter(item => item.status !== 'posted');
    const publishedRecent = timelineItems.filter(item => item.status === 'posted');

    const calendarDaysMap: Record<string, CalendarTimelineItem[]> = {};
    for (const item of timelineItems) {
      if (!calendarDaysMap[item.dateKey]) {
        calendarDaysMap[item.dateKey] = [];
      }
      calendarDaysMap[item.dateKey].push(item);
    }

    // Stats
    const nextItem = timelineItems.find(item => item.hoursFromNow >= 0 && item.status !== 'posted');
    const nextPostInMinutes = nextItem ? Math.round(nextItem.hoursFromNow * 60) : null;

    const totalApprovedInQueue =
      genQueue.filter(i => i.status === 'approved').length +
      fishQueue.filter(i => i.status === 'approved').length +
      babyQueue.filter(i => i.status === 'approved').length;

    const totalPendingModeration =
      genQueue.filter(i => i.status === 'pending').length +
      fishQueue.filter(i => i.status === 'pending').length +
      babyQueue.filter(i => i.status === 'pending').length;

    return {
      success: true,
      timeline12h,
      timeline24h,
      allScheduled,
      publishedRecent,
      calendarDaysMap,
      stats: {
        nextPostInMinutes,
        totalNext12h: timeline12h.length,
        totalNext24h: timeline24h.length,
        totalApprovedInQueue,
        totalPendingModeration,
      },
    };
  } catch (err: any) {
    console.error('Error in getUnifiedCalendarDataAction:', err);
    return {
      success: false,
      timeline12h: [],
      timeline24h: [],
      allScheduled: [],
      publishedRecent: [],
      calendarDaysMap: {},
      stats: {
        nextPostInMinutes: null,
        totalNext12h: 0,
        totalNext24h: 0,
        totalApprovedInQueue: 0,
        totalPendingModeration: 0,
      },
      error: err.message,
    };
  }
}
