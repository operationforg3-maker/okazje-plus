'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Layers,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarTimelineItem, UnifiedCalendarData } from '@/app/actions/calendar-schedule';
import { getUnifiedCalendarDataAction } from '@/app/actions/calendar-schedule';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function UnifiedCalendarTab() {
  const [data, setData] = useState<UnifiedCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'timeline12h' | 'month' | 'all'>('timeline12h');
  const [nicheFilter, setNicheFilter] = useState<'all' | 'general' | 'fishing' | 'baby'>('all');

  // Month navigation state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string>(new Date().toISOString().split('T')[0]);

  // Modal inspection state
  const [selectedItem, setSelectedItem] = useState<CalendarTimelineItem | null>(null);

  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getUnifiedCalendarDataAction({
        daysAhead: 30,
        filterNiche: nicheFilter,
      });

      if (res.success) {
        setData(res);
      } else {
        toast.error(res.error || 'Błąd ładowania kalendarza');
      }
    } catch (err: any) {
      toast.error('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  }, [nicheFilter]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Month navigation helpers
  const firstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const lastDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0 = Mon, 6 = Sun

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const goToPrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };
  const goToToday = () => {
    const today = new Date();
    setCalendarDate(today);
    setSelectedDayKey(today.toISOString().split('T')[0]);
  };

  const monthYearLabel = calendarDate.toLocaleDateString('pl-PL', {
    month: 'long',
    year: 'numeric',
  });

  const getNicheBadge = (niche: CalendarTimelineItem['niche']) => {
    switch (niche) {
      case 'general':
        return (
          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
            🎯 Okazje Plus
          </Badge>
        );
      case 'fishing':
        return (
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
            🎣 Wędkarskie
          </Badge>
        );
      case 'baby':
        return (
          <Badge variant="outline" className="text-[10px] bg-pink-500/10 text-pink-600 border-pink-500/30">
            👶 Maluch & Mama
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: CalendarTimelineItem['status']) => {
    switch (status) {
      case 'approved':
        return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Gotowy w kolejce</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">Oczekuje na akceptację</Badge>;
      case 'scheduled_slot':
        return <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">Slot Autopilota</Badge>;
      case 'posted':
        return <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-600 border-slate-500/30">Opublikowany</Badge>;
      default:
        return null;
    }
  };

  const selectedDayItems = data?.calendarDaysMap[selectedDayKey] || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Fast KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Najbliższy Post</p>
              <p className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-1.5 mt-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                {data?.stats?.nextPostInMinutes !== null && data?.stats?.nextPostInMinutes !== undefined
                  ? data.stats.nextPostInMinutes <= 0
                    ? 'Właśnie teraz'
                    : `za ${data.stats.nextPostInMinutes} min`
                  : 'Brak w 24h'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Clock className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Najbliższe 12 Godzin</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                {data?.stats.totalNext12h || 0} <span className="text-xs font-normal text-muted-foreground">postów</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Zap className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Doba (24h do przodu)</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                {data?.stats.totalNext24h || 0} <span className="text-xs font-normal text-muted-foreground">postów</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Zatwierdzone w Kolejce</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">
                {data?.stats.totalApprovedInQueue || 0}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar: View Switcher, Niche Filter & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border border-border/70">
        {/* View Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-background rounded-lg border border-border/80 shadow-xs">
          <Button
            variant={viewMode === 'timeline12h' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('timeline12h')}
            className={cn("text-xs h-7 px-3 font-semibold", viewMode === 'timeline12h' && "bg-muted shadow-xs")}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Oś czasu (12h - 24h)
          </Button>

          <Button
            variant={viewMode === 'month' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('month')}
            className={cn("text-xs h-7 px-3 font-semibold", viewMode === 'month' && "bg-muted shadow-xs")}
          >
            <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
            Widok Miesięczny
          </Button>

          <Button
            variant={viewMode === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('all')}
            className={cn("text-xs h-7 px-3 font-semibold", viewMode === 'all' && "bg-muted shadow-xs")}
          >
            <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
            Pełny Harmonogram
          </Button>
        </div>

        {/* Niche Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1 hidden md:inline">Profil:</span>
          <Button
            variant={nicheFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNicheFilter('all')}
            className="text-xs h-7 px-2.5"
          >
            Wszystkie
          </Button>
          <Button
            variant={nicheFilter === 'general' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNicheFilter('general')}
            className="text-xs h-7 px-2.5"
          >
            🎯 Okazje+
          </Button>
          <Button
            variant={nicheFilter === 'fishing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNicheFilter('fishing')}
            className="text-xs h-7 px-2.5"
          >
            🎣 Wędkarskie
          </Button>
          <Button
            variant={nicheFilter === 'baby' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNicheFilter('baby')}
            className="text-xs h-7 px-2.5"
          >
            👶 Maluch & Mama
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={loadCalendarData}
            disabled={loading}
            className="h-7 w-7 ml-1"
            title="Odśwież kalendarz"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* VIEW 1: TIMELINE 12H - 24H (PRIMARY VIEW REQUESTED BY USER) */}
      {viewMode === 'timeline12h' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Oś Czasu Publikacji na Najbliższe 12-24 Godziny
            </h3>
            <p className="text-xs text-muted-foreground">
              Szczegółowy rozkład postów i slotów autopilota minuta po minucie. Sprawdź, kiedy który bot publikuje na fanpage Facebooka.
            </p>
          </div>

          {data?.timeline24h.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-2">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold">Brak zaplanowanych slotów w ciągu 24h</p>
                <p className="text-xs text-muted-foreground">
                  Upewnij się, że godziny publikacji są ustawione w zakładce <strong>Ustawienia</strong> danego profilu.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/80">
              {data?.timeline24h.map((item, idx) => {
                const isUnder12h = item.hoursFromNow <= 12;

                return (
                  <div key={item.id} className="relative group">
                    {/* Circle marker on timeline */}
                    <div
                      className={cn(
                        "absolute -left-6 top-4 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center transition-all",
                        item.status === 'approved'
                          ? "bg-emerald-500 shadow-xs"
                          : item.status === 'pending'
                          ? "bg-amber-500 shadow-xs"
                          : "bg-primary/80"
                      )}
                    />

                    <Card
                      className={cn(
                        "border transition-all hover:shadow-md cursor-pointer",
                        isUnder12h
                          ? "border-primary/30 bg-card/90"
                          : "border-border/60 bg-card/50",
                        item.niche === 'fishing' && "hover:border-amber-500/40",
                        item.niche === 'baby' && "hover:border-pink-500/40",
                        item.niche === 'general' && "hover:border-primary/40"
                      )}
                      onClick={() => setSelectedItem(item)}
                    >
                      <CardContent className="p-4 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl p-1.5 rounded-lg bg-muted/60 border border-border/50">
                              {item.botAvatar}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">
                                  {item.title}
                                </span>
                                {getNicheBadge(item.niche)}
                                {getStatusBadge(item.status)}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Bot: <strong>{item.botName}</strong> • Profil: <strong>{item.nicheLabel}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="text-right sm:shrink-0">
                            <div className="flex items-center gap-1.5 sm:justify-end">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              <span className="font-extrabold text-sm text-foreground">
                                {item.timeDisplay}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-primary">
                              {item.countdownText}
                            </span>
                          </div>
                        </div>

                        {/* Content snippet */}
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/20 p-2 rounded border border-border/40 font-sans">
                          {item.content}
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                          <span className="flex items-center gap-1">
                            {item.status === 'scheduled_slot' ? (
                              <span className="text-blue-500 font-medium">⚡ Automatyczne zasilenie przez bota</span>
                            ) : (
                              <span className="text-emerald-600 font-medium">✓ Post gotowy z dedykowaną treścią</span>
                            )}
                          </span>

                          <span className="text-primary hover:underline flex items-center gap-1 font-semibold">
                            Zobacz szczegóły <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MONTHLY INTERACTIVE CALENDAR GRID */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Calendar Grid (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold capitalize flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    {monthYearLabel}
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={goToPrevMonth} className="h-7 w-7 p-0">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-7 px-2.5">
                      Dziś
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToNextMonth} className="h-7 w-7 p-0">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-3 sm:p-5 pt-0">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-muted-foreground pb-2 border-b">
                  {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(d => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1.5 pt-2">
                  {calendarDays.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="min-h-[85px] bg-muted/10 rounded-lg border border-dashed border-border/30" />;
                    }

                    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const itemsOnDay = data?.calendarDaysMap[dateStr] || [];
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;
                    const isSelected = selectedDayKey === dateStr;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDayKey(dateStr)}
                        className={cn(
                          "min-h-[85px] p-2 text-left rounded-xl border transition-all flex flex-col justify-between",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs"
                            : "border-border/60 hover:border-border hover:bg-muted/30 bg-card",
                          isToday && !isSelected && "border-amber-500/40 bg-amber-500/5"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center",
                              isToday
                                ? "bg-amber-500 text-white font-black"
                                : "text-foreground"
                            )}
                          >
                            {day}
                          </span>

                          {itemsOnDay.length > 0 && (
                            <span className="text-[10px] font-bold text-muted-foreground px-1 bg-muted rounded">
                              {itemsOnDay.length}
                            </span>
                          )}
                        </div>

                        {/* Event Pills */}
                        <div className="space-y-1 mt-1">
                          {itemsOnDay.slice(0, 2).map(it => (
                            <div
                              key={it.id}
                              className={cn(
                                "text-[9px] font-semibold px-1 py-0.5 rounded truncate flex items-center gap-1",
                                it.niche === 'fishing' && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                                it.niche === 'baby' && "bg-pink-500/10 text-pink-700 dark:text-pink-300",
                                it.niche === 'general' && "bg-primary/10 text-primary"
                              )}
                            >
                              <span>{it.nicheIcon}</span>
                              <span className="truncate">{it.scheduledTime.split('T')[1]?.slice(0, 5)} {it.botName}</span>
                            </div>
                          ))}
                          {itemsOnDay.length > 2 && (
                            <span className="text-[9px] text-muted-foreground block font-medium">
                              +{itemsOnDay.length - 2} więcej
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Day Inspector (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Harmonogram dla: {selectedDayKey}
                </CardTitle>
                <CardDescription className="text-xs">
                  Znaleziono {selectedDayItems.length} zaplanowanych publikacji w tym dniu.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {selectedDayItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                    <p>Brak zaplanowanych postów na ten dzień.</p>
                  </div>
                ) : (
                  selectedDayItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="p-3 rounded-lg border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-foreground truncate">
                          {item.title}
                        </span>
                        <span className="font-mono text-xs font-extrabold text-primary shrink-0">
                          {item.scheduledTime.split('T')[1]?.slice(0, 5)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getNicheBadge(item.niche)}
                        {getStatusBadge(item.status)}
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {item.content}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* VIEW 3: ALL SCHEDULED / FULL LIST */}
      {viewMode === 'all' && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Pełna Lista Nadchodzących Publikacji ({data?.allScheduled.length || 0})
            </CardTitle>
            <CardDescription className="text-xs">
              Wszystkie zarezerwowane sloty czasowe i posty z kolejki moderacji na kolejne 14 dni.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            {data?.allScheduled.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="p-3 sm:p-4 rounded-xl border border-border/70 hover:border-primary/40 bg-card hover:bg-muted/20 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl p-2 rounded-xl bg-muted/60 border border-border/50 shrink-0">
                    {item.botAvatar}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                        {item.title}
                      </span>
                      {getNicheBadge(item.niche)}
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Bot: {item.botName} • Profil: {item.nicheLabel}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <p className="font-extrabold text-xs sm:text-sm text-foreground">
                    {item.timeDisplay}
                  </p>
                  <p className="text-[11px] text-primary font-semibold">
                    {item.countdownText}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* DETAIL MODAL INSPECTOR */}
      {selectedItem && (
        <Dialog open={Boolean(selectedItem)} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl">{selectedItem.botAvatar}</span>
                <div>
                  <DialogTitle className="text-sm sm:text-base font-bold">
                    {selectedItem.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Zaplanowano: <strong>{selectedItem.timeDisplay}</strong> ({selectedItem.countdownText})
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                {getNicheBadge(selectedItem.niche)}
                {getStatusBadge(selectedItem.status)}
                <Badge variant="outline" className="text-[10px]">
                  Autor: {selectedItem.botName}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-foreground">Treść wpisu:</span>
                <p className="p-3 bg-muted/30 rounded-lg border text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans max-h-[220px] overflow-y-auto">
                  {selectedItem.content}
                </p>
              </div>

              {selectedItem.firstComment && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground">💬 Pierwszy komentarz (link partnerski):</span>
                  <p className="p-2.5 bg-muted/40 rounded-lg border text-muted-foreground font-mono break-all text-[11px]">
                    {selectedItem.firstComment}
                  </p>
                </div>
              )}

              {selectedItem.imageUrl && (
                <div className="rounded-lg overflow-hidden border max-h-[160px] flex items-center justify-center bg-muted/20">
                  <img
                    src={selectedItem.imageUrl}
                    alt="Podgląd"
                    className="object-contain max-h-[160px] w-full"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              {selectedItem.fbPostUrl && (
                <Button variant="outline" size="sm" asChild className="text-xs">
                  <a href={selectedItem.fbPostUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Zobacz na Facebooku
                  </a>
                </Button>
              )}
              <Button size="sm" onClick={() => setSelectedItem(null)} className="text-xs">
                Zamknij
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
