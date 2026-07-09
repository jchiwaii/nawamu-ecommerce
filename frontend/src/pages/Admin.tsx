import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { api, apiFetch, asList } from "../api/client";
import type { AdminDashboard, AdminUser, Brand, Category, Order, Payment, Product, ProductVariant, Review, SupportTicket } from "../api/types";
import { ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { Field, Select, TextArea } from "../components/forms";
import { useAuth } from "../state/auth";
import { Link, useRouter } from "../state/router";
import { money } from "../utils";
import "../styles/admin.css";


type AdminTab = "dashboard" | "orders" | "products" | "users" | "payments" | "support" | "reviews";

const tabs: { id: AdminTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "products", label: "Products" },
  { id: "orders", label: "Purchases" },
  { id: "users", label: "Customers" },
  { id: "payments", label: "Payments" },
  { id: "support", label: "Support" },
  { id: "reviews", label: "Reviews" },
];

export function AdminPage({ tab }: { tab: AdminTab }) {
  const { user } = useAuth();

  return (
    <RequireStaff>
      <section className="admin-shell">
        <aside className="admin-sidebar">
          <div className="brand admin-brand" aria-label="Nawamu admin">
            <span className="brand-mark">N</span>
            <span>Nawamu</span>
          </div>
          <nav>
            {tabs.map((item) => (
              <Link key={item.id} to={item.id === "dashboard" ? "/admin" : `/admin/${item.id}`} className={item.id === tab ? "active" : ""}>
                <span className="admin-nav-dot" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="admin-top-actions">
            <span className="admin-user-chip">
              <span className="admin-avatar" aria-hidden="true" />
              {user?.full_name || user?.email || "Staff"}
            </span>
          </div>
        </aside>
        <main className="admin-main">
          {tab === "dashboard" ? <AdminDashboardPage /> : null}
          {tab === "orders" ? <AdminOrdersPage /> : null}
          {tab === "products" ? <AdminProductsPage /> : null}
          {tab === "users" ? <AdminUsersPage /> : null}
          {tab === "payments" ? <AdminPaymentsPage /> : null}
          {tab === "support" ? <AdminSupportPage /> : null}
          {tab === "reviews" ? <AdminReviewsPage /> : null}
        </main>
      </section>
    </RequireStaff>
  );
}

function RequireStaff({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.navigate(`/login?next=${encodeURIComponent(router.path)}`);
      return;
    }
    if (!user.is_staff) {
      router.navigate("/");
    }
  }, [loading, user, router]);

  if (loading) return <LoadingBlock label="Checking admin access" />;
  if (!user) return null;
  if (!user.is_staff) return null;
  return <>{children}</>;
}

function AdminHeader({ title, copy, children }: { title: string; copy?: string; children?: ReactNode }) {
  return (
    <header className="admin-header">
      <div>
        <h1>{title}</h1>
        {copy ? <p>{copy}</p> : null}
      </div>
      {children ? <div className="admin-header-actions">{children}</div> : null}
    </header>
  );
}

function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminDashboard().then(setDashboard).catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorBlock message={error} />;
  if (!dashboard) return <LoadingBlock label="Loading dashboard" />;

  const metricCards = [
    ["Revenue", money(dashboard.metrics.revenue)],
    ["Orders", dashboard.metrics.orders_total],
    ["To fulfil", dashboard.metrics.orders_to_fulfill],
    ["Customers", dashboard.metrics.customers_total],
    ["Products", dashboard.metrics.products_active],
    ["Low stock", dashboard.metrics.low_stock_count],
    ["Support", dashboard.metrics.pending_support_count],
  ];

  return (
    <>
      <AdminHeader title="Store overview" />
      <section className="admin-metrics">
        {metricCards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="admin-grid-two">
        <AdminPanel title="Recent orders">
          <div className="admin-list">
            {dashboard.recent_orders.map((order) => (
              <Link to="/admin/orders" key={order.id} className="admin-list-row">
                <span>{order.number}</span>
                <em>{order.status.replaceAll("_", " ")}</em>
                <strong>{money(order.total)}</strong>
              </Link>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel title="Low stock variants">
          <div className="admin-list">
            {dashboard.low_stock.length ? dashboard.low_stock.map((item) => (
              <div key={item.variant_id} className="admin-list-row">
                <span>{item.product}</span>
                <em>{item.size} / {item.color}</em>
                <strong>{item.stock_quantity}</strong>
              </div>
            )) : <p className="muted-small">No low stock variants.</p>}
          </div>
        </AdminPanel>
      </section>
      <section className="admin-grid-two">
        <AdminPanel title="Best sellers">
          <div className="admin-list">
            {dashboard.best_sellers.map((product) => (
              <Link to={`/shop/${product.slug}`} key={product.id} className="admin-list-row">
                <span>{product.name}</span>
                <em>★ {product.rating_avg}</em>
                <strong>{product.sold_count}</strong>
              </Link>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel title="Pending support">
          <div className="admin-list">
            {dashboard.pending_tickets.length ? dashboard.pending_tickets.map((ticket) => (
              <Link to="/admin/support" key={ticket.id} className="admin-list-row">
                <span>{ticket.subject}</span>
                <em>{ticket.priority}</em>
                <strong>{ticket.status}</strong>
              </Link>
            )) : <p className="muted-small">No pending tickets.</p>}
          </div>
        </AdminPanel>
      </section>
    </>
  );
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [manualItems, setManualItems] = useState([{ variant: "", quantity: 1 }]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(status = filter) {
    setLoading(true);
    const query = status ? `?status=${status}` : "";
    try {
      const data = await api.orders(query);
      setOrders(data.results);
      setSelected((current) => current || data.results[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminResources() {
    const [userData, variantData] = await Promise.all([
      api.adminUsers("?page_size=200"),
      api.adminVariants("?page_size=200"),
    ]);
    setUsers(userData.results);
    setVariants(variantData.results);
  }

  useEffect(() => {
    load("");
    loadAdminResources().catch((err) => setError(err instanceof Error ? err.message : "Could not load admin order resources."));
  }, []);

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      const updated = await api.adminUpdateOrderStatus(selected.number, {
        status: form.get("status"),
        note: form.get("note"),
        courier_name: form.get("courier_name"),
        tracking_number: form.get("tracking_number"),
        tracking_url: form.get("tracking_url"),
      });
      setSelected(updated);
      setMessage("Order updated.");
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order.");
    }
  }

  async function createManualOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = manualItems
      .filter((item) => item.variant && item.quantity > 0)
      .map((item) => ({ variant: Number(item.variant), quantity: item.quantity }));
    if (!items.length) {
      setError("Add at least one SKU item to the manual order.");
      return;
    }
    setError("");
    try {
      const order = await api.adminCreateOrder({
        user: Number(form.get("manual_user")),
        status: form.get("manual_status"),
        fulfillment_method: form.get("manual_fulfillment_method"),
        shipping_full_name: form.get("shipping_full_name"),
        shipping_phone: form.get("shipping_phone"),
        shipping_line1: form.get("shipping_line1"),
        shipping_city: form.get("shipping_city"),
        shipping_county: form.get("shipping_county"),
        delivery_location: form.get("delivery_location"),
        preferred_delivery_window: form.get("preferred_delivery_window"),
        pickup_location: form.get("pickup_location"),
        shipping_amount: form.get("shipping_amount") || "0",
        customer_note: form.get("customer_note"),
        admin_note: form.get("admin_note"),
        items,
      });
      setSelected(order);
      setMessage(`Manual order ${order.number} created.`);
      setManualItems([{ variant: "", quantity: 1 }]);
      event.currentTarget.reset();
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create manual order.");
    }
  }

  return (
    <>
      <AdminHeader title="Orders" copy="View customer orders, update fulfilment, tracking, and status history.">
        <Select label="Status" value={filter} onChange={(event) => { setFilter(event.target.value); load(event.target.value); }}>
          <option value="">All orders</option>
          {orderStatuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}
        </Select>
      </AdminHeader>
      {loading ? <LoadingBlock label="Loading orders" /> : null}
      {error ? <ErrorBlock message={error} /> : null}
      {message ? <p className="inline-status">{message}</p> : null}
      <section className="admin-split">
        <AdminPanel title="Order queue">
          <div className="admin-list">
            {orders.map((order) => (
              <button key={order.id} className={`admin-list-row button-row-reset ${selected?.id === order.id ? "selected" : ""}`} onClick={() => setSelected(order)}>
                <span>{order.number}</span>
                <em>{order.status.replaceAll("_", " ")}</em>
                <strong>{money(order.total)}</strong>
              </button>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel title={selected ? selected.number : "Order detail"}>
          {selected ? (
            <form className="admin-form" onSubmit={updateStatus}>
              <div className="admin-detail-list">
                <p><strong>Total:</strong> {money(selected.total)} · <strong>Delivery:</strong> {money(selected.shipping_amount)}</p>
                <p><strong>Fulfillment:</strong> {selected.fulfillment_method} {selected.delivery_location || selected.pickup_location ? `· ${selected.delivery_location || selected.pickup_location}` : ""}</p>
                <p><strong>Preferred time:</strong> {selected.preferred_delivery_window || "Not set"}</p>
              </div>
              <Select label="Status" name="status" defaultValue={selected.status}>
                {orderStatuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}
              </Select>
              <div className="admin-form-grid">
                <Field label="Courier" name="courier_name" defaultValue={selected.courier_name || ""} />
                <Field label="Tracking number" name="tracking_number" defaultValue={selected.tracking_number || ""} />
              </div>
              <Field label="Tracking URL" name="tracking_url" defaultValue={selected.tracking_url || ""} />
              <TextArea label="Status note" name="note" rows={3} placeholder="Customer-visible timeline note" />
              <button className="quiet-button dark">Update order</button>
              <div className="admin-items">
                {selected.items.map((item) => (
                  <div key={item.id} className="admin-list-row">
                    <span>{item.quantity} × {item.product_name}</span>
                    <em>{item.size} / {item.color}</em>
                    <strong>{money(item.line_total)}</strong>
                  </div>
                ))}
              </div>
            </form>
          ) : <p className="muted-small">Select an order.</p>}
        </AdminPanel>
      </section>
      <AdminPanel title="Create manual order">
        <form className="admin-form" onSubmit={createManualOrder}>
          <div className="admin-form-grid">
            <Select label="Customer" name="manual_user" required>
              <option value="">Choose customer</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email} · {user.email}</option>)}
            </Select>
            <Select label="Initial status" name="manual_status" defaultValue="paid">
              {orderStatuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}
            </Select>
          </div>
          <div className="admin-form-grid">
            <Field label="Customer name" name="shipping_full_name" required />
            <Field label="Customer phone" name="shipping_phone" required />
          </div>
          <div className="admin-form-grid">
            <Select label="Fulfillment" name="manual_fulfillment_method" defaultValue="delivery">
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
            </Select>
            <Field label="Shipping fee" name="shipping_amount" type="number" min="0" step="0.01" defaultValue="0" />
          </div>
          <div className="admin-form-grid">
            <Field label="Address / pickup point" name="shipping_line1" defaultValue="Nawamu pickup point, Ngara, Nairobi" required />
            <Field label="City" name="shipping_city" defaultValue="Nairobi" required />
          </div>
          <div className="admin-form-grid">
            <Field label="County" name="shipping_county" defaultValue="Nairobi" />
            <Field label="Delivery area" name="delivery_location" placeholder="e.g. Westlands" />
          </div>
          <div className="admin-form-grid">
            <Field label="Pickup location" name="pickup_location" placeholder="Nawamu pickup point, Ngara, Nairobi" />
            <Field label="Preferred time" name="preferred_delivery_window" placeholder="Tomorrow, 2pm - 5pm" />
          </div>
          <div className="manual-items">
            <p className="tiny-label">Items</p>
            {manualItems.map((item, index) => (
              <div className="manual-item-row" key={`${index}-${item.variant}`}>
                <Select
                  label="SKU"
                  value={item.variant}
                  onChange={(event) => {
                    const next = [...manualItems];
                    next[index] = { ...next[index], variant: event.target.value };
                    setManualItems(next);
                  }}
                  required
                >
                  <option value="">Choose SKU</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.product_name || "Product"} · {variant.sku} · {variant.size}/{variant.color} · {variant.stock_quantity} left
                    </option>
                  ))}
                </Select>
                <Field
                  label="Qty"
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) => {
                    const next = [...manualItems];
                    next[index] = { ...next[index], quantity: Number(event.target.value) };
                    setManualItems(next);
                  }}
                  required
                />
                <button type="button" className="quiet-button danger" onClick={() => setManualItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} disabled={manualItems.length === 1}>Remove</button>
              </div>
            ))}
            <button type="button" className="quiet-button" onClick={() => setManualItems((items) => [...items, { variant: "", quantity: 1 }])}>Add another item</button>
          </div>
          <TextArea label="Customer note" name="customer_note" rows={3} />
          <TextArea label="Admin note" name="admin_note" rows={3} />
          <button className="quiet-button dark">Create manual order</button>
        </form>
      </AdminPanel>
    </>
  );
}

function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [query, setQuery] = useState("");
  const [productView, setProductView] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(search = query) {
    setLoading(true);
    setError("");
    try {
      const [productData, categoryData, brandData] = await Promise.all([
        api.products(search ? `?q=${encodeURIComponent(search)}&page_size=50` : "?page_size=50"),
        api.categories(),
        api.brands(),
      ]);
      setProducts(productData.results);
      setCategories(asList(categoryData));
      setBrands(asList(brandData));
      if (!selected && productData.results[0]) {
        await selectProduct(productData.results[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin catalog.");
    } finally {
      setLoading(false);
    }
  }

  async function selectProduct(product: Product) {
    const detail = await api.product(product.slug);
    setSelected(detail);
    setEditingVariant(null);
    setMessage("");
  }

  useEffect(() => {
    load("");
  }, []);

  function newProduct() {
    setSelected(null);
    setEditingVariant(null);
    setMessage("Creating a new product.");
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = Number(form.get("category"));
    const brand = Number(form.get("brand"));
    if (!category || !brand) {
      setError("Choose a category and brand before saving the product.");
      return;
    }
    const compareAt = String(form.get("compare_at_price") || "").trim();
    const payload = {
      name: String(form.get("name") || "").trim(),
      description: String(form.get("description") || "").trim(),
      category,
      brand,
      gender: form.get("gender"),
      style: String(form.get("style") || "").trim(),
      base_price: String(form.get("base_price") || "0").trim(),
      compare_at_price: compareAt || null,
      is_active: form.has("is_active"),
      is_featured: form.has("is_featured"),
    };
    setSaving(true);
    setError("");
    try {
      const saved = selected
        ? await api.adminUpdateProduct(selected.slug, payload)
        : await api.adminCreateProduct(payload);
      const detail = await api.product(saved.slug);
      setSelected(detail);
      setMessage(selected ? "Product updated." : "Product created. Add its size/color variants next.");
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!selected) return;
    if (!window.confirm(`Remove ${selected.name}? This cannot be undone.`)) return;
    setSaving(true);
    setError("");
    try {
      await api.adminDeleteProduct(selected.slug);
      setSelected(null);
      setMessage("Product removed.");
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove product.");
    } finally {
      setSaving(false);
    }
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const priceOverride = String(form.get("price_override") || "").trim();
    const payload = {
      product: selected.id,
      sku: String(form.get("sku") || "").trim(),
      size: String(form.get("size") || "").trim(),
      color: String(form.get("color") || "").trim(),
      price_override: priceOverride || null,
      stock_quantity: Number(form.get("stock_quantity") || 0),
      low_stock_threshold: Number(form.get("low_stock_threshold") || 5),
      is_active: form.has("variant_is_active"),
    };
    setSaving(true);
    setError("");
    try {
      if (editingVariant) await api.adminUpdateVariant(editingVariant.id, payload);
      else await api.adminCreateVariant(payload);
      const detail = await api.product(selected.slug);
      setSelected(detail);
      setEditingVariant(null);
      setMessage(editingVariant ? "Variant updated." : "Variant added.");
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save variant.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVariant(variant: ProductVariant) {
    if (!window.confirm(`Remove SKU ${variant.sku}?`)) return;
    setSaving(true);
    setError("");
    try {
      await api.adminDeleteVariant(variant.id);
      if (selected) setSelected(await api.product(selected.slug));
      setEditingVariant(null);
      setMessage("Variant removed.");
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove variant.");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.adminCreateCategory({
        name: String(form.get("name") || "").trim(),
        description: String(form.get("description") || "").trim(),
        is_active: true,
      });
      event.currentTarget.reset();
      await load(query);
      setMessage("Category added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add category.");
    }
  }

  async function createBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.adminCreateBrand({
        name: String(form.get("name") || "").trim(),
        description: String(form.get("description") || "").trim(),
        is_active: true,
      });
      event.currentTarget.reset();
      await load(query);
      setMessage("Brand added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add brand.");
    }
  }

  const filteredProducts = useMemo(() => {
    if (productView === "most") {
      return [...products].sort((first, second) => second.sold_count - first.sold_count);
    }
    if (productView.startsWith("category:")) {
      const categoryId = Number(productView.replace("category:", ""));
      return products.filter((product) => product.category.id === categoryId);
    }
    return products;
  }, [productView, products]);

  return (
    <>
      <AdminHeader title="Product" copy="Create, edit, hide, remove, and stock shoe products from the admin UI.">
        <div className="admin-header-control-group">
          <form className="admin-search-control" onSubmit={(event) => { event.preventDefault(); load(query); }}>
            <input className="admin-control-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
            <button className="admin-control-button">Search</button>
          </form>
          <button className="admin-control-button" onClick={newProduct}>New product</button>
        </div>
      </AdminHeader>
      {loading ? <LoadingBlock label="Loading products" /> : null}
      {error ? <ErrorBlock message={error} /> : null}
      {message ? <p className="inline-status">{message}</p> : null}
      <section className="admin-crud-grid admin-product-console">
        <AdminPanel title="Catalog">
          <div className="admin-product-tabs">
            <button className={productView === "all" ? "active" : ""} onClick={() => setProductView("all")}>All products</button>
            <button className={productView === "most" ? "active" : ""} onClick={() => setProductView("most")}>Most purchased</button>
            {categories.slice(0, 5).map((category) => (
              <button key={category.id} className={productView === `category:${category.id}` ? "active" : ""} onClick={() => setProductView(`category:${category.id}`)}>
                {category.name}
              </button>
            ))}
          </div>
          <div className="admin-product-card-grid">
            {filteredProducts.map((product) => {
              const stockTotal = product.variants?.reduce((sum, variant) => sum + variant.stock_quantity, 0);
              return (
                <button key={product.id} className={`admin-product-card button-row-reset ${selected?.id === product.id ? "selected" : ""}`} onClick={() => selectProduct(product)}>
                  <div className="admin-product-thumb"><span>{product.gender}</span></div>
                  <strong>{product.name}</strong>
                  <em>{money(product.base_price)}</em>
                  <div className="admin-product-meta">
                    <span>{stockTotal === undefined ? "SKUs" : "Stock"} <b>{stockTotal ?? product.variants?.length ?? 0}</b></span>
                    <span>Sold <b>{product.sold_count}</b></span>
                  </div>
                </button>
              );
            })}
            {!filteredProducts.length ? <p className="muted-small">No products match this view.</p> : null}
          </div>
        </AdminPanel>

        <AdminPanel title={selected ? "Product details" : "Create product"}>
          {selected ? (
            <div className="admin-product-spotlight">
              <div className="admin-product-hero-thumb" />
              <div>
                <p className="tiny-label">{selected.gender} shoe</p>
                <h3>{selected.name}</h3>
                <p>{selected.brand.name} · {selected.category.name} · {money(selected.base_price)}</p>
                <span>{selected.rating_avg} rating · {selected.review_count} reviews</span>
              </div>
            </div>
          ) : null}
          <form className="admin-form" key={selected?.slug || "new-product"} onSubmit={saveProduct}>
            <Field label="Product name" name="name" defaultValue={selected?.name || ""} required />
            <TextArea label="Description" name="description" defaultValue={selected?.description || ""} rows={4} required />
            <div className="admin-form-grid">
              <Select label="Category" name="category" defaultValue={selected?.category.id || categories[0]?.id || ""} required>
                <option value="">Choose category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
              <Select label="Brand" name="brand" defaultValue={selected?.brand.id || brands[0]?.id || ""} required>
                <option value="">Choose brand</option>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </Select>
            </div>
            <div className="admin-form-grid">
              <Select label="Audience" name="gender" defaultValue={selected?.gender || "unisex"}>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="kids">Kids</option>
                <option value="unisex">Unisex</option>
              </Select>
              <Field label="Style" name="style" defaultValue={selected?.style || ""} placeholder="running, casual, school..." />
            </div>
            <div className="admin-form-grid">
              <Field label="Base price" name="base_price" type="number" min="0" step="0.01" defaultValue={selected?.base_price || ""} required />
              <Field label="Compare-at price" name="compare_at_price" type="number" min="0" step="0.01" defaultValue={selected?.compare_at_price || ""} />
            </div>
            <div className="check-grid">
              <label className="check-row"><input type="checkbox" name="is_active" defaultChecked={selected?.is_active ?? true} /> Active on shop</label>
              <label className="check-row"><input type="checkbox" name="is_featured" defaultChecked={selected?.is_featured ?? false} /> Featured</label>
            </div>
            <div className="button-row">
              <button className="quiet-button dark" disabled={saving}>{saving ? "Saving..." : selected ? "Save product" : "Create product"}</button>
              {selected ? <button type="button" className="quiet-button danger" onClick={deleteProduct} disabled={saving}>Remove product</button> : null}
            </div>
          </form>
        </AdminPanel>
      </section>

      <section className="admin-crud-grid">
        <AdminPanel title="Size / color variants">
          {selected ? (
            <div className="admin-list">
              {selected.variants?.length ? selected.variants.map((variant) => (
                <button key={variant.id} className={`admin-list-row button-row-reset ${editingVariant?.id === variant.id ? "selected" : ""}`} onClick={() => setEditingVariant(variant)}>
                  <span>{variant.sku}</span>
                  <em>{variant.size} / {variant.color} · {variant.is_active ? "active" : "hidden"}</em>
                  <strong>{variant.stock_quantity}</strong>
                </button>
              )) : <p className="muted-small">No variants yet. Add the first SKU below.</p>}
            </div>
          ) : <p className="muted-small">Select or create a product before adding variants.</p>}
        </AdminPanel>

        <AdminPanel title={editingVariant ? `Edit SKU ${editingVariant.sku}` : "Add SKU variant"}>
          {selected ? (
            <form className="admin-form" key={`${selected.id}-${editingVariant?.id || "new-variant"}`} onSubmit={saveVariant}>
              <Field label="SKU" name="sku" defaultValue={editingVariant?.sku || ""} required />
              <div className="admin-form-grid">
                <Field label="Size" name="size" defaultValue={editingVariant?.size || ""} required />
                <Field label="Color" name="color" defaultValue={editingVariant?.color || ""} required />
              </div>
              <div className="admin-form-grid">
                <Field label="Stock quantity" name="stock_quantity" type="number" min="0" defaultValue={editingVariant?.stock_quantity ?? 0} required />
                <Field label="Low stock threshold" name="low_stock_threshold" type="number" min="0" defaultValue={editingVariant?.low_stock_threshold ?? 5} required />
              </div>
              <Field label="Price override" name="price_override" type="number" min="0" step="0.01" defaultValue={editingVariant?.price_override || ""} placeholder="Leave blank to use product price" />
              <label className="check-row"><input type="checkbox" name="variant_is_active" defaultChecked={editingVariant?.is_active ?? true} /> Variant active</label>
              <div className="button-row">
                <button className="quiet-button dark" disabled={saving}>{saving ? "Saving..." : editingVariant ? "Save variant" : "Add variant"}</button>
                {editingVariant ? <button type="button" className="quiet-button" onClick={() => setEditingVariant(null)}>New variant</button> : null}
                {editingVariant ? <button type="button" className="quiet-button danger" onClick={() => deleteVariant(editingVariant)} disabled={saving}>Remove SKU</button> : null}
              </div>
            </form>
          ) : <p className="muted-small">Select a product first.</p>}
        </AdminPanel>
      </section>

      <section className="admin-grid-two">
        <AdminPanel title="Add category">
          <form className="admin-form" onSubmit={createCategory}>
            <Field label="Category name" name="name" required />
            <TextArea label="Description" name="description" rows={3} />
            <button className="quiet-button dark">Add category</button>
          </form>
        </AdminPanel>
        <AdminPanel title="Add brand">
          <form className="admin-form" onSubmit={createBrand}>
            <Field label="Brand name" name="name" required />
            <TextArea label="Description" name="description" rows={3} />
            <button className="quiet-button dark">Add brand</button>
          </form>
        </AdminPanel>
      </section>
    </>
  );
}

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { user: currentUser } = useAuth();

  async function load(query = search) {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminUsers(query ? `?search=${encodeURIComponent(query)}` : "");
      setUsers(data.results);
      setSelected((current) => {
        if (!current) return data.results[0] || null;
        return data.results.find((item) => item.id === current.id) || data.results[0] || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  function newUser() {
    setSelected(null);
    setMessage("Creating a new user.");
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "").trim();
    const payload: Record<string, unknown> = {
      email: String(form.get("email") || "").trim(),
      full_name: String(form.get("full_name") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      role: form.get("role"),
      is_active: form.has("is_active"),
      is_staff: form.has("is_staff"),
      is_superuser: form.has("is_superuser"),
      email_verified: form.has("email_verified"),
    };
    if (password) payload.password = password;

    setSaving(true);
    setError("");
    try {
      const saved = selected ? await api.adminUpdateUser(selected.id, payload) : await api.adminCreateUser(payload);
      setSelected(saved);
      setMessage(selected ? "User updated." : "User created.");
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save user.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!selected) return;
    if (selected.id === currentUser?.id) {
      setError("You cannot remove the account you are currently using.");
      return;
    }
    if (!window.confirm(`Remove ${selected.email}? This cannot be undone.`)) return;
    setSaving(true);
    setError("");
    try {
      await api.adminDeleteUser(selected.id);
      setSelected(null);
      setMessage("User removed.");
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove user. Try deactivating them if they already have orders.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminHeader title="Users" copy="Create customers or staff accounts, edit roles and deactivate users from the admin UI.">
        <div className="admin-header-control-group">
          <form className="admin-search-control" onSubmit={(event) => { event.preventDefault(); load(search); }}>
            <input className="admin-control-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" />
            <button className="admin-control-button">Search</button>
          </form>
          <button className="admin-control-button" onClick={newUser}>New user</button>
        </div>
      </AdminHeader>
      {loading ? <LoadingBlock label="Loading users" /> : null}
      {error ? <ErrorBlock message={error} /> : null}
      {message ? <p className="inline-status">{message}</p> : null}
      <section className="admin-crud-grid">
        <AdminPanel title="Accounts">
          <div className="admin-list">
            {users.map((user) => (
              <button key={user.id} className={`admin-list-row button-row-reset ${selected?.id === user.id ? "selected" : ""}`} onClick={() => setSelected(user)}>
                <span>{user.full_name || user.email}<small>{user.email}</small></span>
                <em>{user.role} · {user.is_active ? "active" : "inactive"}</em>
                <strong>{user.order_count}</strong>
              </button>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title={selected ? `Edit ${selected.email}` : "Create user"}>
          <form className="admin-form" key={selected?.id || "new-user"} onSubmit={saveUser}>
            <Field label="Email" name="email" type="email" defaultValue={selected?.email || ""} required />
            <Field label="Full name" name="full_name" defaultValue={selected?.full_name || ""} />
            <Field label="Phone" name="phone" defaultValue={selected?.phone || ""} />
            <Field label={selected ? "New password" : "Password"} name="password" type="password" minLength={8} placeholder={selected ? "Leave blank to keep current password" : "At least 8 characters"} required={!selected} />
            <Select label="Role" name="role" defaultValue={selected?.role || "customer"}>
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
            </Select>
            <div className="check-grid">
              <label className="check-row"><input type="checkbox" name="is_active" defaultChecked={selected?.is_active ?? true} /> Active</label>
              <label className="check-row"><input type="checkbox" name="is_staff" defaultChecked={selected?.is_staff ?? false} /> Can access admin UI</label>
              <label className="check-row"><input type="checkbox" name="is_superuser" defaultChecked={selected?.is_superuser ?? false} /> Superuser</label>
              <label className="check-row"><input type="checkbox" name="email_verified" defaultChecked={selected?.email_verified ?? false} /> Email verified</label>
            </div>
            <div className="button-row">
              <button className="quiet-button dark" disabled={saving}>{saving ? "Saving..." : selected ? "Save user" : "Create user"}</button>
              {selected ? <button type="button" className="quiet-button danger" onClick={deleteUser} disabled={saving || selected.id === currentUser?.id}>Remove user</button> : null}
            </div>
          </form>
        </AdminPanel>
      </section>
    </>
  );
}

function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const data = await api.payments(nextStatus ? `?status=${nextStatus}` : "");
      setPayments(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  async function retryPayment(payment: Payment) {
    setError("");
    try {
      await api.adminRetryMpesaPayment(payment.id, payment.phone);
      setMessage(`Retry started for ${payment.order_number}.`);
      await load(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retry payment.");
    }
  }

  return (
    <>
      <AdminHeader title="Payments" copy="Monitor M-Pesa transactions, receipts, failures, and retry eligible pending payments.">
        <Select label="Status" value={status} onChange={(event) => { setStatus(event.target.value); load(event.target.value); }}>
          <option value="">All payments</option>
          {paymentStatuses.map((item) => <option value={item} key={item}>{item}</option>)}
        </Select>
      </AdminHeader>
      {loading ? <LoadingBlock label="Loading payments" /> : null}
      {error ? <ErrorBlock message={error} /> : null}
      {message ? <p className="inline-status">{message}</p> : null}
      <AdminPanel title="Payment ledger">
        <div className="admin-table payments-table">
          <div className="admin-table-head">
            <span>Order</span><span>Status</span><span>Amount</span><span>Phone</span><span>Receipt</span><span>Action</span>
          </div>
          {payments.length ? payments.map((payment) => (
            <div className="admin-table-row" key={payment.id}>
              <span>{payment.order_number}<small>{payment.provider}</small></span>
              <span>{payment.status}</span>
              <span>{money(payment.amount)}</span>
              <span>{payment.phone || "-"}</span>
              <span>{payment.receipt_number || payment.result_description || "-"}</span>
              <span>
                {["pending", "failed", "cancelled"].includes(payment.status) ? (
                  <button className="quiet-button" onClick={() => retryPayment(payment)}>Retry</button>
                ) : "-"}
              </span>
            </div>
          )) : <p className="muted-small">No payments match this filter.</p>}
        </div>
      </AdminPanel>
    </>
  );
}

function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  async function load() {
    const data = await api.supportTickets();
    setTickets(data.results);
    setSelected((current) => current || data.results[0] || null);
  }

  useEffect(() => {
    load();
  }, []);

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const updated = await api.adminReplyTicket(selected.id, String(form.get("body") || ""), Boolean(form.get("internal")));
    setSelected(updated);
    event.currentTarget.reset();
    await load();
  }

  async function resolve() {
    if (!selected) return;
    setSelected(await api.adminResolveTicket(selected.id));
    await load();
  }

  return (
    <>
      <AdminHeader title="Support" copy="Read customer support tickets and reply from the admin UI." />
      <section className="admin-split">
        <AdminPanel title="Tickets">
          <div className="admin-list">
            {tickets.map((ticket) => (
              <button key={ticket.id} className={`admin-list-row button-row-reset ${selected?.id === ticket.id ? "selected" : ""}`} onClick={() => setSelected(ticket)}>
                <span>{ticket.subject}</span>
                <em>{ticket.status}</em>
                <strong>{ticket.priority}</strong>
              </button>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel title={selected ? selected.subject : "Conversation"}>
          {selected ? (
            <>
              <div className="support-thread">
                {selected.messages.map((message) => (
                  <article key={message.id}>
                    <strong>{message.sender_type}</strong>
                    <p>{message.body}</p>
                  </article>
                ))}
              </div>
              <form className="admin-form" onSubmit={reply}>
                <TextArea label="Reply" name="body" rows={4} required />
                <label className="check-row"><input type="checkbox" name="internal" /> Internal note</label>
                <div className="button-row">
                  <button className="quiet-button dark">Send reply</button>
                  <button type="button" className="quiet-button" onClick={resolve}>Mark resolved</button>
                </div>
              </form>
            </>
          ) : <p className="muted-small">No tickets selected.</p>}
        </AdminPanel>
      </section>
    </>
  );
}

function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState("pending");

  async function load(nextStatus = status) {
    const data = await apiFetchReviews(nextStatus);
    setReviews(data.results);
  }

  useEffect(() => {
    load("pending");
  }, []);

  async function moderate(id: number, action: "approve" | "reject") {
    if (action === "approve") await api.adminApproveReview(id);
    else await api.adminRejectReview(id);
    await load(status);
  }

  return (
    <>
      <AdminHeader title="Reviews" copy="Approve or reject customer product reviews.">
        <Select label="Status" value={status} onChange={(event) => { setStatus(event.target.value); load(event.target.value); }}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
      </AdminHeader>
      <AdminPanel title="Review queue">
        <div className="admin-list">
          {reviews.length ? reviews.map((review) => (
            <article key={review.id} className="review-admin-row">
              <div>
                <strong>★ {review.rating}.0 {review.title}</strong>
                <p>{review.comment}</p>
                <span>{review.user_name}</span>
              </div>
              <div className="button-row">
                <button className="quiet-button dark" onClick={() => moderate(review.id, "approve")}>Approve</button>
                <button className="quiet-button" onClick={() => moderate(review.id, "reject")}>Reject</button>
              </div>
            </article>
          )) : <p className="muted-small">No reviews in this queue.</p>}
        </div>
      </AdminPanel>
    </>
  );
}

function AdminPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

async function apiFetchReviews(status: string) {
  return apiFetch<{ results: Review[] }>(`/reviews/?status=${status}`);
}

const orderStatuses = [
  "pending_payment",
  "paid",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

const paymentStatuses = [
  "pending",
  "processing",
  "success",
  "failed",
  "cancelled",
];
