import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Cart, Order } from "../api/types";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { Field, TextArea } from "../components/forms";
import { PageHero } from "../components/PageHero";
import { useAuth } from "../state/auth";
import { Link, useRouter } from "../state/router";
import { money } from "../utils";

export function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.navigate("/login");
      return;
    }
    api.cart().then(setCart).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [authLoading, user, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      const response = await api.checkout({
        shipping_full_name: form.get("shipping_full_name"),
        shipping_phone: form.get("shipping_phone"),
        shipping_line1: form.get("shipping_line1"),
        shipping_city: form.get("shipping_city"),
        shipping_county: form.get("shipping_county"),
        customer_note: form.get("customer_note"),
        mpesa_phone: form.get("mpesa_phone"),
      });
      setOrder(response.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    }
  }

  if (loading || authLoading) return <LoadingBlock label="Preparing checkout" />;
  if (!cart || cart.items.length === 0) return <EmptyBlock><h2>No items to checkout.</h2><Link to="/shop" className="button primary">Shop shoes</Link></EmptyBlock>;

  if (order) {
    return (
      <>
        <PageHero eyebrow="Order created" title="M-Pesa payment started." copy="The backend created the order and initiated the payment request." />
        <section className="summary-card wide">
          <h2>{order.number}</h2>
          <p>Status: {order.status}</p>
          <p>Total: {money(order.total)}</p>
          <Link to={`/account/orders/${order.number}`} className="button primary">Track order</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero eyebrow="Checkout" title="Shipping and M-Pesa details." copy="Checkout creates an order, reserves stock, and starts payment through the Django backend." />
      <section className="checkout-layout">
        <form className="panel-form" onSubmit={submit}>
          <Field label="Full name" name="shipping_full_name" defaultValue={user?.full_name || ""} required />
          <Field label="Shipping phone" name="shipping_phone" defaultValue={user?.phone || ""} required />
          <Field label="M-Pesa phone" name="mpesa_phone" defaultValue={user?.phone || ""} required />
          <Field label="Address line" name="shipping_line1" required />
          <div className="filter-row">
            <Field label="City" name="shipping_city" required />
            <Field label="County" name="shipping_county" />
          </div>
          <TextArea label="Customer note" name="customer_note" rows={4} />
          <button className="button primary full">Start M-Pesa checkout</button>
          {error ? <p className="inline-status error-text">{error}</p> : null}
        </form>
        <aside className="summary-card">
          <p className="eyebrow">Cart total</p>
          {cart.items.map((item) => (
            <div className="summary-row" key={item.id}>
              <span>{item.quantity} × {item.product.name}</span>
              <strong>{money(item.line_total)}</strong>
            </div>
          ))}
          <div className="summary-row total">
            <span>Total</span>
            <strong>{money(cart.subtotal)}</strong>
          </div>
        </aside>
      </section>
    </>
  );
}
