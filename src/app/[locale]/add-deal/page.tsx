'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchProductsForLinking, getCategories } from '@/lib/data';
import { linkDealToProduct } from '@/lib/data';
import { toast } from 'sonner';
import { Loader2, Image as ImageIcon, Link2, Tag, Info, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { createNewDeal } from './actions';
import DealCard from '@/components/deal-card';
import { cn } from '@/lib/utils';

// Typ dla danych nowej okazji wysyłanych do API endpoint
interface NewDealData {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  mainCategorySlug: string;
  subCategorySlug: string;
  subSubCategorySlug?: string;
  merchant?: string;
  shippingCost?: number;
}

export default function AddDealPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations('addDeal');
  
  const [merchant, setMerchant] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  const handleScrape = async () => {
    if (!link || !validateUrl(link)) {
      toast.error('Wpisz poprawny adres URL przed skanowaniem');
      return;
    }

    setIsScraping(true);
    const toastId = toast.loading('Skanuję stronę i pobieram szczegóły okazji...');
    try {
      const res = await fetch(`/api/deals/scrape?url=${encodeURIComponent(link)}`);
      if (!res.ok) throw new Error('Nie udało się pobrać szczegółów strony');
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.price) setPrice(String(data.price));
      if (data.originalPrice) setOriginalPrice(String(data.originalPrice));
      if (data.image) setImage(data.image);
      if (data.merchant) setMerchant(data.merchant);

      toast.success('Pomyślnie automatycznie uzupełniono dane!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Nie udało się automatycznie uzupełnić formularza.', { id: toastId });
    } finally {
      setIsScraping(false);
    }
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  const [linkedProductId, setLinkedProductId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  
  // Kategorie
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [subsubcategories, setSubsubcategories] = useState<any[]>([]);
  const [mainCategorySlug, setMainCategorySlug] = useState('');
  const [subCategorySlug, setSubCategorySlug] = useState('');
  const [subSubCategorySlug, setSubSubCategorySlug] = useState('');

  // Walidacja pól
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Obliczanie zniżki
  const discount = originalPrice && price ? parseFloat(originalPrice) - parseFloat(price) : 0;
  const discountPercent = originalPrice && price ? Math.round((discount / parseFloat(originalPrice)) * 100) : 0;

  // Walidacja URL w czasie rzeczywistym
  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Puste pole jest OK (wymagane pole zostanie obsłużone przez submit)
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Walidacja ceny
  const validatePrice = (priceStr: string): boolean => {
    if (!priceStr) return true;
    const num = parseFloat(priceStr);
    return !isNaN(num) && num > 0;
  };

  // Preview obrazka
  useEffect(() => {
    if (image && validateUrl(image)) {
      setImageLoading(true);
      setImagePreviewUrl(image);
      
      // Sprawdź czy obrazek się załaduje
      const img = new Image();
      img.onload = () => setImageLoading(false);
      img.onerror = () => {
        setImageLoading(false);
        setImagePreviewUrl('');
      };
      img.src = image;
    } else {
      setImagePreviewUrl('');
    }
  }, [image]);

  // Walidacja w czasie rzeczywistym
  useEffect(() => {
    const newErrors: Record<string, string> = {};
    
    if (link && !validateUrl(link)) {
      newErrors.link = t('invalidUrl');
    }
    if (image && !validateUrl(image)) {
      newErrors.image = t('invalidUrl');
    }
    if (price && !validatePrice(price)) {
      newErrors.price = t('invalidPrice');
    }
    if (originalPrice && !validatePrice(originalPrice)) {
      newErrors.originalPrice = t('invalidPrice');
    }
    
    setErrors(newErrors);
  }, [link, image, price, originalPrice, t]);
  useEffect(() => {
    async function fetchCategories() {
      const cats = await getCategories();
      setCategories(cats);
    }
    fetchCategories();
  }, []);

  // Aktualizuj podkategorie
  useEffect(() => {
    if (mainCategorySlug) {
      const mainCat = categories.find((c) => c.slug === mainCategorySlug);
      setSubcategories(mainCat?.subcategories || []);
      setSubCategorySlug('');
      setSubSubCategorySlug('');
      setSubsubcategories([]);
    }
  }, [mainCategorySlug, categories]);

  // Aktualizuj sub-subkategorie
  useEffect(() => {
    if (subCategorySlug) {
      const subCat = subcategories.find((c) => c.slug === subCategorySlug);
      setSubsubcategories(subCat?.subcategories || []);
      setSubSubCategorySlug('');
    } else {
      setSubsubcategories([]);
    }
  }, [subCategorySlug, subcategories]);

  useEffect(() => {
    const run = async () => {
      if (!productQuery.trim()) { setProductResults([]); return; }
      setProductSearchLoading(true);
      try {
        const results = await searchProductsForLinking(productQuery.trim());
        setProductResults(results.slice(0, 8));
      } catch (e) {
        console.warn('Search products failed', e);
      } finally {
        setProductSearchLoading(false);
      }
    };
    const t = setTimeout(run, 400); // debounce
    return () => clearTimeout(t);
  }, [productQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error(t('mustBeLoggedIn'));
      return;
    }

    // Walidacja
    if (!title.trim() || !price.trim() || !link.trim()) {
      toast.error(t('requiredFields'));
      return;
    }

    if (!mainCategorySlug || !subCategorySlug) {
      toast.error(t('categoryRequired'));
      return;
    }

    if (Object.keys(errors).length > 0) {
      toast.error(t('errorMessage'));
      return;
    }

    const newDealData: NewDealData = {
        title,
        description,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        link,
        image,
        mainCategorySlug,
        subCategorySlug,
        subSubCategorySlug: subSubCategorySlug || undefined,
        merchant: merchant || undefined,
    };

    setIsLoading(true);
    toast.info(t('processing'));

    try {
        const result = await createNewDeal(newDealData);
        const dealId = result.id;
        
        // Linkowanie z produktem jeśli wybrano
        if (dealId && linkedProductId) {
          try {
            await linkDealToProduct(dealId, linkedProductId);
            toast.success(t('linkingProduct'));
          } catch (e) {
            console.error('Linking failed', e);
            toast.warning(t('linkingFailed'));
          }
        }
        
        toast.success(t('successMessage'));
        router.push('/deals');
    } catch (error) {
        console.error('Błąd podczas tworzenia okazji:', error);
        const errorMessage = error instanceof Error ? error.message : t('errorMessage');
        toast.error(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  const mockDeal = {
    id: 'mock-id',
    title: title || 'Tytuł Twojej nowej okazji',
    description: description || 'Tutaj pojawi się opis okazji...',
    price: parseFloat(price) || 0,
    originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
    link: link || '#',
    image: image || '',
    mainCategorySlug: mainCategorySlug || 'inne',
    subCategorySlug: subCategorySlug || '',
    subSubCategorySlug: subSubCategorySlug || '',
    postedAt: new Date().toISOString(),
    postedBy: user?.displayName || 'Użytkownik',
    temperature: 0,
    votesCount: 0,
    commentsCount: 0,
    freeShipping: false,
    merchant: merchant || '',
  };

  return (
    <div className="page-container py-8 md:py-12 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          Kreator dodawania okazji
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-7 space-y-6">
            {/* Podstawowe informacje */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Podstawowe informacje
                </CardTitle>
                <CardDescription>{t('dealTitleHelper')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title" className="flex items-center gap-2 font-semibold">
                    {t('dealTitle')} <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder={t('dealTitlePlaceholder')}
                    required 
                    disabled={isLoading}
                    className={errors.title ? 'border-destructive' : ''}
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="flex items-center gap-2 font-semibold">
                    {t('description')} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea 
                    id="description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder={t('descriptionPlaceholder')}
                    required 
                    disabled={isLoading}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('descriptionHelper')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Cena i zniżka */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  Cena i Promocja
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price" className="flex items-center gap-2 font-semibold">
                      {t('dealPrice')} <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      id="price" 
                      type="number" 
                      step="0.01"
                      value={price} 
                      onChange={(e) => setPrice(e.target.value)} 
                      placeholder={t('pricePlaceholder')}
                      required 
                      disabled={isLoading}
                      className={errors.price ? 'border-destructive' : ''}
                    />
                    {errors.price && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.price}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="originalPrice" className="flex items-center gap-2 font-semibold">
                      {t('regularPrice')} <span className="text-muted-foreground text-xs">({t('optional')})</span>
                    </Label>
                    <Input 
                      id="originalPrice" 
                      type="number" 
                      step="0.01"
                      value={originalPrice} 
                      onChange={(e) => setOriginalPrice(e.target.value)} 
                      placeholder={t('originalPricePlaceholder')}
                      disabled={isLoading}
                      className={errors.originalPrice ? 'border-destructive' : ''}
                    />
                    {errors.originalPrice && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.originalPrice}
                      </p>
                    )}
                  </div>
                </div>

                {/* Kalkulator zniżki */}
                {discount > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl">
                    <p className="text-xs font-bold text-green-900 dark:text-green-100">
                      Zniżka: {discount.toFixed(2)} PLN ({discountPercent}%)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Linki z AI-Wizard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Odnośnik i Skanowanie oferty
                </CardTitle>
                <CardDescription>Wklej link, aby AI automatycznie pobrało dane okazki</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="link" className="flex items-center gap-2 font-semibold">
                    {t('dealLink')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      id="link" 
                      type="url" 
                      value={link} 
                      onChange={(e) => setLink(e.target.value)} 
                      placeholder={t('dealLinkPlaceholder')}
                      required 
                      disabled={isLoading || isScraping}
                      className={cn("flex-grow", errors.link && 'border-destructive')}
                    />
                    <Button 
                      type="button" 
                      onClick={handleScrape} 
                      disabled={isLoading || isScraping || !link} 
                      className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-4 flex-shrink-0"
                    >
                      {isScraping ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Skanuj'
                      )}
                    </Button>
                  </div>
                  {errors.link && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.link}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="merchant" className="flex items-center gap-2 font-semibold">
                    Sprzedawca / Sklep <span className="text-muted-foreground text-xs">(opcjonalnie)</span>
                  </Label>
                  <Input 
                    id="merchant" 
                    type="text" 
                    value={merchant} 
                    onChange={(e) => setMerchant(e.target.value)} 
                    placeholder="np. AliExpress, Amazon, Allegro"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="image" className="flex items-center gap-2 font-semibold">
                    {t('imageUrl')} <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="image" 
                    type="url" 
                    value={image} 
                    onChange={(e) => setImage(e.target.value)} 
                    placeholder={t('imageUrlPlaceholder')}
                    required 
                    disabled={isLoading}
                    className={errors.image ? 'border-destructive' : ''}
                  />
                  {errors.image && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.image}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Kategorie */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  Kategoria
                </CardTitle>
                <CardDescription>{t('categoryHelper')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="mainCategory" className="text-xs font-semibold">
                    {t('mainCategory')} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={mainCategorySlug} onValueChange={setMainCategorySlug} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('categoryRequired')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {subcategories.length > 0 && (
                  <div>
                    <Label htmlFor="subCategory" className="text-xs font-semibold">
                      {t('subCategory')} <span className="text-destructive">*</span>
                    </Label>
                    <Select value={subCategorySlug} onValueChange={setSubCategorySlug} disabled={isLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('categoryRequired')} />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories.map((subcat) => (
                          <SelectItem key={subcat.slug} value={subcat.slug}>
                            {subcat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {subsubcategories.length > 0 && (
                  <div>
                    <Label htmlFor="subSubCategory" className="text-xs font-semibold">
                      {t('subSubCategory')} <span className="text-muted-foreground text-xs">({t('optional')})</span>
                    </Label>
                    <Select value={subSubCategorySlug} onValueChange={setSubSubCategorySlug} disabled={isLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('optional')} />
                      </SelectTrigger>
                      <SelectContent>
                        {subsubcategories.map((subsubcat) => (
                          <SelectItem key={subsubcat.slug} value={subsubcat.slug}>
                            {subsubcat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Połącz z produktem */}
            <Card>
              <CardHeader>
                <CardTitle>{t('linkProduct')}</CardTitle>
                <CardDescription>{t('linkProductHelper')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="linkedProduct">{t('searchProduct')}</Label>
                  <Input
                    id="linkedProduct"
                    placeholder={t('searchProduct')}
                    value={productQuery}
                    onChange={e => setProductQuery(e.target.value)}
                    disabled={isLoading}
                  />
                  {productSearchLoading && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('searching')}
                    </p>
                  )}
                </div>

                {productResults.length > 0 && (
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {productResults.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => { 
                          setLinkedProductId(p.id); 
                          setProductQuery(p.name); 
                          setProductResults([]);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                          linkedProductId === p.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <span className="line-clamp-1">{p.name}</span>
                        {linkedProductId === p.id && (
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {!productSearchLoading && productQuery && productResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('noProductsFound')}</p>
                )}

                {linkedProductId && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl">
                    <p className="text-xs font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      Produkt połączony pomyślnie! (ID: {linkedProductId})
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button 
              type="submit" 
              size="lg" 
              className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md hover:shadow-lg" 
              disabled={isLoading || Object.keys(errors).length > 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                'Zgłoś nową okazję'
              )}
            </Button>

            {Object.keys(errors).length > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
                <p className="text-xs text-destructive font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {t('errorMessage')}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Live Preview */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
            <Card className="border shadow-xl rounded-2xl overflow-hidden bg-card">
              <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background p-4 border-b border-border/40">
                <h3 className="font-headline text-sm font-bold text-foreground">Podgląd na żywo</h3>
                <p className="text-xs text-muted-foreground">Tak Twoja okazja ukaże się na stronie głównej</p>
              </div>
              <CardContent className="p-6 flex justify-center bg-muted/20">
                <div className="w-full max-w-[340px]">
                  <DealCard deal={mockDeal as any} />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-md rounded-2xl bg-card">
              <CardContent className="p-6 space-y-3 text-xs text-muted-foreground leading-relaxed">
                <h4 className="font-bold text-foreground flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-primary" />
                  Zasady społeczności
                </h4>
                <p>Każda dodana okazja przechodzi automatyczną weryfikację. Upewnij się, że cena jest poprawna, a opis rzetelnie przedstawia ofertę.</p>
                <p>Dzięki funkcji <strong>AI-Wizard</strong> wklejając link z AliExpress automatycznie pobierzemy dla Ciebie oryginalne zdjęcie, opis i cenę!</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
