import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Polityka Prywatności - Okazje+',
  description: 'Polityka prywatności i ochrony danych osobowych serwisu Okazje+',
};

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Powrót do strony głównej
        </Link>
      </Button>

      <article className="prose prose-slate dark:prose-invert max-w-none">
        <h1 className="font-headline">Polityka Prywatności Serwisu &quot;okazja+&quot;</h1>

        <section>
          <h2>§ 1. Postanowienia Ogólne</h2>
          <ol>
            <li>Niniejsza Polityka Prywatności określa zasady przetwarzania danych osobowych Użytkowników korzystających z Serwisu „okazja+" (dalej: <strong>Serwis</strong>).</li>
            <li>Administratorem danych osobowych jest <strong>[Nazwa Usługodawcy]</strong> z siedzibą w <strong>[Adres]</strong>, wpisany do <strong>[KRS/CEIDG]</strong>, NIP: <strong>[NIP]</strong>, REGON: <strong>[REGON]</strong> (dalej: <strong>Administrator</strong>).</li>
            <li>Kontakt z Administratorem w sprawach ochrony danych:
              <ul>
                <li>E-mail: <a href="mailto:privacy@okazje-plus.pl">privacy@okazje-plus.pl</a></li>
                <li>Adres korespondencyjny: <strong>[Adres do korespondencji]</strong></li>
              </ul>
            </li>
            <li>Administrator przetwarza dane osobowe zgodnie z:
              <ul>
                <li><strong>Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO)</strong>,</li>
                <li><strong>Ustawą o ochronie danych osobowych</strong> z dnia 10 maja 2018 r.,</li>
                <li><strong>Ustawą o świadczeniu usług drogą elektroniczną</strong> z dnia 18 lipca 2002 r.</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 2. Zakres i Cele Przetwarzania Danych</h2>
          <h3>2.1. Dane Użytkowników Niezarejestrowanych (Gości)</h3>
          <p><strong>Zakres danych:</strong></p>
          <ul>
            <li>Adres IP,</li>
            <li>Typ i wersja przeglądarki,</li>
            <li>System operacyjny,</li>
            <li>Czas wizyty, odwiedzone strony,</li>
            <li>Dane z plików cookies (jeśli wyrażono zgodę).</li>
          </ul>
          <p><strong>Cele przetwarzania:</strong></p>
          <ul>
            <li>Zapewnienie prawidłowego działania Serwisu (podstawa prawna: prawnie uzasadniony interes Administratora – art. 6 ust. 1 lit. f RODO),</li>
            <li>Analiza ruchu i statystyki (np. Google Analytics) – podstawa: zgoda (art. 6 ust. 1 lit. a RODO),</li>
            <li>Ochrona przed nadużyciami i atakami (np. DDoS) – prawnie uzasadniony interes.</li>
          </ul>

          <h3>2.2. Dane Użytkowników Zarejestrowanych</h3>
          <p><strong>Zakres danych:</strong></p>
          <ul>
            <li>Adres e-mail (wymagany),</li>
            <li>Login/nick (opcjonalny lub generowany automatycznie),</li>
            <li>Hasło (w formie zahashowanej),</li>
            <li>Zdjęcie profilowe (opcjonalne),</li>
            <li>Inne dane podane dobrowolnie przez Użytkownika (np. biografia, linki społecznościowe).</li>
          </ul>
          <p><strong>Cele przetwarzania:</strong></p>
          <ul>
            <li>Rejestracja i zarządzanie Kontem – podstawa: wykonanie umowy (art. 6 ust. 1 lit. b RODO),</li>
            <li>Personalizacja doświadczeń (np. zapisane oferty, historia aktywności) – prawnie uzasadniony interes,</li>
            <li>Komunikacja z Użytkownikiem (np. powiadomienia o nowych ofertach, odpowiedzi na komentarze) – zgoda lub prawnie uzasadniony interes.</li>
          </ul>

          <h3>2.3. Treści Generowane przez Użytkownika (UGC)</h3>
          <p><strong>Zakres danych:</strong></p>
          <ul>
            <li>Komentarze, opinie, recenzje,</li>
            <li>Zdjęcia i grafiki przesłane przez Użytkownika,</li>
            <li>Opisy ofert, linki afiliacyjne (jeśli Użytkownik je dodaje),</li>
            <li>Oceny produktów i ofert.</li>
          </ul>
          <p><strong>Cele przetwarzania:</strong></p>
          <ul>
            <li>Publikacja treści w Serwisie – podstawa: zgoda (art. 6 ust. 1 lit. a RODO) lub wykonanie umowy,</li>
            <li>Moderacja treści (zgodność z Regulaminem, usuwanie treści nielegalnych) – prawnie uzasadniony interes lub obowiązek prawny (DSA).</li>
          </ul>
        </section>

        <section>
          <h2>§ 3. Cookies i Podobne Technologie</h2>
          <ol>
            <li>Serwis wykorzystuje <strong>pliki cookies</strong> w celu:
              <ul>
                <li>Zapewnienia prawidłowego działania strony (cookies niezbędne),</li>
                <li>Zapamiętywania preferencji Użytkownika (np. wybór języka, tryb ciemny),</li>
                <li>Analizy ruchu (np. Google Analytics) – za zgodą Użytkownika,</li>
                <li>Personalizacji reklam (cookies reklamowe) – za zgodą Użytkownika.</li>
              </ul>
            </li>
            <li>Użytkownik może zarządzać ustawieniami cookies poprzez:
              <ul>
                <li>Ustawienia przeglądarki (usunięcie, blokowanie cookies),</li>
                <li>Narzędzie do zarządzania zgodami (cookie banner) dostępne w Serwisie.</li>
              </ul>
            </li>
            <li>Rodzaje używanych cookies:
              <ul>
                <li><strong>Cookies sesyjne</strong> – usuwane po zamknięciu przeglądarki,</li>
                <li><strong>Cookies trwałe</strong> – przechowywane przez określony czas (np. 30 dni, 1 rok),</li>
                <li><strong>Cookies własne</strong> – ustawiane przez Serwis,</li>
                <li><strong>Cookies podmiotów trzecich</strong> – np. Google Analytics, Facebook Pixel (wymagają zgody).</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 4. Udostępnianie Danych Osobowych</h2>
          <ol>
            <li>Administrator może udostępniać dane osobowe następującym kategoriom odbiorców:
              <ul>
                <li><strong>Dostawcy usług IT</strong> – np. hosting (Firebase/Google Cloud), CDN, dostawcy poczty e-mail,</li>
                <li><strong>Partnerzy afiliacyjni</strong> – w zakresie niezbędnym do realizacji programów partnerskich (np. ID sesji, adres IP),</li>
                <li><strong>Analityka i marketing</strong> – Google Analytics, Facebook Pixel (za zgodą Użytkownika),</li>
                <li><strong>Organy państwowe</strong> – na żądanie uprawnionych organów (np. sąd, prokuratura, policja) w zakresie wymaganym prawem.</li>
              </ul>
            </li>
            <li>Administrator nie sprzedaje danych osobowych podmiotom trzecim.</li>
            <li>Dane mogą być przekazywane poza EOG (np. USA – Google Cloud) wyłącznie na podstawie odpowiednich zabezpieczeń (np. standardowe klauzule umowne UE).</li>
          </ol>
        </section>

        <section>
          <h2>§ 5. Okres Przechowywania Danych</h2>
          <ol>
            <li><strong>Dane Użytkowników Zarejestrowanych</strong> – do momentu usunięcia konta lub wycofania zgody.</li>
            <li><strong>Logi systemowe i dane analityczne</strong> – 12 miesięcy (lub zgodnie z wymogami prawnymi).</li>
            <li><strong>Treści UGC (komentarze, opinie)</strong> – do momentu usunięcia przez Użytkownika lub przez Administratora (moderacja).</li>
            <li><strong>Dane do celów rozliczeniowych i podatkowych</strong> – 5 lat (zgodnie z wymogami prawa podatkowego).</li>
            <li><strong>Dane do dochodzenia roszczeń</strong> – do przedawnienia roszczeń (zgodnie z Kodeksem Cywilnym).</li>
          </ol>
        </section>

        <section>
          <h2>§ 6. Prawa Użytkownika (RODO)</h2>
          <p>Użytkownik ma prawo do:</p>
          <ol>
            <li><strong>Dostępu do danych</strong> – otrzymania informacji, jakie dane są przetwarzane (art. 15 RODO).</li>
            <li><strong>Sprostowania danych</strong> – poprawienia danych nieprawidłowych lub niekompletnych (art. 16 RODO).</li>
            <li><strong>Usunięcia danych („prawo do bycia zapomnianym")</strong> – w przypadkach określonych w art. 17 RODO (np. dane nie są już potrzebne, cofnięcie zgody).</li>
            <li><strong>Ograniczenia przetwarzania</strong> – żądania wstrzymania przetwarzania w określonych przypadkach (art. 18 RODO).</li>
            <li><strong>Przenoszenia danych</strong> – otrzymania danych w ustrukturyzowanym formacie (np. JSON, CSV) i przesłania ich do innego administratora (art. 20 RODO).</li>
            <li><strong>Sprzeciwu wobec przetwarzania</strong> – wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie (art. 21 RODO).</li>
            <li><strong>Cofnięcia zgody</strong> – w dowolnym momencie, bez wpływu na zgodność z prawem przetwarzania przed cofnięciem (art. 7 ust. 3 RODO).</li>
            <li><strong>Wniesienia skargi do organu nadzorczego</strong> – w Polsce: Prezes Urzędu Ochrony Danych Osobowych (<a href="https://uodo.gov.pl" target="_blank" rel="noopener noreferrer">uodo.gov.pl</a>).</li>
          </ol>
          <p>W celu realizacji powyższych praw należy skontaktować się z Administratorem pod adresem: <a href="mailto:privacy@okazje-plus.pl">privacy@okazje-plus.pl</a>.</p>
        </section>

        <section>
          <h2>§ 7. Bezpieczeństwo Danych</h2>
          <ol>
            <li>Administrator stosuje środki techniczne i organizacyjne zapewniające bezpieczeństwo danych, w tym:
              <ul>
                <li><strong>Szyfrowanie połączeń</strong> – SSL/TLS (HTTPS),</li>
                <li><strong>Haszowanie haseł</strong> – przechowywanie haseł w formie zaszyfrowanej (bcrypt, Argon2),</li>
                <li><strong>Firewall i monitoring</strong> – zabezpieczenia przed nieautoryzowanym dostępem,</li>
                <li><strong>Regularne kopie zapasowe</strong> – backup danych na wypadek awarii,</li>
                <li><strong>Ograniczenie dostępu</strong> – tylko upoważnieni pracownicy/współpracownicy mają dostęp do danych osobowych.</li>
              </ul>
            </li>
            <li>W przypadku naruszenia ochrony danych osobowych (data breach), Administrator:
              <ul>
                <li>Zgłosi incydent do organu nadzorczego w ciągu <strong>72 godzin</strong> (zgodnie z art. 33 RODO),</li>
                <li>Poinformuje Użytkowników, jeśli naruszenie stwarza wysokie ryzyko dla ich praw i wolności (art. 34 RODO).</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 8. Marketing i Newsletter</h2>
          <ol>
            <li>Administrator może wysyłać Użytkownikom komunikaty marketingowe (newsletter) wyłącznie za ich <strong>zgodą</strong> (opt-in).</li>
            <li>Newsletter może zawierać informacje o:
              <ul>
                <li>Nowych ofertach i promocjach,</li>
                <li>Aktualizacjach Serwisu,</li>
                <li>Akcjach specjalnych, konkursach.</li>
              </ul>
            </li>
            <li>Użytkownik może w każdej chwili <strong>wypisać się z newslettera</strong> poprzez:
              <ul>
                <li>Link „Wypisz się" w treści e-maila,</li>
                <li>Ustawienia konta w Serwisie,</li>
                <li>Kontakt z Administratorem: <a href="mailto:kontakt@okazje-plus.pl">kontakt@okazje-plus.pl</a>.</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2>§ 9. Profilowanie i Automatyczne Podejmowanie Decyzji</h2>
          <ol>
            <li>Serwis może wykorzystywać <strong>profilowanie</strong> w celu:
              <ul>
                <li>Personalizacji treści i ofert,</li>
                <li>Analizy preferencji Użytkowników (np. rekomendacje produktów),</li>
                <li>Optymalizacji kampanii marketingowych.</li>
              </ul>
            </li>
            <li>Profilowanie nie prowadzi do automatycznych decyzji wywołujących skutki prawne lub istotnie wpływających na Użytkownika (np. automatyczne odrzucenie konta).</li>
            <li>Użytkownik ma prawo do <strong>sprzeciwu wobec profilowania</strong> (art. 21 RODO).</li>
          </ol>
        </section>

        <section>
          <h2>§ 10. Linki do Stron Zewnętrznych</h2>
          <ol>
            <li>Serwis może zawierać linki do witryn zewnętrznych (np. sklepy partnerskie, media społecznościowe).</li>
            <li>Administrator nie ponosi odpowiedzialności za politykę prywatności stron trzecich. Użytkownik powinien samodzielnie zapoznać się z ich regulaminami i politykami prywatności.</li>
            <li>Przekierowanie do strony zewnętrznej może wiązać się z przekazaniem danych (np. ID sesji) – wyłącznie w zakresie niezbędnym do realizacji usługi (np. programy afiliacyjne).</li>
          </ol>
        </section>

        <section>
          <h2>§ 11. Zmiany Polityki Prywatności</h2>
          <ol>
            <li>Administrator zastrzega sobie prawo do zmiany Polityki Prywatności w przypadku:
              <ul>
                <li>Zmian w przepisach prawa,</li>
                <li>Wprowadzenia nowych funkcjonalności Serwisu,</li>
                <li>Aktualizacji praktyk bezpieczeństwa.</li>
              </ul>
            </li>
            <li>O zmianach Użytkownicy zostaną poinformowani poprzez:
              <ul>
                <li>Powiadomienie e-mail (dla użytkowników zarejestrowanych),</li>
                <li>Komunikat na stronie głównej Serwisu.</li>
              </ul>
            </li>
            <li>Zmiany wchodzą w życie w terminie <strong>14 dni</strong> od ich ogłoszenia.</li>
            <li>Dalsze korzystanie z Serwisu po wejściu w życie zmian oznacza akceptację nowej Polityki Prywatności.</li>
          </ol>
        </section>

        <section>
          <h2>§ 12. Kontakt</h2>
          <p>W sprawach związanych z ochroną danych osobowych prosimy o kontakt:</p>
          <ul>
            <li><strong>E-mail:</strong> <a href="mailto:privacy@okazje-plus.pl">privacy@okazje-plus.pl</a></li>
            <li><strong>Adres korespondencyjny:</strong> [Adres do korespondencji]</li>
          </ul>
          <p>Administrator odpowie na zgłoszenie w terminie <strong>30 dni</strong> (zgodnie z art. 12 RODO).</p>
        </section>

        <p className="text-sm text-muted-foreground mt-8">
          Data ostatniej aktualizacji: 8 listopada 2025
        </p>
      </article>
    </div>
  );
}
