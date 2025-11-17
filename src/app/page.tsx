"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Flame, Users, Zap, Clock, Mail, CheckCircle2, Trophy, Rocket, Sparkles, Gift } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import Link from "next/link";

const BETA_RELEASE = new Date("2025-11-19T10:00:00+01:00");
const PUBLIC_RELEASE = new Date("2025-11-21T19:00:00+01:00");

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function Home() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState<number | null>(null);
  const [currentCount, setCurrentCount] = useState(0);
  const [betaTimeLeft, setBetaTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [publicTimeLeft, setPublicTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  // Hydration guard to avoid text mismatch (React error #418)
  const [hydrated, setHydrated] = useState(false);

  const calculateTimeLeft = (targetDate: Date): TimeLeft => {
    const now = new Date();
    const difference = targetDate.getTime() - now.getTime();
    if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  useEffect(() => {
    setHydrated(true);
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/pre-register/count", { cache: "no-store" });
        if (!res.ok) {
          console.warn("[landing] count endpoint status", res.status);
          return;
        }
        const data = await res.json();
        if (typeof data.count === 'number') setCurrentCount(data.count);
      } catch (error) {
        console.error("Error fetching count:", error);
      }
    };
    fetchCount();
    // Poll rzadziej aby zmniejszyć obciążenie
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBetaTimeLeft(calculateTimeLeft(BETA_RELEASE));
      setPublicTimeLeft(calculateTimeLeft(PUBLIC_RELEASE));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) {
      toast({ title: "Błąd", description: "Proszę wypełnić wszystkie pola", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/pre-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRegistered(true);
        setRegistrationNumber(data.registrationNumber);
        toast({
          title: 'Sukces!',
          description: `Zarejestrowano jako ${data.registrationNumber <= 100 ? 'PIONIER' : 'BETA TESTER'} #${data.registrationNumber}`,
        });
      } else {
        const msg = data.error || (data.issues ? 'Niepoprawne dane formularza' : 'Nie udało się zarejestrować');
        toast({ title: 'Błąd', description: msg, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Błąd', description: 'Wystąpił problem z rejestracją', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isPioneer = currentCount < 100;
  const spotsLeft = Math.max(0, 5000 - currentCount);
  const pioneerSpotsLeft = Math.max(0, 100 - currentCount);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-accent/5 to-background">
      <div className="flex-1">
        <div className="container mx-auto px-4 md:px-6 py-12 md:py-20">
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Logo Header */}
            <div className="text-center space-y-6">
              <Link href="/" className="inline-flex items-center gap-3">
                <ShoppingBag className="h-12 w-12 md:h-16 md:w-16 text-primary" />
                <h1 className="font-headline text-5xl md:text-7xl font-bold">
                  Okazje<span className="text-primary">+</span>
                </h1>
              </Link>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  <Flame className="h-4 w-4" />
                  Najlepsze okazje w jednym miejscu
                </div>
                <p className="text-lg md:text-xl text-muted-foreground">
                  Polska platforma społecznościowa do odkrywania najlepszych promocji i produktów
                </p>
              </div>
            </div>

            {/* Countdown Cards */}
            <div className="space-y-6">
              {/* Beta Release */}
              <Card className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Flame className="h-5 w-5" />
                      <span className="font-semibold uppercase tracking-wide">Beta Release</span>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold font-headline">
                      Środa, 19 listopada · 10:00
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {hydrated && [
                      { label: "Dni", value: betaTimeLeft.days },
                      { label: "Godz", value: betaTimeLeft.hours },
                      { label: "Min", value: betaTimeLeft.minutes },
                      { label: "Sek", value: betaTimeLeft.seconds },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <div className="bg-primary/10 rounded-lg p-3 md:p-4 min-w-[60px] md:min-w-[80px]">
                          <div className="text-2xl md:text-4xl font-bold text-primary font-headline">
                            {value.toString().padStart(2, "0")}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{label}</div>
                      </div>
                    ))}
                    {!hydrated && (
                      <div className="flex gap-3" suppressHydrationWarning>
                        {['Dni','Godz','Min','Sek'].map(label => (
                          <div key={label} className="text-center">
                            <div className="bg-primary/5 rounded-lg p-3 md:p-4 min-w-[60px] md:min-w-[80px]">
                              <div className="text-2xl md:text-4xl font-bold text-primary/50 font-headline">--</div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Public Release */}
              <Card className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-accent">
                      <Zap className="h-5 w-5" />
                      <span className="font-semibold uppercase tracking-wide">Public Release</span>
                    </div>
                    <p className="text-2xl md:text-3xl font-bold font-headline">
                      Piątek, 21 listopada · 19:00
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {hydrated && [
                      { label: "Dni", value: publicTimeLeft.days },
                      { label: "Godz", value: publicTimeLeft.hours },
                      { label: "Min", value: publicTimeLeft.minutes },
                      { label: "Sek", value: publicTimeLeft.seconds },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <div className="bg-accent/10 rounded-lg p-3 md:p-4 min-w-[60px] md:min-w-[80px]">
                          <div className="text-2xl md:text-4xl font-bold text-accent font-headline">
                            {value.toString().padStart(2, "0")}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{label}</div>
                      </div>
                    ))}
                    {!hydrated && (
                      <div className="flex gap-3" suppressHydrationWarning>
                        {['Dni','Godz','Min','Sek'].map(label => (
                          <div key={label} className="text-center">
                            <div className="bg-accent/5 rounded-lg p-3 md:p-4 min-w-[60px] md:min-w-[80px]">
                              <div className="text-2xl md:text-4xl font-bold text-accent/50 font-headline">--</div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Stats & Registration */}
            <Card className="p-6 md:p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Wczesny dostęp</span>
                  </div>
                  <span className="text-xl md:text-2xl font-bold text-primary font-headline">
                    {currentCount} / 5000
                  </span>
                </div>

                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                    style={{ width: `${Math.min((currentCount / 5000) * 100, 100)}%` }}
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>
                    Zapisz się teraz — liczba miejsc ograniczona. {isPioneer ? 'Pionierzy otrzymują specjalną odznakę w profilu.' : 'Dołącz do listy Beta i zyskaj wcześniejszy dostęp.'}
                  </span>
                </div>

                {!registered ? (
                  <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Imię lub nick</Label>
                        <Input
                          id="name"
                          placeholder="Jan lub TwójNick"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          disabled={loading || spotsLeft === 0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="jan@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading || spotsLeft === 0}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading || spotsLeft === 0}>
                      {loading ? (
                        <>
                          <Clock className="mr-2 h-4 w-4 animate-spin" />
                          Rejestracja...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          {isPioneer ? "🏆 Zostań Pionierem" : "🚀 Dołącz do Beta"}
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Zaproszenie otrzymasz w dniu premiery beta. {isPioneer && pioneerSpotsLeft > 0 && `Zostało ${pioneerSpotsLeft} miejsc dla pionierów!`}
                    </p>
                  </form>
                ) : (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center space-y-3">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                    <p className="font-bold text-lg">
                      {registrationNumber && registrationNumber <= 100 ? "🏆 Jesteś Pionierem" : "🚀 Jesteś Beta Testerem"} #{registrationNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">Zaproszenie wysłano na {email}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Dlaczego warto dołączyć teraz? */}
            <Card className="p-6 md:p-8">
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold">
                    <Zap className="h-3.5 w-3.5" />
                    Early Access
                  </div>
                  <h2 className="text-2xl md:text-3xl font-headline font-bold">Dlaczego warto dołączyć teraz?</h2>
                  <p className="text-muted-foreground">Zyskaj przewagę i pomóż nam współtworzyć najlepsze miejsce z okazjami w Polsce.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card/50">
                    <Trophy className="h-6 w-6 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold">Odznaka Pioniera/Beta</p>
                      <p className="text-sm text-muted-foreground">Unikalna odznaka w profilu oraz na liście użytkowników – pokaż, że byłeś z nami od początku.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card/50">
                    <Rocket className="h-6 w-6 text-accent mt-0.5" />
                    <div>
                      <p className="font-semibold">Wcześniejszy dostęp do funkcji</p>
                      <p className="text-sm text-muted-foreground">Testuj nowości przed innymi i zgłaszaj uwagi, zanim trafią do publicznej wersji.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card/50">
                    <Sparkles className="h-6 w-6 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold">Realny wpływ na rozwój</p>
                      <p className="text-sm text-muted-foreground">Głosuj na pomysły, sugeruj poprawki i kształtuj roadmapę Okazje+.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card/50">
                    <Gift className="h-6 w-6 text-accent mt-0.5" />
                    <div>
                      <p className="font-semibold">Niespodzianki dla pierwszych</p>
                      <p className="text-sm text-muted-foreground">Specjalne aktywacje i okazjonalne bonusy przygotowane dla early adopters.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

