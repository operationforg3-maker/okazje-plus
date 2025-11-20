'use client';

import { useEffect, useState } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Settings
} from 'lucide-react';
import { getEnabledMarketplaces, getMarketplaceMappings, createCategoryMapping } from '@/lib/multi-marketplace';
import { Marketplace, CategoryMapping } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function CategoryMappingsPage() {
  const { toast } = useToast();
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [platformCategories, setPlatformCategories] = useState<any[]>([]);
  
  // New mapping form state
  const [newMapping, setNewMapping] = useState({
    mainSlug: '',
    subSlug: '',
    marketplaceId: '',
    marketplaceCategoryId: '',
    marketplaceCategoryName: '',
    confidence: 1.0,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const mps = await getEnabledMarketplaces();
        setMarketplaces(mps);
        if (mps.length > 0) {
          setSelectedMarketplace(mps[0].id);
          setNewMapping(prev => ({ ...prev, marketplaceId: mps[0].id }));
        }

        // Fetch platform categories
        const catsSnapshot = await getDocs(collection(db, 'categories'));
        const cats = catsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlatformCategories(cats);
      } catch (error) {
        console.error('Error fetching marketplaces:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const mps = await getEnabledMarketplaces();
        setMarketplaces(mps);
        if (mps.length > 0) {
          setSelectedMarketplace(mps[0].id);
        }
      } catch (error) {
        console.error('Error fetching marketplaces:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchMappings() {
      if (!selectedMarketplace) return;
      
      try {
        const data = await getMarketplaceMappings(selectedMarketplace);
        setMappings(data);
      } catch (error) {
        console.error('Error fetching mappings:', error);
      }
    }
    fetchMappings();
  }, [selectedMarketplace]);

  const handleAddMapping = async () => {
    if (!newMapping.mainSlug || !newMapping.marketplaceId || !newMapping.marketplaceCategoryId) {
      toast({
        title: 'Błąd',
        description: 'Wypełnij wszystkie wymagane pola',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createCategoryMapping(
        {
          mainSlug: newMapping.mainSlug,
          subSlug: newMapping.subSlug || undefined,
        },
        newMapping.marketplaceId,
        {
          id: newMapping.marketplaceCategoryId,
          name: newMapping.marketplaceCategoryName,
        },
        newMapping.confidence,
        false // not verified by default
      );

      toast({
        title: 'Sukces',
        description: 'Mapowanie zostało dodane',
      });

      // Refresh mappings
      const data = await getMarketplaceMappings(selectedMarketplace);
      setMappings(data);

      // Reset form and close dialog
      setNewMapping({
        mainSlug: '',
        subSlug: '',
        marketplaceId: selectedMarketplace,
        marketplaceCategoryId: '',
        marketplaceCategoryName: '',
        confidence: 1.0,
      });
      setShowAddDialog(false);
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const filteredMappings = mappings.filter((mapping) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      mapping.platformCategory.mainSlug.toLowerCase().includes(query) ||
      mapping.platformCategory.subSlug?.toLowerCase().includes(query) ||
      mapping.marketplaceCategory.name.toLowerCase().includes(query)
    );
  });

  const verifiedCount = mappings.filter((m) => m.verified).length;
  const unverifiedCount = mappings.length - verifiedCount;
  const avgConfidence =
    mappings.length > 0
      ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
      : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mapowanie Kategorii</h1>
          <p className="text-muted-foreground">
            Zarządzaj mapowaniem kategorii marketplace na kategorie platformy
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj mapowanie
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Dodaj nowe mapowanie</DialogTitle>
              <DialogDescription>
                Zmapuj kategorię marketplace na kategorię platformy
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="marketplace">Marketplace</Label>
                <Select
                  value={newMapping.marketplaceId}
                  onValueChange={(value) =>
                    setNewMapping({ ...newMapping, marketplaceId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz marketplace" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketplaces.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>
                        {mp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mainSlug">Kategoria główna (slug)</Label>
                <Select
                  value={newMapping.mainSlug}
                  onValueChange={(value) =>
                    setNewMapping({ ...newMapping, mainSlug: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię główną" />
                  </SelectTrigger>
                  <SelectContent>
                    {platformCategories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.slug}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="subSlug">Podkategoria (slug) - opcjonalne</Label>
                <Input
                  id="subSlug"
                  placeholder="np. smartfony"
                  value={newMapping.subSlug}
                  onChange={(e) =>
                    setNewMapping({ ...newMapping, subSlug: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="marketplaceCategoryId">ID kategorii marketplace</Label>
                <Input
                  id="marketplaceCategoryId"
                  placeholder="np. 123456"
                  value={newMapping.marketplaceCategoryId}
                  onChange={(e) =>
                    setNewMapping({
                      ...newMapping,
                      marketplaceCategoryId: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="marketplaceCategoryName">Nazwa kategorii marketplace</Label>
                <Input
                  id="marketplaceCategoryName"
                  placeholder="np. Electronics > Phones"
                  value={newMapping.marketplaceCategoryName}
                  onChange={(e) =>
                    setNewMapping({
                      ...newMapping,
                      marketplaceCategoryName: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confidence">Pewność (0-1)</Label>
                <Input
                  id="confidence"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={newMapping.confidence}
                  onChange={(e) =>
                    setNewMapping({
                      ...newMapping,
                      confidence: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Anuluj
              </Button>
              <Button onClick={handleAddMapping}>Dodaj</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wszystkie mapowania</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mappings.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zweryfikowane</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{verifiedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Do weryfikacji</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{unverifiedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Śr. pewność AI</CardTitle>
            <Sparkles className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgConfidence * 100).toFixed(0)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={selectedMarketplace} onValueChange={setSelectedMarketplace}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Wybierz marketplace" />
              </SelectTrigger>
              <SelectContent>
                {marketplaces.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>
                    {mp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1">
              <Input
                placeholder="Szukaj mapowania..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <Button variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              Auto-mapuj AI
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mappings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mapowania kategorii</CardTitle>
          <CardDescription>
            {selectedMarketplace
              ? `Mapowania dla ${marketplaces.find((m) => m.id === selectedMarketplace)?.name}`
              : 'Wybierz marketplace'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Ładowanie...
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Brak mapowań dla wybranego marketplace
              </p>
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Dodaj pierwsze mapowanie
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategoria platformy</TableHead>
                  <TableHead>Kategoria marketplace</TableHead>
                  <TableHead>Pewność</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data utworzenia</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div className="font-medium">
                        {mapping.platformCategory.mainSlug}
                      </div>
                      {mapping.platformCategory.subSlug && (
                        <div className="text-xs text-muted-foreground">
                          {mapping.platformCategory.subSlug}
                          {mapping.platformCategory.subSubSlug &&
                            ` → ${mapping.platformCategory.subSubSlug}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {mapping.marketplaceCategory.name}
                      </div>
                      {mapping.marketplaceCategory.path && (
                        <div className="text-xs text-muted-foreground">
                          {mapping.marketplaceCategory.path.join(' → ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${mapping.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs">
                          {(mapping.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {mapping.verified ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Zweryfikowane
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(mapping.createdAt).toLocaleDateString('pl-PL')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {!mapping.verified && (
                          <Button variant="outline" size="sm">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Zatwierdź
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          Edytuj
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Jak działa mapowanie kategorii?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • <strong>Automatyczne mapowanie AI:</strong> System używa AI do sugerowania mapowań na podstawie nazw i opisów kategorii
          </p>
          <p>
            • <strong>Weryfikacja manualna:</strong> Administratorzy mogą zatwierdzać lub korygować mapowania AI
          </p>
          <p>
            • <strong>Pewność:</strong> Im wyższa pewność (confidence), tym bardziej pewne jest mapowanie AI
          </p>
          <p>
            • <strong>Hierarchia:</strong> Mapowania uwzględniają pełną hierarchię kategorii (główna → pod → pod-pod)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(CategoryMappingsPage);
