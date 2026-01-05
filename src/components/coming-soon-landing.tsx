'use client';

import Image from 'next/image';
import { Mail, Sparkles } from 'lucide-react';

export default function ComingSoonLanding() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 overflow-hidden relative">
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
      <div className="max-w-2xl w-full text-center relative z-10 space-y-12 animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-72 h-24">
            <Image
              src="/Logotyp_okazjeplus.svg"
              alt="Okazje Plus"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full shadow-lg">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold text-lg">Już wkrótce</span>
          <Sparkles className="w-5 h-5" />
        </div>

        {/* Main message */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-6xl font-headline font-bold text-foreground leading-tight">
            Najlepsze okazje<br />
            <span className="text-primary">w jednym miejscu</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-xl mx-auto">
            Przygotowujemy coś wyjątkowego dla łowców promocji
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          {[
            { emoji: '🔥', text: 'Gorące okazje' },
            { emoji: '💰', text: 'Najlepsze ceny' },
            { emoji: '✓', text: 'Sprawdzone źródła' },
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-card rounded-lg p-6 border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
            >
              <div className="text-4xl mb-3">{feature.emoji}</div>
              <p className="text-foreground font-medium">{feature.text}</p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="pt-12">
          <div className="inline-flex items-center gap-3 text-muted-foreground">
            <Mail className="w-5 h-5 text-primary" />
            <span className="text-base">Kontakt:</span>
            <a
              href="mailto:business@okazjeplus.pl"
              className="text-base font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              business@okazjeplus.pl
            </a>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 pt-8">
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
  );
}
