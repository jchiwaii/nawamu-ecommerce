import { PageHero } from "../components/PageHero";
import { SectionHeader } from "../components/SectionHeader";
import { Link } from "../state/router";

export function About() {
  return (
    <>
      <PageHero
        eyebrow="About Nawamu"
        title="A shoe store with a backend strong enough to grow."
        copy="The frontend is designed to feel calm, practical, and premium while the Django backend handles catalog, users, cart, orders, payments, and support."
      >
        <Link to="/shop" className="button primary">
          Explore shoes
        </Link>
      </PageHero>

      <section className="section story-grid">
        <div className="story-image" />
        <div>
          <p className="eyebrow">Our story</p>
          <h2>From first browse to delivery, every step is connected.</h2>
          <p>
            Nawamu is built around the real customer path: discover a pair, choose a variant, save it,
            add it to cart, pay by M-Pesa, then track the order until it arrives.
          </p>
          <p>
            Admins can manage products, users, stock, support tickets, and orders from the Django Admin,
            while the customer sees a clean storefront.
          </p>
        </div>
      </section>

      <section className="section numbers">
        <article>
          <strong>24/7</strong>
          <span>Support-ready flow</span>
        </article>
        <article>
          <strong>SKU</strong>
          <span>Variant stock control</span>
        </article>
        <article>
          <strong>M-Pesa</strong>
          <span>Checkout integration</span>
        </article>
      </section>

      <section className="section two-col">
        <div>
          <SectionHeader eyebrow="Vision" title="Make online shoe buying feel certain." />
          <p>
            Clear product details, visible stock, useful search, and support that routes directly to admin.
          </p>
        </div>
        <div>
          <SectionHeader eyebrow="Mission" title="Keep the customer path short and honest." />
          <p>
            No decorative clutter. Just strong product discovery, reliable checkout, and transparent order status.
          </p>
        </div>
      </section>

      <section className="section values-strip">
        <article>
          <span>Fit</span>
          <h3>Size-first buying</h3>
          <p>Every purchase is tied to the chosen variant, not a vague product.</p>
        </article>
        <article>
          <span>Care</span>
          <h3>Human support</h3>
          <p>Contact forms become conversations the admin can answer.</p>
        </article>
        <article>
          <span>Trust</span>
          <h3>Traceable orders</h3>
          <p>Status history keeps customers informed after payment.</p>
        </article>
      </section>
    </>
  );
}
