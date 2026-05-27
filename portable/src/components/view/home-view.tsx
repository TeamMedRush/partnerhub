import {
  getCachedInventoryItem,
  loadCachedCatalog,
  loadCachedInventory,
  loadInventoryWorkspace,
  markInventoryUnavailable,
  normalizeApiError,
  saveInventoryDraft,
  type InventoryDraft,
  type PartnerProfileUpdateInput,
  type PartnerRegistrationInput,
} from "@api/app";
import { About } from "@components/block/about";
import { AppShell } from "@components/kit/app-shell";
import { StatePanel } from "@components/kit/state-panel";
import { useAuth } from "@contexts/auth-context";
import type {
  ApiError,
  InventoryItem,
  Product,
  User,
} from "@interfaces/app";
import {
  formatAddress,
  formatCurrency,
} from "@transformers/app";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

export interface PartnerRouteState {
  page:
    | "home"
    | "login"
    | "register"
    | "dashboard"
    | "inventory"
    | "inventory-new"
    | "inventory-detail"
    | "orders"
    | "profile"
    | "not-found";
  path: string;
  inventoryId?: string;
}

interface HomeViewProps {
  route: PartnerRouteState;
}

interface InventorySourceState {
  loading: boolean;
  saving: boolean;
  error: ApiError | null;
  inventory: InventoryItem[];
  catalog: Product[];
  refresh: () => Promise<void>;
  saveDraft: (draft: InventoryDraft) => Promise<InventoryItem | null>;
  markUnavailable: (item: InventoryItem) => Promise<void>;
}

function SectionHeader(
  { title, summary, actionLabel, actionHref, onAction }:
  {
    title: string;
    summary: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
  },
) {
  return (
    <div className="view-section__header">
      <div>
        <p className="view-section__eyebrow">MedRush Partner Flow</p>
        <h2>{title}</h2>
        <p>{summary}</p>
      </div>

      {actionLabel && actionHref ? (
        <a className="view-button view-button--secondary" href={actionHref}>
          {actionLabel}
        </a>
      ) : null}

      {actionLabel && onAction ? (
        <button
          className="view-button view-button--secondary"
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function useInventorySource(token: string | undefined): InventorySourceState {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadCachedInventory());
  const [catalog, setCatalog] = useState<Product[]>(() => loadCachedCatalog());

  const refresh = useCallback(async () => {
    if (!token) {
      setInventory([]);
      setCatalog(loadCachedCatalog());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const workspace = await loadInventoryWorkspace(token);
      setInventory(workspace.inventory);
      setCatalog(workspace.catalog);
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const saveDraft = useCallback(async (draft: InventoryDraft) => {
    if (!token) {
      return null;
    }

    setSaving(true);
    setError(null);

    try {
      const saved = await saveInventoryDraft(token, draft);
      setInventory((current) => {
        const next = current.filter((item) => item.id !== saved.id);
        next.push(saved);
        return next.sort((left, right) => left.name.localeCompare(right.name));
      });
      return saved;
    } catch (caught) {
      setError(normalizeApiError(caught));
      return null;
    } finally {
      setSaving(false);
    }
  }, [token]);

  const markUnavailable = useCallback(async (item: InventoryItem) => {
    if (!token) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const saved = await markInventoryUnavailable(token, item);
      setInventory((current) => current.map((entry) =>
        entry.id === saved.id ? saved : entry
      ));
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setSaving(false);
    }
  }, [token]);

  return {
    loading,
    saving,
    error,
    inventory,
    catalog,
    refresh,
    saveDraft,
    markUnavailable,
  };
}

function InventoryCard({ item }: { item: InventoryItem }) {
  return (
    <article className="inventory-card">
      <div className="inventory-card__topline">
        <span className={`inventory-card__status inventory-card__status--${item.status}`}>
          {item.status}
        </span>
        <strong>{formatCurrency(item.price)}</strong>
      </div>

      <h3>{item.name}</h3>
      <p className="inventory-card__subline">{item.brand} | {item.category}</p>
      <p className="inventory-card__description">{item.description || "Description is currently stored locally until a public medicine update endpoint exists."}</p>

      <div className="inventory-card__stats">
        <div>
          <span>Stock</span>
          <strong>{item.stockQuantity}</strong>
        </div>
        <div>
          <span>Prescription</span>
          <strong>{item.prescriptionRequired ? "Required" : "Open sale"}</strong>
        </div>
        <div>
          <span>Expiry</span>
          <strong>{item.expiryDate || "Unset"}</strong>
        </div>
      </div>

      <div className="inventory-card__actions">
        <a className="view-button view-button--ghost" href={`/inventory/${item.id}`}>
          Edit item
        </a>
      </div>
    </article>
  );
}

function LoginPage() {
  const { signIn, busy, error, clearError } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  async function onSubmit(event: Event) {
    event.preventDefault();
    clearError();
    const result = await signIn(form);

    if (result.ok) {
      window.location.href = "/dashboard";
    }
  }

  return (
    <section className="view-form-panel">
      <SectionHeader
        title="Pharmacy sign in"
        summary="Sign in with the MedRush partner persona to unlock the live inventory routes already available on the backend."
      />

      <form className="view-form" onSubmit={onSubmit}>
        <label>
          <span>Email</span>
          <input
            required
            type="email"
            value={form.email}
            onInput={(event) => setForm((current) => ({
              ...current,
              email: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <label>
          <span>Password</span>
          <input
            required
            type="password"
            value={form.password}
            onInput={(event) => setForm((current) => ({
              ...current,
              password: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        {error ? (
          <div className="view-error-banner">
            <strong>{error.message}</strong>
            {error.hint ? <span>{error.hint}</span> : null}
          </div>
        ) : null}

        <div className="view-form__actions">
          <button className="view-button view-button--primary" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <a className="view-button view-button--ghost" href="/register">
            Register pharmacy
          </a>
        </div>
      </form>
    </section>
  );
}

function RegisterPage() {
  const { register, busy, error, clearError } = useAuth();
  const [form, setForm] = useState<PartnerRegistrationInput>({
    name: "",
    email: "",
    password: "",
    phone: "",
    lat: 12.9716,
    long: 77.5946,
    addressLine1: "",
    addressLine2: "",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "",
    country: "India",
  });

  async function onSubmit(event: Event) {
    event.preventDefault();
    clearError();
    const result = await register(form);

    if (result.ok) {
      window.location.href = "/dashboard";
    }
  }

  return (
    <section className="view-form-panel">
      <SectionHeader
        title="Register a partner pharmacy"
        summary="Partner registration uses the backend signup route directly and stores the returned session locally because a profile-read endpoint does not exist yet."
      />

      <form className="view-form" onSubmit={onSubmit}>
        <label>
          <span>Pharmacy name</span>
          <input
            required
            type="text"
            value={form.name}
            onInput={(event) => setForm((current) => ({
              ...current,
              name: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <div className="view-form__grid">
          <label>
            <span>Email</span>
            <input
              required
              type="email"
              value={form.email}
              onInput={(event) => setForm((current) => ({
                ...current,
                email: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>Phone</span>
            <input
              required
              type="tel"
              value={form.phone}
              onInput={(event) => setForm((current) => ({
                ...current,
                phone: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>
        </div>

        <label>
          <span>Password</span>
          <input
            required
            type="password"
            value={form.password}
            onInput={(event) => setForm((current) => ({
              ...current,
              password: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <label>
          <span>Address line 1</span>
          <input
            required
            type="text"
            value={form.addressLine1}
            onInput={(event) => setForm((current) => ({
              ...current,
              addressLine1: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <label>
          <span>Address line 2</span>
          <input
            type="text"
            value={form.addressLine2 || ""}
            onInput={(event) => setForm((current) => ({
              ...current,
              addressLine2: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <div className="view-form__grid view-form__grid--triple">
          <label>
            <span>City</span>
            <input
              required
              type="text"
              value={form.city}
              onInput={(event) => setForm((current) => ({
                ...current,
                city: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>State</span>
            <input
              required
              type="text"
              value={form.state}
              onInput={(event) => setForm((current) => ({
                ...current,
                state: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>Pincode</span>
            <input
              required
              type="text"
              value={form.pincode}
              onInput={(event) => setForm((current) => ({
                ...current,
                pincode: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>
        </div>

        <div className="view-form__grid">
          <label>
            <span>Latitude</span>
            <input
              required
              step="0.0001"
              type="number"
              value={String(form.lat)}
              onInput={(event) => setForm((current) => ({
                ...current,
                lat: Number((event.currentTarget as HTMLInputElement).value || "0"),
              }))}
            />
          </label>

          <label>
            <span>Longitude</span>
            <input
              required
              step="0.0001"
              type="number"
              value={String(form.long)}
              onInput={(event) => setForm((current) => ({
                ...current,
                long: Number((event.currentTarget as HTMLInputElement).value || "0"),
              }))}
            />
          </label>
        </div>

        {error ? (
          <div className="view-error-banner">
            <strong>{error.message}</strong>
            {error.hint ? <span>{error.hint}</span> : null}
          </div>
        ) : null}

        <div className="view-form__actions">
          <button className="view-button view-button--primary" type="submit" disabled={busy}>
            {busy ? "Creating account..." : "Create partner account"}
          </button>
        </div>
      </form>
    </section>
  );
}

function DashboardPage({ inventory, loading, error, onRefresh }: {
  inventory: InventoryItem[];
  loading: boolean;
  error: ApiError | null;
  onRefresh: () => void;
}) {
  const lowStock = inventory.filter((item) => item.status === "low").length;
  const unavailable = inventory.filter((item) => item.status === "unavailable").length;
  const stockValue = inventory.reduce((sum, item) => sum + item.price * item.stockQuantity, 0);

  return (
    <section className="view-stack">
      <SectionHeader
        title="Partner dashboard"
        summary="Monitor low-stock items, inventory value, and profile completeness while the backend grows into richer partner operations."
        actionLabel="Refresh inventory"
        onAction={onRefresh}
      />

      <div className="metric-grid">
        <article className="metric-card">
          <span>Listed items</span>
          <strong>{inventory.length}</strong>
          <p>Inventory rows currently synced to the backend.</p>
        </article>
        <article className="metric-card">
          <span>Low stock</span>
          <strong>{lowStock}</strong>
          <p>Items at five units or fewer.</p>
        </article>
        <article className="metric-card">
          <span>Stock value</span>
          <strong>{formatCurrency(stockValue)}</strong>
          <p>Frontend calculation from live price and quantity.</p>
        </article>
      </div>

      {loading ? (
        <StatePanel
          title="Syncing inventory"
          message="Refreshing partner inventory from GET /api/v1/partner/inventory."
        />
      ) : null}

      {error ? (
        <StatePanel
          title="Inventory sync unavailable"
          message={`${error.message}${error.hint ? ` ${error.hint}` : ""}`}
          tone="danger"
        />
      ) : null}

      {unavailable > 0 ? (
        <StatePanel
          title="Unavailable items need attention"
          message={`${unavailable} items are currently marked unavailable in the UI by setting stock to zero.`}
          tone="warning"
        />
      ) : null}
    </section>
  );
}

function InventoryPage({
  inventory,
  loading,
  error,
  onRefresh,
}: {
  inventory: InventoryItem[];
  loading: boolean;
  error: ApiError | null;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch = `${item.name} ${item.brand} ${item.category}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStock = lowStockOnly ? item.status === "low" : true;
      return matchesSearch && matchesStock;
    });
  }, [inventory, lowStockOnly, query]);

  return (
    <section className="view-stack">
      <SectionHeader
        title="Inventory"
        summary="Search and filter locally because the backend catalog and inventory endpoints do not support query-string filtering yet."
        actionLabel="Add inventory item"
        actionHref="/inventory/new"
      />

      <div className="toolbar-card">
        <label className="toolbar-card__search">
          <span>Search inventory</span>
          <input
            type="search"
            value={query}
            placeholder="Search name, brand, or category"
            onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
          />
        </label>

        <label className="toolbar-card__toggle">
          <input
            checked={lowStockOnly}
            type="checkbox"
            onInput={(event) => setLowStockOnly((event.currentTarget as HTMLInputElement).checked)}
          />
          <span>Show low stock only</span>
        </label>

        <button className="view-button view-button--ghost" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {loading ? (
        <StatePanel
          title="Loading inventory"
          message="Pulling the latest inventory rows from the partner endpoint."
        />
      ) : null}

      {error ? (
        <StatePanel
          title="Inventory unavailable"
          message={`${error.message}${error.hint ? ` ${error.hint}` : ""}`}
          tone="danger"
        />
      ) : null}

      {!loading && filteredInventory.length === 0 ? (
        <StatePanel
          title="No inventory matches this filter"
          message="Try broadening the local filters or add a new item from the catalog."
        />
      ) : (
        <div className="feature-grid">
          {filteredInventory.map((item) => (
            <InventoryCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function InventoryEditorPage({
  mode,
  catalog,
  inventory,
  saving,
  error,
  inventoryId,
  onSave,
  onMarkUnavailable,
}: {
  mode: "new" | "edit";
  catalog: Product[];
  inventory: InventoryItem[];
  saving: boolean;
  error: ApiError | null;
  inventoryId?: string;
  onSave: (draft: InventoryDraft) => Promise<InventoryItem | null>;
  onMarkUnavailable: (item: InventoryItem) => Promise<void>;
}) {
  const currentItem = mode === "edit" && inventoryId
    ? inventory.find((item) => item.id === inventoryId) || getCachedInventoryItem(inventoryId)
    : null;

  const [form, setForm] = useState<InventoryDraft>(() => {
    if (currentItem) {
      return {
        id: currentItem.id,
        medicineId: currentItem.medicineId,
        name: currentItem.name,
        brand: currentItem.brand,
        category: currentItem.category,
        description: currentItem.description,
        price: currentItem.price,
        stockQuantity: currentItem.stockQuantity,
        expiryDate: currentItem.expiryDate,
        prescriptionRequired: currentItem.prescriptionRequired,
        imageUrl: currentItem.imageUrl,
      };
    }

    const firstMedicine = catalog[0];
    return {
      medicineId: firstMedicine?.medicineId || "",
      name: firstMedicine?.name || "",
      brand: firstMedicine?.brand || "",
      category: firstMedicine?.category || "",
      description: firstMedicine?.description || "",
      price: 0,
      stockQuantity: 0,
      expiryDate: "",
      prescriptionRequired: firstMedicine?.prescriptionRequired || false,
      imageUrl: "",
    };
  });
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "new" && !form.medicineId && catalog[0]) {
      setForm((current) => ({
        ...current,
        medicineId: catalog[0].medicineId,
        name: catalog[0].name,
        brand: catalog[0].brand,
        category: catalog[0].category,
        description: catalog[0].description,
        prescriptionRequired: catalog[0].prescriptionRequired,
      }));
    }
  }, [catalog, form.medicineId, mode]);

  if (mode === "new" && catalog.length === 0) {
    return (
      <StatePanel
        title="Catalog required before inventory can be added"
        message="The backend does not expose a public medicine create endpoint yet, so Partner Hub can only add stock for medicines already returned by GET /api/v1/medicines."
        tone="warning"
        actionLabel="Back to inventory"
        actionHref="/inventory"
      />
    );
  }

  if (mode === "edit" && !currentItem) {
    return (
      <StatePanel
        title="Inventory item not found"
        message="This detail route depends on cached inventory rows because the backend does not expose a single inventory-item endpoint."
        tone="warning"
        actionLabel="Back to inventory"
        actionHref="/inventory"
      />
    );
  }

  async function onSubmit(event: Event) {
    event.preventDefault();
    setSaved(null);
    const result = await onSave(form);

    if (result) {
      setSaved(mode === "new"
        ? "Inventory item added through PUT /api/v1/partner/inventory."
        : "Inventory item updated through PUT /api/v1/partner/inventory.");
      if (mode === "new") {
        window.location.href = "/inventory";
      }
    }
  }

  const selectedMedicine = catalog.find((item) => item.medicineId === form.medicineId);

  return (
    <section className="view-form-panel">
      <SectionHeader
        title={mode === "new" ? "Add inventory item" : "Edit inventory item"}
        summary="Price and stock write back to the backend. Brand, category, expiry, prescription flags, and imagery are stored locally until medicine-management APIs exist."
      />

      <form className="view-form" onSubmit={onSubmit}>
        <label>
          <span>Medicine</span>
          <select
            required
            value={form.medicineId}
            onInput={(event) => {
              const medicineId = (event.currentTarget as HTMLSelectElement).value;
              const nextProduct = catalog.find((item) => item.medicineId === medicineId);

              setForm((current) => ({
                ...current,
                medicineId,
                name: nextProduct?.name || current.name,
                brand: nextProduct?.brand || current.brand,
                category: nextProduct?.category || current.category,
                description: nextProduct?.description || current.description,
                prescriptionRequired: nextProduct?.prescriptionRequired ?? current.prescriptionRequired,
              }));
            }}
          >
            {catalog.map((product) => (
              <option key={product.medicineId} value={product.medicineId}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        {selectedMedicine ? (
          <div className="inline-note">
            Backend catalog source: {selectedMedicine.name}
          </div>
        ) : null}

        <div className="view-form__grid">
          <label>
            <span>Display name</span>
            <input
              required
              type="text"
              value={form.name}
              onInput={(event) => setForm((current) => ({
                ...current,
                name: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>Brand</span>
            <input
              required
              type="text"
              value={form.brand}
              onInput={(event) => setForm((current) => ({
                ...current,
                brand: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>
        </div>

        <div className="view-form__grid">
          <label>
            <span>Category</span>
            <input
              required
              type="text"
              value={form.category}
              onInput={(event) => setForm((current) => ({
                ...current,
                category: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>Expiry date</span>
            <input
              type="date"
              value={form.expiryDate || ""}
              onInput={(event) => setForm((current) => ({
                ...current,
                expiryDate: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>
        </div>

        <label>
          <span>Description</span>
          <textarea
            value={form.description}
            onInput={(event) => setForm((current) => ({
              ...current,
              description: (event.currentTarget as HTMLTextAreaElement).value,
            }))}
          />
        </label>

        <div className="view-form__grid">
          <label>
            <span>Price</span>
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={String(form.price)}
              onInput={(event) => setForm((current) => ({
                ...current,
                price: Number((event.currentTarget as HTMLInputElement).value || "0"),
              }))}
            />
          </label>

          <label>
            <span>Stock quantity</span>
            <input
              required
              min="0"
              type="number"
              value={String(form.stockQuantity)}
              onInput={(event) => setForm((current) => ({
                ...current,
                stockQuantity: Number((event.currentTarget as HTMLInputElement).value || "0"),
              }))}
            />
          </label>
        </div>

        <label className="toolbar-card__toggle">
          <input
            checked={form.prescriptionRequired}
            type="checkbox"
            onInput={(event) => setForm((current) => ({
              ...current,
              prescriptionRequired: (event.currentTarget as HTMLInputElement).checked,
            }))}
          />
          <span>Prescription required</span>
        </label>

        <label>
          <span>Image URL</span>
          <input
            type="url"
            value={form.imageUrl || ""}
            placeholder="Optional storefront image"
            onInput={(event) => setForm((current) => ({
              ...current,
              imageUrl: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        {error ? (
          <div className="view-error-banner">
            <strong>{error.message}</strong>
            {error.hint ? <span>{error.hint}</span> : null}
          </div>
        ) : null}

        {saved ? (
          <div className="view-success-banner">
            {saved}
          </div>
        ) : null}

        <div className="view-form__actions">
          <button className="view-button view-button--primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : mode === "new" ? "Add inventory item" : "Save changes"}
          </button>

          {mode === "edit" && currentItem ? (
            <button
              className="view-button view-button--ghost"
              type="button"
              disabled={saving}
              onClick={() => onMarkUnavailable(currentItem)}
            >
              Mark unavailable
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function OrdersPage() {
  return (
    <StatePanel
      title="Partner orders are waiting on backend support"
      message="Partner Hub is ready for an orders workflow, but the current MedRush server does not expose a partner order queue, preparation lifecycle, or fulfillment actions yet."
      tone="warning"
    />
  );
}

function ProfilePage({ session }: { session: User }) {
  const { updateProfile, busy, error, clearError } = useAuth();
  const [saved, setSaved] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerProfileUpdateInput>({
    name: session.name,
    email: session.email,
    phone: session.phone,
    lat: session.latitude || 12.9716,
    long: session.longitude || 77.5946,
    addressLine1: session.address?.addressLine1 || "",
    addressLine2: session.address?.addressLine2 || "",
    city: session.address?.city || "Bengaluru",
    state: session.address?.state || "Karnataka",
    pincode: session.address?.pincode || "",
    country: session.address?.country || "India",
    password: "",
  });

  async function onSubmit(event: Event) {
    event.preventDefault();
    clearError();
    setSaved(null);
    const result = await updateProfile(form);

    if (result.ok) {
      setSaved("Partner profile updated through PATCH /api/v1/partner/account.");
      setForm((current) => ({ ...current, password: "" }));
    }
  }

  return (
    <section className="view-form-panel">
      <SectionHeader
        title="Partner profile"
        summary={`Current storefront address: ${formatAddress(session.address)}`}
      />

      <form className="view-form" onSubmit={onSubmit}>
        <label>
          <span>Name</span>
          <input
            required
            type="text"
            value={form.name}
            onInput={(event) => setForm((current) => ({
              ...current,
              name: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <div className="view-form__grid">
          <label>
            <span>Email</span>
            <input
              required
              type="email"
              value={form.email}
              onInput={(event) => setForm((current) => ({
                ...current,
                email: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>Phone</span>
            <input
              required
              type="tel"
              value={form.phone}
              onInput={(event) => setForm((current) => ({
                ...current,
                phone: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>
        </div>

        <label>
          <span>Address line 1</span>
          <input
            required
            type="text"
            value={form.addressLine1}
            onInput={(event) => setForm((current) => ({
              ...current,
              addressLine1: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <label>
          <span>Address line 2</span>
          <input
            type="text"
            value={form.addressLine2 || ""}
            onInput={(event) => setForm((current) => ({
              ...current,
              addressLine2: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        <div className="view-form__grid view-form__grid--triple">
          <label>
            <span>City</span>
            <input
              required
              type="text"
              value={form.city}
              onInput={(event) => setForm((current) => ({
                ...current,
                city: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>State</span>
            <input
              required
              type="text"
              value={form.state}
              onInput={(event) => setForm((current) => ({
                ...current,
                state: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>

          <label>
            <span>Pincode</span>
            <input
              required
              type="text"
              value={form.pincode}
              onInput={(event) => setForm((current) => ({
                ...current,
                pincode: (event.currentTarget as HTMLInputElement).value,
              }))}
            />
          </label>
        </div>

        <div className="view-form__grid">
          <label>
            <span>Latitude</span>
            <input
              required
              step="0.0001"
              type="number"
              value={String(form.lat)}
              onInput={(event) => setForm((current) => ({
                ...current,
                lat: Number((event.currentTarget as HTMLInputElement).value || "0"),
              }))}
            />
          </label>

          <label>
            <span>Longitude</span>
            <input
              required
              step="0.0001"
              type="number"
              value={String(form.long)}
              onInput={(event) => setForm((current) => ({
                ...current,
                long: Number((event.currentTarget as HTMLInputElement).value || "0"),
              }))}
            />
          </label>
        </div>

        <label>
          <span>New password</span>
          <input
            type="password"
            value={form.password || ""}
            placeholder="Leave blank to keep the current password"
            onInput={(event) => setForm((current) => ({
              ...current,
              password: (event.currentTarget as HTMLInputElement).value,
            }))}
          />
        </label>

        {error ? (
          <div className="view-error-banner">
            <strong>{error.message}</strong>
            {error.hint ? <span>{error.hint}</span> : null}
          </div>
        ) : null}

        {saved ? (
          <div className="view-success-banner">
            {saved}
          </div>
        ) : null}

        <div className="view-form__actions">
          <button className="view-button view-button--primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}

function RequireSession({ session }: { session: User | null }) {
  if (session) {
    return null;
  }

  return (
    <StatePanel
      title="Sign in required"
      message="Partner dashboard, inventory, orders, and profile pages rely on a stored partner auth session."
      tone="warning"
      actionLabel="Go to login"
      actionHref="/login"
    />
  );
}

function NotFoundPage() {
  return (
    <StatePanel
      title="Route not found"
      message="This Partner Hub route does not exist yet. Use the navigation to return to supported inventory and profile flows."
      tone="warning"
      actionLabel="Back to dashboard"
      actionHref="/dashboard"
    />
  );
}

export function HomeView({ route }: HomeViewProps) {
  const { session, logout } = useAuth();
  const inventoryState = useInventorySource(session?.token);
  const refreshInventory = inventoryState.refresh;

  useEffect(() => {
    if (
      session
      && ["dashboard", "inventory", "inventory-new", "inventory-detail"].includes(route.page)
    ) {
      refreshInventory();
    }
  }, [refreshInventory, route.page, session]);

  const navigation = session
    ? [
      { label: "Home", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Inventory", href: "/inventory" },
      { label: "Orders", href: "/orders" },
      { label: "Profile", href: "/profile" },
    ]
    : [
      { label: "Home", href: "/" },
      { label: "Login", href: "/login" },
      { label: "Register", href: "/register" },
    ];

  let content = <NotFoundPage />;

  if (route.page === "home") {
    content = <About session={session} />;
  }

  if (route.page === "login") {
    content = <LoginPage />;
  }

  if (route.page === "register") {
    content = <RegisterPage />;
  }

  if (route.page === "dashboard") {
    content = session ? (
      <DashboardPage
        inventory={inventoryState.inventory}
        loading={inventoryState.loading}
        error={inventoryState.error}
        onRefresh={inventoryState.refresh}
      />
    ) : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "inventory") {
    content = session ? (
      <InventoryPage
        inventory={inventoryState.inventory}
        loading={inventoryState.loading}
        error={inventoryState.error}
        onRefresh={inventoryState.refresh}
      />
    ) : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "inventory-new") {
    content = session ? (
      <InventoryEditorPage
        mode="new"
        catalog={inventoryState.catalog}
        inventory={inventoryState.inventory}
        saving={inventoryState.saving}
        error={inventoryState.error}
        onSave={inventoryState.saveDraft}
        onMarkUnavailable={inventoryState.markUnavailable}
      />
    ) : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "inventory-detail") {
    content = session ? (
      <InventoryEditorPage
        mode="edit"
        inventoryId={route.inventoryId}
        catalog={inventoryState.catalog}
        inventory={inventoryState.inventory}
        saving={inventoryState.saving}
        error={inventoryState.error}
        onSave={inventoryState.saveDraft}
        onMarkUnavailable={inventoryState.markUnavailable}
      />
    ) : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "orders") {
    content = session ? <OrdersPage /> : <RequireSession session={session?.profile || null} />;
  }

  if (route.page === "profile") {
    content = session ? (
      <ProfilePage session={session.profile} />
    ) : <RequireSession session={session?.profile || null} />;
  }

  return (
    <AppShell
      appName="Partner Hub"
      strapline="Pharmacy inventory workspace"
      navItems={navigation}
      currentPath={route.path}
      session={session}
      onLogout={() => {
        logout();
        window.location.href = "/";
      }}
    >
      {content}
    </AppShell>
  );
}

