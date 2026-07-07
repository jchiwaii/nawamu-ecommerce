import { AuthProvider } from "./state/auth";
import { RouterProvider, useRouter } from "./state/router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { About } from "./pages/About";
import { Shop } from "./pages/Shop";
import { ProductDetail } from "./pages/ProductDetail";
import { Contact } from "./pages/Contact";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { CartPage } from "./pages/Cart";
import { CheckoutPage } from "./pages/Checkout";
import { FavoritesPage, OrderDetailPage, OrdersPage, SupportPage } from "./pages/Account";
import { AdminPage } from "./pages/Admin";

export function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <Layout>
          <Routes />
        </Layout>
      </AuthProvider>
    </RouterProvider>
  );
}

function Routes() {
  const { path } = useRouter();
  const pathname = path.split("?")[0].replace(/\/$/, "") || "/";

  if (pathname === "/") return <Home />;
  if (pathname === "/about") return <About />;
  if (pathname === "/shop") return <Shop />;
  if (pathname.startsWith("/shop/")) return <ProductDetail slug={decodeURIComponent(pathname.replace("/shop/", ""))} />;
  if (pathname === "/contact") return <Contact />;
  if (pathname === "/login") return <LoginPage />;
  if (pathname === "/register") return <RegisterPage />;
  if (pathname === "/cart") return <CartPage />;
  if (pathname === "/checkout") return <CheckoutPage />;
  if (pathname === "/favorites") return <FavoritesPage />;
  if (pathname === "/support") return <SupportPage />;
  if (pathname === "/account/orders") return <OrdersPage />;
  if (pathname.startsWith("/account/orders/")) {
    return <OrderDetailPage number={decodeURIComponent(pathname.replace("/account/orders/", ""))} />;
  }
  if (pathname === "/admin") return <AdminPage tab="dashboard" />;
  if (pathname === "/admin/orders") return <AdminPage tab="orders" />;
  if (pathname === "/admin/products") return <AdminPage tab="products" />;
  if (pathname === "/admin/users") return <AdminPage tab="users" />;
  if (pathname === "/admin/support") return <AdminPage tab="support" />;
  if (pathname === "/admin/reviews") return <AdminPage tab="reviews" />;

  return (
    <section className="page-hero">
      <p className="eyebrow">404</p>
      <h1>That page is not in the storefront yet.</h1>
      <p>Use the shop, cart, account, or contact paths from the navigation.</p>
    </section>
  );
}
