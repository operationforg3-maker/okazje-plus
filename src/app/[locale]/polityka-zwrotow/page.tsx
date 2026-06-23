import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isPl = locale === 'pl';
  return {
    title: isPl ? 'Polityka zwrotów i reklamacji - Okazje+' : 'Return and Refund Policy - Okazje+',
    description: isPl 
      ? 'Zasady zwrotów, odstąpienia od umowy oraz reklamacji w serwisie Okazje+' 
      : 'Return, refund, and complaint rules for Okazje+',
    alternates: {
      canonical: `https://okazjeplus.pl/${locale}/polityka-zwrotow`,
      languages: {
        pl: 'https://okazjeplus.pl/pl/polityka-zwrotow',
        en: 'https://okazjeplus.pl/en/polityka-zwrotow',
        de: 'https://okazjeplus.pl/de/polityka-zwrotow',
        fr: 'https://okazjeplus.pl/fr/polityka-zwrotow',
        es: 'https://okazjeplus.pl/es/polityka-zwrotow',
        uk: 'https://okazjeplus.pl/uk/polityka-zwrotow',
        'x-default': 'https://okazjeplus.pl/pl/polityka-zwrotow',
      },
    },
  };
}

export default async function PolitykaZwrotowPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isPl = locale === 'pl';

  if (isPl) {
    return (
      <LegalPageLayout
        title="Polityka Zwrotów i Reklamacji"
        description="Zasady odstąpienia od umowy, zwrotów towarów oraz zgłaszania reklamacji dla zakupów dokonanych przez platformę Okazje+."
        updatedAt="23 czerwca 2026"
        autoGenerateSections
        heroIcon={<RefreshCw className="h-8 w-8" />}
      >
        <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-headline prose-h2:text-xl prose-h3:text-lg prose-ul:list-disc prose-ol:list-decimal">
          <p>
            Niniejsza Polityka Zwrotów i Reklamacji określa zasady i procedury związane z odstąpieniem od umowy,
            zwrotami towarów oraz zgłaszaniem reklamacji w ramach transakcji zawieranych za pośrednictwem serwisu Okazje+.
          </p>

          <section id="prawo-odstapienia" className="scroll-mt-28">
            <h2>§ 1. Prawo do Odstąpienia od Umowy (Zwrot Towaru)</h2>
            <ol>
              <li>Każdy konsument korzystający z serwisu Okazje+ ma prawo odstąpić od umowy zakupu w terminie <strong>14 dni</strong> bez podawania jakiejkolwiek przyczyny.</li>
              <li>Bieg terminu do odstąpienia od umowy rozpoczyna się od dnia, w którym konsument lub wskazana przez niego osoba trzecia (inna niż przewoźnik) weszła w posiadanie zakupionego produktu.</li>
              <li>Aby skorzystać z prawa do odstąpienia od umowy, należy poinformować sprzedawcę o swojej decyzji w drodze jednoznacznego oświadczenia (np. pismo wysłane pocztą tradycyjną lub pocztą elektroniczną).</li>
              <li>Do zachowania terminu wystarczy wysłanie oświadczenia o odstąpieniu przed jego upływem.</li>
            </ol>
          </section>

          <section id="skutki-odstapienia" className="scroll-mt-28">
            <h2>§ 2. Skutki Odstąpienia od Umowy i Zwrot Środków</h2>
            <ol>
              <li>W przypadku odstąpienia od umowy, sprzedawca zwraca użytkownikowi wszystkie otrzymane płatności, w tym koszty dostarczenia rzeczy (z wyjątkiem dodatkowych kosztów wynikających z wybranego przez użytkownika sposobu dostawy innego niż najtańszy zwykły sposób dostawy oferowany przez sprzedawcę), niezwłocznie, a w każdym przypadku nie później niż <strong>14 dni</strong> od dnia poinformowania o decyzji o wykonaniu prawa odstąpienia.</li>
              <li>Zwrot płatności dokonywany jest przy użyciu takich samych sposobów płatności, jakie zostały użyte w pierwotnej transakcji, chyba że konsument wyraźnie zgodził się na inne rozwiązanie.</li>
              <li>Sprzedawca może wstrzymać się ze zwrotem płatności do czasu otrzymania rzeczy z powrotem lub do czasu dostarczenia dowodu jej odesłania, w zależności od tego, które zdarzenie nastąpi wcześniej.</li>
              <li>Konsument ponosi bezpośrednie koszty zwrotu rzeczy (odesłania towaru do sprzedawcy).</li>
            </ol>
          </section>

          <section id="procedura-zwrotu" className="scroll-mt-28">
            <h2>§ 3. Procedura Zwrotu Towaru</h2>
            <ol>
              <li>Zwracany towar należy odesłać na adres podany przez sprzedawcę danej oferty niezwłocznie, a w każdym razie nie później niż <strong>14 dni</strong> od dnia poinformowania o odstąpieniu od umowy.</li>
              <li>Użytkownik odpowiada tylko za zmniejszenie wartości rzeczy wynikające z korzystania z niej w sposób inny niż było to konieczne do stwierdzenia charakteru, cech i funkcjonowania rzeczy.</li>
              <li>Zaleca się przesyłanie towaru w oryginalnym, nieuszkodzonym opakowaniu wraz ze wszystkimi akcesoriami i dowodem zakupu.</li>
            </ol>
          </section>

          <section id="wyjatki-od-zwrotu" className="scroll-mt-28">
            <h2>§ 4. Wyłączenia z Prawa do Odstąpienia od Umowy</h2>
            <p>Prawo do odstąpienia od umowy nie przysługuje w odniesieniu do umów m.in.:</p>
            <ul>
              <li>o świadczenie usług, jeżeli sprzedawca wykonał w pełni usługę za wyraźną zgodą konsumenta;</li>
              <li>w której przedmiotem świadczenia jest rzecz nieprefabrykowana, wyprodukowana według specyfikacji konsumenta lub służąca zaspokojeniu jego zindywidualizowanych potrzeb;</li>
              <li>w której przedmiotem świadczenia jest rzecz ulegająca szybkiemu zepsuciu lub mająca krótki termin przydatności do użycia;</li>
              <li>w której przedmiotem świadczenia jest rzecz dostarczana w zapieczętowanym opakowaniu, której po otwarciu opakowania nie można zwrócić ze względu na ochronę zdrowia lub ze względów higienicznych;</li>
              <li>o dostarczanie treści cyfrowych, które nie są zapisane na nośniku materialnym, jeżeli spełnianie świadczenia rozpoczęło się za wyraźną zgodą konsumenta.</li>
            </ul>
          </section>

          <section id="reklamacje" className="scroll-mt-28">
            <h2>§ 5. Reklamacje i Rękojmia</h2>
            <ol>
              <li>Sprzedawca jest zobowiązany dostarczyć towar wolny od wad. W przypadku stwierdzenia wady zakupionego towaru, konsumentowi przysługuje prawo do złożenia reklamacji na podstawie rękojmi lub gwarancji (jeśli została udzielona).</li>
              <li>Zgłoszenie reklamacyjne powinno zawierać opis wady, datę jej stwierdzenia oraz żądanie klienta (np. naprawa, wymiana, obniżenie ceny lub odstąpienie od umowy).</li>
              <li>Reklamację należy przesłać pocztą elektroniczną lub tradycyjną na adres sprzedawcy danej oferty.</li>
              <li>Sprzedawca ustosunkuje się do reklamacji w terminie <strong>14 dni</strong> od dnia jej otrzymania.</li>
            </ol>
          </section>

          <section id="kontakt" className="scroll-mt-28">
            <h2>§ 6. Kontakt w sprawach zwrotów</h2>
            <p>W razie pytań lub wątpliwości dotyczących procesu zwrotu i reklamacji prosimy o kontakt:</p>
            <ul>
              <li><strong>E-mail:</strong> <a href="mailto:support@okazje-plus.pl">support@okazje-plus.pl</a></li>
              <li><strong>Adres korespondencyjny:</strong> Okazje+ Zwroty, [Adres do korespondencji]</li>
            </ul>
          </section>
        </article>
      </LegalPageLayout>
    );
  }

  // English fallback for all other locales
  return (
    <LegalPageLayout
      title="Return and Refund Policy"
      description="Rules for withdrawing from the contract, returning goods, and filing complaints for purchases made via the Okazje+ platform."
      updatedAt="June 23, 2026"
      autoGenerateSections
      heroIcon={<RefreshCw className="h-8 w-8" />}
      backLabel="Back to homepage"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Return Policy" }]}
    >
      <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-headline prose-h2:text-xl prose-h3:text-lg prose-ul:list-disc prose-ol:list-decimal">
        <p>
          This Return and Refund Policy sets out the rules and procedures for withdrawing from a contract,
          returning goods, and submitting complaints regarding transactions concluded through the Okazje+ platform.
        </p>

        <section id="right-of-withdrawal" className="scroll-mt-28">
          <h2>§ 1. Right of Withdrawal (Product Return)</h2>
          <ol>
            <li>Every consumer using the Okazje+ service has the right to withdraw from a purchase agreement within <strong>14 days</strong> without giving any reason.</li>
            <li>The withdrawal period expires after 14 days from the day on which the consumer or a third party indicated by the consumer (other than the carrier) acquires physical possession of the product.</li>
            <li>To exercise the right of withdrawal, you must inform the seller of your decision by an unequivocal statement (e.g., a letter sent by post or email).</li>
            <li>To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired.</li>
          </ol>
        </section>

        <section id="effects-of-withdrawal" className="scroll-mt-28">
          <h2>§ 2. Effects of Withdrawal and Refunds</h2>
          <ol>
            <li>If you withdraw from this contract, the seller shall reimburse to you all payments received, including the costs of delivery (with the exception of the supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by the seller), without undue delay and in any event not later than <strong>14 days</strong> from the day on which the seller is informed about your decision to withdraw.</li>
            <li>The reimbursement will be carried out using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise.</li>
            <li>The seller may withhold reimbursement until they have received the goods back or you have supplied evidence of having sent back the goods, whichever is the earliest.</li>
            <li>You will have to bear the direct cost of returning the goods.</li>
          </ol>
        </section>

        <section id="return-procedure" className="scroll-mt-28">
          <h2>§ 3. Return Procedure</h2>
          <ol>
            <li>You shall send back the goods to the address provided by the seller without undue delay and in any event not later than <strong>14 days</strong> from the day on which you communicate your withdrawal from the contract.</li>
            <li>You are only liable for any diminished value of the goods resulting from the handling other than what is necessary to establish the nature, characteristics, and functioning of the goods.</li>
            <li>It is recommended to return the product in its original, undamaged packaging with all accessories and proof of purchase.</li>
          </ol>
        </section>

        <section id="exceptions" className="scroll-mt-28">
          <h2>§ 4. Exceptions to the Right of Withdrawal</h2>
          <p>The right of withdrawal does not apply to contracts for:</p>
          <ul>
            <li>the provision of services if the seller has fully performed the service with the consumer's explicit consent;</li>
            <li>the supply of goods made to the consumer's specifications or clearly personalized;</li>
            <li>the supply of goods which are liable to deteriorate or expire rapidly;</li>
            <li>the supply of sealed goods which are not suitable for return due to health protection or hygiene reasons and were unsealed after delivery;</li>
            <li>the supply of digital content which is not supplied on a tangible medium if the performance has begun with the consumer's prior express consent.</li>
          </ul>
        </section>

        <section id="complaints" className="scroll-mt-28">
          <h2>§ 5. Complaints and Warranty</h2>
          <ol>
            <li>The seller is obliged to deliver goods free from defects. In the event of a defect, the consumer has the right to file a complaint under the statutory warranty or commercial guarantee (if provided).</li>
            <li>The complaint notification should contain a description of the defect, the date of its discovery, and the customer's request (e.g. repair, replacement, price reduction, or withdrawal from the contract).</li>
            <li>Complaints should be sent by email or traditional post to the seller's address.</li>
            <li>The seller will respond to the complaint within <strong>14 days</strong> of receiving it.</li>
          </ol>
        </section>

        <section id="contact" className="scroll-mt-28">
          <h2>§ 6. Contact Information</h2>
          <p>If you have any questions regarding returns and refunds, please contact us:</p>
          <ul>
            <li><strong>Email:</strong> <a href="mailto:support@okazje-plus.pl">support@okazje-plus.pl</a></li>
            <li><strong>Mailing address:</strong> Okazje+ Returns, [Mailing address]</li>
          </ul>
        </section>
      </article>
    </LegalPageLayout>
  );
}
