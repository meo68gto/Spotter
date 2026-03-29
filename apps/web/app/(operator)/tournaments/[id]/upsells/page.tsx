'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpsellProduct {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: 'food' | 'activity' | 'merchandise' | 'game';
  maxQuantity?: number;
  available: number; // remaining inventory
  isActive: boolean;
  sortOrder: number;
}

interface Purchase {
  id: string;
  registrationId: string;
  playerName: string;
  playerEmail: string;
  productId: string;
  quantity: number;
  totalCents: number;
  purchasedAt: string;
}

interface RegistrationWithPurchases {
  id: string;
  playerName: string;
  playerEmail: string;
  status: string;
  purchases: Purchase[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PRODUCTS: UpsellProduct[] = [
  {
    id: 'up-1',
    name: 'Gourmet Lunch Buffet',
    description: 'Includes grilled chicken, salad bar, dessert, and non-alcoholic beverages',
    priceCents: 2500,
    category: 'food',
    maxQuantity: 120,
    available: 34,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'up-2',
    name: 'Closest-to-Pin Contest Entry',
    description: 'One entry into the closest-to-pin contest on all par-3 holes. Prizes for top 3.',
    priceCents: 1000,
    category: 'game',
    maxQuantity: undefined,
    available: 999,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'up-3',
    name: 'Long Drive Contest Entry',
    description: 'One entry into the long drive competition on Hole 7. Winner takes a $200 pro shop gift card.',
    priceCents: 1000,
    category: 'game',
    maxQuantity: undefined,
    available: 999,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'up-4',
    name: 'Mulligan Pack (3 for 1)',
    description: 'One pack of 3 mulligans. Use on any hole. Cannot be used for tournament-winning shots.',
    priceCents: 1500,
    category: 'game',
    maxQuantity: undefined,
    available: 999,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'up-5',
    name: 'Event Polo Shirt',
    description: 'Spotter Spring Championship branded performance polo. Sizes S–3XL. Pick up at check-in.',
    priceCents: 4500,
    category: 'merchandise',
    maxQuantity: 100,
    available: 23,
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'up-6',
    name: 'Sleek Spotter Cap',
    description: 'Limited edition tournament cap with embroidered event logo.',
    priceCents: 2000,
    category: 'merchandise',
    maxQuantity: 150,
    available: 67,
    isActive: true,
    sortOrder: 6,
  },
  {
    id: 'up-7',
    name: 'Premium Golf Towel Set',
    description: 'High-quality microfiber towel with embroidered logo. Includes ball marker.',
    priceCents: 1800,
    category: 'merchandise',
    maxQuantity: 80,
    available: 41,
    isActive: true,
    sortOrder: 7,
  },
  {
    id: 'up-8',
    name: 'Happy Hour Drink Tickets (4)',
    description: 'Post-round drinks at the clubhouse. Beer, wine, or soft drinks. 21+ only.',
    priceCents: 2000,
    category: 'food',
    maxQuantity: undefined,
    available: 999,
    isActive: true,
    sortOrder: 8,
  },
];

const MOCK_PURCHASES: Purchase[] = [
  { id: 'pur-1', registrationId: 'reg-1', playerName: 'Alice Johnson', playerEmail: 'alice@example.com', productId: 'up-1', quantity: 1, totalCents: 2500, purchasedAt: '2024-03-01T10:30:00Z' },
  { id: 'pur-2', registrationId: 'reg-1', playerName: 'Alice Johnson', playerEmail: 'alice@example.com', productId: 'up-2', quantity: 1, totalCents: 1000, purchasedAt: '2024-03-01T10:30:00Z' },
  { id: 'pur-3', registrationId: 'reg-1', playerName: 'Alice Johnson', playerEmail: 'alice@example.com', productId: 'up-5', quantity: 1, totalCents: 4500, purchasedAt: '2024-03-01T10:30:00Z' },
  { id: 'pur-4', registrationId: 'reg-2', playerName: 'Bob Smith', playerEmail: 'bob@example.com', productId: 'up-1', quantity: 1, totalCents: 2500, purchasedAt: '2024-03-02T14:15:00Z' },
  { id: 'pur-5', registrationId: 'reg-2', playerName: 'Bob Smith', playerEmail: 'bob@example.com', productId: 'up-4', quantity: 2, totalCents: 3000, purchasedAt: '2024-03-02T14:15:00Z' },
  { id: 'pur-6', registrationId: 'reg-3', playerName: 'Carol Davis', playerEmail: 'carol@example.com', productId: 'up-5', quantity: 2, totalCents: 9000, purchasedAt: '2024-03-03T09:00:00Z' },
  { id: 'pur-7', registrationId: 'reg-4', playerName: 'David Lee', playerEmail: 'david@example.com', productId: 'up-6', quantity: 1, totalCents: 2000, purchasedAt: '2024-03-03T11:20:00Z' },
  { id: 'pur-8', registrationId: 'reg-5', playerName: 'Eve Martinez', playerEmail: 'eve@example.com', productId: 'up-1', quantity: 1, totalCents: 2500, purchasedAt: '2024-03-04T08:45:00Z' },
  { id: 'pur-9', registrationId: 'reg-5', playerName: 'Eve Martinez', playerEmail: 'eve@example.com', productId: 'up-7', quantity: 1, totalCents: 1800, purchasedAt: '2024-03-04T08:45:00Z' },
  { id: 'pur-10', registrationId: 'reg-6', playerName: 'Frank Wilson', playerEmail: 'frank@example.com', productId: 'up-8', quantity: 1, totalCents: 2000, purchasedAt: '2024-03-05T16:30:00Z' },
  { id: 'pur-11', registrationId: 'reg-7', playerName: 'Grace Chen', playerEmail: 'grace@example.com', productId: 'up-2', quantity: 1, totalCents: 1000, purchasedAt: '2024-03-05T17:00:00Z' },
  { id: 'pur-12', registrationId: 'reg-7', playerName: 'Grace Chen', playerEmail: 'grace@example.com', productId: 'up-3', quantity: 1, totalCents: 1000, purchasedAt: '2024-03-05T17:00:00Z' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

const CATEGORY_ICONS: Record<UpsellProduct['category'], { bg: string; color: string; icon: string }> = {
  food:        { bg: 'bg-orange-100',  color: 'text-orange-700', icon: '🍽️' },
  activity:   { bg: 'bg-purple-100', color: 'text-purple-700', icon: '🎯' },
  merchandise: { bg: 'bg-indigo-100', color: 'text-indigo-700', icon: '👕' },
  game:       { bg: 'bg-green-100',  color: 'text-green-700',  icon: '⛳' },
};

// ---------------------------------------------------------------------------
// Add/Edit Product Modal
// ---------------------------------------------------------------------------

interface ProductModalProps {
  isOpen: boolean;
  product?: UpsellProduct;
  onClose: () => void;
  onSave: (data: Omit<UpsellProduct, 'id'>) => void;
}

function ProductModal({ isOpen, product, onClose, onSave }: ProductModalProps) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [priceCents, setPriceCents] = useState(
    product ? (product.priceCents / 100).toFixed(2) : '',
  );
  const [category, setCategory] = useState<UpsellProduct['category']>(product?.category ?? 'game');
  const [maxQuantity, setMaxQuantity] = useState(product?.maxQuantity?.toString() ?? '');
  const [available, setAvailable] = useState(product?.available?.toString() ?? '');
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !priceCents) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      priceCents: Math.round(parseFloat(priceCents) * 100),
      category,
      maxQuantity: maxQuantity ? parseInt(maxQuantity) : undefined,
      available: available ? parseInt(available) : 999,
      isActive,
      sortOrder: product?.sortOrder ?? 99,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{product ? 'Edit Add-On' : 'New Add-On Product'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Product Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Lunch Buffet, Closest-to-Pin Entry" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="What's included..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price (USD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" required value={priceCents}
                  onChange={(e) => setPriceCents(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="25.00" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as UpsellProduct['category'])}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="food">Food & Beverage</option>
                <option value="game">Contest / Game</option>
                <option value="merchandise">Merchandise</option>
                <option value="activity">Activity / Experience</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Quantity</label>
              <input type="number" min="1" value={maxQuantity}
                onChange={(e) => setMaxQuantity(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Unlimited if blank" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Available Inventory</label>
              <input type="number" min="0" value={available}
                onChange={(e) => setAvailable(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="999 for unlimited" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-700">{isActive ? 'Active — shown at registration' : 'Inactive — hidden'}</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              {product ? 'Save Changes' : 'Create Add-On'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue Tab
// ---------------------------------------------------------------------------

function RevenueSummary({ products, purchases }: { products: UpsellProduct[]; purchases: Purchase[] }) {
  const totalRevenue = purchases.reduce((s, p) => s + p.totalCents, 0);
  const totalUnits = purchases.reduce((s, p) => s + p.quantity, 0);

  const byProduct = products.map((product) => {
    const productPurchases = purchases.filter((p) => p.productId === product.id);
    const units = productPurchases.reduce((s, p) => s + p.quantity, 0);
    const revenue = productPurchases.reduce((s, p) => s + p.totalCents, 0);
    const buyers = new Set(productPurchases.map((p) => p.registrationId)).size;
    return { ...product, units, revenue, buyers };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalPotential = byProduct.reduce((s, p) => s + (p.maxQuantity ?? 999) * p.priceCents, 0);
  const sellThrough = totalPotential > 0 ? Math.round((totalRevenue / totalPotential) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-4 text-white">
          <p className="text-xs text-indigo-200 font-medium">Total Revenue</p>
          <p className="text-2xl font-bold mt-1">{fmtCents(totalRevenue)}</p>
          <p className="text-xs text-indigo-200 mt-1">{totalUnits} units sold</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Avg. Per Player</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmtCents(purchases.length > 0 ? totalRevenue / new Set(purchases.map((p) => p.registrationId)).size : 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">across {new Set(purchases.map((p) => p.registrationId)).size} players</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Sell-Through</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{sellThrough}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {byProduct.filter((p) => p.units > 0).length} products with sales
          </p>
        </div>
      </div>

      {/* Revenue by product */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Revenue by Add-On</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {byProduct.map((product) => {
            const cat = CATEGORY_ICONS[product.category];
            const pct = totalRevenue > 0 ? Math.round((product.revenue / totalRevenue) * 100) : 0;
            return (
              <div key={product.id} className="px-5 py-3 flex items-center gap-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${cat.bg}`}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                    <p className="text-sm font-bold text-gray-900">{fmtCents(product.revenue)}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-20">{product.units} sold · {product.buyers} buyers</span>
                    <span className="text-xs text-gray-400">{fmtCents(product.priceCents)} ea.</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Purchases Tab (who bought what)
// ---------------------------------------------------------------------------

function PurchasesTab({ products, purchases }: { products: UpsellProduct[]; purchases: Purchase[] }) {
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const [search, setSearch] = useState('');

  const filtered = purchases.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.playerName.toLowerCase().includes(q) ||
      p.playerEmail.toLowerCase().includes(q) ||
      productMap[p.productId]?.name.toLowerCase().includes(q)
    );
  });

  // Group by player
  const byPlayer = filtered.reduce<Record<string, Purchase[]>>((acc, p) => {
    const key = `${p.registrationId}|${p.playerName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="search" placeholder="Search by player or add-on..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {Object.keys(byPlayer).length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500 font-medium">No purchases found</p>
        </div>
      ) : (
        Object.entries(byPlayer).map(([key, ps]) => {
          const [, playerName] = key.split('|');
          const playerEmail = ps[0].playerEmail;
          const total = ps.reduce((s, p) => s + p.totalCents, 0);
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-700">{playerName.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{playerName}</p>
                    <p className="text-xs text-gray-500">{playerEmail}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-700">{fmtCents(total)}</p>
                  <p className="text-xs text-gray-500">{ps.reduce((s, p) => s + p.quantity, 0)} items</p>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {ps.map((purchase) => {
                  const product = productMap[purchase.productId];
                  if (!product) return null;
                  return (
                    <div key={purchase.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{CATEGORY_ICONS[product.category].icon}</span>
                        <span className="text-sm text-gray-700">{product.name}</span>
                        {purchase.quantity > 1 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">×{purchase.quantity}</span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{fmtCents(purchase.totalCents)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type Tab = 'products' | 'purchases';

export default function UpsellsPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [products, setProducts] = useState<UpsellProduct[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('products');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<UpsellProduct | undefined>(undefined);
  const [search, setSearch] = useState('');

  const fetchUpsells = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/operator/tournaments/${tournamentId}/upsells`);
    if (res.ok) {
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
      setPurchases([]); // purchases nested in product data if needed
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { fetchUpsells(); }, [fetchUpsells]);

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
  });

  const handleSave = async (data: Omit<UpsellProduct, 'id'>) => {
    if (editingProduct) {
      // Not implemented — upsells update via product re-fetch
      setEditingProduct(undefined);
    } else {
      const res = await fetch(`/api/operator/tournaments/${tournamentId}/upsells`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) fetchUpsells();
      setEditingProduct(undefined);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-500">Loading upsells…</span>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    if (confirm('Deactivate this add-on? It will be hidden from registration.')) {
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, isActive: false } : p));
    }
  };

  const totalRevenue = purchases.reduce((s, p) => s + p.totalCents, 0);
  const totalUnits = purchases.reduce((s, p) => s + p.quantity, 0);

  return (
    <div className="space-y-6 p-6 min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/tournaments" className="hover:text-gray-700">Tournaments</Link>
        <span>/</span>
        <Link href={`/tournaments/${tournamentId}/fulfillment`} className="hover:text-gray-700">Fulfillment</Link>
        <span>/</span>
        <span className="text-gray-900">Upsells</span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registration Upsells</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Add-on products and contests sold during registration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right bg-white border border-gray-200 rounded-lg px-4 py-2">
            <p className="text-xs text-gray-500">Total Revenue</p>
            <p className="text-lg font-bold text-indigo-700">{fmtCents(totalRevenue)}</p>
          </div>
          <button
            onClick={() => { setEditingProduct(undefined); setShowModal(true); }}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Add-On
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-1 inline-flex">
        {([['products', 'Add-On Products'], ['purchases', 'Purchases']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'products' ? (
        <div className="space-y-4">
          {/* Quick search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="search" placeholder="Search add-ons..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Product cards */}
          {filteredProducts.filter((p) => p.isActive).length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
              <p className="text-gray-500 font-medium">No add-ons yet</p>
              <button onClick={() => setShowModal(true)} className="mt-3 text-indigo-600 text-sm font-medium hover:underline">
                + Create your first add-on
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProducts.filter((p) => p.isActive).map((product) => {
                const cat = CATEGORY_ICONS[product.category];
                const units = purchases.filter((p) => p.productId === product.id).reduce((s, p) => s + p.quantity, 0);
                const revenue = purchases.filter((p) => p.productId === product.id).reduce((s, p) => s + p.totalCents, 0);
                const buyers = new Set(purchases.filter((p) => p.productId === product.id).map((p) => p.registrationId)).size;

                return (
                  <div key={product.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${cat.bg}`}>
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{product.name}</h3>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900">{fmtCents(product.priceCents)}</p>
                            {product.maxQuantity && (
                              <p className="text-xs text-gray-500">{product.available} left</p>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 mt-3">
                          <div className="text-center">
                            <p className="text-sm font-bold text-gray-900">{units}</p>
                            <p className="text-xs text-gray-500">Sold</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-gray-900">{buyers}</p>
                            <p className="text-xs text-gray-500">Buyers</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-indigo-700">{fmtCents(revenue)}</p>
                            <p className="text-xs text-gray-500">Revenue</p>
                          </div>
                          {product.maxQuantity && (
                            <div className="flex-1 flex items-center gap-1.5">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${product.available === 0 ? 'bg-red-500' : 'bg-indigo-500'}`}
                                  style={{ width: `${Math.min(((product.maxQuantity - product.available) / product.maxQuantity) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{Math.round(((product.maxQuantity - product.available) / product.maxQuantity) * 100)}%</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => { setEditingProduct(product); setShowModal(true); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inactive products */}
          {products.filter((p) => !p.isActive).length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500 mb-2">{products.filter((p) => !p.isActive).length} inactive add-ons (hidden from registration)</p>
            </div>
          )}
        </div>
      ) : (
        <RevenueSummary products={products} purchases={purchases} />
      )}

      {/* Purchases detail below revenue summary when on revenue tab */}
      {tab === 'purchases' && (
        <div className="pt-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">All Purchases</h3>
          <PurchasesTab products={products} purchases={purchases} />
        </div>
      )}

      <ProductModal
        isOpen={showModal}
        product={editingProduct}
        onClose={() => { setShowModal(false); setEditingProduct(undefined); }}
        onSave={handleSave}
      />
    </div>
  );
}
