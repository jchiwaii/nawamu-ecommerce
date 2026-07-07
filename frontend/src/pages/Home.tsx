import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Category, Product, Review } from "../api/types";
import { ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { ProductCard } from "../components/ProductCard";
import { SectionHeader } from "../components/SectionHeader";
import { Link } from "../state/router";
import { money, productImage } from "../utils";

export function Home() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [popular, setPopular] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [featuredData, popularData, categoryData] = await Promise.all([
          api.products("?is_featured=true&page_size=6"),
          api.products("?ordering=-created_at&page_size=4"),
          api.categories(),
        ]);
        setFeatured(featuredData.results);
        setPopular(popularData.results);
        setCategories(Array.isArray(categoryData) ? categoryData : categoryData.results);
        if (featuredData.results[0]) {
          const reviewData = await api.productReviews(featuredData.results[0].slug);
          setReviews(reviewData.results.slice(0, 3));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load storefront data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingBlock label="Loading Nawamu storefront" />;
  if (error) return <ErrorBlock message={error} />;

  const heroProduct = featured[0] || popular[0];

  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">New season footwear</p>
          <h1>Shoes that keep up with your whole day.</h1>
          <p>
            Browse everyday runners, clean sneakers, and durable boots pulled live from the Django catalog.
          </p>
          <div className="button-row">
            <Link to="/shop" className="button primary">
              Shop collection
            </Link>
            <Link to="/about" className="button ghost">
              Our story
            </Link>
          </div>
        </div>
        {heroProduct ? (
          <Link to={`/shop/${heroProduct.slug}`} className="hero-product">
            <img src={productImage(heroProduct)} alt={heroProduct.name} />
            <div>
              <span>Featured</span>
              <h2>{heroProduct.name}</h2>
              <p>{money(heroProduct.min_price || heroProduct.base_price)}</p>
            </div>
          </Link>
        ) : null}
      </section>

      <section className="section">
        <SectionHeader
          eyebrow="New arrivals"
          title="Fresh pairs from the backend"
          copy="Every product card here is loaded from `/api/products/` and can go straight into cart."
        >
          <Link to="/shop">View all</Link>
        </SectionHeader>
        <div className="product-grid">
          {featured.map((product, index) => (
            <ProductCard product={product} index={index} key={product.id} />
          ))}
        </div>
      </section>

      <section className="banner">
        <div>
          <p className="eyebrow">Built for movement</p>
          <h2>Find your size, choose your color, pay by M-Pesa.</h2>
        </div>
        <Link to="/shop?q=best%20shoes%20of%20men" className="button dark">
          Search men&apos;s best shoes
        </Link>
      </section>

      <section className="section split-section">
        <div>
          <SectionHeader
            eyebrow="Categories"
            title="Shop by intent"
            copy="Categories come from Django Admin, so the storefront updates when the admin changes the catalog."
          />
        </div>
        <div className="category-grid">
          {categories.slice(0, 6).map((category) => (
            <Link key={category.id} to={`/shop?category=${category.slug}`} className="category-card">
              <span>{category.name.slice(0, 2)}</span>
              <h3>{category.name}</h3>
              <p>{category.description || "Explore available shoes and variants."}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader eyebrow="Most popular" title="Pairs people keep choosing" />
        <div className="product-grid compact">
          {popular.map((product, index) => (
            <ProductCard product={product} index={index + 4} key={product.id} />
          ))}
        </div>
      </section>

      <section className="section values-strip">
        <article>
          <span>01</span>
          <h3>Variant-level stock</h3>
          <p>Size and color availability is checked before cart and checkout.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Live order tracking</h3>
          <p>Customers can follow status history once their order is placed.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Support threads</h3>
          <p>Contact messages become admin-managed support tickets.</p>
        </article>
      </section>

      <section className="section testimonials">
        <SectionHeader eyebrow="Reviews" title="Customer notes" />
        <div className="testimonial-grid">
          {(reviews.length ? reviews : demoReviews).map((review) => (
            <article key={review.id}>
              <p>“{review.comment}”</p>
              <strong>{review.user_name}</strong>
              <span>★ {review.rating}.0</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

const demoReviews: Review[] = [
  {
    id: 1,
    product: 1,
    user_name: "Nawamu customer",
    rating: 5,
    title: "Comfortable",
    comment: "Clean fit, fast checkout, and the size was exactly right.",
    is_verified_purchase: true,
    created_at: "",
  },
];
