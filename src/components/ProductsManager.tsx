import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, X, Package, Upload } from 'lucide-react';
import { productsApi, categoriesApi, uploadApi } from '@/lib/api';
import { prepareImage } from '@/lib/image';
import { formatCurrency, imageSrc } from '@/lib/format';
import type { Product, Category } from '@/types';

interface EditFormData {
  name: string;
  description: string;
  price: string;
  stock: string;
  image_url: string;
  category_id: string;
  is_active: boolean;
}

const emptyForm: EditFormData = {
  name: '',
  description: '',
  price: '',
  stock: '',
  image_url: '',
  category_id: '',
  is_active: true,
};

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodData, catData] = await Promise.all([
        productsApi.list(),
        categoriesApi.list(),
      ]);
      setProducts(prodData);
      setCategories(catData);
    } catch (err) {
      setError('Failed to load data');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAddForm = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setUploadError(null);
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingId(product.id);
    setUploadError(null);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      image_url: product.image_url || '',
      category_id: product.category_id || '',
      is_active: product.is_active,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.price) {
      setError('Name and price are required');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock) || 0,
      image_url: formData.image_url.trim() || null,
      category_id: formData.category_id || null,
      is_active: formData.is_active,
    };

    if (editingId) {
      try {
        await productsApi.update(editingId, payload);
      } catch (err) {
        setError((err as Error).message);
        setSaving(false);
        return;
      }
    } else {
      try {
        await productsApi.create(payload);
      } catch (err) {
        setError((err as Error).message);
        setSaving(false);
        return;
      }
    }

    setShowForm(false);
    setSaving(false);
    loadData();
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const blob = await prepareImage(file);
      const result = await uploadApi.image(blob, file.name);
      setFormData((prev) => ({ ...prev, image_url: result.url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      await productsApi.remove(id);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    loadData();
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return 'Uncategorized';
    return categories.find((c) => c.id === id)?.name || 'Uncategorized';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Products</h2>
          <p className="text-stone-500 text-sm">{products.length} items in your bakery</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-stone-900 font-medium px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="flex gap-4 p-4">
              <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden shrink-0">
                {product.image_url ? (
                  <img
                    src={imageSrc(product.image_url)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-stone-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-stone-900 truncate">{product.name}</h3>
                  {!product.is_active && (
                    <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded">Hidden</span>
                  )}
                </div>
                <p className="text-xs text-stone-400 mb-2">{getCategoryName(product.category_id)}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-amber-600 font-bold">{formatCurrency(product.price)}</span>
                    <span className="text-xs text-stone-400 ml-2">
                      {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex border-t border-stone-100">
              <button
                onClick={() => openEditForm(product)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <div className="w-px bg-stone-100" />
              <button
                onClick={() => handleDelete(product.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-stone-400">
          <Package className="w-12 h-12 mb-3" />
          <p>No products found</p>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">
                {editingId ? 'Edit Product' : 'Add Product'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Sourdough Loaf"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Brief product description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Price (PHP) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Product image</label>
                <div className="flex gap-3 items-start">
                  <div className="w-24 h-24 rounded-lg bg-stone-100 overflow-hidden shrink-0 flex items-center justify-center border border-stone-200">
                    {formData.image_url ? (
                      <img
                        key={formData.image_url}
                        src={imageSrc(formData.image_url)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Package className="w-8 h-8 text-stone-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <label
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-medium cursor-pointer hover:bg-stone-800 transition-colors ${
                        uploading ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      {uploading ? 'Uploading...' : 'Upload photo'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                    </label>
                    {formData.image_url && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
                        className="ml-2 text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                    <input
                      type="text"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="...or paste an image URL (https://...)"
                    />
                  </div>
                </div>
                {uploadError && (
                  <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{uploadError}</p>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded accent-amber-500"
                />
                <span className="text-sm text-stone-700">Available for sale</span>
              </label>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
