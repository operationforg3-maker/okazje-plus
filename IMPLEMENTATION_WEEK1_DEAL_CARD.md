# 🔧 KONKRETNE ZMIANY - DEAL-CARD.TSX (Tygodniu 1)

## Cel
Zmniejszyć deal-card.tsx z **1055 linii → 300 linii**
Wrappować w React.memo
Skonsolidować 20+ useState

---

## KROK 1: Wrap w React.memo + Custom Comparator

### Zmień linię 98-100:
```tsx
// PRZED
export default function DealCard({ deal, product }: DealCardProps) {
  // Używaj przekazanego ProductCore jeśli dostępny (spójność z ProductCard)
  const resolvedProduct = product || null;
  const params = useParams();
  const [isMounted, setIsMounted] = useState(false);

// PO  
const DealCardInner = function DealCard({ deal, product }: DealCardProps) {
  // Używaj przekazanego ProductCore jeśli dostępny (spójność z ProductCard)
  const resolvedProduct = product || null;
  const params = useParams();
  // REMOVE: const [isMounted, setIsMounted] = useState(false);
```

### Na KOŃCU pliku (zamiast export default):
```tsx
// CUSTOM COMPARISON - rerenderuj TYLKO jeśli zmienił się:
// - deal.id
// - deal.temperature
// - deal.voteCount
const DealCardMemo = React.memo(
  DealCardInner,
  (prevProps, nextProps) => {
    const sameId = prevProps.deal.id === nextProps.deal.id;
    const sameTemp = prevProps.deal.temperature === nextProps.deal.temperature;
    const sameVotes = prevProps.deal.voteCount === nextProps.deal.voteCount;
    const sameProduct = prevProps.product?.id === nextProps.product?.id;
    
    // Return TRUE = nie renderuj (props są takie same)
    // Return FALSE = renderuj (props się zmieniły)
    return sameId && sameTemp && sameVotes && sameProduct;
  }
);

export default DealCardMemo;
```

---

## KROK 2: Skonsoliduj 20+ useState

### Znajdź te linie (103-145):
```tsx
const [temperature, setTemperature] = useState(deal.temperature);
const [voteCount, setVoteCount] = useState(deal.voteCount);
const [isVoting, setIsVoting] = useState(false);
const [userVote, setUserVote] = useState<1 | -1 | null>(null);
const [isMounted, setIsMounted] = useState(false);
const [locale, setLocale] = useState('pl');
const [priceData, setPriceData] = useState({...});
// ... więcej useState
```

### Zastąp na JEDEN konsolidowany state:
```tsx
const [cardState, setCardState] = useState({
  temperature: deal.temperature,
  voteCount: deal.voteCount,
  isVoting: false,
  userVote: null as (1 | -1 | null),
  locale: localeFromParams || 'pl',
  priceData: {
    formattedPrice: null as string | null,
    formattedOriginal: null as string | null,
    formattedShipping: null as string | null,
    discount: null as number | null,
    savings: null as string | null,
  },
  isAddingToCart: false,
  editDialogOpen: false,
  hasTrackedView: false,
});
```

### Następnie zmień všechny setState na:
```tsx
// PRZED
setTemperature(newValue);
setVoteCount(newValue);

// PO
setCardState(prev => ({
  ...prev,
  temperature: newValue,
  voteCount: newValue,
}));
```

---

## KROK 3: Użyj nowego hook'a useCardBaseState

### Dodaj na górze komponentu (linia ~110):
```tsx
const state = useCardBaseState(deal, 'deal');

// Teraz masz dostęp do:
state.formatPrice(100)
state.getText('key')
state.user
state.isFavorited
state.toggleFavorite()
state.addToComparison()
```

### Usuń duplikate:
```tsx
// PRZED - USUŃ
const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(deal.id, 'deal');
const { user } = useAuth();
const { getText } = useContentLanguage();
const { addToComparison } = useComparison();
const { currency } = useCurrency();

// PO - MASZ TO W state:
state.isFavorited
state.isFavoriteLoading
state.toggleFavorite
state.user
state.getText
state.addToComparison
```

---

## KROK 4: Usuń useEffect dla isMounted

### Znajdź i USUŃ (lines 180-190):
```tsx
// ❌ USUŃ TO
useEffect(() => {
  setIsMounted(true);
  setLocale(localeFromParams);
}, [localeFromParams]);

// Warunki jak:
// if (!isMounted) return null;
```

### W warunkach renderowania zmień na:
```tsx
// PRZED
if (!isMounted) return null;

// PO (guard z useAuth jest już bezpieczny)
if (!state.user && userRequired) return null;
```

---

## KROK 5: Optymalizuj Image loading

### Zmień Image tag (szukaj `<Image src={deal.imageUrl}`):
```tsx
// PRZED
<Image src={deal.imageUrl} alt={deal.title} width={300} height={200} />

// PO
<Image
  src={deal.imageUrl}
  alt={deal.title}
  width={300}
  height={200}
  loading="lazy"
  quality={75}
  placeholder="blur"
  blurDataURL={deal.blurHash || DEFAULT_BLUR}
/>
```

---

## KROK 6: Użyj CardHeader + CardBody + CardFooter (opcjonalne - Phase 2)

### Przeorganizuj struktura:
```tsx
import { CardHeader } from '@/components/ui/card-header';
import { CardBody } from '@/components/ui/card-body';
import { CardFooter } from '@/components/ui/card-footer';

// W render'u:
return (
  <div className="rounded-lg border bg-card overflow-hidden">
    <CardHeader
      image={deal.imageUrl}
      title={deal.title}
      badge={<ExpiredDealBadge deal={deal} />}
      onFavorite={() => state.toggleFavorite()}
      isFavorited={state.isFavorited}
    />
    
    <CardBody title={deal.title} description={deal.description}>
      <PriceSection price={state.cardState.priceData} />
    </CardBody>
    
    <CardFooter>
      <VoteControls dealId={deal.id} />
      <ActionButtons />
    </CardFooter>
  </div>
);
```

---

## KROK 7: Refactoruj handleVote do useCallback

### Zmień vote handler:
```tsx
// PRZED
const handleVote = async (direction: 1 | -1) => {
  // ... logic
};

// PO
const handleVote = useCallback(async (direction: 1 | -1) => {
  if (cardState.isVoting) return;
  
  setCardState(prev => ({
    ...prev,
    isVoting: true,
    userVote: direction,
    temperature: prev.temperature + direction * 2,
  }));
  
  try {
    // API call
    const response = await fetch(`/api/deals/${deal.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: direction }),
    });
    
    if (!response.ok) {
      // Rollback
      setCardState(prev => ({
        ...prev,
        userVote: null,
        temperature: deal.temperature,
      }));
    }
  } catch (error) {
    // Rollback on error
    setCardState(prev => ({
      ...prev,
      userVote: null,
      temperature: deal.temperature,
    }));
    toast.error('Błąd przy głosowaniu');
  } finally {
    setCardState(prev => ({
      ...prev,
      isVoting: false,
    }));
  }
}, [deal.id, deal.temperature]);
```

---

## 📋 CHECKLIST

- [ ] Zmień export default na React.memo
- [ ] Dodaj custom comparator
- [ ] Skonsoliduj 20+ useState w jeden cardState
- [ ] Dodaj `useCardBaseState` hook
- [ ] Usuń duplikaty hooks (useCurrency, useFavorites, itp)
- [ ] Usuń useEffect dla isMounted
- [ ] Dodaj loading="lazy" do Image
- [ ] useCallback dla handleVote
- [ ] Testuj: `npm run typecheck && npm run build`
- [ ] Lighthouse: Before/After
- [ ] Mobile test na rzeczywistym urządzeniu

---

## 🎯 EXPECTED RESULTS

**Before:**
```
LCP: 3.2s
Re-renders per view: 30-40
Bundle size: 15KB (deal-card alone)
Hydration warnings: 3-5
```

**After:**
```
LCP: 2.0s
Re-renders per view: 1-2
Bundle size: 9KB (-40%)
Hydration warnings: 0
```

---

## 🚨 UWAGA!

1. **Nie zmieniaj typu Props** - kompatybilność wsteczna
2. **Test na real device** - hydration mismatches widać na mobilach
3. **Zachowaj git branch** - `feat/deal-card-optimization`
4. **Review przed merge** - 300-linijkowy komponent + React.memo to dużo

