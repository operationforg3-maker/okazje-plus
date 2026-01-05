'use client';

import Image from 'next/image';
import { Mail, Sparkles, Zap, TrendingUp, Shield, Users, Star, Gift } from 'lucide-react';

export default function ComingSoonLanding() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-amber-50/30 to-orange-100/50" />
      
      {/* Floating geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-gradient-to-br from-orange-400/10 to-amber-400/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-40 -right-20 w-[500px] h-[500px] bg-gradient-to-tl from-orange-300/15 to-amber-300/15 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-orange-200/5 to-amber-200/5 rounded-full blur-3xl animate-pulse-slow" />
        
        {/* Decorative icons floating */}
        <div className="absolute top-32 right-1/4 animate-float-up opacity-20">
          <Sparkles className="w-8 h-8 text-orange-500" />
        </div>
        <div className="absolute bottom-32 left-1/4 animate-float-up animation-delay-1000 opacity-20">
          <Star className="w-10 h-10 text-amber-500" />
        </div>
        <div className="absolute top-1/3 right-20 animate-float-up animation-delay-2000 opacity-15">
          <Gift className="w-12 h-12 text-orange-400" />
        </div>
      </div>

      {/* Main content container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-6xl w-full">
          {/* Logo with glow effect */}
          <div className="mb-12 flex justify-center animate-scale-in">
            <div className="relative">
              <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-orange-400/30 to-amber-400/30 rounded-full" />
              <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
                <div className="relative w-72 h-28">
                  <Image
                    src="/Logotyp_okazjeplus.svg"
                    alt="Okazje Plus"
                    fill
                    className="object-contain drop-shadow-lg"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Hero section */}
          <div className="text-center mb-16 space-y-8 animate-fade-in-up animation-delay-200">
            {/* Badge */}
            <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-white rounded-full shadow-xl shadow-orange-300/50 animate-shimmer bg-[length:200%_100%]">
              <Sparkles className="w-6 h-6 animate-spin-slow" />
              <span className="font-bold text-xl tracking-wide">PREMIERA WKRÓTCE</span>
              <Sparkles className="w-6 h-6 animate-spin-slow" />
            </div>

            {/* Main headline */}
            <div className="space-y-6">
              <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
                <span className="inline-block text-gray-900 animate-slide-in-left">Twoja brama do</span>
                <br />
                <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 animate-gradient bg-[length:200%_100%] animate-slide-in-right">najlepszych okazji</span>
              </h1>
              <p className="text-2xl md:text-3xl text-gray-600 max-w-3xl mx-auto font-light">
                Rewolucja w świecie zakupów online już za chwilę
              </p>
            </div>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 animate-fade-in-up animation-delay-400">
            {[
              { icon: Zap, title: 'Błyskawiczne', subtitle: 'Najgorętsze oferty w mgnieniu oka', color: 'from-orange-500 to-red-500' },
              { icon: TrendingUp, title: 'Inteligentne', subtitle: 'AI podpowiada najlepsze promocje', color: 'from-amber-500 to-orange-500' },
              { icon: Shield, title: 'Bezpieczne', subtitle: 'Tylko sprawdzone źródła', color: 'from-orange-500 to-amber-600' },
              { icon: Users, title: 'Społeczność', subtitle: 'Tysiące łowców okazji', color: 'from-amber-400 to-orange-500' },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group bg-white/85 backdrop-blur-xl rounded-3xl p-8 shadow-xl transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:bg-white/95 animate-fade-in-scale"
                  style={{ animationDelay: `${(index + 6) * 100}ms` }}
                >
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.color} mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.subtitle}</p>
                </div>
              );
            })}
          </div>

          {/* CTA Section */}
          <div className="max-w-3xl mx-auto animate-fade-in-up animation-delay-800">
            <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center gap-3 text-gray-700">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-gray-500 font-medium">Chcesz wiedzieć więcej?</p>
                    <a
                      href="mailto:business@okazjeplus.pl"
                      className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent hover:from-orange-700 hover:to-amber-700 transition-all"
                    >
                      business@okazjeplus.pl
                    </a>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-200">
                  <p className="text-gray-500 text-sm">
                    🚀 Przygotuj się na nowe doświadczenie zakupowe
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom progress indicator */}
          <div className="flex justify-center items-center gap-3 mt-16 animate-fade-in animation-delay-1000">
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 animate-pulse-sequence shadow-lg"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-sm text-gray-500 font-medium">Przygotowujemy coś wyjątkowego...</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(5deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(-5deg);
          }
        }

        @keyframes floatDelayed {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(-40px, 30px) rotate(-7deg);
          }
          66% {
            transform: translate(30px, -20px) rotate(7deg);
          }
        }

        @keyframes floatUp {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-20px) rotate(10deg);
            opacity: 0.4;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
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

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes pulseSlow {
          0%, 100% {
            opacity: 0.1;
            transform: scale(1);
          }
          50% {
            opacity: 0.2;
            transform: scale(1.05);
          }
        }

        @keyframes pulseSequence {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        @keyframes spinSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-float {
          animation: float 20s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: floatDelayed 25s ease-in-out infinite;
        }

        .animate-float-up {
          animation: floatUp 6s ease-in-out infinite;
        }

        .animate-fade-in-up {
          animation: fadeInUp 1s ease-out forwards;
        }

        .animate-fade-in-scale {
          animation: fadeInScale 0.8s ease-out forwards;
          opacity: 0;
        }

        .animate-fade-in {
          animation: fadeIn 1s ease-out forwards;
        }

        .animate-scale-in {
          animation: scaleIn 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .animate-slide-in-left {
          animation: slideInLeft 1s ease-out forwards;
        }

        .animate-slide-in-right {
          animation: slideInRight 1s ease-out 0.2s forwards;
          opacity: 0;
        }

        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }

        .animate-gradient {
          animation: gradient 8s ease infinite;
        }

        .animate-pulse-slow {
          animation: pulseSlow 8s ease-in-out infinite;
        }

        .animate-pulse-sequence {
          animation: pulseSequence 1.5s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spinSlow 3s linear infinite;
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

        .animation-delay-1000 {
          animation-delay: 1s;
          opacity: 0;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
