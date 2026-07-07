import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Cart as CartType } from "../api/types";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { PageHero } from "../components/PageHero";
import { Link } from "../state/router";
import { money, productImage } from "../utils";

export function CartPage() {
  const [cart, setCart] = useState<CartType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setCart(await api.cart());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load cart.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function update(itemId: number, quantity: number) {
    setCart(await api.updateCartItem(itemId, quantity));
  }

  async function remove(itemId: number) {
    setCart(await api.removeCartItem(itemId));
  }

  return (
    <>
      <PageHero eyebrow="Cart" title="Review your selected shoes." copy="Your cart uses the Django cart token and merges when you login." />
      {loading ? <LoadingBlock label="Loading cart" /> : null}
      {error ? <ErrorBlock message={error} /> : null}
      {!loading && cart && cart.items.length === 0 ? (
        <EmptyBlock>
          <h2>Your cart is empty.</h2>
          <Link to="/shop" className="button primary">Go to shop</Link>
        </EmptyBlock>
      ) : null}
      {cart && cart.items.length ? (
        <section className="cart-layout">
          <div className="cart-items">
            {cart.items.map((item) => (
              <article className="cart-item" key={item.id}>
                <img src={productImage(item.product)} alt={item.product.name} />
                <div>
                  <h3>{item.product.name}</h3>
                  <p>{item.variant.size} / {item.variant.color} · {item.variant.sku}</p>
                  <strong>{money(item.unit_price)}</strong>
                </div>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) => update(item.id, Number(event.target.value))}
                />
                <strong>{money(item.line_total)}</strong>
                <button onClick={() => remove(item.id)}>Remove</button>
              </article>
            ))}
          </div>
          <aside className="summary-card">
            <p className="eyebrow">Order summary</p>
            <div className="summary-row">
              <span>Items</span>
              <strong>{cart.item_count}</strong>
            </div>
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{money(cart.subtotal)}</strong>
            </div>
            <Link to="/checkout" className="button primary full">Continue to checkout</Link>
          </aside>
        </section>
      ) : null}
    </>
  );
}
