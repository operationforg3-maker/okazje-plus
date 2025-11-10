import Link from 'next/link';
import { Gavel } from 'lucide-react';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata = {
  title: 'Regulamin - Okazje+',
  description: 'Regulamin świadczenia usług serwisu Okazje+',
};

export default function RegulaminPage() {
  return (
    <LegalPageLayout
      title="Regulamin Okazje+"
      description="Szczegółowe zasady korzystania z platformy Okazje+, w tym informacje o moderacji, afiliacji oraz prawach użytkowników."
      updatedAt="8 listopada 2025"
      autoGenerateSections
      heroIcon={<Gavel className="h-8 w-8" />}
    >
      <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-headline prose-h2:text-xl prose-h3:text-lg prose-ul:list-disc prose-ol:list-decimal">
        <p>
          Niniejszy dokument określa warunki świadczenia usług przez platformę Okazje+ oraz zasady
          publikowania i moderowania treści dodawanych przez społeczność.
        </p>

        <section id="definicje" className="scroll-mt-28">
          <h2>§ 1. Definicje</h2>
          <ol>
            <li><strong>Serwis</strong> – platforma internetowa „Okazje+" dostępna pod adresem [okazje-plus.web.app] oraz powiązanymi subdomenami, umożliwiająca użytkownikom dodawanie, ocenę i wyszukiwanie ofert produktów, publikację opinii oraz korzystanie z systemów grywalizacji.</li>
            <li><strong>Usługodawca</strong> – podmiot odpowiedzialny za działanie Serwisu.</li>
            <li><strong>Użytkownik</strong> – osoba korzystająca z Serwisu, w tym użytkownik niezarejestrowany (Gość) oraz użytkownik zarejestrowany (Członek).</li>
            <li><strong>Konto</strong> – indywidualne konto Użytkownika w Serwisie, utworzone poprzez rejestrację.</li>
            <li><strong>Treści UGC</strong> – treści generowane przez Użytkownika (ang. User Generated Content), w szczególności: opisy ofert, komentarze, oceny, zdjęcia, recenzje oraz linki partnerskie.</li>
            <li><strong>Operator</strong> – osoba fizyczna, prawna lub jednostka organizacyjna przetwarzająca dane osobowe w imieniu Usługodawcy zgodnie z RODO.</li>
            <li><strong>Moderacja</strong> – proces weryfikacji treści przesyłanych przez Użytkowników przed lub po ich publikacji, w celu zapewnienia zgodności z Regulaminem i obowiązującymi przepisami prawa, w tym zgodność z Aktem o Usługach Cyfrowych (DSA).</li>
          </ol>
        </section>

        <section id="postanowienia-ogolne" className="scroll-mt-28">
          <h2>§ 2. Postanowienia Ogólne i Warunki Techniczne</h2>
          <ol>
            <li>Niniejszy Regulamin określa zasady korzystania z Serwisu oraz prawa i obowiązki Użytkowników oraz Usługodawcy.</li>
            <li>Rozpoczęcie korzystania z Serwisu oznacza akceptację wszystkich postanowień Regulaminu.</li>
            <li>Usługi w Serwisie mogą być świadczone nieodpłatnie (podstawowy dostęp) lub odpłatnie (w przypadku planów premium lub innych rozszerzeń funkcjonalności – jeśli zostaną wprowadzone).</li>
            <li>Do korzystania z Serwisu niezbędne jest:
              <ul>
                <li>urządzenie z dostępem do Internetu,</li>
                <li>przeglądarka internetowa wspierająca JavaScript,</li>
                <li>aktywne połączenie internetowe,</li>
                <li>adres e-mail (w przypadku rejestracji).</li>
              </ul>
            </li>
            <li>Serwis wykorzystuje ciasteczka (cookies) w celu zapewnienia prawidłowego działania oraz analizy ruchu. Szczegóły znajdują się w Polityce Prywatności.</li>
          </ol>
        </section>

        <section id="model-biznesowy" className="scroll-mt-28">
          <h2>§ 3. Model Biznesowy, Afiliacja i Oznaczanie Treści (Zgodność z UOKiK)</h2>
          <ol>
            <li>Serwis prowadzi działalność w oparciu o <strong>model afiliacyjny</strong>. Publikowane oferty mogą zawierać linki partnerskie prowadzące do zewnętrznych sklepów internetowych.</li>
            <li>Usługodawca może otrzymywać prowizję od partnerów afiliacyjnych (tzw. Commission), gdy Użytkownik dokona zakupu poprzez link zamieszczony w Serwisie.</li>
            <li>Każda treść (oferta, rekomendacja, artykuł) zawierająca linki afiliacyjne jest <strong>oznaczona wyraźnym komunikatem</strong>, takim jak: „Link afiliacyjny", „Możemy otrzymać prowizję za zakup", lub podobnym, zgodnie z wymogami UOKiK i Dyrektywy UE w sprawie nieuczciwych praktyk handlowych.</li>
            <li>Oznaczenia są widoczne dla Użytkownika w sposób czytelny i niezaciemniający charakteru relacji afiliacyjnej.</li>
            <li>Użytkownicy mają świadomość, że rekomendacje produktów mogą być motywowane komercyjnie, jednak nie zmienia to prawa Użytkownika do korzystania z informacji i porównywania cen u różnych dostawców.</li>
          </ol>
        </section>

        <section id="ugc" className="scroll-mt-28">
          <h2>§ 4. Treści Generowane przez Użytkownika (UGC) i Licencja</h2>
          <ol>
            <li>Użytkownik, przesyłając treści (komentarze, zdjęcia, opisy produktów, linki, oceny itp.), oświadcza, że:
              <ul>
                <li>jest uprawniony do udostępniania tych treści,</li>
                <li>treści nie naruszają praw osób trzecich (w tym prawa autorskiego, wizerunku, dóbr osobistych),</li>
                <li>treści są zgodne z prawdą i prawem obowiązującym w Polsce i Unii Europejskiej.</li>
              </ul>
            </li>
            <li>Przesyłając treści do Serwisu, Użytkownik udziela Usługodawcy <strong>niewyłącznej, bezterminowej, nieodpłatnej, przenoszalnej licencji</strong> do:
              <ul>
                <li>publicznego wyświetlania, powielania, modyfikacji, tłumaczenia, publikowania i dystrybucji treści w ramach działania Serwisu,</li>
                <li>udzielania sublicencji podmiotom współpracującym (np. dostawcy hostingu, partnerom API),</li>
                <li>wykorzystywania treści w celach marketingowych (np. case studies, reklamy, materiały promocyjne).</li>
              </ul>
            </li>
            <li>Użytkownik zachowuje autorskie prawa majątkowe do swoich treści, jednak zgadza się na ich publiczną eksploatację w ramach Serwisu.</li>
            <li>Usługodawca nie jest zobowiązany do monitorowania wszystkich treści przed publikacją (model notice-and-takedown), jednak stosuje <strong>moderację ex ante</strong> (przed publikacją) w przypadku zgłoszeń naruszeń lub ryzyka publikacji treści nielegalnych.</li>
          </ol>
        </section>

        <section id="grywalizacja" className="scroll-mt-28">
          <h2>§ 5. Grywalizacja i Systemy Ocen</h2>
          <ol>
            <li>Serwis wykorzystuje mechanizmy grywalizacyjne, w tym:
              <ul>
                <li><strong>System „temperatury" (Heat Index)</strong> – oferty mogą być oceniane przez Użytkowników poprzez przyznawanie „ciepła" (głosy pozytywne) lub „zimna" (głosy negatywne). Algorytm wyznacza „temperaturę" oferty na podstawie aktywności Użytkowników.</li>
                <li><strong>Odznaki, punkty i rankingi</strong> – Użytkownicy mogą zdobywać punkty, odznaki lub poziomy za aktywną partycypację w Serwisie (dodawanie ofert, komentarze, oceny).</li>
              </ul>
            </li>
            <li>Algorytmy rankingowe mogą uwzględniać czynniki takie jak:
              <ul>
                <li>liczba i jakość interakcji,</li>
                <li>czas publikacji,</li>
                <li>reputacja Użytkownika,</li>
                <li>moderacja treści (usunięcie treści nielegalnych obniża ranking).</li>
              </ul>
            </li>
            <li>Użytkownik nie ma roszczenia o konkretną pozycję w rankingu. Usługodawca zastrzega sobie prawo do modyfikacji algorytmów rankingowych w celu poprawy jakości treści i doświadczeń Użytkowników.</li>
          </ol>
        </section>

        <section id="moderacja" className="scroll-mt-28">
          <h2>§ 6. Moderacja Treści i Akt o Usługach Cyfrowych (DSA)</h2>
          <ol>
            <li>Serwis podlega przepisom <strong>Aktu o Usługach Cyfrowych (Digital Services Act, DSA)</strong>, który nakłada obowiązki związane z moderacją treści i transparentnością decyzji moderacyjnych.</li>
            <li>Usługodawca zobowiązuje się do:
              <ul>
                <li>usuwania treści nielegalnych (np. naruszających prawa autorskie, szkalujących, zawierających mowę nienawiści),</li>
                <li>informowania Użytkownika o przyczynach usunięcia lub ograniczenia dostępu do treści,</li>
                <li>umożliwienia składania skarg na decyzje moderacyjne (zgodnie z § 9).</li>
              </ul>
            </li>
            <li>Użytkownik, którego treść została usunięta lub ograniczona, otrzymuje <strong>powiadomienie e-mail</strong> zawierające:
              <ul>
                <li>przyczynę usunięcia,</li>
                <li>podstawę prawną (jeśli dotyczy),</li>
                <li>możliwość odwołania się od decyzji.</li>
              </ul>
            </li>
            <li>W przypadku poważnych lub wielokrotnych naruszeń, Konto Użytkownika może zostać zawieszone lub usunięte.</li>
          </ol>
        </section>

        <section id="punkty-kontaktowe" className="scroll-mt-28">
          <h2>§ 7. Punkty Kontaktowe (Wymóg DSA)</h2>
          <ol>
            <li>Zgodnie z DSA, Serwis udostępnia:
              <ul>
                <li><strong>Punkt kontaktowy dla użytkowników</strong> – adres e-mail: <a href="mailto:kontakt@okazje-plus.pl">kontakt@okazje-plus.pl</a></li>
                <li><strong>Punkt kontaktowy dla organów państwowych</strong> – adres e-mail: <a href="mailto:legal@okazje-plus.pl">legal@okazje-plus.pl</a></li>
              </ul>
            </li>
            <li>Zgłoszenia dotyczące treści nielegalnych można składać również poprzez <strong>formularz w Serwisie</strong> (jeśli dostępny) lub bezpośrednio na powyższe adresy e-mail.</li>
            <li>Odpowiedź na zgłoszenia jest udzielana w terminie <strong>7 dni roboczych</strong> (dla zgłoszeń priorytetowych – 24 godziny).</li>
          </ol>
        </section>

        <section id="odpowiedzialnosc" className="scroll-mt-28">
          <h2>§ 8. Odpowiedzialność Usługodawcy (Safe Harbor)</h2>
          <ol>
            <li>Usługodawca nie ponosi odpowiedzialności za:
              <ul>
                <li>treści publikowane przez Użytkowników (model Safe Harbor zgodnie z art. 14 Dyrektywy o handlu elektronicznym oraz DSA),</li>
                <li>nieaktualne oferty, błędy w cenach lub braki w dostępności produktów w sklepach partnerskich,</li>
                <li>działania lub zaniechania partnerów afiliacyjnych (np. brak realizacji zamówienia przez sklep),</li>
                <li>utratę danych wynikającą z działania siły wyższej, awarii technicznych lub ataków hakerskich.</li>
              </ul>
            </li>
            <li>Usługodawca nie gwarantuje ciągłości działania Serwisu i może przeprowadzać przerwy techniczne (maintenance) po uprzednim poinformowaniu Użytkowników (o ile to możliwe).</li>
            <li>Użytkownik korzysta z Serwisu na własną odpowiedzialność. Wszelkie decyzje zakupowe podejmowane na podstawie informacji z Serwisu są wyłączną odpowiedzialnością Użytkownika.</li>
          </ol>
        </section>

        <section id="reklamacje" className="scroll-mt-28">
          <h2>§ 9. Postępowanie Reklamacyjne i Prawo do Odwołania</h2>
          <ol>
            <li>Użytkownik może składać reklamacje dotyczące:
              <ul>
                <li>działania Serwisu,</li>
                <li>decyzji moderacyjnych (usunięcie treści, zawieszenie konta),</li>
                <li>naruszeń Regulaminu przez innych Użytkowników.</li>
              </ul>
            </li>
            <li>Reklamacje należy kierować na adres: <a href="mailto:kontakt@okazje-plus.pl">kontakt@okazje-plus.pl</a> z dopiskiem „Reklamacja".</li>
            <li>Reklamacja powinna zawierać:
              <ul>
                <li>dane Użytkownika (adres e-mail, ID konta),</li>
                <li>opis problemu,</li>
                <li>ewentualne dowody (screenshoty, linki).</li>
              </ul>
            </li>
            <li>Usługodawca udziela odpowiedzi w terminie <strong>14 dni</strong> od otrzymania reklamacji.</li>
            <li>W przypadku odmowy uwzględnienia reklamacji, Użytkownik ma prawo do skorzystania z <strong>pozasądowego rozwiązywania sporów</strong> (np. mediacja, arbiter konsumencki).</li>
          </ol>
        </section>

        <section id="rodo" className="scroll-mt-28">
          <h2>§ 10. Ochrona Danych Osobowych (RODO)</h2>
          <ol>
            <li>Szczegółowe zasady przetwarzania danych osobowych określa <Link href="/polityka-prywatnosci" className="text-primary hover:underline">Polityka Prywatności</Link>.</li>
            <li>Użytkownik ma prawo do:
              <ul>
                <li>dostępu do swoich danych,</li>
                <li>sprostowania danych,</li>
                <li>usunięcia danych („prawo do bycia zapomnianym"),</li>
                <li>ograniczenia przetwarzania,</li>
                <li>przenoszenia danych,</li>
                <li>wniesienia sprzeciwu wobec przetwarzania,</li>
                <li>cofnięcia zgody (jeśli przetwarzanie opiera się na zgodzie).</li>
              </ul>
            </li>
            <li>W celu realizacji powyższych praw należy skontaktować się z Administratorem Danych pod adresem: <a href="mailto:privacy@okazje-plus.pl">privacy@okazje-plus.pl</a>.</li>
          </ol>
        </section>

        <section id="zmiany-regulaminu" className="scroll-mt-28">
          <h2>§ 11. Zmiany Regulaminu</h2>
          <ol>
            <li>Usługodawca zastrzega sobie prawo do zmiany niniejszego Regulaminu w przypadku:
              <ul>
                <li>zmian w przepisach prawa,</li>
                <li>wprowadzenia nowych funkcjonalności Serwisu,</li>
                <li>usprawnienia bezpieczeństwa i jakości usług.</li>
              </ul>
            </li>
            <li>O zmianach Użytkownicy zostaną poinformowani poprzez:
              <ul>
                <li>powiadomienie e-mail (dla użytkowników zarejestrowanych),</li>
                <li>komunikat na stronie głównej Serwisu.</li>
              </ul>
            </li>
            <li>Zmiany wchodzą w życie w terminie <strong>14 dni</strong> od ich ogłoszenia.</li>
            <li>Dalsze korzystanie z Serwisu po wejściu w życie zmian oznacza akceptację nowego Regulaminu. W przypadku braku akceptacji, Użytkownik powinien zaprzestać korzystania z Serwisu i może zażądać usunięcia konta.</li>
          </ol>
        </section>

        <section id="postanowienia-koncowe" className="scroll-mt-28">
          <h2>§ 12. Postanowienia Końcowe</h2>
          <ol>
            <li>Regulamin wchodzi w życie z dniem publikacji w Serwisie.</li>
            <li>W sprawach nieuregulowanych niniejszym Regulaminem stosuje się przepisy prawa polskiego, w szczególności:
              <ul>
                <li>Ustawę o świadczeniu usług drogą elektroniczną,</li>
                <li>Kodeks Cywilny,</li>
                <li>RODO (Rozporządzenie UE 2016/679),</li>
                <li>Akt o Usługach Cyfrowych (DSA – Rozporządzenie UE 2022/2065).</li>
              </ul>
            </li>
            <li>Wszelkie spory wynikające z korzystania z Serwisu będą rozstrzygane przez sądy powszechne właściwe dla siedziby Usługodawcy, chyba że przepisy bezwzględnie obowiązujące stanowią inaczej (np. w sprawach konsumenckich).</li>
          </ol>
        </section>

      </article>
    </LegalPageLayout>
  );
}
