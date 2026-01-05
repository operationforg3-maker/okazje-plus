'use client';

import Image from 'next/image';
import { Mail, Sparkles } from 'lucide-react';

export default function ComingSoonLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl animate-pulse-slower" />
      </div>

      {/* Main content */}
      <div className="max-w-2xl w-full text-center relative z-10 animate-fade-in-up">
        {/* Logo */}
        <div className="mb-8 flex justify-center animate-scale-in">
          <div className="relative w-64 h-24">
            <Image
              src="/Logotyp_okazjeplus.svg"
              alt="Okazje Plus"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Coming Soon Badge */}
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full mb-8 shadow-lg shadow-orange-200 animate-scale-in animation-delay-200">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold text-lg">Już wkrótce</span>
          <Sparkles className="w-5 h-5" />
        </div>

        {/* Main message */}
        <div className="space-y-4 mb-12 animate-fade-in-up animation-delay-400">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            Najlepsze okazje<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
              w jednym miejscu
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-xl mx-auto">
            Przygotowujemy coś wyjątkowego dla łowców promocji i smart shopperów
          </p>
        </div>

        {/* Features preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in-up animation-delay-600">
          {[
            { icon: '🔥', text: 'Gorące okazje' },
            { icon: '💰', text: 'Najlepsze ceny' },
            { icon: '🎯', text: 'Sprawdzone źródła' },
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100 transition-all duration-300 hover:scale-105 hover:-translate-y-2 hover:shadow-md"
            >
              <div className="text-4xl mb-2">{feature.icon}</div>
              <p className="text-gray-700 font-medium">{feature.text}</p>
            </div>
          ))}
        </div>

        {/* Contact info */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-100 animate-fade-in-up animation-delay-800">
          <div className="flex items-center justify-center gap-3 text-gray-700 flex-wrap">
            <Mail className="w-5 h-5 text-orange-600" />
            <span className="text-lg">Kontakt:</span>
            <a
              href="mailto:business@okazjeplus.pl"
              className="text-lg font-semibold text-orange-600 hover:text-orange-700 transition-colors underline decoration-2 underline-offset-4"
            >
              business@okazjeplus.pl
            </a>
          </div>
        </div>

        {/* Animated dots indicator */}
        <div className="flex justify-center gap-2 mt-12">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulseSlow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }

        @keyframes pulseSlower {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1.2);
          }
          50% {
            opacity: 0.4;
            transform: scale(1);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .animate-scale-in {
          animation: scaleIn 0.6s ease-out forwards;
        }

        .animate-pulse-slow {
          animation: pulseSlow 8s ease-in-out infinite;
        }

        .animate-pulse-slower {
          animation: pulseSlower 10s ease-in-out infinite;
        }

        .animation-delay-200 {
          animation-delay: 0.2s;
          opacity: 0;
        }

        .animation-delay-400 {
          animation-delay: 0.4s;
          opacity: 0;
        }

        .animation-delay-600 {
          animation-delay: 0.6s;
          opacity: 0;
        }

        .animation-delay-800 {
          animation-delay: 0.8s;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
