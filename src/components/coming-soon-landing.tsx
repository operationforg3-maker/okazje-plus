'use client';

import { Mail, Sparkles } from 'lucide-react';
import { useState } from 'react';

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

      if (response.ok) {
        setSubmitted(true);
        setEmail('');
        setTimeout(() => setSubmitted(false), 5000);
      } else {
        const data = await response.json();
        setError(data.error || 'Błąd podczas rejestracji');
      }
    } catch (err) {
      setError('Błąd połączenia. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Logo/Brand */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold">
            Okazje Plus
          </h1>
          <p className="text-xl md:text-2xl text-slate-300">
            Najlepsze okazje w jednym miejscu
          </p>
        </div>

        {/* Coming Soon Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-full">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold text-lg">Już wkrótce</span>
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* Newsletter Form */}
        <div className="bg-slate-800/50 rounded-lg p-8 border border-slate-700 space-y-4 backdrop-blur">
          <h2 className="text-lg font-bold text-center">
            Bądź na bieżąco
          </h2>
          <p className="text-sm text-slate-300 text-center">
            Otrzymaj powiadomienie gdy startujemy
          </p>
          
          <form onSubmit={handleSubscribe} className="space-y-3">
            <div className="flex gap-2 flex-col sm:flex-row">
              <input
                type="email"
                placeholder="Twój email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || submitted}
                required
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isLoading || submitted}
              >
                {submitted ? '✓ Dziękujemy!' : 'Zapisz się'}
              </button>
            </div>
            
            {error && (
              <p className="text-sm text-red-400 text-center">
                ⚠ {error}
              </p>
            )}
            
            {submitted && (
              <p className="text-sm text-green-400 text-center">
                ✓ Sprawdź swoją skrzynkę email
              </p>
            )}
          </form>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { emoji: '🔥', text: 'Gorące okazje' },
            { emoji: '💰', text: 'Najlepsze ceny' },
            { emoji: '✓', text: 'Sprawdzone źródła' },
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 text-center backdrop-blur"
            >
              <div className="text-4xl mb-3">{feature.emoji}</div>
              <p className="font-medium">{feature.text}</p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="text-center pt-8 border-t border-slate-700">
          <div className="inline-flex items-center gap-3 text-slate-300">
            <Mail className="w-5 h-5 text-blue-400" />
            <span>Pytania?</span>
            <a
              href="mailto:business@okazjeplus.pl"
              className="font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              business@okazjeplus.pl
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
