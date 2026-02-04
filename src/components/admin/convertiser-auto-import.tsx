'use client';

import { useState } from 'react';
import { Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Convertiser Auto Import All Component
 * 
 * Automatically imports ALL products from Convertiser catalog without keywords.
 * Uses auto-browse mode to paginate through entire catalog (21k+ items).
 * 
 * Features:
 * - One-click full catalog import
 * - Real-time progress tracking
 * - Automatic batch AI categorization
 * - Automatic enrichment via Deal-Refiner
 * - Configurable max results (default: 10000)
 */
export default function ConvertiserAutoImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{
    jobId?: string;
    productsFound?: number;
    productsCreated?: number;
    dealsCreated?: number;
    status?: string;
    error?: string;
  }>({});
  const [maxResults, setMaxResults] = useState(10000);
  const [convertiserMode, setConvertiserMode] = useState<'products' | 'offers'>('offers');

  const handleAutoImport = async () => {
    try {
      setIsImporting(true);
      setProgress({});

      // Start auto-browse harvester
      const response = await fetch('/api/admin/harvester/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'convertiser',
          query: '', // Empty query for auto-browse
          maxResults,
          convertiserMode,
          autoBrowse: true, // Enable auto-browse mode
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to start auto-import');
      }

      const jobId = data.job?.id;
      if (!jobId) {
        throw new Error('No job ID returned');
      }

      setProgress({ jobId, status: 'running' });

      // Poll for job status every 5 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/admin/harvester-jobs?jobId=${jobId}`);
          const statusData = await statusResponse.json();

          if (!statusData.success || !statusData.job) {
            clearInterval(pollInterval);
            setProgress(prev => ({ 
              ...prev, 
              status: 'failed', 
              error: 'Failed to fetch job status' 
            }));
            setIsImporting(false);
            return;
          }

          const job = statusData.job;
          setProgress({
            jobId,
            productsFound: job.productsFound || 0,
            productsCreated: job.productsCreated || 0,
            dealsCreated: job.dealsCreated || 0,
            status: job.status,
          });

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval);
            setIsImporting(false);
          }
        } catch (pollError) {
          console.error('Failed to poll job status:', pollError);
          clearInterval(pollInterval);
          setIsImporting(false);
        }
      }, 5000);

    } catch (error) {
      console.error('Auto-import error:', error);
      setProgress(prev => ({ 
        ...prev, 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md p-6 border-2 border-purple-300 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
          <Download className="text-white" size={24} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-2xl font-bold text-gray-900">
              🚀 Auto Import - Convertiser
            </h3>
            <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold">NOWE</span>
          </div>
          <p className="text-sm text-gray-600 mb-4 font-medium">
            ⚡ Pobierz WSZYSTKIE produkty z katalogu Convertiser (21k+ items) BEZ podawania słów kluczowych.
            <br/>
            System automatycznie: paginuje katalog → deduplikuje → kategoryzuje AI → wzbogaca opisy
          </p>

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Results
              </label>
              <input
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value) || 10000)}
                min={100}
                max={50000}
                step={1000}
                disabled={isImporting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maksymalna liczba produktów do pobrania
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mode
              </label>
              <select
                value={convertiserMode}
                onChange={(e) => setConvertiserMode(e.target.value as 'products' | 'offers')}
                disabled={isImporting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="offers">Offers (Recommended - tracking links)</option>
                <option value="products">Products</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Offers mode generuje linki trackingowe
              </p>
            </div>
          </div>

          {/* Progress Display */}
          {progress.status && (
            <div className="mb-4 p-4 bg-white rounded-lg border-2 border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                {progress.status === 'running' && (
                  <>
                    <Loader2 className="animate-spin text-purple-600" size={20} />
                    <span className="font-semibold text-gray-900">⏳ Import w toku (możesz zamknąć tę kartę)...</span>
                  </>
                )}
                {progress.status === 'completed' && (
                  <>
                    <CheckCircle className="text-green-600" size={20} />
                    <span className="font-semibold text-green-900">✅ Import zakończony!</span>
                  </>
                )}
                {progress.status === 'failed' && (
                  <>
                    <AlertCircle className="text-red-600" size={20} />
                    <span className="font-semibold text-red-900">❌ Import nie powiódł się</span>
                  </>
                )}
              </div>

              {progress.jobId && (
                <div className="text-xs text-gray-500 mb-3">
                  Job ID: {progress.jobId}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-blue-50 rounded p-2">
                  <div className="text-blue-600 font-medium">Znaleziono</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {progress.productsFound || 0}
                  </div>
                </div>
                <div className="bg-green-50 rounded p-2">
                  <div className="text-green-600 font-medium">Produkty</div>
                  <div className="text-2xl font-bold text-green-900">
                    {progress.productsCreated || 0}
                  </div>
                </div>
                <div className="bg-purple-50 rounded p-2">
                  <div className="text-purple-600 font-medium">Oferty</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {progress.dealsCreated || 0}
                  </div>
                </div>
              </div>

              {progress.error && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {progress.error}
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleAutoImport}
            disabled={isImporting}
            className={`
              w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium
              transition-colors
              ${isImporting 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800'
              }
            `}
          >
            {isImporting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Importowanie...
              </>
            ) : (
              <>
                <Download size={20} />
                Uruchom Auto Import
              </>
            )}
          </button>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <div className="font-semibold mb-2">📋 Jak to działa:</div>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Paginacja:</strong> Pobiera całą katalog Convertiser (100 items/strona) aż do limitu</li>
              <li><strong>Deduplikacja:</strong> Automatycznie unika duplikatów za pomocą identity matching</li>
              <li><strong>AI Kategoryzacja:</strong> Batch processing przypisuje produkty do kategorii</li>
              <li><strong>Wzbogacanie:</strong> Deal-Refiner dodaje opisy i normalizuje specs</li>
              <li><strong>Asynchroniczne:</strong> Wszystko w tle - możesz zamknąć przeglądarkę!</li>
            </ul>
            <div className="mt-2 pt-2 border-t border-blue-200">
              Tracking links: <strong>Generowane automatycznie</strong> dla każdej oferty (mode: Offers)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
