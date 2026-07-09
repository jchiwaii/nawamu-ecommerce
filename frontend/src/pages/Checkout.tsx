import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Cart, Order } from "../api/types";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { Field, Select, TextArea } from "../components/forms";
import { PageHero } from "../components/PageHero";
import { useAuth } from "../state/auth";
import { Link, useRouter } from "../state/router";
import { money } from "../utils";

type DeliveryMethod = "delivery" | "pickup";

const PICKUP_LOCATION = "Nawamu pickup point, Ngara, Nairobi";

const DELIVERY_LOCATIONS = [
  { name: "Nairobi CBD", city: "Nairobi", county: "Nairobi", baseFee: 180 },
  { name: "Ngara", city: "Nairobi", county: "Nairobi", baseFee: 120 },
  { name: "Westlands", city: "Nairobi", county: "Nairobi", baseFee: 250 },
  { name: "Kilimani", city: "Nairobi", county: "Nairobi", baseFee: 260 },
  { name: "Kasarani", city: "Nairobi", county: "Nairobi", baseFee: 320 },
  { name: "Embakasi", city: "Nairobi", county: "Nairobi", baseFee: 340 },
  { name: "Syokimau", city: "Machakos", county: "Machakos", baseFee: 420 },
  { name: "Rongai", city: "Kajiado", county: "Kajiado", baseFee: 450 },
  { name: "Kiambu Town", city: "Kiambu", county: "Kiambu", baseFee: 420 },
  { name: "Thika", city: "Thika", county: "Kiambu", baseFee: 520 },
];

const DELIVERY_WINDOWS = [
  { value: "Flexible delivery - confirm with rider", label: "Flexible delivery - confirm with rider", surcharge: 0 },
  { value: "Today, 2pm - 5pm", label: "Today, 2pm - 5pm", surcharge: 150 },
  { value: "Tomorrow, 9am - 12pm", label: "Tomorrow, 9am - 12pm", surcharge: 80 },
  { value: "Tomorrow, 2pm - 5pm", label: "Tomorrow, 2pm - 5pm", surcharge: 60 },
  { value: "Evening delivery, 6pm - 8pm", label: "Evening delivery, 6pm - 8pm", surcharge: 120 },
];

export function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("delivery");
  const [locationQuery, setLocationQuery] = useState("Nairobi CBD");
  const [deliveryWindow, setDeliveryWindow] = useState(DELIVERY_WINDOWS[0].value);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedLocation = useMemo(
    () => DELIVERY_LOCATIONS.find((location) => location.name.toLowerCase() === locationQuery.trim().toLowerCase()),
    [locationQuery],
  );
  const selectedWindow = useMemo(
    () => DELIVERY_WINDOWS.find((window) => window.value === deliveryWindow) || DELIVERY_WINDOWS[0],
    [deliveryWindow],
  );
  const deliveryFee = useMemo(() => {
    if (deliveryMethod === "pickup") return 0;
    const baseFee = selectedLocation?.baseFee ?? 350;
    return baseFee + selectedWindow.surcharge;
  }, [deliveryMethod, selectedLocation, selectedWindow]);
  const estimatedTotal = Number(cart?.subtotal || 0) + deliveryFee;

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
    const customerNote = String(form.get("customer_note") || "").trim();
    const fulfillmentNote = [
      `Fulfillment: ${deliveryMethod === "pickup" ? "Free pickup at Ngara" : "Deliver to my location"}`,
      deliveryMethod === "pickup" ? `Pickup location: ${PICKUP_LOCATION}` : `Delivery location: ${locationQuery}`,
      `Preferred time: ${selectedWindow.label}`,
      customerNote ? `Customer note: ${customerNote}` : "",
    ].filter(Boolean).join("\n");
    const deliveryAddress = String(form.get("shipping_line1") || "").trim();
    try {
      const response = await api.checkout({
        fulfillment_method: deliveryMethod,
        shipping_full_name: form.get("shipping_full_name"),
        shipping_phone: form.get("shipping_phone"),
        shipping_line1: deliveryMethod === "pickup" ? PICKUP_LOCATION : deliveryAddress,
        shipping_city: deliveryMethod === "pickup" ? "Nairobi" : selectedLocation?.city || locationQuery,
        shipping_county: deliveryMethod === "pickup" ? "Nairobi" : selectedLocation?.county || "",
        shipping_amount: deliveryFee.toFixed(2),
        delivery_location: deliveryMethod === "pickup" ? "" : locationQuery,
        preferred_delivery_window: selectedWindow.label,
        pickup_location: deliveryMethod === "pickup" ? PICKUP_LOCATION : "",
        customer_note: fulfillmentNote,
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
        <PageHero eyebrow="Order created" title="M-Pesa payment started." copy="Your fulfillment details have been saved with the order." />
        <section className="summary-card wide">
          <h2>{order.number}</h2>
          <p>Status: {order.status}</p>
          <p>Method: {order.fulfillment_method === "pickup" ? "Free pickup at Ngara" : "Deliver to my location"}</p>
          {order.fulfillment_method === "delivery" ? <p>Delivery: {order.delivery_location} · {order.preferred_delivery_window}</p> : <p>Pickup: {order.pickup_location}</p>}
          <p>Total: {money(order.total)}</p>
          <Link to={`/account/orders/${order.number}`} className="button primary">Track order</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero eyebrow="Checkout" title="Delivery, pickup, and payment." copy="Choose home delivery or free pickup, then pay securely without leaving this page." />
      <section className="checkout-layout">
        <form className="panel-form" onSubmit={submit}>
          <div className="checkout-step">
            <p className="eyebrow">Delivery Method</p>
            <div className="delivery-methods">
              <button
                type="button"
                className={deliveryMethod === "delivery" ? "delivery-card selected" : "delivery-card"}
                aria-pressed={deliveryMethod === "delivery"}
                onClick={() => setDeliveryMethod("delivery")}
              >
                <strong>Deliver to my location</strong>
                <span>Your order is delivered to exactly where you are, within your preferred time.</span>
              </button>
              <button
                type="button"
                className={deliveryMethod === "pickup" ? "delivery-card selected" : "delivery-card"}
                aria-pressed={deliveryMethod === "pickup"}
                onClick={() => setDeliveryMethod("pickup")}
              >
                <strong>Free pickup at Ngara, Nrb</strong>
                <span>Collect from the shop with no delivery charge.</span>
              </button>
            </div>
          </div>

          <Field label="Full name" name="shipping_full_name" defaultValue={user?.full_name || ""} required />
          <Field label="Shipping phone" name="shipping_phone" defaultValue={user?.phone || ""} required />

          {deliveryMethod === "delivery" ? (
            <div className="checkout-step">
              <Field
                label="Delivery Location *"
                name="delivery_location"
                list="delivery-locations"
                placeholder="Search for your town..."
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                required
              />
              <datalist id="delivery-locations">
                {DELIVERY_LOCATIONS.map((location) => (
                  <option key={location.name} value={location.name} />
                ))}
              </datalist>
              <TextArea
                label="Exact address / landmark"
                name="shipping_line1"
                rows={3}
                placeholder="Estate, building, street, shop name, gate, or rider instructions"
                required
              />
              <Select
                label="Preferred delivery time"
                name="preferred_delivery_window"
                value={deliveryWindow}
                onChange={(event) => setDeliveryWindow(event.target.value)}
              >
                {DELIVERY_WINDOWS.map((window) => (
                  <option key={window.value} value={window.value}>{window.label}</option>
                ))}
              </Select>
              <div className="delivery-note">
                <strong>{money(deliveryFee)} estimated delivery fee</strong>
                <span>Delivery fee will vary with your town, exact location, and preferred time. Final rider confirmation can be handled by admin before fulfillment.</span>
              </div>
            </div>
          ) : (
            <div className="pickup-box">
              <p className="eyebrow">Pickup Location</p>
              <strong>{PICKUP_LOCATION}</strong>
              <span>Pickup is free. We will keep the order ready once payment is confirmed.</span>
              <Select
                label="Preferred pickup time"
                name="preferred_delivery_window"
                value={deliveryWindow}
                onChange={(event) => setDeliveryWindow(event.target.value)}
              >
                {DELIVERY_WINDOWS.map((window) => (
                  <option key={window.value} value={window.value}>{window.label}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="payment-box">
            <p className="eyebrow">Payment</p>
            <p>Pay securely with M-Pesa or your debit/credit card, without leaving this page.</p>
            <Field label="M-Pesa phone" name="mpesa_phone" defaultValue={user?.phone || ""} required />
          </div>
          <TextArea label="Customer note" name="customer_note" rows={4} />
          <button className="button primary full">Start secure checkout</button>
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
          <div className="summary-row">
            <span>{deliveryMethod === "pickup" ? "Pickup" : "Delivery estimate"}</span>
            <strong>{deliveryFee ? money(deliveryFee) : "Free"}</strong>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <strong>{money(estimatedTotal)}</strong>
          </div>
          <p className="summary-note">Delivery fee varies by place and time. Pickup at Ngara is always free.</p>
        </aside>
      </section>
    </>
  );
}
