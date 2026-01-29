'use client';

import { useEffect } from 'react';
import 'vanilla-cookieconsent/dist/cookieconsent.css';
import * as CookieConsent from 'vanilla-cookieconsent';
import { useParams } from 'next/navigation';

export function CookieConsentBanner() {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';

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
        },
      },
    });
  }, [locale]);

  return null;
}
