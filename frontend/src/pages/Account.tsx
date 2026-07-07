import { FormEvent, ReactNode, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Order, Product, SupportTicket } from "../api/types";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { ProductCard } from "../components/ProductCard";
import { Field, TextArea } from "../components/forms";
import { PageHero } from "../components/PageHero";
import { useAuth } from "../state/auth";
import { Link, useRouter } from "../state/router";
import { money } from "../utils";

function RequireLogin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.navigate("/login");
  }, [loading, user, router]);
  if (loading) return <LoadingBlock label="Checking account" />;
  if (!user) return null;
  return <>{children}</>;
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.orders().then((data) => setOrders(data.results)).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  return (
    <RequireLogin>
      <>
        <PageHero eyebrow="Orders" title="Track every order." copy="Order history and statuses come from `/api/orders/`." />
        {loading ? <LoadingBlock label="Loading orders" /> : null}
        {error ? <ErrorBlock message={error} /> : null}
        {!loading && orders.length === 0 ? <EmptyBlock>No orders yet.</EmptyBlock> : null}
        <section className="list-panel">
          {orders.map((order) => (
            <Link to={`/account/orders/${order.number}`} className="order-row" key={order.id}>
              <span>{order.number}</span>
              <strong>{money(order.total)}</strong>
              <em>{order.status.replaceAll("_", " ")}</em>
            </Link>
          ))}
        </section>
      </>
    </RequireLogin>
  );
}

export function OrderDetailPage({ number }: { number: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.order(number).then(setOrder).catch((err) => setError(err.message));
  }, [number]);

  return (
    <RequireLogin>
      <>
        {!order && !error ? <LoadingBlock label="Loading order" /> : null}
        {error ? <ErrorBlock message={error} /> : null}
        {order ? (
          <>
            <PageHero eyebrow="Order detail" title={order.number} copy={`Current status: ${order.status.replaceAll("_", " ")}`} />
            <section className="checkout-layout">
              <div className="list-panel">
                {order.items.map((item) => (
                  <article className="summary-row" key={item.id}>
                    <span>{item.quantity} × {item.product_name}</span>
                    <strong>{money(item.line_total)}</strong>
                  </article>
                ))}
              </div>
              <aside className="summary-card">
                <p className="eyebrow">Tracking</p>
                <p>Courier: {order.courier_name || "Pending"}</p>
                <p>Tracking: {order.tracking_number || "Not assigned"}</p>
                <div className="timeline">
                  {order.status_history.map((history) => (
                    <article key={history.id}>
                      <strong>{history.status.replaceAll("_", " ")}</strong>
                      <span>{new Date(history.created_at).toLocaleString()}</span>
                      {history.note ? <p>{history.note}</p> : null}
                    </article>
                  ))}
                </div>
              </aside>
            </section>
          </>
        ) : null}
      </>
    </RequireLogin>
  );
}

export function FavoritesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.favorites().then((data) => setProducts(data.results.map((item) => item.product_detail))).finally(() => setLoading(false));
  }, []);

  return (
    <RequireLogin>
      <>
        <PageHero eyebrow="Favorites" title="Saved pairs." copy="Favorites are stored in the backend for your account." />
        {loading ? <LoadingBlock label="Loading favorites" /> : null}
        {!loading && products.length === 0 ? <EmptyBlock>No saved shoes yet.</EmptyBlock> : null}
        <section className="section">
          <div className="product-grid">
            {products.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}
          </div>
        </section>
      </>
    </RequireLogin>
  );
}

export function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [status, setStatus] = useState("");

  async function load() {
    const data = await api.supportTickets();
    setTickets(data.results);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.createSupportTicket({
      subject: form.get("subject"),
      message: form.get("message"),
      category: "account",
    });
    event.currentTarget.reset();
    setStatus("Ticket created.");
    await load();
  }

  return (
    <RequireLogin>
      <>
        <PageHero eyebrow="Support" title="Messages with admin." copy="Create tickets and read replies connected to your account." />
        <section className="checkout-layout">
          <form className="panel-form" onSubmit={submit}>
            <Field label="Subject" name="subject" required />
            <TextArea label="Message" name="message" rows={5} required />
            <button className="button primary">Create ticket</button>
            {status ? <p className="inline-status">{status}</p> : null}
          </form>
          <div className="list-panel">
            {tickets.map((ticket) => (
              <article className="ticket-card" key={ticket.id}>
                <strong>{ticket.subject}</strong>
                <span>{ticket.status}</span>
                {ticket.messages.slice(-1).map((message) => <p key={message.id}>{message.body}</p>)}
              </article>
            ))}
          </div>
        </section>
      </>
    </RequireLogin>
  );
}
