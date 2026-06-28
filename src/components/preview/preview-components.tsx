import { ArrowRight, Bolt, Compass, Heart, LayoutGrid, Sparkles, Star, Target } from 'lucide-react';

interface PreviewSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function PreviewSection({ title, description, children }: PreviewSectionProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-muted/40 bg-card/70 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" />
          <span>Eksperymentalny prototyp</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function PreviewCard({ title, subtitle, details, accent }: { title: string; subtitle: string; details: string; accent: string; }) {
  return (
    <div className="rounded-3xl border border-muted/20 bg-background p-6 shadow-sm shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-md hover:shadow-slate-900/10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary/80">{accent}</p>
          <h3 className="mt-3 text-xl font-semibold text-foreground">{title}</h3>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Star className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      <div className="mt-6 rounded-3xl bg-secondary/5 px-4 py-3 text-sm text-foreground/80">{details}</div>
    </div>
  );
}

function SampleBadge({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

const previewTitles = [
  'AI Concierge: szybkie decyzje',
  'Editorial Magazine: oferta premium',
  'Speedboard: natychmiastowe wyszukiwanie',
  'Conversational Funnel: dialog zakupowy',
];

const previewSummaries = [
  'Układ inspirowany asystentem zakupowym, skupiony na personalizacji i natychmiastowej rekomendacji ofert.',
  'Wersja editorial z mocnym storytellingiem, głównymi akcjami i selekcją tematów produktowych.',
  'Nowoczesny interfejs „dashboard” z szybkim filtrowaniem, kluczowymi wskaźnikami i kartami natychmiastowego działania.',
  'Ścieżka prowadzona dialogiem, która pokazuje produkt przez pytania, szybkie filtry i mikrowyboru.',
];

export function PreviewListIndex() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-muted/20 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl shadow-slate-900/20 text-white">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-300/90">Ukryty podgląd interfejsu</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Cztery nowe propozycje UX dla Okazje+</h1>
            <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">Każdy wariant pokazuje własny styl landing page, listingu ofert oraz karty produktu. Strony są dostępne tylko przez bezpośredni adres URL i nie są widoczne w głównej nawigacji.</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((index) => (
            <a
              key={index}
              href={`/pl/preview/design-${index}`}
              className="group rounded-[2rem] border border-muted/20 bg-white/90 p-6 shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Wariant {index}</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900">{previewTitles[index - 1]}</h2>
                </div>
                <ArrowRight className="h-5 w-5 text-primary transition group-hover:translate-x-1" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{previewSummaries[index - 1]}</p>
            </a>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-muted/20 bg-card/70 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Jak używać tych podglądów</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Strony zostały przygotowane jako bezpośrednio dostępne prototypy. Użyj adresów aby ocenić kierunek, porównać układy i wybrać najlepszą ścieżkę do produkcji.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-950/90 p-5 text-slate-100">
                <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Adresy</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <li>/pl/preview/design-1</li>
                  <li>/pl/preview/design-2</li>
                  <li>/pl/preview/design-3</li>
                  <li>/pl/preview/design-4</li>
                </ul>
              </div>
              <div className="rounded-3xl bg-slate-950/90 p-5 text-slate-100">
                <p className="text-sm uppercase tracking-[0.24em] text-sky-300">Zalecenie</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">Warianty są ukryte i nie są linkowane. Jeśli wybierzemy jeden z nich, można go przenieść do głównych tras z feature flagą lub stopniowo zastępować istniejący UX.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function DesignOnePreview() {
  return (
    <div className="space-y-12">
      <header className="rounded-[2rem] bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-10 text-white shadow-2xl shadow-slate-950/20">
        <div className="max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-sky-300/90">Wariant 1</p>
              <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">AI Concierge dla Twoich zakupów</h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">Inteligentny landing, który przypomina asystenta zakupowego. Użytkownik zaczyna od celu, a system doprowadza go do najlepszych okazji.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-100 shadow-xl shadow-slate-950/20">
              <p className="text-sm uppercase tracking-[0.3em] text-sky-200/80">Najlepsza oferta</p>
              <p className="mt-3 text-4xl font-semibold">Smartwatch Ultra X</p>
              <p className="mt-2 text-sm text-slate-300">Oszczędź 32% na wersji z GPS i bezpłatną wysyłką.</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-200">
                <span className="rounded-full bg-slate-800/80 px-3 py-1">Bestseller</span>
                <span className="rounded-full bg-slate-800/80 px-3 py-1">4.8/5 ⭐</span>
                <span className="rounded-full bg-slate-800/80 px-3 py-1">Dostawa 24h</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <PreviewSection
        title="Szybki start od potrzeb"
        description="Użytkownik rozpoczyna od krótkiego wyboru celu lub zeskanowania kategorii. Formularz działa jak concierge, prowadząc do odpowiednich ofert i rekomendacji."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-md shadow-slate-900/5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Krok 1</p>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Wybierz cel</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Kupuję prezent, potrzebuję elektronikę, szukam rzeczy do domu.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-md shadow-slate-900/5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Krok 2</p>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Opcje dopasowania</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Wybierz budżet, preferencje kolorystyczne, cechy i czas dostawy.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-md shadow-slate-900/5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Krok 3</p>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Gotowa lista</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Otrzymaj spersonalizowane oferty z priorytetem szybkości i wartości.</p>
          </div>
        </div>
      </PreviewSection>

      <PreviewSection
        title="Przegląd ofert"
        description="Karta ofertowa z kluczowymi punktami: cena, ocena, czas dostawy i wartość oszczędności. Elementy są czytelne, aby ułatwić szybki wybór."
      >
        <div className="grid gap-6 xl:grid-cols-3">
          <PreviewCard accent="Top Pick" title="Słuchawki bezprzewodowe NeoBeat" subtitle="Najlepszy stosunek jakości do ceny dla aktywnych użytkowników." details="Cena: 349 zł · Dostawa 12h · Ocena: 4.7 · Rabat: 28%" />
          <PreviewCard accent="Premium" title="Laptop Creator 16" subtitle="Idealny do pracy kreatywnej i rozrywki z długim czasem pracy na baterii." details="Cena: 4 799 zł · Dostawa 24h · Ocena: 4.9 · Oszczędność 650 zł" />
          <PreviewCard accent="Szybka dostawa" title="AirFryer Smart 5L" subtitle="Kompaktowy piekarnik do zdrowych posiłków z cyfrowym panelem." details="Cena: 219 zł · Dostawa 48h · Ocena: 4.5 · Bestseller" />
        </div>
      </PreviewSection>

      <PreviewSection
        title="Karta produktu"
        description="Karta pojedynczego produktu z mocnym nagłówkiem, szybkim podsumowaniem i CTA. Nadaje się do mobilnych i desktopowych stron produktowych."
      >
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20">
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-3xl bg-slate-800/70 p-4">
                <LayoutGrid className="h-6 w-6 text-sky-300" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.26em] text-sky-300/80">Premium</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight">Asystent Smartwatch Pro</h3>
              </div>
            </div>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300">Gotowy do działania produkt z pełną specyfikacją, rekomendacjami dodatków i krótkim uzasadnieniem, dlaczego warto go wybrać.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-900/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Czas pracy</p>
                <p className="mt-2 text-xl font-semibold">72h</p>
              </div>
              <div className="rounded-3xl bg-slate-900/80 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Waga</p>
                <p className="mt-2 text-xl font-semibold">45 g</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <SampleBadge icon={Heart} label="Ulubione" />
              <SampleBadge icon={Bolt} label="Błyskawicznie" />
              <SampleBadge icon={Target} label="Top wybór" />
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-8 shadow-lg shadow-slate-900/5">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Szybki przegląd</p>
            <div className="mt-6 space-y-4 text-sm leading-6 text-slate-600">
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                <span>Ocena jakości</span>
                <span className="font-semibold text-slate-900">4.8/5</span>
              </div>
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                <span>Oszczędność</span>
                <span className="font-semibold text-slate-900">32%</span>
              </div>
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                <span>Dostępność</span>
                <span className="font-semibold text-slate-900">12 szt.</span>
              </div>
              <div className="rounded-3xl bg-slate-900/95 p-4 text-white">
                <p className="text-sm uppercase tracking-[0.26em] text-sky-200/80">Call to Action</p>
                <p className="mt-3 text-xl font-semibold">Kup teraz za 799 zł</p>
              </div>
            </div>
          </div>
        </div>
      </PreviewSection>
    </div>
  );
}

export function DesignTwoPreview() {
  return (
    <div className="space-y-12">
      <header className="rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.13),transparent_32%),#ffffff] p-10 shadow-lg shadow-slate-900/5">
        <div className="max-w-5xl">
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Wariant 2</p>
            <h1 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">Editorial Magazine dla okazji</h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-600">Tłumacz oferty na opowieści: inspiracje, najlepsze wybory tygodnia oraz osobiste rekomendacje redakcyjne.</p>
          </div>
        </div>
      </header>

      <PreviewSection
        title="Storytelling zamiast listy"
        description="Landing page zaczyna się od tematycznych kolekcji, modułów „poleca redakcja” i szybkich przewodników zakupowych."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center gap-3 text-slate-900">
              <Heart className="h-5 w-5 text-pink-500" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Edytorial</p>
                <h3 className="mt-3 text-xl font-semibold">Top 10 prezentów dla niej</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Karty tematyczne z krótkim wprowadzeniem, ofertami i faktycznym kontekstem produktowym.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center gap-3 text-slate-900">
              <Compass className="h-5 w-5 text-sky-500" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Kolekcja</p>
                <h3 className="mt-3 text-xl font-semibold">Back-to-work gadgets</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Przewodnik zakupowy, który pokazuje oferty w stylu magazynu z rekomendacjami i krótkimi opiniami.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center gap-3 text-slate-900">
              <Bolt className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Ekspert</p>
                <h3 className="mt-3 text-xl font-semibold">Hit tygodnia</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Moduł z silnym nagłówkiem, krótką syntezą i ofertą, którą poleca redakcja.</p>
          </div>
        </div>
      </PreviewSection>

      <PreviewSection
        title="Nowy deals page"
        description="Duże grafiki ofertowe, sekcje tematyczne i wyróżnione przepisy. Takie doświadczenie daje wrażenie wartościowego magazynu zamiast zwykłego katalogu."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-3xl bg-white p-3 shadow-sm shadow-slate-900/5">
                <Target className="h-6 w-6 text-slate-700" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Featured</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">Wyprzedaże dnia</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Segmenty oparte na potrzebach: dom, elektronika, sport i prezenty.</p>
            <div className="mt-6 grid gap-4">
              <PreviewCard accent="Must Read" title="Zestaw domowy do 499 zł" subtitle="Najbardziej opłacalne propozycje dla nowoczesnego mieszkania." details="15 ofert · najlepsza cena · bezpłatny zwrot" />
              <PreviewCard accent="Poradnik" title="Smartfony z najwyższą baterią" subtitle="Ranking z użytecznymi notatkami redakcji na temat wydajności." details="10 ofert · oszczędność 20-40% · szybka dostawa" />
            </div>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <h3 className="text-xl font-semibold text-slate-950">Sekcja produktu</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Card z opisem, oceną eksperta i przyciskami szybkiego nawigowania pomiędzy ofertami.</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Trend</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">Słuchawki studyjne 2026</p>
                  </div>
                  <span className="rounded-full bg-slate-900/95 px-3 py-1 text-sm font-semibold text-white">4.9</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">Redakcja poleca jako najlepszy wybór do pracy zdalnej i podcastów.</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Editor’s pick</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">Elegancki ekspres do kawy</p>
                  </div>
                  <span className="rounded-full bg-slate-900/95 px-3 py-1 text-sm font-semibold text-white">+15%</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">Idealny wybór dla tych, którzy chcą desktopowego doświadczenia zakupowego z charakterem.</p>
              </div>
            </div>
          </div>
        </div>
      </PreviewSection>
    </div>
  );
}

export function DesignThreePreview() {
  return (
    <div className="space-y-12">
      <header className="rounded-[2rem] bg-slate-950 p-10 text-white shadow-2xl shadow-slate-950/20">
        <div className="max-w-5xl">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300/90">Wariant 3</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">Speedboard: natychmiastowe wyniki</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">Przegląd ofert jak kokpit: filtry, highlights, szybkie akcje i metryki, które przyspieszają decyzję zakupową.</p>
        </div>
      </header>

      <PreviewSection
        title="Kokpit danych zakupowych"
        description="Zestawienie ofert jako dashboard ze wskaźnikami i szybkim filtrem. Użytkownik widzi najważniejsze liczby w jednym widoku."
      >
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] bg-slate-900 p-6 text-white shadow-xl shadow-slate-950/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-sky-300/80">Szybki przegląd</p>
                <h3 className="mt-3 text-3xl font-semibold">Twoje top okazje</h3>
              </div>
              <div className="rounded-3xl bg-slate-800/80 p-4">
                <Bolt className="h-6 w-6 text-amber-300" />
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {['Nowe', 'Top oszczędność', 'Szybka dostawa'].map((item) => (
                <div key={item} className="rounded-3xl bg-slate-800/90 p-5">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{item}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{item === 'Top oszczędność' ? '42%' : item === 'Szybka dostawa' ? '12h' : '28 ofert'}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-[2rem] bg-slate-800/90 p-6 text-slate-300">
              <p className="text-sm uppercase tracking-[0.24em] text-sky-200/80">Wykres trendów</p>
              <div className="mt-5 h-48 rounded-3xl bg-slate-950/80" />
            </div>
          </div>
          <div className="space-y-4">
            {['Aktywne filtry', 'Preferowane marki', 'Bestsellery'].map((title, index) => (
              <div key={title} className="rounded-[2rem] bg-white p-6 shadow-md shadow-slate-900/5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{title}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {['Elektronika', 'Dom', 'Sport', 'Moda', 'Zdrowie'].slice(0, index + 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PreviewSection>

      <PreviewSection
        title="Karty ofert podobne do kokpitu"
        description="Karty łączą w sobie metryki, CTA i krótki kontekst. Użytkownik widzi wszystkie kluczowe dane w kompaktowym formacie."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Bestseller</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">Smart głośnik Home</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">+19%</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Świetne oceny w jakości dźwięku i szybka dostawa.</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Cena</span><span className="font-semibold text-slate-900">299 zł</span></div>
              <div className="flex items-center justify-between"><span>Dostawa</span><span>24h</span></div>
              <div className="flex items-center justify-between"><span>Ocena</span><span>4.8/5</span></div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Szybka decyzja</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">Powerbank 30k</h3>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700">Express</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Wysoka pojemność i gwarantowana jakość w niskiej cenie.</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Oszczędność</span><span>28%</span></div>
              <div className="flex items-center justify-between"><span>Stan</span><span>W magazynie</span></div>
              <div className="flex items-center justify-between"><span>Rating</span><span>4.6</span></div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Zaufane</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">Słuchawki ANC</h3>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Top</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Oferty z najlepszą oceną i wygodnym zwrotem. Idealne dla ludzi w biegu.</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Promocja</span><span>45%</span></div>
              <div className="flex items-center justify-between"><span>Czas</span><span>2 dni</span></div>
              <div className="flex items-center justify-between"><span>Ocena</span><span>4.9</span></div>
            </div>
          </div>
        </div>
      </PreviewSection>
    </div>
  );
}

export function DesignFourPreview() {
  return (
    <div className="space-y-12">
      <header className="rounded-[2rem] bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-10 text-white shadow-2xl shadow-slate-950/20">
        <div className="max-w-5xl">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/90">Wariant 4</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">Conversational Funnel zakupowy</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">Interakcja zamiast wyboru. Strona prowadzi użytkownika poprzez pytania, które naturalnie zawężają ścieżkę do ofert. Idealne dla zakupów o dużym znaczeniu.</p>
        </div>
      </header>

      <PreviewSection
        title="Dialog w centrum uwagi"
        description="Sekcja w formie karty z pytaniami, które przybliżają użytkownika do odpowiedniego produktu bez konieczności przeglądania długich list."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-white p-6 shadow-lg shadow-slate-900/5">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.26em] text-slate-500">Krok 1</p>
              <h3 className="text-2xl font-semibold text-slate-950">Czego potrzebujesz?</h3>
              <div className="space-y-3">
                {['Prezent dla mamy', 'Słuchawki do pracy', 'Sprzęt fitness do domu'].map((item) => (
                  <button key={item} className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-left text-sm font-medium text-slate-900 transition hover:border-slate-400">{item}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-lg shadow-slate-950/20">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.26em] text-emerald-300/80">Krok 2</p>
              <h3 className="text-2xl font-semibold">Co jest dla Ciebie ważne?</h3>
              <div className="space-y-3 text-sm leading-6 text-slate-300">
                <div className="rounded-3xl bg-slate-800/80 p-4">Cena poniżej 500 zł</div>
                <div className="rounded-3xl bg-slate-800/80 p-4">Długa gwarancja</div>
                <div className="rounded-3xl bg-slate-800/80 p-4">Natychmiastowa wysyłka</div>
              </div>
            </div>
          </div>
        </div>
      </PreviewSection>

      <PreviewSection
        title="Karty sugerowane w dialogu"
        description="Wariant karty produktu, która jest odpowiedzią na konkretne pytania użytkownika. Jasno pokazuje, jak produkt spełnia wymagania."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Dla prezentu</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">Aparat lifestyle</h3>
              </div>
              <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-sm font-semibold text-fuchsia-700">Empatia</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Łatwy w użyciu, świetny design i prezentowy wygląd.</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Ocena</span><span>4.7</span></div>
              <div className="flex items-center justify-between"><span>Promocja</span><span>29%</span></div>
              <div className="flex items-center justify-between"><span>Czas</span><span>48h</span></div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Dla pracy</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">Monitor UltraWide</h3>
              </div>
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-700">Focus</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Szeroki ekran idealny do pracy i multitaskingu.</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Rozmiar</span><span>34"</span></div>
              <div className="flex items-center justify-between"><span>Gwarancja</span><span>3 lata</span></div>
              <div className="flex items-center justify-between"><span>Oszczędność</span><span>24%</span></div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Dla domu</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">Robot sprzątający</h3>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">Praktyczny</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Oszczędza czas i upraszcza codzienne sprzątanie.</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Funkcje</span><span>Mapowanie</span></div>
              <div className="flex items-center justify-between"><span>Stan</span><span>Gotowy</span></div>
              <div className="flex items-center justify-between"><span>Cena</span><span>1 099 zł</span></div>
            </div>
          </div>
        </div>
      </PreviewSection>
    </div>
  );
}
