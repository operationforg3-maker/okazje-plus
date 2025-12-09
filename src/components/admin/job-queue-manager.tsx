'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

type JobType = 'import_aliexpress' | 'import_allegro' | 'import_amazon' | 'import_ebay' | 'verify_links' | 'cleanup_products' | 'repair_indexes';

const JOB_TYPE_LABELS: Record<JobType, string> = {
  import_aliexpress: 'Import z AliExpress',
  import_allegro: 'Import z Allegro',
  import_amazon: 'Import z Amazon',
  import_ebay: 'Import z eBay',
  verify_links: 'Weryfikacja linków',
  cleanup_products: 'Czyszczenie produktów',
  repair_indexes: 'Naprawa indeksów',
};

const JOB_TYPE_DESCRIPTIONS: Record<JobType, string> = {
  import_aliexpress: 'Importuj produkty z AliExpress bazując na kategoriach',
  import_allegro: 'Importuj produkty z Allegro bazując na kategoriach',
  import_amazon: 'Importuj produkty z Amazon bazując na kategoriach',
  import_ebay: 'Importuj produkty z eBay bazując na kategoriach',
  verify_links: 'Zweryfikuj status affiliate URLs',
  cleanup_products: 'Usuń nieaktywne/nieprawidłowe produkty',
  repair_indexes: 'Przebuduj indeksy Firestore i Typesense',
};

interface QueuedJob {
  id: string;
  type: JobType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  error?: string;
  payload?: Record<string, any>;
}

export function JobQueueManager() {
  const { getIdToken: getIdTokenFromContext } = useAuth();
  const [selectedJobType, setSelectedJobType] = useState<JobType>('import_aliexpress');
  const [mainCategory, setMainCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [subSubCategory, setSubSubCategory] = useState('');
  const [itemsPerCategory, setItemsPerCategory] = useState('50');
  const [loading, setLoading] = useState(false);
  const [queuedJobs, setQueuedJobs] = useState<QueuedJob[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const getToken = async () => {
    const token = await getIdTokenFromContext();
    if (!token) throw new Error('Brak tokenu - zaloguj się ponownie');
    return token;
  };

  const enqueueJob = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mainCategory || !subCategory || !subSubCategory) {
      toast.error('Wypełnij wszystkie pola kategorii');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/jobs/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: selectedJobType,
          payload: {
            mainCategory,
            subCategory,
            subSubCategory,
            itemsPerCategory: parseInt(itemsPerCategory) || 50,
            draftStatus: 'pending_ai',
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(`Błąd: ${error.error}`);
        return;
      }

      const data = await res.json();
      toast.success(`Job enqueued! ID: ${data.jobId}`);
      
      // Reset form
      setMainCategory('');
      setSubCategory('');
      setSubSubCategory('');
      setItemsPerCategory('50');

      // Refresh queue
      await fetchQueue();
    } catch (e: any) {
      toast.error(`Błąd: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async () => {
    setLoadingQueue(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/jobs/enqueue?limit=20&status=pending', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setQueuedJobs(data.jobs || []);
      }
    } catch (e: any) {
      toast.error(`Błąd: ${e.message}`);
    } finally {
      setLoadingQueue(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enqueue Job Form */}
      <Card>
        <CardHeader>
          <CardTitle>Enqueue Job</CardTitle>
          <CardDescription>
            Dodaj nowy job do kolejki. Job zostanie przetworzony przez cron processor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={enqueueJob} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Job Type Selection */}
              <div>
                <Label htmlFor="job-type">Job Type</Label>
                <Select 
                  value={selectedJobType}
                  onValueChange={(value) => setSelectedJobType(value as JobType)}
                >
                  <SelectTrigger id="job-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="import_aliexpress">{JOB_TYPE_LABELS.import_aliexpress}</SelectItem>
                    <SelectItem value="import_allegro">{JOB_TYPE_LABELS.import_allegro}</SelectItem>
                    <SelectItem value="import_amazon">{JOB_TYPE_LABELS.import_amazon}</SelectItem>
                    <SelectItem value="import_ebay">{JOB_TYPE_LABELS.import_ebay}</SelectItem>
                    <SelectItem value="verify_links">{JOB_TYPE_LABELS.verify_links}</SelectItem>
                    <SelectItem value="cleanup_products">{JOB_TYPE_LABELS.cleanup_products}</SelectItem>
                    <SelectItem value="repair_indexes">{JOB_TYPE_LABELS.repair_indexes}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {JOB_TYPE_DESCRIPTIONS[selectedJobType]}
                </p>
              </div>

              {/* Items Per Category */}
              <div>
                <Label htmlFor="items-per-category">Produkty na kategorię</Label>
                <Input
                  id="items-per-category"
                  type="number"
                  min="1"
                  max="500"
                  value={itemsPerCategory}
                  onChange={(e) => setItemsPerCategory(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>

            {/* Category Selection */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="main-cat">Main Category</Label>
                <Input
                  id="main-cat"
                  placeholder="np. elektronika"
                  value={mainCategory}
                  onChange={(e) => setMainCategory(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="sub-cat">Sub Category</Label>
                <Input
                  id="sub-cat"
                  placeholder="np. telefony"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="sub-sub-cat">Sub Sub Category</Label>
                <Input
                  id="sub-sub-cat"
                  placeholder="np. smartfony"
                  value={subSubCategory}
                  onChange={(e) => setSubSubCategory(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Dodawanie...
                  </>
                ) : (
                  'Enqueue Job'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  fetchQueue();
                  setShowQueue(!showQueue);
                }}
                disabled={loadingQueue}
              >
                {loadingQueue ? 'Ładowanie...' : showQueue ? 'Ukryj kolejkę' : 'Pokaż kolejkę'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Job Queue */}
      {showQueue && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Jobs ({queuedJobs.length})</CardTitle>
            <CardDescription>
              Ostatnie pending jobs. Będą przetworzone przez cron processor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingQueue ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : queuedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Brak pending jobs</p>
            ) : (
              <div className="space-y-2">
                {queuedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm">{job.id}</p>
                        <Badge variant="outline">{JOB_TYPE_LABELS[job.type]}</Badge>
                      </div>
                      {job.payload && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {job.payload.mainCategory}/{job.payload.subCategory}/{job.payload.subSubCategory}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'pending' && (
                        <Clock className="h-4 w-4 text-amber-500" />
                      )}
                      {job.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {job.status === 'failed' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant="secondary">{job.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
