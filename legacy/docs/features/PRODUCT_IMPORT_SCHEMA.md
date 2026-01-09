# Product Import – Rozszerzony schemat JSON

## Przegląd
System importu produktów (`/admin/products-import`) obsługuje rozszerzone pola umożliwiające import danych technicznych, ocen, tłumaczeń wielojęzycznych i bogatych opisów.

## Schemat JSON (ProductInputSchema)

### 1. Podstawowe pola
```json
{
  "affiliateUrl": "https://example.com/product",
  "price": 99.99,
  "originalPrice": 149.99,
  "mainCategorySlug": "elektronika",
  "subCategorySlug": "smartfony",
  "subSubCategorySlug": "android",
  "status": "approved"
}
```

### 2. Tytuły i opisy – LocalizedText
**Stare pole (legacy, deprecated):**
```json
{
  "name": "Produkt PL",
  "description": "Opis PL",
  "longDescription": "Długi opis PL"
}
```

**Nowe pola (rekomendowane – obsługa wielu języków):**
```json
{
  "title": {
    "pl": "Smartfon XYZ",
    "en": "Smartphone XYZ",
    "de": "Smartphone XYZ"
  },
  "shortDescription": {
    "pl": "Nowoczesny smartfon z aparatem 50MP",
    "en": "Modern smartphone with 50MP camera"
  },
  "fullDescription": {
    "pl": "Szczegółowy opis... [może być HTML/markdown]",
    "en": "Detailed description..."
  },
  "seoDescription": {
    "pl": "Meta opis dla SEO",
    "en": "Meta description for SEO"
  }
}
```
**Uwagi:**
- Jeśli podasz tylko string (np. `"title": "Smartfon XYZ"`), pipeline automatycznie stworzy `{ pl: "Smartfon XYZ", en: "Smartfon XYZ" }`.
- Minimalne wymaganie: pole `pl` **lub** `en` (co najmniej jeden język).

### 3. Specyfikacje techniczne
**W katalogu głównym:**
```json
{
  "specifications": [
    { "key": "screen_size", "name": "Przekątna ekranu", "value": "6.5", "unit": "inch" },
    { "key": "ram", "name": "RAM", "value": "8", "unit": "GB" },
    { "name": "Pojemność baterii", "value": "5000 mAh" }
  ]
}
```

**Lub w `metadata`:**
```json
{
  "metadata": {
    "originalId": "ae_1234567890",
    "specifications": [
      { "key": "cpu", "value": "Snapdragon 888" },
      { "name": "Kamera", "value": "50MP + 12MP" }
    ]
  }
}
```

**Pola opcjonalne w spec:**
- `key` – identyfikator (np. `"screen_size"`)
- `name` – nazwa wyświetlana (np. `"Przekątna ekranu"`)
- `value` – **wymagane** (wartość)
- `unit` – jednostka (np. `"GB"`, `"inch"`)

### 4. Oceny zewnętrzne (AliExpress, Allegro itp.)
**Metoda 1 – ratingSources:**
```json
{
  "ratingSources": {
    "external": {
      "average": 4.5,
      "count": 12345,
      "source": "aliexpress",
      "updatedAt": "2025-01-05T12:00:00Z"
    }
  }
}
```

**Metoda 2 – pola top-level:**
```json
{
  "externalRating": 4.5,
  "externalRatingCount": 12345
}
```

**Metoda 3 – metadata (AliExpress raw):**
```json
{
  "metadata": {
    "evaluateRate": "4.5/5",
    "evaluateCount": 12345,
    "merchantRating": 4.8
  }
}
```

**Uwagi:**
- Pipeline automatycznie parsuje `evaluateRate` (wyciąga liczbę z stringa `"4.5/5"` → `4.5`)
- Jeśli podasz kilka źródeł, priorytet: `ratingSources.external.average` > `evaluateRate` > `externalRating`
- `merchantRating` to ocena sprzedawcy (0–5), oddzielna od oceny produktu

### 5. Pełny przykład JSON (import 2 produktów)

```json
[
  {
    "title": {
      "pl": "Smartfon Android 5G",
      "en": "Android 5G Smartphone"
    },
    "shortDescription": {
      "pl": "Nowoczesny telefon z aparatem 50MP i baterią 5000mAh",
      "en": "Modern phone with 50MP camera and 5000mAh battery"
    },
    "fullDescription": {
      "pl": "Szczegółowy opis produktu... [tekst lub HTML]",
      "en": "Detailed product description..."
    },
    "seoDescription": {
      "pl": "Kup smartfon Android 5G z aparatem 50MP – darmowa dostawa",
      "en": "Buy Android 5G smartphone with 50MP camera – free shipping"
    },
    "image": "https://example.com/image.jpg",
    "imageHint": "Smartfon Android 5G czarny",
    "affiliateUrl": "https://example.com/product/12345",
    "price": 1299,
    "originalPrice": 1699,
    "mainCategorySlug": "elektronika",
    "subCategorySlug": "smartfony",
    "subSubCategorySlug": "android",
    "status": "approved",
    "specifications": [
      { "key": "screen_size", "name": "Przekątna ekranu", "value": "6.5", "unit": "inch" },
      { "key": "ram", "name": "RAM", "value": "8", "unit": "GB" },
      { "name": "Pojemność baterii", "value": "5000 mAh" },
      { "name": "Procesor", "value": "Snapdragon 888" },
      { "name": "Aparat", "value": "50MP + 12MP" }
    ],
    "ratingSources": {
      "external": {
        "average": 4.5,
        "count": 12345,
        "source": "aliexpress",
        "updatedAt": "2025-01-05T12:00:00Z"
      }
    },
    "metadata": {
      "originalId": "ae_1234567890",
      "source": "aliexpress",
      "merchantRating": 4.8,
      "evaluateCount": 12345
    }
  },
  {
    "name": "Laptop gamingowy XYZ",
    "description": "Potężny laptop do gier z RTX 4070",
    "longDescription": "Szczegółowy opis laptopa...",
    "image": "https://example.com/laptop.jpg",
    "affiliateUrl": "https://example.com/laptop/67890",
    "price": 5999,
    "mainCategorySlug": "elektronika",
    "subCategorySlug": "komputery",
    "subSubCategorySlug": "laptopy",
    "status": "approved",
    "specifications": [
      { "name": "Procesor", "value": "Intel Core i7-13700H" },
      { "name": "GPU", "value": "RTX 4070 8GB" },
      { "name": "RAM", "value": "32GB DDR5" },
      { "name": "Dysk", "value": "1TB NVMe SSD" }
    ],
    "externalRating": 4.8,
    "externalRatingCount": 567,
    "metadata": {
      "originalId": "csv_laptop_67890"
    }
  }
]
```

## Przepływ importu

1. **Walidacja** – pipeline sprawdza czy podano wymagane pola (`affiliateUrl`, `price`, kategorie).
2. **Normalizacja LocalizedText** – konwersja stringów na obiekty `{ pl, en }` jeśli trzeba.
3. **Mapowanie ocen** – `evaluateRate`, `merchantRating`, `externalRating` → `ratingSources.external`.
4. **Specyfikacje** – łączenie `specifications` z `metadata.specifications`.
5. **Deduplikacja AI** (jeśli włączona) – wykrywanie duplikatów po nazwie/opisie.
6. **Zapis** – utworzenie/aktualizacja w Firestore.
7. **Sanitizacja** – wszystkie dane przepuszczane przez `sanitizeProductPayload` przed zwrotem do UI.

## Parametry importu (UI `/admin/products-import`)

- **upsert** (domyślnie: `true`) – aktualizuje istniejące produkty po `metadata.originalId` lub `affiliateUrl`
- **dedupe** (domyślnie: `true`) – AI sprawdza duplikaty (podobieństwo > 85%)
- **batchSize** (domyślnie: `500`) – liczba produktów przetwarzanych w jednej partii

## API endpoint
```
POST /api/admin-import/products
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "mode": "dry-run",  // lub "run"
  "payload": {
    "products": [...],
    "upsert": true,
    "dedupe": true,
    "batchSize": 500,
    "dryRun": true
  }
}
```

**Dry-run response:**
```json
{
  "ok": true,
  "summary": { "total": 2, "toCreate": 1, "toUpdate": 1, "duplicates": 0 },
  "preview": [
    { "product": { "name": "Smartfon Android 5G" }, "action": "create" },
    { "product": { "id": "abc123", "name": "Laptop gamingowy XYZ" }, "action": "update", "reason": "Existing product found" }
  ]
}
```

## Uwagi końcowe
- **Wymagane pola:** `affiliateUrl`, `price`, `mainCategorySlug`, `subCategorySlug`
- **Zalecane:** podaj `title` jako LocalizedText dla wsparcia wielu języków (M4 standard)
- **Opcjonalne:** `specifications`, `ratingSources`, `seoDescription` – wzbogacają dane produktu
- **Backward compatibility:** stare pola (`name`, `description`, `longDescription`) są nadal obsługiwane, ale pipeline automatycznie konwertuje je na LocalizedText

---

**Ostatnia aktualizacja:** 2025-01-05 (M5 post-completion)
