import { PropsWithChildren, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { Link, useRouter } from "../state/router";
import type { Cart } from "../api/types";

export function Layout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);

  useEffect(() => {
    api.cart().then(setCart).catch(() => setCart(null));
  }, [router.path]);

  const nav = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/shop", label: "Shop" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <div className="site-shell">
      <header className="nav-wrap">
        <nav className="nav">
          <Link to="/" className="brand" ariaLabel="Nawamu home">
            <span className="brand-mark">N</span>
            <span>Nawamu</span>
          </Link>
          <div className="nav-links">
            {nav.map((item) => (
              <Link key={item.href} to={item.href} className={router.path.split("?")[0] === item.href ? "active" : ""}>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="nav-actions">
            {user?.is_staff ? (
              <Link to="/admin" className="icon-link" ariaLabel="Admin dashboard">
                Admin
              </Link>
            ) : null}
            <Link to="/favorites" className="icon-link" ariaLabel="Favorites">
              Saved
            </Link>
            <Link to="/cart" className="cart-pill" ariaLabel="Cart">
              Cart <span>{cart?.item_count || 0}</span>
            </Link>
            {user ? (
              <button
                className="text-button"
                onClick={() => {
                  logout();
                  router.navigate("/");
                }}
              >
                Logout
              </button>
            ) : (
              <Link to="/login" className="text-button">
                Login
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <section className="newsletter">
        <div>
          <p className="eyebrow">Nawamu updates</p>
          <h2>New drops, quiet deals, and care notes for your shoes.</h2>
        </div>
        <form className="newsletter-form" onSubmit={(event) => event.preventDefault()}>
          <input type="email" placeholder="Email address" aria-label="Email address" />
          <button type="submit">Join list</button>
        </form>
      </section>
      <div className="footer-grid">
        <div>
          <Link to="/" className="brand footer-brand">
            <span className="brand-mark">N</span>
            <span>Nawamu</span>
          </Link>
          <p>Clean, durable footwear for everyday motion. Built for Nairobi pace and everywhere after.</p>
        </div>
        <div>
          <h3>Shop</h3>
          <Link to="/shop?gender=men">Men</Link>
          <Link to="/shop?gender=women">Women</Link>
          <Link to="/shop?gender=unisex">Unisex</Link>
        </div>
        <div>
          <h3>Help</h3>
          <Link to="/contact">Contact support</Link>
          <Link to="/account/orders">Track orders</Link>
          <Link to="/support">Support tickets</Link>
        </div>
        <div>
          <h3>Backend</h3>
          <a href="http://127.0.0.1:8000/admin/">Django Admin</a>
          <Link to="/admin">React Admin UI</Link>
          <a href="http://127.0.0.1:8000/api/docs/">API Docs</a>
        </div>
      </div>
      <p className="fineprint">Nawamu © 2026. Ecommerce frontend connected to Django REST API.</p>
    </footer>
  );
}
