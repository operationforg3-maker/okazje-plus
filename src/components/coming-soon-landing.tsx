'use client';

import { Mail, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Logo } from './logo';
import { Button } from './ui/button';

export default function ComingSoonLanding() {
  const t = useTranslations('home');
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
        setError(data.error || t('newsletter.error'));
      }
    } catch (err) {
      setError(t('newsletter.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in duration-700">
        {/* Logo */}
        <div className="flex justify-center animate-in slide-in-from-top duration-1000">
          <Logo className="h-16 md:h-20" />
        </div>

        {/* Tagline */}
        <div className="text-center space-y-3 animate-in slide-in-from-bottom duration-1000 delay-150">
          <p className="text-xl md:text-2xl text-slate-300 font-medium">
            {t('tagline')}
          </p>
        </div>

        {/* Coming Soon Badge */}
        <div className="flex justify-center animate-in zoom-in duration-700 delay-300">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#357D58] to-[#4ade80] rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="font-semibold text-lg">{t('badge')}</span>
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Newsletter Form */}
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 space-y-4 backdrop-blur-sm shadow-2xl animate-in slide-in-from-bottom duration-1000 delay-500">
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            {t('newsletter.title')}
          </h2>
          <p className="text-sm text-slate-300 text-center">
            {t('newsletter.description')}
          </p>
          
          <form onSubmit={handleSubscribe} className="space-y-4 pt-2">
            <div className="flex gap-3 flex-col sm:flex-row">
              <input
                type="email"
                placeholder={t('newsletter.placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#357D58] focus:border-transparent transition-all duration-200 text-white placeholder-slate-400"
                disabled={isLoading || submitted}
                required
              />
              <Button
                type="submit"
                disabled={isLoading || submitted}
                className="px-8 py-3 bg-gradient-to-r from-[#357D58] to-[#4ade80] hover:from-[#2d6a4a] hover:to-[#357D58] text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('newsletter.button')}...
                  </span>
                ) : submitted ? (
                  <span className="flex items-center gap-2">
                    ✓ {t('newsletter.success')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('newsletter.button')}
                  </span>
                )}
              </Button>
            </div>
            
            {error && (
              <p className="text-sm text-red-400 text-center animate-in fade-in duration-300">
                {error}
              </p>
            )}
            
            {submitted && (
              <p className="text-sm text-green-400 text-center font-medium animate-in fade-in duration-300">
                Dziękujemy! Skontaktujemy się wkrótce.
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-400 text-sm animate-in fade-in duration-1000 delay-700">
          <p>{t('footer.copyright')}</p>
        </div>
      </div>
    </div>
  );
}
