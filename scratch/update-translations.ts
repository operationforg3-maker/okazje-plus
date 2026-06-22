import * as fs from 'fs';
import * as path from 'path';

const locales = ['pl', 'en', 'de', 'fr', 'es', 'uk'];
const messagesDir = path.join(__dirname, '../messages');

// Helper to deep merge objects
function mergeDeep(target: any, source: any) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

function updateNamespace(ns: string, dataByLocale: Record<string, any>) {
  for (const locale of locales) {
    const filename = locale === 'pl' ? `${ns}.json` : `${ns}.${locale}.json`;
    const filePath = path.join(messagesDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`File missing: ${filePath}`);
      continue;
    }
    
    try {
      const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const localeData = dataByLocale[locale] || {};
      
      mergeDeep(fileContent, localeData);
      
      fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2) + '\n', 'utf8');
      console.log(`Updated ${filePath} successfully.`);
    } catch (e) {
      console.error(`Error updating ${filePath}:`, e);
    }
  }
}

// 1. Update NAV
const navUpdates: Record<string, any> = {
  pl: {
    waitingRoom: "Poczekalnia",
    search: "Szukaj",
    account: "Konto",
    mobileNavigation: "Nawigacja mobilna",
    openSearch: "Otwórz wyszukiwarkę"
  },
  en: {
    waitingRoom: "Waiting Room",
    search: "Search",
    account: "Account",
    mobileNavigation: "Mobile navigation",
    openSearch: "Open search"
  },
  de: {
    waitingRoom: "Warteschlange",
    search: "Suche",
    account: "Konto",
    mobileNavigation: "Mobile Navigation",
    openSearch: "Suche öffnen"
  },
  fr: {
    waitingRoom: "Salle d'attente",
    search: "Rechercher",
    account: "Compte",
    mobileNavigation: "Navigation mobile",
    openSearch: "Ouvrir la recherche"
  },
  es: {
    waitingRoom: "Sala de espera",
    search: "Buscar",
    account: "Cuenta",
    mobileNavigation: "Navegación móvil",
    openSearch: "Abrir búsqueda"
  },
  uk: {
    waitingRoom: "Черга",
    search: "Пошук",
    account: "Акаунт",
    mobileNavigation: "Мобільна навігація",
    openSearch: "Відкрити пошук"
  }
};
updateNamespace('nav', navUpdates);

// 2. Update DEALS
const dealsUpdates: Record<string, any> = {
  pl: {
    sidebar: {
      expandCategory: "Rozwiń kategorię",
      collapseCategory: "Zwiń kategorię",
      expandSubcategory: "Rozwiń podkategorię",
      collapseSubcategory: "Zwiń podkategorię"
    }
  },
  en: {
    sidebar: {
      expandCategory: "Expand category",
      collapseCategory: "Collapse category",
      expandSubcategory: "Expand subcategory",
      collapseSubcategory: "Collapse subcategory"
    }
  },
  de: {
    sidebar: {
      expandCategory: "Kategorie erweitern",
      collapseCategory: "Kategorie einklappen",
      expandSubcategory: "Unterkategorie erweitern",
      collapseSubcategory: "Unterkategorie einklappen"
    }
  },
  fr: {
    sidebar: {
      expandCategory: "Développer la catégorie",
      collapseCategory: "Réduire la catégorie",
      expandSubcategory: "Développer la sous-catégorie",
      collapseSubcategory: "Réduire la sous-catégorie"
    }
  },
  es: {
    sidebar: {
      expandCategory: "Expandir categoría",
      collapseCategory: "Contraer categoría",
      expandSubcategory: "Expandir subcategoría",
      collapseSubcategory: "Contraer subcategoría"
    }
  },
  uk: {
    sidebar: {
      expandCategory: "Розгорнути категорію",
      collapseCategory: "Згорнути категорію",
      expandSubcategory: "Розгорнути підкатегорію",
      collapseSubcategory: "Згорнути підкатегорію"
    }
  }
};
updateNamespace('deals', dealsUpdates);

// 3. Update FILTERS
const filtersUpdates: Record<string, any> = {
  pl: {
    minPrice: "Cena minimalna",
    maxPrice: "Cena maksymalna"
  },
  en: {
    minPrice: "Minimum price",
    maxPrice: "Maximum price"
  },
  de: {
    minPrice: "Mindestpreis",
    maxPrice: "Höchstpreis"
  },
  fr: {
    minPrice: "Prix minimum",
    maxPrice: "Prix maximum"
  },
  es: {
    minPrice: "Precio mínimo",
    maxPrice: "Precio máximo"
  },
  uk: {
    minPrice: "Мінімальна ціна",
    maxPrice: "Максимальна ціна"
  }
};
updateNamespace('filters', filtersUpdates);

// 4. Update SEARCH
const searchUpdates: Record<string, any> = {
  pl: {
    placeholder: "Szukaj produktów i okazji...",
    minChars: "Wpisz co najmniej 2 znaki, aby zobaczyć wyniki.",
    all: "Wszystkie",
    viewAllResults: "Zobacz pełne wyniki",
    noDeals: "Brak okazji dla tego zapytania.",
    noProducts: "Brak produktów dla tego zapytania."
  },
  en: {
    placeholder: "Search products and deals...",
    minChars: "Enter at least 2 characters to see results.",
    all: "All",
    viewAllResults: "View all results",
    noDeals: "No deals found for this query.",
    noProducts: "No products found for this query."
  },
  de: {
    placeholder: "Suche nach Produkten und Angeboten...",
    minChars: "Geben Sie mindestens 2 Zeichen ein, um Ergebnisse zu sehen.",
    all: "Alle",
    viewAllResults: "Alle Ergebnisse anzeigen",
    noDeals: "Keine Angebote für diese Anfrage gefunden.",
    noProducts: "Keine Produkte für diese Anfrage gefunden."
  },
  fr: {
    placeholder: "Rechercher des produits et des offres...",
    minChars: "Entrez au moins 2 caractères pour voir les résultats.",
    all: "Tous",
    viewAllResults: "Voir tous les résultats",
    noDeals: "Aucune offre trouvée pour cette requête.",
    noProducts: "Aucun produit trouvé pour cette requête."
  },
  es: {
    placeholder: "Buscar productos y ofertas...",
    minChars: "Ingrese al menos 2 caracteres para ver los resultados.",
    all: "Todos",
    viewAllResults: "Ver todos los resultados",
    noDeals: "No se encontraron ofertas para esta búsqueda.",
    noProducts: "No se encontraron productos para esta búsqueda."
  },
  uk: {
    placeholder: "Шукати продукти та пропозиції...",
    minChars: "Введіть принаймні 2 символи, щоб побачити результати.",
    all: "Всі",
    viewAllResults: "Переглянути всі результати",
    noDeals: "Не знайдено пропозицій для цього запиту.",
    noProducts: "Не знайдено продуктів для цього запиту."
  }
};
updateNamespace('search', searchUpdates);

// 5. Update SAVED SEARCH
const savedSearchUpdates: Record<string, any> = {
  pl: {
    enableNotifications: "Włącz powiadomienia",
    disableNotifications: "Wyłącz powiadomienia"
  },
  en: {
    enableNotifications: "Enable notifications",
    disableNotifications: "Disable notifications"
  },
  de: {
    enableNotifications: "Benachrichtigungen aktivieren",
    disableNotifications: "Benachrichtigungen deaktivieren"
  },
  fr: {
    enableNotifications: "Activer les notifications",
    disableNotifications: "Désactiver les notifications"
  },
  es: {
    enableNotifications: "Activar notificaciones",
    disableNotifications: "Desactivar notificaciones"
  },
  uk: {
    enableNotifications: "Увімкнути сповіщення",
    disableNotifications: "Вимкнути сповіщення"
  }
};
updateNamespace('savedSearch', savedSearchUpdates);

// 6. Update COMMON
const commonUpdates: Record<string, any> = {
  pl: {
    labels: {
      user: "Użytkownik",
      temperature: "Temperatura",
      boughtCount: "{count} kupiło",
      youSave: "Oszczędzasz {amount}"
    },
    messages: {
      voteRemoved: "Głos usunięty",
      voteChanged: "Głos zmieniony",
      voteAdded: "Głos dodany"
    },
    search: {
      searchBarLabel: "Wyszukaj produkty i okazje",
      resultsLabel: "Wyniki wyszukiwania"
    }
  },
  en: {
    labels: {
      user: "User",
      temperature: "Temperature",
      boughtCount: "{count} bought",
      youSave: "You save {amount}"
    },
    messages: {
      voteRemoved: "Vote removed",
      voteChanged: "Vote changed",
      voteAdded: "Vote added"
    },
    search: {
      searchBarLabel: "Search products and deals",
      resultsLabel: "Search results"
    }
  },
  de: {
    labels: {
      user: "Benutzer",
      temperature: "Temperatur",
      boughtCount: "{count} gekauft",
      youSave: "Sie sparen {amount}"
    },
    messages: {
      voteRemoved: "Stimme entfernt",
      voteChanged: "Stimme geändert",
      voteAdded: "Stimme hinzugefügt"
    },
    search: {
      searchBarLabel: "Produkte und Angebote suchen",
      resultsLabel: "Suchergebnisse"
    }
  },
  fr: {
    labels: {
      user: "Utilisateur",
      temperature: "Température",
      boughtCount: "{count} achetés",
      youSave: "Vous économisez {amount}"
    },
    messages: {
      voteRemoved: "Vote supprimé",
      voteChanged: "Vote modifié",
      voteAdded: "Vote ajouté"
    },
    search: {
      searchBarLabel: "Rechercher des produits et des offres",
      resultsLabel: "Résultats de recherche"
    }
  },
  es: {
    labels: {
      user: "Usuario",
      temperature: "Temperatura",
      boughtCount: "{count} comprados",
      youSave: "Ahorras {amount}"
    },
    messages: {
      voteRemoved: "Voto eliminado",
      voteChanged: "Voto cambiado",
      voteAdded: "Voto añadido"
    },
    search: {
      searchBarLabel: "Buscar productos y ofertas",
      resultsLabel: "Resultados de búsqueda"
    }
  },
  uk: {
    labels: {
      user: "Користувач",
      temperature: "Температура",
      boughtCount: "{count} купили",
      youSave: "Ви заощаджуєте {amount}"
    },
    messages: {
      voteRemoved: "Голос видалено",
      voteChanged: "Голос змінено",
      voteAdded: "Голос додано"
    },
    search: {
      searchBarLabel: "Шукати продукти та пропозиції",
      resultsLabel: "Результати пошуку"
    }
  }
};
updateNamespace('common', commonUpdates);

console.log('--- TRANSLATION UPDATE COMPLETED ---');
