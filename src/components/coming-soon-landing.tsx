'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Mail, Sparkles } from 'lucide-react';

export default function ComingSoonLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-orange-200/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Main content */}
      <motion.div
        className="max-w-2xl w-full text-center relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Logo */}
        <motion.div
          className="mb-8 flex justify-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="relative w-64 h-24">
            <Image
              src="/Logotyp_okazjeplus.svg"
              alt="Okazje Plus"
              fill
              className="object-contain"
              priority
            />
          </div>
        </motion.div>

        {/* Coming Soon Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full mb-8 shadow-lg shadow-orange-200"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold text-lg">Już wkrótce</span>
          <Sparkles className="w-5 h-5" />
        </motion.div>

        {/* Main message */}
        <motion.div
          className="space-y-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            Najlepsze okazje<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
              w jednym miejscu
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-xl mx-auto">
            Przygotowujemy coś wyjątkowego dla łowców promocji i smart shopperów
          </p>
        </motion.div>

        {/* Features preview */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          {[
            { icon: '🔥', text: 'Gorące okazje' },
            { icon: '💰', text: 'Najlepsze ceny' },
            { icon: '🎯', text: 'Sprawdzone źródła' },
          ].map((feature, index) => (
            <motion.div
              key={index}
              className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100"
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-4xl mb-2">{feature.icon}</div>
              <p className="text-gray-700 font-medium">{feature.text}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Contact info */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
        >
          <div className="flex items-center justify-center gap-3 text-gray-700">
            <Mail className="w-5 h-5 text-orange-600" />
            <span className="text-lg">Kontakt:</span>
            <a
              href="mailto:business@okazjeplus.pl"
              className="text-lg font-semibold text-orange-600 hover:text-orange-700 transition-colors underline decoration-2 underline-offset-4"
            >
              business@okazjeplus.pl
            </a>
          </div>
        </motion.div>

        {/* Animated dots indicator */}
        <motion.div
          className="flex justify-center gap-2 mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-orange-500 rounded-full"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
