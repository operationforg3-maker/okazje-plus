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
import { Loader2, Image as ImageIcon, Link2, Tag, Info, CheckCircle2, AlertCircle } from 'lucide-react';

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
    };

    setIsLoading(true);
    toast.info(t('processing'));

    try {
        const response = await fetch('/api/admin/deals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newDealData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || t('errorMessage'));
        }

        const result = await response.json();
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

  return (
    <div className="page-container py-8 md:py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl mb-2">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Podstawowe informacje */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('dealTitleHelper')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title" className="flex items-center gap-2">
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
              <p className="text-xs text-muted-foreground mt-1">{t('dealTitleHelper')}</p>
            </div>

            <div>
              <Label htmlFor="description" className="flex items-center gap-2">
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
              <Tag className="h-5 w-5" />
              {t('price')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price" className="flex items-center gap-2">
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
                {!errors.price && (
                  <p className="text-xs text-muted-foreground mt-1">{t('priceHelper')}</p>
                )}
              </div>

              <div>
                <Label htmlFor="originalPrice" className="flex items-center gap-2">
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
                {!errors.originalPrice && (
                  <p className="text-xs text-muted-foreground mt-1">{t('originalPriceHelper')}</p>
                )}
              </div>
            </div>

            {/* Kalkulator zniżki */}
            {discount > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {t('discount')}: {discount.toFixed(2)} PLN ({discountPercent}%)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linki */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {t('dealLink')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="link" className="flex items-center gap-2">
                {t('dealLink')} <span className="text-destructive">*</span>
              </Label>
              <Input 
                id="link" 
                type="url" 
                value={link} 
                onChange={(e) => setLink(e.target.value)} 
                placeholder={t('dealLinkPlaceholder')}
                required 
                disabled={isLoading}
                className={errors.link ? 'border-destructive' : ''}
              />
              {errors.link ? (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.link}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">{t('dealLinkHelper')}</p>
              )}
            </div>

            <div>
              <Label htmlFor="image" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
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
              {errors.image ? (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.image}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">{t('imageUrlHelper')}</p>
              )}
            </div>

            {/* Preview obrazka */}
            {imagePreviewUrl && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {t('imagePreview')}
                </p>
                {imageLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <img 
                    src={imagePreviewUrl} 
                    alt="Preview" 
                    className="max-h-48 mx-auto rounded-md object-contain"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kategorie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {t('mainCategory')}
            </CardTitle>
            <CardDescription>{t('categoryHelper')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mainCategory" className="text-sm">
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
                <Label htmlFor="subCategory" className="text-sm">
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
                <Label htmlFor="subSubCategory" className="text-sm">
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
              <div className="border rounded-md divide-y">
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
              <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('productSelected')}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {t('linkedProductId')}: {linkedProductId}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Przycisk Submit */}
        <Button 
          type="submit" 
          size="lg" 
          className="w-full" 
          disabled={isLoading || Object.keys(errors).length > 0}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            t('submit')
          )}
        </Button>

        {Object.keys(errors).length > 0 && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm text-destructive font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('errorMessage')}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
