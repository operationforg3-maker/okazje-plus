"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Flame, Users, Zap, CheckCircle2, Clock, ShoppingBag, TrendingUp, Award, Mail } from "lucide-react";
import { Footer } from "@/components/layout/footer";

// Beta Release: środa 20.11.2025, 10:00 (CET)
const BETA_RELEASE = new Date("2025-11-20T10:00:00+01:00");
// Public Release: piątek 21.11.2025, 19:00 (CET)
const PUBLIC_RELEASE = new Date("2025-11-21T19:00:00+01:00");

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function ComingSoonPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState<number | null>(null);
  const [currentCount, setCurrentCount] = useState(0);
  const [betaTimeLeft, setBetaTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [publicTimeLeft, setPublicTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Oblicz pozostały czas
  const calculateTimeLeft = (targetDate: Date): TimeLeft => {
    const now = new Date();
    const difference = targetDate.getTime() - now.getTime();

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  // Pobierz aktualny licznik rejestracji
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/pre-register/count");
        if (res.ok) {
          const data = await res.json();
          setCurrentCount(data.count || 0);
        }
      } catch (error) {
        console.error("Error fetching count:", error);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000); // Co 30s

    return () => clearInterval(interval);
  }, []);

  // Timer countdown
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
      toast({
        title: "Błąd",
        description: "Proszę wypełnić wszystkie pola",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/pre-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const data = await res.json();

      if (res.ok) {
        setRegistered(true);
        setRegistrationNumber(data.registrationNumber);
        toast({
          title: "Sukces!",
          description: `Zarejestrowano jako ${data.registrationNumber <= 100 ? "PIONIER" : "BETA TESTER"} #${data.registrationNumber}`,
        });
      } else {
        toast({
          title: "Błąd",
          description: data.error || "Nie udało się zarejestrować",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Błąd",
        description: "Wystąpił problem z rejestracją. Spróbuj ponownie.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isPioneer = currentCount < 100;
  const spotsLeft = Math.max(0, 5000 - currentCount);
  const pioneerSpotsLeft = Math.max(0, 100 - currentCount);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-accent/5 to-background">
      {/* Hero Section */}
      <div className="flex-1">
        <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="max-w-5xl mx-auto space-y-12">
            {/* Header z Logo */}
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <ShoppingBag className="h-9 w-9 text-white" />
                </div>
                <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight">
                  Okazje<span className="text-primary">+</span>
                </h1>
              </div>
              
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  <Flame className="h-4 w-4" />
                  Najlepsze okazje w jednym miejscu
                </div>
                <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-medium">
                  Polska platforma okazji i produktów sprawdzonych przez społeczność
                </p>
              </div>
            </div>

            {/* Countdown Timers */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Beta Countdown */}
              <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/30">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Award className="h-5 w-5" />
                    <span className="font-semibold text-sm uppercase tracking-wide">Beta Release</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Środa, 20 listopada 2025 · 10:00
                  </p>
                  <div className="grid grid-cols-4 gap-2 md:gap-3">
                    {[
                      { label: "Dni", value: betaTimeLeft.days },
                      { label: "Godz", value: betaTimeLeft.hours },
                      { label: "Min", value: betaTimeLeft.minutes },
                      { label: "Sek", value: betaTimeLeft.seconds },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 shadow-sm text-center">
                        <div className="text-2xl md:text-4xl font-bold text-primary font-headline">
                          {value.toString().padStart(2, "0")}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Public Countdown */}
              <Card className="p-6 md:p-8 bg-gradient-to-br from-accent/10 to-primary/10 border-2 border-accent/30">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-accent">
                    <Zap className="h-5 w-5" />
                    <span className="font-semibold text-sm uppercase tracking-wide">Public Release</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Piątek, 21 listopada 2025 · 19:00
                  </p>
                  <div className="grid grid-cols-4 gap-2 md:gap-3">
                    {[
                      { label: "Dni", value: publicTimeLeft.days },
                      { label: "Godz", value: publicTimeLeft.hours },
                      { label: "Min", value: publicTimeLeft.minutes },
                      { label: "Sek", value: publicTimeLeft.seconds },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 shadow-sm text-center">
                        <div className="text-2xl md:text-4xl font-bold text-accent font-headline">
                          {value.toString().padStart(2, "0")}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Progress Bar */}
            <Card className="p-6 bg-card">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Wczesny dostęp</span>
                  </div>
                  <span className="text-2xl md:text-3xl font-bold text-primary font-headline">
                    {currentCount} <span className="text-muted-foreground">/ 5000</span>
                  </span>
                </div>

                <div className="relative w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-primary to-accent transition-all duration-500"
                    style={{ width: `${Math.min((currentCount / 5000) * 100, 100)}%` }}
                  />
                </div>

                {isPioneer && pioneerSpotsLeft > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Zostało tylko {pioneerSpotsLeft} miejsc dla PIONIERÓW
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Registration Form or Success */}
            {!registered ? (
              <Card className="p-8 md:p-10 bg-card">
                <div className="space-y-6">
                  <div className="text-center space-y-3">
                    <h2 className="font-headline text-3xl md:text-4xl font-bold">
                      {isPioneer ? "🏆 Zostań Pionierem" : "🚀 Dołącz do Beta"}
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {isPioneer
                        ? "Pierwsze 100 osób otrzyma status PIONIERA z ekskluzywnymi benefitami"
                        : "Zapisz się na listę 5000 pierwszych użytkowników platformy"}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Imię i nazwisko</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Jan Kowalski"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={loading || spotsLeft === 0}
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Adres email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="jan@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading || spotsLeft === 0}
                        className="h-12"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold"
                      size="lg"
                      disabled={loading || spotsLeft === 0}
                    >
                      {loading ? (
                        <>
                          <Clock className="mr-2 h-5 w-5 animate-spin" />
                          Rejestracja...
                        </>
                      ) : spotsLeft === 0 ? (
                        "Lista pełna"
                      ) : (
                        <>
                          <Mail className="mr-2 h-5 w-5" />
                          Zapisz się na listę
                        </>
                      )}
                    </Button>
                  </form>

                  <p className="text-xs text-center text-muted-foreground max-w-md mx-auto">
                    Otrzymasz zaproszenie na adres email w dniu premiery beta. Nie wysyłamy spamu.
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="p-8 md:p-10 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800">
                <div className="space-y-6 text-center max-w-md mx-auto">
                  <CheckCircle2 className="h-20 w-20 text-green-600 mx-auto" />
                  <div className="space-y-2">
                    <h2 className="font-headline text-3xl font-bold text-green-900 dark:text-green-100">
                      Sukces!
                    </h2>
                    <p className="text-xl font-semibold text-green-800 dark:text-green-200">
                      {registrationNumber && registrationNumber <= 100 ? (
                        <>🏆 Jesteś Pionierem #{registrationNumber}</>
                      ) : (
                        <>🚀 Jesteś Beta Testerem #{registrationNumber}</>
                      )}
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
                    <p>
                      Potwierdzenie wysłano na <strong>{email}</strong>
                    </p>
                    <p>
                      Zaproszenie otrzymasz <strong>20 listopada o 10:00</strong>
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 pt-8">
              <Card className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Flame className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-headline font-bold text-xl mb-2">Gorące Okazje</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tysiące aktywnych promocji weryfikowanych przez społeczność
                </p>
              </Card>

              <Card className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-7 w-7 text-accent" />
                </div>
                <h3 className="font-headline font-bold text-xl mb-2">Społeczność</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Aktywni użytkownicy dzielący się najlepszymi znaleziskami
                </p>
              </Card>

              <Card className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-headline font-bold text-xl mb-2">AI Predykcja</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Gemini 2.5 Flash analizuje trendy i rekomenduje okazje
                </p>
              </Card>
            </div>

            {/* Stats */}
            <Card className="p-8 bg-gradient-to-br from-primary/5 to-accent/5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-3xl md:text-4xl font-bold text-primary font-headline">1000+</div>
                  <p className="text-sm text-muted-foreground mt-1">Okazji</p>
                </div>
                <div>
                  <div className="text-3xl md:text-4xl font-bold text-primary font-headline">5000</div>
                  <p className="text-sm text-muted-foreground mt-1">Beta testerów</p>
                </div>
                <div>
                  <div className="text-3xl md:text-4xl font-bold text-primary font-headline">24/7</div>
                  <p className="text-sm text-muted-foreground mt-1">Monitoring</p>
                </div>
                <div>
                  <div className="text-3xl md:text-4xl font-bold text-primary font-headline">AI</div>
                  <p className="text-sm text-muted-foreground mt-1">Asystent</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
