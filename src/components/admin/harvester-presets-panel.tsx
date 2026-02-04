'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Edit2, Trash2, Clock, TrendingUp, Package } from 'lucide-react';

interface HarvesterPreset {
  id: string;
  name: string;
  source: 'convertiser' | 'aliexpress' | 'amazon' | 'allegro';
  keywords: string[];
  convertiserMode?: 'products' | 'offers';
  maxResultsPerKeyword: number;
  schedule?: {
    enabled: boolean;
    cron?: string;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: string | null;
  totalRuns: number;
  stats?: {
    totalProducts: number;
    totalDeals: number;
    lastRunStatus: string | null;
  };
}

export default function HarvesterPresetsPanel() {
  const [presets, setPresets] = useState<HarvesterPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<HarvesterPreset | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    source: 'convertiser' as 'convertiser' | 'aliexpress' | 'amazon' | 'allegro',
    keywords: '',
    convertiserMode: 'products' as 'products' | 'offers',
    maxResultsPerKeyword: 50,
    active: true,
  });

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/harvester/presets');
      const data = await response.json();
      if (data.success) {
        setPresets(data.presets);
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const keywords = formData.keywords.split('\n').map(k => k.trim()).filter(Boolean);
      
      const response = await fetch('/api/admin/harvester/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          keywords,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPresets([data.preset, ...presets]);
        setShowCreateModal(false);
        resetForm();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to create preset:', error);
      alert('Failed to create preset');
    }
  };

  const handleUpdate = async () => {
    if (!editingPreset) return;

    try {
      const keywords = formData.keywords.split('\n').map(k => k.trim()).filter(Boolean);
      
      const response = await fetch(`/api/admin/harvester/presets/${editingPreset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          keywords,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPresets(presets.map(p => p.id === editingPreset.id ? data.preset : p));
        setEditingPreset(null);
        resetForm();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to update preset:', error);
      alert('Failed to update preset');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten preset?')) return;

    try {
      const response = await fetch(`/api/admin/harvester/presets/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        setPresets(presets.filter(p => p.id !== id));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to delete preset:', error);
      alert('Failed to delete preset');
    }
  };

  const handleRun = async (id: string, presetName: string) => {
    if (!confirm(`Uruchomić harvester dla presetu "${presetName}"?`)) return;

    try {
      const response = await fetch(`/api/admin/harvester/presets/${id}/run`, {
        method: 'POST',
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Uruchomiono ${data.jobIds.length} zadań harvestera!\n\nBatch ID: ${data.batchJobId}\n\nSprawdź status w zakładce "Jobs".`);
        fetchPresets(); // Refresh to update lastRun
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to run preset:', error);
      alert('Failed to run preset');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (preset: HarvesterPreset) => {
    setFormData({
      name: preset.name,
      source: preset.source,
      keywords: preset.keywords.join('\n'),
      convertiserMode: preset.convertiserMode || 'products',
      maxResultsPerKeyword: preset.maxResultsPerKeyword,
      active: preset.active,
    });
    setEditingPreset(preset);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      source: 'convertiser',
      keywords: '',
      convertiserMode: 'products',
      maxResultsPerKeyword: 50,
      active: true,
    });
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      convertiser: 'bg-purple-100 text-purple-800',
      aliexpress: 'bg-red-100 text-red-800',
      amazon: 'bg-orange-100 text-orange-800',
      allegro: 'bg-green-100 text-green-800',
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="p-6">Ładowanie presetów...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presety Harvestera</h1>
          <p className="text-sm text-gray-600 mt-1">
            Zarządzaj listami keywords dla automatycznego importu produktów
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Nowy Preset
        </button>
      </div>

      {presets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Brak presetów</h3>
          <p className="text-gray-600 mb-6">Utwórz pierwszy preset z listą keywords do automatycznego importu</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Utwórz Preset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map(preset => (
            <div key={preset.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-4 border-b">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{preset.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSourceBadge(preset.source)}`}>
                        {preset.source}
                      </span>
                      {preset.source === 'convertiser' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {preset.convertiserMode === 'offers' ? 'Offers' : 'Products'}
                        </span>
                      )}
                      {!preset.active && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Nieaktywny
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <Package size={14} />
                    <span>{preset.keywords.length} keywords</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} />
                    <span>{preset.maxResultsPerKeyword} max/keyword</span>
                  </div>
                  {preset.lastRun && (
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      <span className="text-xs">
                        Ostatni: {new Date(preset.lastRun).toLocaleDateString('pl-PL')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {preset.stats && (
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Produkty</div>
                      <div className="font-semibold text-gray-900">{preset.stats.totalProducts}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Oferty</div>
                      <div className="font-semibold text-gray-900">{preset.stats.totalDeals}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 flex gap-2">
                <button
                  onClick={() => handleRun(preset.id, preset.name)}
                  disabled={!preset.active}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                >
                  <Play size={16} />
                  Uruchom
                </button>
                <button
                  onClick={() => openEditModal(preset)}
                  className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  title="Edytuj"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(preset.id)}
                  className="px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
                  title="Usuń"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingPreset) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingPreset ? 'Edytuj Preset' : 'Nowy Preset'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nazwa Presetu
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="np. Elektronika - Telefony"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Źródło
                </label>
                <select
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="convertiser">Convertiser</option>
                  <option value="aliexpress">AliExpress</option>
                  <option value="amazon">Amazon</option>
                  <option value="allegro">Allegro</option>
                </select>
              </div>

              {formData.source === 'convertiser' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Convertiser Mode
                  </label>
                  <select
                    value={formData.convertiserMode}
                    onChange={e => setFormData({ ...formData, convertiserMode: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="products">Products (Produkty)</option>
                    <option value="offers">Offers (Oferty z tracking)</option>
                  </select>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.convertiserMode === 'offers' 
                      ? 'Pobiera oferty sprzedawców z automatycznymi linkami śledzącymi (affiliate)'
                      : 'Pobiera produkty z wieloma ofertami (porównanie cen)'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords (jeden na linię)
                </label>
                <textarea
                  value={formData.keywords}
                  onChange={e => setFormData({ ...formData, keywords: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  rows={8}
                  placeholder="iPhone 15&#10;Samsung Galaxy S24&#10;laptop gaming&#10;..."
                />
                <p className="text-xs text-gray-600 mt-1">
                  {formData.keywords.split('\n').filter(Boolean).length} keywords
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max wyników na keyword
                </label>
                <input
                  type="number"
                  value={formData.maxResultsPerKeyword}
                  onChange={e => setFormData({ ...formData, maxResultsPerKeyword: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="10"
                  max="200"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={e => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-700">
                  Aktywny (można uruchamiać)
                </label>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingPreset(null);
                  resetForm();
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                onClick={editingPreset ? handleUpdate : handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingPreset ? 'Zapisz' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
