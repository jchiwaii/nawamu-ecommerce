import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { api, apiFetch } from "../api/client";
import type { AdminDashboard, AdminUser, Order, Product, Review, SupportTicket } from "../api/types";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { Field, Select, TextArea } from "../components/forms";
import { useAuth } from "../state/auth";
import { Link, useRouter } from "../state/router";
import { money } from "../utils";

type AdminTab = "dashboard" | "orders" | "products" | "users" | "support" | "reviews";

const tabs: { id: AdminTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "orders", label: "Orders" },
  { id: "products", label: "Products" },
  { id: "users", label: "Users" },
  { id: "support", label: "Support" },
  { id: "reviews", label: "Reviews" },
];

export function AdminPage({ tab }: { tab: AdminTab }) {
  return (
    <RequireStaff>
      <section className="admin-shell">
        <aside className="admin-sidebar">
          <Link to="/" className="brand admin-brand">
            <span className="brand-mark">N</span>
            <span>Nawamu Admin</span>
          </Link>
          <nav>
            {tabs.map((item) => (
              <Link key={item.id} to={item.id === "dashboard" ? "/admin" : `/admin/${item.id}`} className={item.id === tab ? "active" : ""}>
                {item.label}
              </Link>
            ))}
          </nav>
          <a href="http://127.0.0.1:8000/admin/" className="admin-external">
            Django Admin
          </a>
          <a href="http://127.0.0.1:8000/api/docs/" className="admin-external">
            API Docs
          </a>
        </aside>
        <main className="admin-main">
          {tab === "dashboard" ? <AdminDashboardPage /> : null}
          {tab === "orders" ? <AdminOrdersPage /> : null}
          {tab === "products" ? <AdminProductsPage /> : null}
          {tab === "users" ? <AdminUsersPage /> : null}
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
    if (!loading && !user) router.navigate("/login");
  }, [loading, user, router]);

  if (loading) return <LoadingBlock label="Checking admin access" />;
  if (!user) return null;
  if (!user.is_staff) {
    return (
      <EmptyBlock>
        <h2>Staff access required.</h2>
        <p>Login with a staff/admin account to open the admin UI.</p>
        <Link to="/login" className="button primary">Login</Link>
      </EmptyBlock>
    );
  }
  return <>{children}</>;
}

function AdminHeader({ title, copy, children }: { title: string; copy: string; children?: ReactNode }) {
  return (
    <header className="admin-header">
      <div>
        <p className="tiny-label">Backend control</p>
        <h1>{title}</h1>
        <p>{copy}</p>
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
      <AdminHeader title="Store overview" copy="Live metrics from the Django staff dashboard API." />
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
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    load("");
  }, []);

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const updated = await api.adminUpdateOrderStatus(selected.number, {
      status: form.get("status"),
      note: form.get("note"),
      courier_name: form.get("courier_name"),
      tracking_number: form.get("tracking_number"),
      tracking_url: form.get("tracking_url"),
    });
    setSelected(updated);
    await load(filter);
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
    </>
  );
}

function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(search = query) {
    setLoading(true);
    const data = await api.products(search ? `?q=${encodeURIComponent(search)}&page_size=50` : "?page_size=50");
    setProducts(data.results);
    setLoading(false);
  }

  useEffect(() => {
    load("");
  }, []);

  return (
    <>
      <AdminHeader title="Products and stock" copy="Browse catalog records from the API. Deep product editing remains available in Django Admin.">
        <form className="admin-inline-form" onSubmit={(event) => { event.preventDefault(); load(query); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
          <button>Search</button>
        </form>
      </AdminHeader>
      {loading ? <LoadingBlock label="Loading products" /> : null}
      <AdminPanel title="Catalog">
        <div className="admin-table">
          <div className="admin-table-head">
            <span>Product</span><span>Brand</span><span>Gender</span><span>Price</span><span>Variants</span><span>Sold</span>
          </div>
          {products.map((product) => (
            <Link to={`/shop/${product.slug}`} className="admin-table-row" key={product.id}>
              <span>{product.name}</span>
              <span>{product.brand.name}</span>
              <span>{product.gender}</span>
              <span>{money(product.base_price)}</span>
              <span>{product.variants?.length || "Detail"}</span>
              <span>{product.sold_count}</span>
            </Link>
          ))}
        </div>
      </AdminPanel>
    </>
  );
}

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load(query = search) {
    setLoading(true);
    const data = await api.adminUsers(query ? `?search=${encodeURIComponent(query)}` : "");
    setUsers(data.results);
    setLoading(false);
  }

  useEffect(() => {
    load("");
  }, []);

  return (
    <>
      <AdminHeader title="Users" copy="Staff-visible customer and admin records from `/api/admin/users/`.">
        <form className="admin-inline-form" onSubmit={(event) => { event.preventDefault(); load(search); }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" />
          <button>Search</button>
        </form>
      </AdminHeader>
      {loading ? <LoadingBlock label="Loading users" /> : null}
      <AdminPanel title="Accounts">
        <div className="admin-table user-table">
          <div className="admin-table-head">
            <span>User</span><span>Phone</span><span>Role</span><span>Orders</span><span>Status</span>
          </div>
          {users.map((user) => (
            <div className="admin-table-row" key={user.id}>
              <span>{user.full_name || user.email}<small>{user.email}</small></span>
              <span>{user.phone || "-"}</span>
              <span>{user.role}</span>
              <span>{user.order_count}</span>
              <span>{user.is_active ? "Active" : "Inactive"}</span>
            </div>
          ))}
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
