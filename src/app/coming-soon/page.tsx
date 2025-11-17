"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Flame, Users, Zap, CheckCircle2, Clock } from "lucide-react";

// Beta Release: środa 19.11.2025, 10:00 (CET)
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

      if (res.ok && data.success) {
        setRegistered(true);
        setRegistrationNumber(data.registrationNumber);
        setCurrentCount(data.registrationNumber);
        
        toast({
          title: "Dziękujemy za rejestrację! 🎉",
          description: `Jesteś ${data.registrationNumber <= 100 ? "PIONIEREM" : "BETA TESTEREM"} #${data.registrationNumber}!`,
        });
      } else {
        toast({
          title: "Błąd",
          description: data.error || "Nie udało się zarejestrować",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Wystąpił problem z rejestracją",
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Logo & Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Flame className="h-12 w-12 md:h-16 md:w-16 text-orange-500" />
              <h1 className="font-headline text-4xl md:text-6xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                Okazje+
              </h1>
            </div>
            <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 font-medium">
              Niedługo startujemy! 🚀
            </p>
          </div>

          {/* Timers */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Beta Release Timer */}
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-6 w-6 text-purple-600" />
                  <h2 className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    Beta Release
                  </h2>
                </div>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  Środa, 20 listopada 2025, 10:00
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Dni", value: betaTimeLeft.days },
                    { label: "Godz", value: betaTimeLeft.hours },
                    { label: "Min", value: betaTimeLeft.minutes },
                    { label: "Sek", value: betaTimeLeft.seconds },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow">
                      <div className="text-2xl md:text-3xl font-bold text-purple-600">
                        {value.toString().padStart(2, "0")}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Public Release Timer */}
            <Card className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-orange-200 dark:border-orange-800">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Users className="h-6 w-6 text-orange-600" />
                  <h2 className="text-xl font-bold text-orange-900 dark:text-orange-100">
                    Public Release
                  </h2>
                </div>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Piątek, 21 listopada 2025, 19:00
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Dni", value: publicTimeLeft.days },
                    { label: "Godz", value: publicTimeLeft.hours },
                    { label: "Min", value: publicTimeLeft.minutes },
                    { label: "Sek", value: publicTimeLeft.seconds },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow">
                      <div className="text-2xl md:text-3xl font-bold text-orange-600">
                        {value.toString().padStart(2, "0")}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Status Bar */}
          <Card className="p-6 bg-white dark:bg-gray-800">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Zarejestrowanych:</span>
                </div>
                <span className="text-2xl font-bold text-primary">
                  {currentCount} / 5000
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
                  style={{ width: `${(currentCount / 5000) * 100}%` }}
                />
              </div>

              {isPioneer && pioneerSpotsLeft > 0 && (
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    🏆 Zostało tylko {pioneerSpotsLeft} miejsc dla PIONIERÓW!
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {spotsLeft > 0
                  ? `Pozostało ${spotsLeft} miejsc na wczesny dostęp`
                  : "Osiągnięto limit rejestracji"}
              </p>
            </div>
          </Card>

          {/* Registration Form */}
          {!registered ? (
            <Card className="p-8 bg-white dark:bg-gray-800">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {isPioneer ? "Zostań Pionierem! 🏆" : "Dołącz do Beta Testerów! 🚀"}
                  </h2>
                  <p className="text-muted-foreground">
                    {isPioneer
                      ? "Pierwsze 100 osób otrzyma status PIONIERA i ekskluzywne benefity!"
                      : "Bądź w pierwszej piątce tysięcy użytkowników platformy Okazje+"}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Adres email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jan.kowalski@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading || spotsLeft === 0}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading || spotsLeft === 0}
                  >
                    {loading ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Rejestracja...
                      </>
                    ) : spotsLeft === 0 ? (
                      "Lista pełna"
                    ) : (
                      "Zarejestruj się teraz!"
                    )}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground">
                  Rejestrując się, otrzymasz wiadomość email z zaproszeniem do platformy w dniu premiery.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="p-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800">
              <div className="space-y-4 text-center">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
                <h2 className="text-2xl font-bold text-green-900 dark:text-green-100">
                  Dziękujemy za rejestrację!
                </h2>
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                    {registrationNumber && registrationNumber <= 100 ? (
                      <>🏆 Jesteś PIONIEREM #{registrationNumber}!</>
                    ) : (
                      <>🚀 Jesteś BETA TESTEREM #{registrationNumber}!</>
                    )}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Wysłaliśmy potwierdzenie na adres <strong>{email}</strong>
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Zaproszenie do platformy otrzymasz w dniu premiery beta!
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-6 pt-8">
            <Card className="p-6 text-center">
              <Flame className="h-10 w-10 text-orange-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Gorące Okazje</h3>
              <p className="text-sm text-muted-foreground">
                Najlepsze promocje sprawdzone przez społeczność
              </p>
            </Card>

            <Card className="p-6 text-center">
              <Users className="h-10 w-10 text-blue-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Społeczność</h3>
              <p className="text-sm text-muted-foreground">
                Tysiące użytkowników dzielących się okazjami
              </p>
            </Card>

            <Card className="p-6 text-center">
              <Zap className="h-10 w-10 text-purple-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">AI Asystent</h3>
              <p className="text-sm text-muted-foreground">
                Inteligentne rekomendacje dopasowane do Ciebie
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
