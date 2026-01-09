'use client';

import Image from 'next/image';
import { Mail, Sparkles, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogoSVGWrapper } from './layout/logo-svg-wrapper';

export default function ComingSoonLanding() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        setEmail('');
        setTimeout(() => setSubmitted(false), 5000);
      } else {
        setError(data.error || 'Błąd podczas rejestracji');
      }
    } catch (err) {
      console.error('Newsletter subscription error:', err);
      setError('Błąd połączenia. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Lokalny, wymuszony tryb ciemny dla lepszej ekspozycji logotypu i kontrastu
    <div className="dark">
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 overflow-hidden relative">
      {/* Subtle brand accent dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 left-1/4 w-2 h-2 rounded-full bg-primary" />
        <div className="absolute top-40 right-1/3 w-3 h-3 rounded-full bg-primary/60" />
        <div className="absolute bottom-40 left-1/3 w-2 h-2 rounded-full bg-primary" />
        <div className="absolute bottom-60 right-1/4 w-3 h-3 rounded-full bg-primary/60" />
        <div className="absolute top-1/2 left-20 w-2 h-2 rounded-full bg-accent/40" />
        <div className="absolute top-1/3 right-32 w-2 h-2 rounded-full bg-accent/40" />
      </div>

      {/* Main content */}
      <div className="max-w-2xl w-full relative z-10 space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center">
          <LogoSVGWrapper className="w-72 h-24" />
        </div>

        {/* Main headline & description */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-headline font-bold leading-tight">
            Najlepsze okazje<br />
            <span className="text-primary">w jednym miejscu</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Przygotowujemy coś wyjątkowego dla łowców promocji
          </p>
        </div>

        {/* CTA Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full shadow-lg">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold text-lg">Już wkrótce</span>
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* Newsletter signup */}
        <div className="bg-gray-50 rounded-lg p-8 border border-gray-200 space-y-4">
          <h2 className="text-lg font-headline font-bold text-gray-900 text-center">
            Bądź na bieżąco
          </h2>
          <p className="text-sm text-gray-600 text-center">
            Otrzymaj powiadomienie gdy startujemy
          </p>
          
          <form onSubmit={handleSubscribe} className="space-y-3">
            <div className="flex gap-2 flex-col sm:flex-row">
              <Input
                type="email"
                placeholder="Twój email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg"
                disabled={isLoading || submitted}
              />
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white rounded-lg px-6 whitespace-nowrap"
                disabled={isLoading || submitted}
              >
                {submitted ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Dziękujemy!
                  </>
                ) : (
                  'Zapisz się'
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center">
                ⚠ {error}
              </p>
            )}
            {submitted && (
              <p className="text-sm text-primary text-center">
                ✓ Na twój email trafiła wiadomość potwierdzająca
              </p>
            )}
          </form>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {[
            { emoji: '🔥', text: 'Gorące okazje' },
            { emoji: '💰', text: 'Najlepsze ceny' },
            { emoji: '✓', text: 'Sprawdzone źródła' },
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
            >
              <div className="text-4xl mb-3">{feature.emoji}</div>
              <p className="text-gray-900 font-medium">{feature.text}</p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="text-center pt-8 border-t border-gray-200">
          <div className="inline-flex items-center gap-3 text-gray-600">
            <Mail className="w-5 h-5 text-primary" />
            <span className="text-base">Pytania?</span>
            <a
              href="mailto:business@okazjeplus.pl"
              className="text-base font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              business@okazjeplus.pl
            </a>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 pt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 1s ease-out forwards;
        }
      `}</style>
      </div>
    </div>
  );
}
