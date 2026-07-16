'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Play, AlertCircle, ShoppingBag } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AliExpressCampaignsPanel({ authToken }: { authToken: string | null }) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchCampaigns = async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/importer/campaigns', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wystąpił błąd');
      setCampaigns(data.promos || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [authToken]);

  const handleImport = async (campaignName: string) => {
    if (!authToken) return;
    setImportingId(campaignName);
    setSuccessMsg('');
    setError('');
    
    try {
      const res = await fetch('/api/admin/harvester/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          source: 'campaigns',
          query: campaignName,
          maxResults: 50,
          categories: []
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd uruchamiania');
      setSuccessMsg(`Zadanie importu wyprzedaży ${campaignName} zostało dodane (Job ID: ${data.jobId})`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Wyprzedaże i Kampanie AliExpress
            </CardTitle>
            <CardDescription>
              Importuj wybrane produkty z najpopularniejszych, aktualnych wyprzedaży
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Odśwież Listę
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {successMsg && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950/50">
            <AlertDescription className="text-green-700 dark:text-green-300">
              {successMsg}
            </AlertDescription>
          </Alert>
        )}

        {loading && campaigns.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
            Pobieranie aktywnych kampanii z AliExpress...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-md">
            Brak aktywnych kampanii lub błąd API.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((promo) => (
              <div key={promo.promo_name} className="flex flex-col p-4 border rounded-lg hover:border-primary/50 transition-colors bg-card">
                <h3 className="font-medium text-sm truncate" title={promo.promo_name}>
                  {promo.promo_name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Ilość promowanych produktów: {promo.product_num}
                </p>
                <div className="mt-auto pt-2 border-t flex justify-between items-center">
                  <Badge variant="secondary" className="text-[10px]">
                    Campaign
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="default"
                    className="h-8 text-xs"
                    disabled={importingId === promo.promo_name}
                    onClick={() => handleImport(promo.promo_name)}
                  >
                    {importingId === promo.promo_name ? (
                      <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Play className="h-3 w-3 mr-1" />
                    )}
                    Importuj (Top 50)
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
