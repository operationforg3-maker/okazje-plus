/**
 * Server Actions: Harmonogram i Kalendarz Publikacji Social Media
 * Agreguje zaplanowane posty, sloty czasowe autopilota oraz historię publikacji
 * dla wszystkich 3 profili (Ogólne Okazje Plus, Wędkarskie, Maluch i Mama)
 * z widokiem na co najmniej 12-48 godzin do przodu oraz widokiem miesięcznym.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getServerAuthSession } from '@/lib/auth-server';
import { revalidatePath } from 'next/cache';
import { getGeneralAutopilotConfig, getGeneralDeals, generateGeneralPostAction, publishGeneralPostAction } from '@/app/actions/general-autopilot';
import { getFishingAutopilotConfig, getFishingDeals, generateFishingPost, publishFishingPost } from '@/app/actions/fishing-autopilot';
import { getBabyAutopilotConfig, getBabyDeals, generateBabyPost, publishBabyPostAction } from '@/app/actions/baby-autopilot';
import { sanitizeSocialPostText } from '@/lib/social-growth-types';
import {
  diversifyDealsList,
  detectDealCategory,
  pickDiverseRecommendation,
  getCategoryLabel,
} from '@/lib/deal-diversity';

export interface CandidateDealSummary {
  id: string;
  title: string;
  price: string;
  oldPrice?: string;
  discount?: string;
  merchant?: string;
  imageUrl?: string;
  dealUrl: string;
  description?: string;
  category?: string;
  categoryLabel?: string;
}

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
  candidateDeal?: CandidateDealSummary;
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

    // 1. Fetch configs and available candidate deals for all niches
    const [genConfigRes, fishConfigRes, babyConfigRes, genDealsRes, fishDealsRes, babyDealsRes] = await Promise.all([
      getGeneralAutopilotConfig(true),
      getFishingAutopilotConfig(true),
      getBabyAutopilotConfig(true),
      getGeneralDeals({ limit: 40 }, true),
      getFishingDeals(undefined, 40, undefined, true),
      getBabyDeals({ limit: 40 }, true),
    ]);

    const genConfig = genConfigRes.config;
    const fishConfig = fishConfigRes.config;
    const babyConfig = babyConfigRes.config;

    const genAvailableDeals: CandidateDealSummary[] = diversifyDealsList((genDealsRes.deals || []).map(d => {
      const cat = detectDealCategory(d.title || '', d.description, 'general');
      return {
        id: d.id,
        title: d.title || 'Hit Cenowy',
        price: String(d.price || ''),
        oldPrice: d.oldPrice ? String(d.oldPrice) : undefined,
        discount: d.discount ? `-${d.discount}%` : undefined,
        merchant: d.merchant,
        imageUrl: d.imageUrl,
        dealUrl: d.dealUrl,
        description: d.description,
        category: cat,
        categoryLabel: getCategoryLabel(cat),
      };
    }), { niche: 'general' });

    const fishAvailableDeals: CandidateDealSummary[] = diversifyDealsList((fishDealsRes.deals || []).map(d => {
      const cat = detectDealCategory(d.title || '', d.description, 'fishing');
      return {
        id: d.id,
        title: d.title || 'Sprzęt Wędkarski',
        price: d.price || '',
        oldPrice: d.oldPrice,
        discount: d.discount,
        merchant: d.merchant,
        imageUrl: d.imageUrl,
        dealUrl: d.dealUrl,
        description: d.description,
        category: cat,
        categoryLabel: getCategoryLabel(cat),
      };
    }), { niche: 'fishing' });

    const babyAvailableDeals: CandidateDealSummary[] = diversifyDealsList((babyDealsRes.deals || []).map(d => {
      const cat = detectDealCategory(d.title || '', d.description, 'baby');
      return {
        id: d.id,
        title: d.title || 'Akcesoria dla Malucha i Mamy',
        price: d.price || '',
        oldPrice: d.oldPrice,
        discount: d.discount,
        merchant: d.merchant,
        imageUrl: d.imageUrl,
        dealUrl: d.dealUrl,
        description: d.description,
        category: cat,
        categoryLabel: getCategoryLabel(cat),
      };
    }), { niche: 'baby' });

    // 2. Fetch Queued Items from all 3 collections (fixing fishingPostsQueue with 's')
    const [genQueueSnap, fishQueueSnap, babyQueueSnap] = await Promise.all([
      adminDb.collection('generalPostQueue').orderBy('createdAt', 'desc').limit(50).get(),
      adminDb.collection('fishingPostsQueue').orderBy('createdAt', 'desc').limit(50).get(),
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
        availableDeals: genAvailableDeals,
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
        availableDeals: fishAvailableDeals,
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
        availableDeals: babyAvailableDeals,
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
      let candidateCursor = 0;

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
            // Assign candidate deal from the top available deals in this niche
            let candidateDeal: CandidateDealSummary | undefined;
            if (n.availableDeals.length > 0) {
              candidateDeal = n.availableDeals[candidateCursor % n.availableDeals.length];
              candidateCursor++;
            }

            timelineItems.push({
              id: `slot-${n.key}-${dateKey}-${timeStr.replace(':', '')}`,
              niche: n.key,
              nicheLabel: n.label,
              nicheIcon: n.icon,
              botName: n.defaultBot,
              botAvatar: n.defaultAvatar,
              botRole: 'autopilot',
              title: candidateDeal ? candidateDeal.title : `${n.label} (Autopilot)`,
              content: candidateDeal
                ? `Planowana okazja: ${candidateDeal.title} (${candidateDeal.price}${candidateDeal.merchant ? ` • ${candidateDeal.merchant}` : ''}).\nTreść posta nie została jeszcze wygenerowana — kliknij "Wygeneruj post wcześniej", aby przygotować wpis i dowolnie go edytować przed publikacją!`
                : `Zaplanowany slot publikacji. Autopilot automatycznie pobierze najnowszą ofertę z bazy okazji lub feeda partnerskiego i wygeneruje post na fanpage Facebooka.`,
              scheduledTime: slotDateTime.toISOString(),
              timeDisplay: formatDisplayDate(slotDateTime, now),
              dateKey,
              hoursFromNow: countdown.hours,
              countdownText: countdown.text,
              status: 'scheduled_slot',
              imageUrl: candidateDeal?.imageUrl,
              linkUrl: candidateDeal?.dealUrl,
              dealId: candidateDeal?.id,
              candidateDeal,
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

/**
 * Generuje post z wyprzedzeniem dla planowanego slotu czasowego i zapisuje go w kolejce do moderacji/edycji.
 */
export async function preGenerateSlotPostAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  scheduledTime: string;
  dealId?: string;
  botId?: string;
  customTopic?: string;
}): Promise<{
  success: boolean;
  queueItemId?: string;
  post?: any;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const { niche, scheduledTime, dealId, customTopic } = params;

    if (niche === 'fishing') {
      const genRes = await generateFishingPost({
        botRole: 'deal_hunter',
        dealId,
        customTopic,
      }, true);

      if (!genRes.success || !genRes.item) {
        return { success: false, error: genRes.error || 'Nie udało się wygenerować posta wędkarskiego' };
      }

      const postData = {
        ...genRes.item,
        scheduledFor: scheduledTime,
        status: 'approved' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await adminDb.collection('fishingPostsQueue').add(postData);
      revalidatePath('/[locale]/admin/social-media', 'page');
      revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
      return { success: true, queueItemId: docRef.id, post: { id: docRef.id, ...postData } };
    } else if (niche === 'baby') {
      const genRes = await generateBabyPost({
        botRole: 'bargain_mom',
        dealId,
        customTopic,
      }, true);

      if (!genRes.success || !genRes.item) {
        return { success: false, error: genRes.error || 'Nie udało się wygenerować posta dla malucha' };
      }

      const postData = {
        ...genRes.item,
        scheduledFor: scheduledTime,
        status: 'approved' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await adminDb.collection('babyPostQueue').add(postData);
      revalidatePath('/[locale]/admin/social-media', 'page');
      revalidatePath('/[locale]/admin/baby-autopilot', 'page');
      return { success: true, queueItemId: docRef.id, post: { id: docRef.id, ...postData } };
    } else {
      const genRes = await generateGeneralPostAction({
        botRole: 'bargain_hunter',
        dealId,
        customTopic,
      });

      if (!genRes.success || !genRes.post) {
        return { success: false, error: genRes.error || 'Nie udało się wygenerować posta Okazje Plus' };
      }

      const postData = {
        ...genRes.post,
        scheduledFor: scheduledTime,
        status: 'approved' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await adminDb.collection('generalPostQueue').add(postData);
      revalidatePath('/[locale]/admin/social-media', 'page');
      return { success: true, queueItemId: docRef.id, post: { id: docRef.id, ...postData } };
    }
  } catch (err: any) {
    console.error('Error in preGenerateSlotPostAction:', err);
    return { success: false, error: err.message || 'Błąd generowania posta z wyprzedzeniem' };
  }
}

/**
 * Zapisuje dowolne edycje w zaplanowanym lub oczekującym poście w kolejce.
 */
export async function saveScheduledPostEditsAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  queueItemId: string;
  updates: {
    title?: string;
    content?: string;
    firstComment?: string;
    imageUrl?: string;
    linkUrl?: string;
    scheduledFor?: string;
    status?: 'pending' | 'approved' | 'posted';
    dealId?: string;
    wifeAlibi?: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const { niche, queueItemId, updates } = params;
    const collectionName = niche === 'fishing'
      ? 'fishingPostsQueue'
      : niche === 'baby'
        ? 'babyPostQueue'
        : 'generalPostQueue';

    const cleanUpdates: Record<string, any> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (cleanUpdates.content) {
      cleanUpdates.content = sanitizeSocialPostText(cleanUpdates.content);
    }
    if (cleanUpdates.firstComment) {
      cleanUpdates.firstComment = cleanUpdates.firstComment.trim();
    }

    await adminDb.collection(collectionName).doc(queueItemId).set(cleanUpdates, { merge: true });

    revalidatePath('/[locale]/admin/social-media', 'page');
    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error in saveScheduledPostEditsAction:', err);
    return { success: false, error: err.message || 'Błąd zapisu zmian w poście' };
  }
}

/**
 * Zwraca listę dostępnych okazji w danej niszy do wyboru przez użytkownika.
 */
export async function getNicheAvailableDealsAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  limit?: number;
  searchQuery?: string;
}): Promise<{ success: boolean; deals: CandidateDealSummary[]; error?: string }> {
  try {
    const { niche, limit = 40, searchQuery } = params;

    if (niche === 'fishing') {
      const res = await getFishingDeals(searchQuery, limit, undefined, true);
      const rawDeals: CandidateDealSummary[] = (res.deals || []).map(d => {
        const cat = detectDealCategory(d.title || '', d.description, 'fishing');
        return {
          id: d.id,
          title: d.title || 'Sprzęt wędkarski',
          price: d.price || '',
          oldPrice: d.oldPrice,
          discount: d.discount,
          merchant: d.merchant,
          imageUrl: d.imageUrl,
          dealUrl: d.dealUrl,
          description: d.description,
          category: cat,
          categoryLabel: getCategoryLabel(cat),
        };
      });
      return { success: true, deals: diversifyDealsList(rawDeals, { niche: 'fishing' }) };
    } else if (niche === 'baby') {
      const res = await getBabyDeals({ limit, searchQuery }, true);
      const rawDeals: CandidateDealSummary[] = (res.deals || []).map(d => {
        const cat = detectDealCategory(d.title || '', d.description, 'baby');
        return {
          id: d.id,
          title: d.title || 'Dla malucha i mamy',
          price: d.price || '',
          oldPrice: d.oldPrice,
          discount: d.discount,
          merchant: d.merchant,
          imageUrl: d.imageUrl,
          dealUrl: d.dealUrl,
          description: d.description,
          category: cat,
          categoryLabel: getCategoryLabel(cat),
        };
      });
      return { success: true, deals: diversifyDealsList(rawDeals, { niche: 'baby' }) };
    } else {
      const res = await getGeneralDeals({ limit, searchQuery }, true);
      const rawDeals: CandidateDealSummary[] = (res.deals || []).map(d => {
        const cat = detectDealCategory(d.title || '', d.description, 'general');
        return {
          id: d.id,
          title: d.title || 'Hit Cenowy',
          price: String(d.price || ''),
          oldPrice: d.oldPrice ? String(d.oldPrice) : undefined,
          discount: d.discount ? `-${d.discount}%` : undefined,
          merchant: d.merchant,
          imageUrl: d.imageUrl,
          dealUrl: d.dealUrl,
          description: d.description,
          category: cat,
          categoryLabel: getCategoryLabel(cat),
        };
      });
      return { success: true, deals: diversifyDealsList(rawDeals, { niche: 'general' }) };
    }
  } catch (err: any) {
    console.error('Error in getNicheAvailableDealsAction:', err);
    return { success: false, deals: [], error: err.message };
  }
}

/**
 * Usuwa post z kolejki publikacji kalendarza.
 */
export async function deleteCalendarPostAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  queueItemId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const { niche, queueItemId } = params;
    const collectionName = niche === 'fishing'
      ? 'fishingPostsQueue'
      : niche === 'baby'
        ? 'babyPostQueue'
        : 'generalPostQueue';

    await adminDb.collection(collectionName).doc(queueItemId).delete();

    revalidatePath('/[locale]/admin/social-media', 'page');
    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting calendar post:', err);
    return { success: false, error: err.message || 'Błąd usuwania posta' };
  }
}

/**
 * Inteligentny dobór okazji przez AI z innej kategorii niż ostatnio publikowane (Anti-Clustering).
 */
export async function getDiverseAiDealRecommendationAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  excludeDealIds?: string[];
}): Promise<{
  success: boolean;
  deal?: CandidateDealSummary;
  categoryLabel?: string;
  reason?: string;
  error?: string;
}> {
  try {
    const { niche, excludeDealIds = [] } = params;

    const collectionName = niche === 'fishing'
      ? 'fishingPostsQueue'
      : niche === 'baby'
        ? 'babyPostQueue'
        : 'generalPostQueue';

    const recentSnap = await adminDb
      .collection(collectionName)
      .orderBy('createdAt', 'desc')
      .limit(6)
      .get();

    const recentCategories = recentSnap.docs.map(doc => {
      const data = doc.data();
      return detectDealCategory(data.title || '', data.content || '', niche);
    }).filter(Boolean);

    const dealsRes = await getNicheAvailableDealsAction({ niche, limit: 50 });
    if (!dealsRes.success || dealsRes.deals.length === 0) {
      return { success: false, error: 'Brak dostępnych okazji w bazie dla tego profilu' };
    }

    const rec = pickDiverseRecommendation(dealsRes.deals, {
      niche,
      recentCategories,
      excludeDealIds,
    });

    if (!rec.deal) {
      return { success: false, error: 'Nie udało się dobrać zróżnicowanej oferty' };
    }

    return {
      success: true,
      deal: rec.deal,
      categoryLabel: rec.categoryLabel,
      reason: rec.reason,
    };
  } catch (err: any) {
    console.error('Error getting diverse AI deal recommendation:', err);
    return { success: false, error: err.message || 'Błąd rekomendacji AI' };
  }
}

/**
 * Regeneruje treść posta dla nowo wybranej okazji bezpośrednio z poziomu edytora.
 */
export async function regeneratePostContentAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  dealId: string;
  botRole?: string;
  customTopic?: string;
  humorLevel?: 'subtle' | 'high' | 'legendary' | 'none';
}): Promise<{
  success: boolean;
  content?: string;
  title?: string;
  firstComment?: string;
  imageUrl?: string;
  linkUrl?: string;
  wifeAlibi?: string;
  error?: string;
}> {
  try {
    const { niche, dealId, botRole, customTopic, humorLevel } = params;

    if (niche === 'fishing') {
      const genRes = await generateFishingPost({
        botRole: (botRole as any) || 'deal_hunter',
        dealId,
        customTopic,
        humorLevel,
      }, true);

      if (!genRes.success || !genRes.item) {
        return { success: false, error: genRes.error || 'Błąd generowania posta wędkarskiego' };
      }

      return {
        success: true,
        content: sanitizeSocialPostText(genRes.item.content || ''),
        title: genRes.item.title || '',
        firstComment: genRes.item.firstComment || '',
        imageUrl: genRes.item.imageUrl,
        linkUrl: genRes.item.linkUrl || (genRes.item as any).dealUrl,
        wifeAlibi: genRes.item.wifeAlibi,
      };
    } else if (niche === 'baby') {
      const genRes = await generateBabyPost({
        botRole: (botRole as any) || 'bargain_mom',
        dealId,
        customTopic,
        humorLevel,
      }, true);

      if (!genRes.success || !genRes.item) {
        return { success: false, error: genRes.error || 'Błąd generowania posta dla malucha' };
      }

      return {
        success: true,
        content: sanitizeSocialPostText(genRes.item.content || ''),
        title: genRes.item.title || '',
        firstComment: genRes.item.firstComment || '',
        imageUrl: genRes.item.imageUrl,
        linkUrl: genRes.item.linkUrl || (genRes.item as any).dealUrl,
      };
    } else {
      const genRes = await generateGeneralPostAction({
        botRole: (botRole as any) || 'bargain_hunter',
        dealId,
        customTopic,
        humorLevel,
      });

      if (!genRes.success || !genRes.post) {
        return { success: false, error: genRes.error || 'Błąd generowania posta' };
      }

      return {
        success: true,
        content: sanitizeSocialPostText(genRes.post.content || ''),
        title: genRes.post.title || '',
        firstComment: genRes.post.firstComment || '',
        imageUrl: genRes.post.imageUrl,
        linkUrl: genRes.post.linkUrl || (genRes.post as any).dealUrl,
      };
    }
  } catch (err: any) {
    console.error('Error in regeneratePostContentAction:', err);
    return { success: false, error: err.message || 'Błąd generowania treści' };
  }
}

/**
 * Akceptuje / zatwierdza post oczekujący w kolejce (zmienia status z 'pending' na 'approved').
 */
export async function approveCalendarPostAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  queueItemId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const { niche, queueItemId } = params;
    const collectionName = niche === 'fishing'
      ? 'fishingPostsQueue'
      : niche === 'baby'
        ? 'babyPostQueue'
        : 'generalPostQueue';

    await adminDb.collection(collectionName).doc(queueItemId).update({
      status: 'approved',
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/[locale]/admin/social-media', 'page');
    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true };
  } catch (err: any) {
    console.error('Error approving calendar post:', err);
    return { success: false, error: err.message || 'Błąd zatwierdzania posta' };
  }
}

/**
 * Publikuje post z kalendarza natychmiast na Facebooku (omijając czekanie na zaplanowaną godzinę).
 */
export async function publishCalendarPostNowAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  queueItemId: string;
}): Promise<{ success: boolean; fbPostUrl?: string; error?: string }> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, error: 'Wymagane uprawnienia administratora' };
    }

    const { niche, queueItemId } = params;
    if (niche === 'fishing') {
      const res = await publishFishingPost(queueItemId);
      if (res.success) {
        revalidatePath('/[locale]/admin/social-media', 'page');
        return { success: true, fbPostUrl: (res as any).fbPostUrl };
      }
      return { success: false, error: res.error || 'Błąd publikacji na profilu wędkarskim' };
    } else if (niche === 'baby') {
      const res = await publishBabyPostAction(queueItemId);
      if (res.success) {
        revalidatePath('/[locale]/admin/social-media', 'page');
        return { success: true, fbPostUrl: (res as any).fbPostUrl || (res as any).fbPostId };
      }
      return { success: false, error: res.error || 'Błąd publikacji na profilu Perełki dla Malucha' };
    } else {
      const res = await publishGeneralPostAction(queueItemId);
      if (res.success) {
        revalidatePath('/[locale]/admin/social-media', 'page');
        return { success: true, fbPostUrl: (res as any).fbPostUrl || (res as any).fbPostId };
      }
      return { success: false, error: res.error || 'Błąd publikacji na profilu Okazje Plus' };
    }
  } catch (err: any) {
    console.error('Error in publishCalendarPostNowAction:', err);
    return { success: false, error: err.message || 'Błąd natychmiastowej publikacji posta' };
  }
}

/**
 * Zaakceptuj slot: natychmiast generuje post AI dla proponowanej okazji i zapisuje go w kolejce jako 'approved'.
 */
export async function acceptAndGenerateSlotPostAction(params: {
  niche: 'general' | 'fishing' | 'baby';
  scheduledTime: string;
  dealId: string;
}): Promise<{ success: boolean; queueItemId?: string; error?: string }> {
  try {
    const res = await preGenerateSlotPostAction(params);
    if (res.success && res.queueItemId) {
      return { success: true, queueItemId: res.queueItemId };
    }
    return { success: false, error: res.error || 'Błąd generowania posta dla slotu' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Błąd akceptacji slotu' };
  }
}

/**
 * Zbiorcze zatwierdzenie wszystkich oczekujących postów we wszystkich profilach.
 */
export async function approveAllPendingCalendarPostsAction(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return { success: false, count: 0, error: 'Wymagane uprawnienia administratora' };
    }

    const collections = ['generalPostQueue', 'fishingPostsQueue', 'babyPostQueue'];
    let totalApproved = 0;

    for (const col of collections) {
      const snap = await adminDb.collection(col).where('status', '==', 'pending').get();
      if (!snap.empty) {
        const batch = adminDb.batch();
        snap.docs.forEach(docSnap => {
          batch.update(docSnap.ref, {
            status: 'approved',
            updatedAt: new Date().toISOString(),
          });
          totalApproved++;
        });
        await batch.commit();
      }
    }

    revalidatePath('/[locale]/admin/social-media', 'page');
    revalidatePath('/[locale]/admin/fishing-autopilot', 'page');
    revalidatePath('/[locale]/admin/baby-autopilot', 'page');
    return { success: true, count: totalApproved };
  } catch (err: any) {
    console.error('Error approving all pending posts:', err);
    return { success: false, count: 0, error: err.message || 'Błąd zbiorczego zatwierdzania' };
  }
}



