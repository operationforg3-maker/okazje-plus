export default function AiApiSpec() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Specyfikacja API AI</h2>
      <ul className="list-disc ml-6 space-y-2">
        <li><b>Dodawanie kategorii:</b> <code>dodaj kategorię "Nazwa"</code></li>
        <li><b>Dodawanie podkategorii:</b> <code>dodaj podkategorię "Nazwa" do "Kategoria nadrzędna"</code></li>
        <li><b>Wypełnianie katalogu:</b> <code>wypełnij katalog</code> — automatyczne generowanie kategorii i produktów</li>
        <li><b>Wyszukiwanie produktu:</b> <code>wyszukaj produkt "fraza"</code></li>
        <li><b>Importowanie ofert:</b> <code>zaimportuj deale z AliExpress</code></li>
        <li><b>Obsługa statusów i logów:</b> <code>pokaż logi AI</code></li>
        <li><b>Dowolne polecenia naturalne:</b> AI rozpoznaje intencje i mapuje na API</li>
      </ul>
      <p className="mt-4 text-muted-foreground text-xs">Możesz wpisywać polecenia w języku polskim lub angielskim. AI automatycznie rozpozna intencję i wykona odpowiednią akcję.</p>
    </div>
  );
}
