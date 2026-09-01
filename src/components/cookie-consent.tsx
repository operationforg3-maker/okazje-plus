'use client';

import { useEffect, useMemo, useState } from 'react';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import * as CookieConsent from 'vanilla-cookieconsent';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { trackSignUp, trackWelcomeBannerAction } from '@/lib/analytics';

const WELCOME_AFTER_COOKIES_KEY = 'okp_welcome_after_cookies_seen_v1';

const LANGUAGE_TEXTS: Record<string, {
  title: string;
  description: string;
  sourceLabel: string;
  languageLabel: string;
  currencyLabel: string;
  confirmBtn: string;
  registerBtn: string;
  skipBtn: string;
  closeBtnLabel: string;
}> = {
  pl: {
    title: 'Witamy w Okazje+',
    description: 'Dopasowaliśmy ustawienia do Twojego wejścia. Możesz je od razu zmienić lub założyć konto.',
    sourceLabel: 'Źródło wejścia',
    languageLabel: 'Język',
    currencyLabel: 'Waluta',
    confirmBtn: 'Potwierdź wybór',
    registerBtn: 'Przejdź do rejestracji',
    skipBtn: 'Pomiń',
    closeBtnLabel: 'Zamknij',
  },
  en: {
    title: 'Welcome to Okazje+',
    description: 'We suggested settings based on your entry. You can change them now or create an account.',
    sourceLabel: 'Entry source',
    languageLabel: 'Language',
    currencyLabel: 'Currency',
    confirmBtn: 'Confirm selection',
    registerBtn: 'Go to registration',
    skipBtn: 'Skip',
    closeBtnLabel: 'Close',
  },
  de: {
    title: 'Willkommen bei Okazje+',
    description: 'Wir haben Einstellungen anhand deines Einstiegs vorgeschlagen. Du kannst sie jetzt ändern oder ein Konto erstellen.',
    sourceLabel: 'Einstiegsquelle',
    languageLabel: 'Sprache',
    currencyLabel: 'Währung',
    confirmBtn: 'Auswahl bestätigen',
    registerBtn: 'Zur Registrierung',
    skipBtn: 'Überspringen',
    closeBtnLabel: 'Schließen',
  },
  fr: {
    title: 'Bienvenue sur Okazje+',
    description: 'Nous avons suggéré des paramètres selon votre entrée. Vous pouvez les modifier ou créer un compte.',
    sourceLabel: 'Source d’entrée',
    languageLabel: 'Langue',
    currencyLabel: 'Devise',
    confirmBtn: 'Confirmer le choix',
    registerBtn: 'Aller à l’inscription',
    skipBtn: 'Ignorer',
    closeBtnLabel: 'Fermer',
  },
  es: {
    title: 'Bienvenido a Okazje+',
    description: 'Sugerimos la configuración según tu entrada. Puedes cambiarla ahora o crear una cuenta.',
    sourceLabel: 'Origen de entrada',
    languageLabel: 'Idioma',
    currencyLabel: 'Moneda',
    confirmBtn: 'Confirmar selección',
    registerBtn: 'Ir al registro',
    skipBtn: 'Omitir',
    closeBtnLabel: 'Cerrar',
  },
  uk: {
    title: 'Ласкаво просимо до Okazje+',
    description: 'Ми запропонували налаштування на основі вашого входу. Можна змінити їх зараз або створити акаунт.',
    sourceLabel: 'Джерело входу',
    languageLabel: 'Мова',
    currencyLabel: 'Валюта',
    confirmBtn: 'Підтвердити вибір',
    registerBtn: 'Перейти до реєстрації',
    skipBtn: 'Пропустити',
    closeBtnLabel: 'Закрити',
  },
};

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;
const LANGUAGE_OPTIONS = [
  { value: 'pl', label: 'Polski' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'uk', label: 'Українська' },
] as const;
const CURRENCY_OPTIONS = [
  { value: 'PLN', label: 'PLN' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
] as const;

function detectSource(): string {
  if (typeof window === 'undefined') return 'direct';
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) return utmSource;
  const gclid = params.get('gclid');
  if (gclid) return 'google_ads';
  const fbclid = params.get('fbclid');
  if (fbclid) return 'facebook_ads';
  if (!document.referrer) return 'direct';
  try {
    return new URL(document.referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'external';
  }
}

function suggestCurrency(locale: string, source: string): 'PLN' | 'EUR' | 'USD' | 'GBP' {
  if (source.includes('.co.uk') || source.includes('uk')) return 'GBP';
  if (locale === 'de' || locale === 'fr' || locale === 'es') return 'EUR';
  if (locale === 'en') return 'USD';
  return 'PLN';
}

function normalizeLocale(input: string): string {
  const normalized = input.toLowerCase().split('-')[0];
  return SUPPORTED_LOCALES.includes(normalized as (typeof SUPPORTED_LOCALES)[number]) ? normalized : 'pl';
}

export function CookieConsentBanner() {
  const params = useParams();
  const locale = normalizeLocale((params?.locale as string) || 'pl');
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [entrySource, setEntrySource] = useState('direct');
  const [selectedLanguage, setSelectedLanguage] = useState(locale);
  const [selectedCurrency, setSelectedCurrency] = useState<'PLN' | 'EUR' | 'USD' | 'GBP'>('PLN');
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const syncCookieThemeWithApp = () => {
    if (typeof document === 'undefined') return;
    const cookieRoot = document.getElementById('cc-main');
    if (!cookieRoot) return;

    cookieRoot.style.setProperty('--cc-bg', 'hsl(var(--background))');
    cookieRoot.style.setProperty('--cc-primary-color', 'hsl(var(--foreground))');
    cookieRoot.style.setProperty('--cc-secondary-color', 'hsl(var(--muted-foreground))');
    cookieRoot.style.setProperty('--cc-btn-primary-bg', 'hsl(var(--primary))');
    cookieRoot.style.setProperty('--cc-btn-primary-color', 'hsl(var(--primary-foreground))');
    cookieRoot.style.setProperty('--cc-btn-primary-border-color', 'hsl(var(--primary))');
    cookieRoot.style.setProperty('--cc-btn-primary-hover-bg', 'hsl(var(--primary) / 0.9)');
    cookieRoot.style.setProperty('--cc-btn-primary-hover-color', 'hsl(var(--primary-foreground))');
    cookieRoot.style.setProperty('--cc-btn-secondary-bg', 'hsl(var(--secondary))');
    cookieRoot.style.setProperty('--cc-btn-secondary-color', 'hsl(var(--secondary-foreground))');
    cookieRoot.style.setProperty('--cc-btn-secondary-border-color', 'hsl(var(--border))');
    cookieRoot.style.setProperty('--cc-btn-secondary-hover-bg', 'hsl(var(--accent))');
    cookieRoot.style.setProperty('--cc-btn-secondary-hover-color', 'hsl(var(--accent-foreground))');
    cookieRoot.style.setProperty('--cc-separator-border-color', 'hsl(var(--border))');
    cookieRoot.style.setProperty('--cc-cookie-category-block-bg', 'hsl(var(--muted))');
    cookieRoot.style.setProperty('--cc-link-color', 'hsl(var(--primary))');
  };

  const activeLanguage = normalizeLocale(selectedLanguage || locale);
  const texts = useMemo(() => LANGUAGE_TEXTS[activeLanguage] || LANGUAGE_TEXTS.pl, [activeLanguage]);

  const openWelcomeBanner = () => {
    if (typeof window === 'undefined') return;
    const alreadySeen = localStorage.getItem(WELCOME_AFTER_COOKIES_KEY);
    if (alreadySeen) return;

    const source = detectSource();
    const browserLocale = normalizeLocale(navigator.language || locale);
    const detectedLocale = normalizeLocale(locale || browserLocale);
    const suggested = suggestCurrency(detectedLocale, source);

    setEntrySource(source);
    setSelectedLanguage(detectedLocale);
    setSelectedCurrency(suggested);

    setShowWelcomeBanner(true);
    document.documentElement.classList.add('show--consent');

    trackWelcomeBannerAction('view', {
      source,
      locale: detectedLocale,
      suggested_currency: suggested,
      path: window.location.pathname,
      referrer: document.referrer || 'direct',
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const updateTheme = () => {
      setIsDarkTheme(root.classList.contains('dark'));
      syncCookieThemeWithApp();
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    syncCookieThemeWithApp();
  }, [showWelcomeBanner, selectedLanguage]);

  useEffect(() => {
    CookieConsent.run({
      // Kategorie cookies
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
        },
        analytics: {
          enabled: false,
          autoClear: {
            cookies: [
              {
                name: /^(_ga|_gid)/,
              },
            ],
          },
        },
        marketing: {
          enabled: false,
        },
      },

      // Konfiguracja GUI
      guiOptions: {
        consentModal: {
          layout: 'box inline',
          position: 'bottom left',
          flipButtons: false,
          equalWeightButtons: true,
        },
        preferencesModal: {
          layout: 'box',
          equalWeightButtons: true,
          flipButtons: false,
        },
      },

      // Tłumaczenia
      language: {
        default: locale,
        autoDetect: 'document',
        translations: {
          pl: {
            consentModal: {
              title: '🍪 Używamy plików cookies',
              description:
                'Ta strona wykorzystuje pliki cookies w celu zapewnienia najlepszej jakości usług. Kontynuując przeglądanie, wyrażasz zgodę na ich używanie. Możesz zmienić ustawienia w dowolnym momencie.',
              acceptAllBtn: 'Akceptuj wszystkie',
              acceptNecessaryBtn: 'Odrzuć wszystkie',
              showPreferencesBtn: 'Zarządzaj preferencjami',
            },
            preferencesModal: {
              title: 'Zarządzaj preferencjami cookies',
              acceptAllBtn: 'Akceptuj wszystkie',
              acceptNecessaryBtn: 'Odrzuć wszystkie',
              savePreferencesBtn: 'Zapisz ustawienia',
              closeIconLabel: 'Zamknij',
              serviceCounterLabel: 'Usługi',
              sections: [
                {
                  title: 'Używanie plików cookies',
                  description:
                    'Używamy plików cookies do zapewnienia podstawowych funkcji strony oraz do poprawy Twojego doświadczenia online. Możesz wybrać dla każdej kategorii, czy chcesz wyrazić zgodę, czy też zrezygnować.',
                },
                {
                  title: 'Niezbędne <span class="pm__badge">Zawsze aktywne</span>',
                  description:
                    'Te pliki cookies są niezbędne do prawidłowego działania strony. Bez nich strona nie będzie działać poprawnie.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analityczne',
                  description:
                    'Te pliki cookies zbierają informacje o tym, jak korzystasz z naszej strony. Wszystkie dane są anonimizowane i nie mogą być wykorzystane do Twojej identyfikacji.',
                  linkedCategory: 'analytics',
                },
                {
                  title: 'Marketing',
                  description:
                    'Te pliki cookies są wykorzystywane do wyświetlania reklam dopasowanych do Twoich zainteresowań.',
                  linkedCategory: 'marketing',
                },
                {
                  title: 'Więcej informacji',
                  description:
                    'W przypadku pytań dotyczących naszej polityki cookies, skontaktuj się z nami przez <a href="/pl/kontakt">formularz kontaktowy</a>.',
                },
              ],
            },
          },
          en: {
            consentModal: {
              title: '🍪 We use cookies',
              description:
                'This website uses cookies to ensure you get the best experience. By continuing to browse, you agree to their use. You can change settings at any time.',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Reject all',
              showPreferencesBtn: 'Manage preferences',
            },
            preferencesModal: {
              title: 'Manage cookie preferences',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Reject all',
              savePreferencesBtn: 'Save settings',
              closeIconLabel: 'Close',
              serviceCounterLabel: 'Services',
              sections: [
                {
                  title: 'Cookie usage',
                  description:
                    'We use cookies to provide basic website functionality and to enhance your online experience. You can choose for each category whether to opt-in or opt-out.',
                },
                {
                  title: 'Necessary <span class="pm__badge">Always enabled</span>',
                  description:
                    'These cookies are essential for the proper functioning of the website. Without them, the website will not work correctly.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analytics',
                  description:
                    'These cookies collect information about how you use our website. All data is anonymized and cannot be used to identify you.',
                  linkedCategory: 'analytics',
                },
                {
                  title: 'Marketing',
                  description:
                    'These cookies are used to display ads tailored to your interests.',
                  linkedCategory: 'marketing',
                },
                {
                  title: 'More information',
                  description:
                    'For any questions regarding our cookie policy, please contact us via <a href="/en/contact">contact form</a>.',
                },
              ],
            },
          },
          de: {
            consentModal: {
              title: '🍪 Wir verwenden Cookies',
              description:
                'Diese Website verwendet Cookies, um Ihnen die beste Erfahrung zu bieten. Indem Sie weiter surfen, stimmen Sie deren Verwendung zu. Sie können die Einstellungen jederzeit ändern.',
              acceptAllBtn: 'Alle akzeptieren',
              acceptNecessaryBtn: 'Alle ablehnen',
              showPreferencesBtn: 'Einstellungen verwalten',
            },
            preferencesModal: {
              title: 'Cookie-Einstellungen verwalten',
              acceptAllBtn: 'Alle akzeptieren',
              acceptNecessaryBtn: 'Alle ablehnen',
              savePreferencesBtn: 'Einstellungen speichern',
              closeIconLabel: 'Schließen',
              serviceCounterLabel: 'Dienste',
              sections: [
                {
                  title: 'Cookie-Nutzung',
                  description:
                    'Wir verwenden Cookies, um grundlegende Website-Funktionen bereitzustellen und Ihre Online-Erfahrung zu verbessern. Sie können für jede Kategorie wählen, ob Sie zustimmen oder ablehnen möchten.',
                },
                {
                  title: 'Notwendig <span class="pm__badge">Immer aktiv</span>',
                  description:
                    'Diese Cookies sind für das ordnungsgemäße Funktionieren der Website unerlässlich. Ohne sie funktioniert die Website nicht richtig.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analytisch',
                  description:
                    'Diese Cookies sammeln Informationen darüber, wie Sie unsere Website nutzen. Alle Daten sind anonymisiert und können nicht zur Identifizierung verwendet werden.',
                  linkedCategory: 'analytics',
                },
                {
                  title: 'Marketing',
                  description:
                    'Diese Cookies werden verwendet, um Anzeigen anzuzeigen, die auf Ihre Interessen zugeschnitten sind.',
                  linkedCategory: 'marketing',
                },
                {
                  title: 'Weitere Informationen',
                  description:
                    'Bei Fragen zu unserer Cookie-Richtlinie kontaktieren Sie uns bitte über das <a href="/de/kontakt">Kontaktformular</a>.',
                },
              ],
            },
          },
          fr: {
            consentModal: {
              title: '🍪 Nous utilisons des cookies',
              description:
                'Ce site utilise des cookies pour vous offrir la meilleure experience. En continuant a naviguer, vous acceptez leur utilisation. Vous pouvez modifier les parametres a tout moment.',
              acceptAllBtn: 'Tout accepter',
              acceptNecessaryBtn: 'Tout refuser',
              showPreferencesBtn: 'Gerar les preferences',
            },
            preferencesModal: {
              title: 'Gerer les preferences de cookies',
              acceptAllBtn: 'Tout accepter',
              acceptNecessaryBtn: 'Tout refuser',
              savePreferencesBtn: 'Enregistrer les parametres',
              closeIconLabel: 'Fermer',
              serviceCounterLabel: 'Services',
              sections: [
                {
                  title: 'Utilisation des cookies',
                  description:
                    'Nous utilisons des cookies pour assurer les fonctions essentielles du site et ameliorer votre experience en ligne. Vous pouvez choisir pour chaque categorie si vous souhaitez accepter ou refuser.',
                },
                {
                  title: 'Necessaires <span class="pm__badge">Toujours actifs</span>',
                  description:
                    'Ces cookies sont indispensables au bon fonctionnement du site. Sans eux, le site ne fonctionnera pas correctement.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analytique',
                  description:
                    'Ces cookies collectent des informations sur la maniere dont vous utilisez notre site. Toutes les donnees sont anonymisees et ne permettent pas de vous identifier.',
                  linkedCategory: 'analytics',
                },
                {
                  title: 'Marketing',
                  description:
                    'Ces cookies sont utilises pour afficher des publicites adaptees a vos centres d interet.',
                  linkedCategory: 'marketing',
                },
                {
                  title: 'Plus d informations',
                  description:
                    'Pour toute question concernant notre politique de cookies, contactez-nous via le <a href="/fr/contact">formulaire de contact</a>.',
                },
              ],
            },
          },
          es: {
            consentModal: {
              title: '🍪 Usamos cookies',
              description:
                'Este sitio utiliza cookies para ofrecerte la mejor experiencia. Al continuar navegando, aceptas su uso. Puedes cambiar la configuracion en cualquier momento.',
              acceptAllBtn: 'Aceptar todo',
              acceptNecessaryBtn: 'Rechazar todo',
              showPreferencesBtn: 'Gestionar preferencias',
            },
            preferencesModal: {
              title: 'Gestionar preferencias de cookies',
              acceptAllBtn: 'Aceptar todo',
              acceptNecessaryBtn: 'Rechazar todo',
              savePreferencesBtn: 'Guardar configuracion',
              closeIconLabel: 'Cerrar',
              serviceCounterLabel: 'Servicios',
              sections: [
                {
                  title: 'Uso de cookies',
                  description:
                    'Usamos cookies para proporcionar funciones basicas del sitio y mejorar tu experiencia en linea. Puedes elegir para cada categoria si deseas aceptar o rechazar.',
                },
                {
                  title: 'Necesarias <span class="pm__badge">Siempre activas</span>',
                  description:
                    'Estas cookies son esenciales para el correcto funcionamiento del sitio. Sin ellas, el sitio no funcionara correctamente.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analiticas',
                  description:
                    'Estas cookies recopilan informacion sobre como utilizas nuestro sitio. Todos los datos son anonimizados y no pueden usarse para identificarte.',
                  linkedCategory: 'analytics',
                },
                {
                  title: 'Marketing',
                  description:
                    'Estas cookies se utilizan para mostrar anuncios adaptados a tus intereses.',
                  linkedCategory: 'marketing',
                },
                {
                  title: 'Mas informacion',
                  description:
                    'Si tienes preguntas sobre nuestra politica de cookies, contactanos mediante el <a href="/es/contact">formulario de contacto</a>.',
                },
              ],
            },
          },
          uk: {
            consentModal: {
              title: '🍪 My vykorystovuiemo cookies',
              description:
                'Tsei sait vykorystovuie cookies, shchob nadaty naikrashchyi dosvid. Prodovzhuiuchy perehliad, vy pohodzhuietes na yikh vykorystannia. Nalash­tuvannia mozhna zminyty u bud yakyi moment.',
              acceptAllBtn: 'Pryiniaty vsi',
              acceptNecessaryBtn: 'Vidkhylyty vsi',
              showPreferencesBtn: 'Keruvaty nalashtuvanniamy',
            },
            preferencesModal: {
              title: 'Keruvannia nalashtuvanniamy cookies',
              acceptAllBtn: 'Pryiniaty vsi',
              acceptNecessaryBtn: 'Vidkhylyty vsi',
              savePreferencesBtn: 'Zberehty nalashtuvannia',
              closeIconLabel: 'Zakryty',
              serviceCounterLabel: 'Sluzhby',
              sections: [
                {
                  title: 'Vykorystannia cookies',
                  description:
                    'My vykorystovuemo cookies dlia bazovoi roboty saitу ta pokrashchennia vashoho dosvidu. Vy mozhete obraty dlia kozhnoi katehorii, chy bazhaiete nadaty zghodu, chy vidmovytysia.',
                },
                {
                  title: 'Neobkhidni <span class="pm__badge">Zavzhdy aktyvni</span>',
                  description:
                    'Tsi cookies neobkhidni dlia korektnoi roboty saitu. Bez nykh sait ne bude pratsiuvaty nalежno.',
                  linkedCategory: 'necessary',
                },
                {
                  title: 'Analityka',
                  description:
                    'Tsi cookies zbiraiut informatsiiu pro te, yak vy korystuietes sajtom. Vsi dany zanonimizovani ta ne mozhut buty vykorystani dlia vashoi identyfikatsii.',
                  linkedCategory: 'analytics',
                },
                {
                  title: 'Marketynh',
                  description:
                    'Tsi cookies vykorystovuiutsia dlia pokazу reklam, adaptovanykh do vashykh interesiv.',
                  linkedCategory: 'marketing',
                },
                {
                  title: 'Bilʹshe informatsii',
                  description:
                    'Yakshcho u vas ye pytannia shchodo nashoi polityky cookies, zviazhitsia z namy cherez <a href="/uk/contact">formu kontaktu</a>.',
                },
              ],
            },
          },
        },
      },
      onFirstConsent: () => {
        const acceptedAnalytics = CookieConsent.acceptedCategory('analytics');
        const acceptedMarketing = CookieConsent.acceptedCategory('marketing');
        if (acceptedAnalytics || acceptedMarketing) {
          openWelcomeBanner();
        }
      },
    });
  }, [locale]);

  const closeWelcomeBanner = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(WELCOME_AFTER_COOKIES_KEY, '1');
      document.documentElement.classList.remove('show--consent');
    }
    trackWelcomeBannerAction('dismiss', {
      source: entrySource,
      selected_language: selectedLanguage,
      selected_currency: selectedCurrency,
      locale,
    });
    setShowWelcomeBanner(false);
  };

  const handleLanguageChange = (newLocale: string) => {
    const normalizedLocale = normalizeLocale(newLocale);
    setSelectedLanguage(normalizedLocale);
    trackWelcomeBannerAction('language_change', {
      source: entrySource,
      selected_language: normalizedLocale,
      locale,
    });
  };

  const handleCurrencyChange = (newCurrency: 'PLN' | 'EUR' | 'USD' | 'GBP') => {
    setSelectedCurrency(newCurrency);
    trackWelcomeBannerAction('currency_change', {
      source: entrySource,
      selected_currency: newCurrency,
      locale,
    });
  };

  const handleConfirm = () => {
    if (typeof window === 'undefined') return;

    localStorage.setItem('preferredCurrency', selectedCurrency);
    localStorage.setItem('preferredLocale', selectedLanguage);
    localStorage.setItem(WELCOME_AFTER_COOKIES_KEY, '1');
    window.dispatchEvent(new CustomEvent('currencyChange', { detail: { currency: selectedCurrency } }));

    trackWelcomeBannerAction('confirm', {
      source: entrySource,
      selected_language: selectedLanguage,
      selected_currency: selectedCurrency,
      locale,
    });

    document.documentElement.classList.remove('show--consent');
    setShowWelcomeBanner(false);

    if (selectedLanguage !== locale) {
      const pathnameWithoutLocale = window.location.pathname.replace(/^\/(pl|en|de|fr|es|uk|it)(\/|$)/, '/');
      const query = window.location.search || '';
      window.location.href = `/${selectedLanguage}${pathnameWithoutLocale}${query}`;
    }
  };

  const handleRegisterClick = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredCurrency', selectedCurrency);
      localStorage.setItem('preferredLocale', selectedLanguage);
      localStorage.setItem(WELCOME_AFTER_COOKIES_KEY, '1');
      document.documentElement.classList.remove('show--consent');
    }

    trackSignUp('cookie_welcome_banner');
    trackWelcomeBannerAction('register_click', {
      source: entrySource,
      selected_language: selectedLanguage,
      selected_currency: selectedCurrency,
      locale,
    });
  };

  const registerHref = `/${selectedLanguage}/register`;
  const cookieRoot = typeof document !== 'undefined' ? document.getElementById('cc-main') : null;
  const unifiedButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '42px',
    lineHeight: '1.1',
    textAlign: 'center' as const,
  };

  const welcomeModal = showWelcomeBanner ? (
    <div className={`${isDarkTheme ? 'cc--darkmode' : ''} cm-wrapper cc--anim`}>
      <div className="cm cm--box cm--bottom cm--left cm--inline">
        <div className="cm__body">
          <button type="button" className="cm__btn cm__btn--close" onClick={closeWelcomeBanner} aria-label={texts.closeBtnLabel}>
            <span>×</span>
          </button>
          <div className="cm__texts">
            <h2 className="cm__title">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <img src="/icon_okazjeplus.svg" alt="Okazje+" style={{ width: '20px', height: '20px' }} />
                {texts.title}
              </span>
            </h2>
            <p className="cm__desc" style={{ maxHeight: 'unset' }}>
              {texts.description}
              <br />
              <strong>{texts.sourceLabel}:</strong> {entrySource}
              <br />
              <label style={{ display: 'block', marginTop: '10px' }}>
                {texts.languageLabel}
                <select
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{
                    marginTop: '6px',
                    display: 'block',
                    width: '100%',
                    border: '1px solid var(--cc-separator-border-color)',
                    borderRadius: '6px',
                    padding: '8px',
                    background: 'var(--cc-bg)',
                    color: 'var(--cc-primary-color)',
                    appearance: 'auto',
                  }}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block', marginTop: '10px' }}>
                {texts.currencyLabel}
                <select
                  value={selectedCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value as 'PLN' | 'EUR' | 'USD' | 'GBP')}
                  style={{
                    marginTop: '6px',
                    display: 'block',
                    width: '100%',
                    border: '1px solid var(--cc-separator-border-color)',
                    borderRadius: '6px',
                    padding: '8px',
                    background: 'var(--cc-bg)',
                    color: 'var(--cc-primary-color)',
                    appearance: 'auto',
                  }}
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </p>
          </div>
          <div className="cm__btns">
            <div className="cm__btn-group cm__btn-group--uneven">
              <button type="button" className="cm__btn" onClick={handleConfirm} style={unifiedButtonStyle}>
                {texts.confirmBtn}
              </button>
              <button type="button" className="cm__btn cm__btn--secondary" onClick={closeWelcomeBanner} style={unifiedButtonStyle}>
                {texts.skipBtn}
              </button>
            </div>
            <div className="cm__btn-group cm__btn-group--uneven">
              <Link
                href={registerHref}
                className="cm__btn cm__btn--secondary"
                onClick={handleRegisterClick}
                style={unifiedButtonStyle}
              >
                {texts.registerBtn}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {cookieRoot && welcomeModal ? createPortal(welcomeModal, cookieRoot) : null}
    </>
  );
}
