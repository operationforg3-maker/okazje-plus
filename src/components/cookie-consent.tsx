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
    });
  }, [locale]);

  return null;
}
