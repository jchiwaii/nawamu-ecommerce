import { useEffect, useState } from "react";
import { api, asList } from "../api/client";
import type { Brand, Category, Product, Review } from "../api/types";
import { ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { ProductCard } from "../components/ProductCard";
import { Link } from "../state/router";
import { money, productImage } from "../utils";

export function Home() {
  const [latest, setLatest] = useState<Product[]>([]);
  const [popular, setPopular] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [latestData, popularData, categoryData, brandData] = await Promise.all([
          api.products("?ordering=-created_at&page_size=6"),
          api.products("?ordering=-sold_count&page_size=4"),
          api.categories(),
          api.brands(),
        ]);
        setLatest(latestData.results);
        setPopular(popularData.results.length ? popularData.results : latestData.results.slice(0, 4));
        setCategories(asList(categoryData));
        setBrands(asList(brandData));
        if (latestData.results[0]) {
          const reviewData = await api.productReviews(latestData.results[0].slug);
          setReviews(reviewData.results.slice(0, 2));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load storefront data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingBlock label="Loading Nawamu" />;
  if (error) return <ErrorBlock message={error} />;

  const leadProducts = latest.slice(0, 4);
  const heroProduct = latest[0] || popular[0];

  return (
    <>
      <section className="market-hero">
        <div className="market-hero-inner">
          <p className="tiny-label">New season</p>
          <h1>New shoes have arrived</h1>
          <p>Shop clean everyday pairs from different brands for men, women, and kids.</p>
          <Link to="/shop" className="quiet-button dark">
            Explore the collection
          </Link>
        </div>
      </section>

      <section className="home-section latest-layout">
        <div className="section-side-copy">
          <p className="tiny-label">Latest looks</p>
          <h2>For every day, every size, every brand.</h2>
          <p>
            A simple catalogue that updates from Django Admin. Add shoes, sizes, colours, and stock once; the shop updates here.
          </p>
          <Link to="/shop" className="under-link">
            Browse all
          </Link>
        </div>
        <div className="mini-product-grid">
          {leadProducts.map((product, index) => (
            <ProductCard product={product} index={index} key={product.id} />
          ))}
        </div>
      </section>

      <section className="sale-strip">
        <div>
          <p className="tiny-label light">Mid-year sale</p>
          <h2>Up to 40% off selected shoes</h2>
          <p>Use the admin dashboard to feature sale products and keep the offer current.</p>
        </div>
        <Link to="/shop?ordering=base_price" className="quiet-button light-button">
          View deals
        </Link>
      </section>

      <section className="home-section">
        <div className="simple-heading">
          <h2>Customer favourites</h2>
          <Link to="/shop?ordering=-sold_count">See all</Link>
        </div>
        <div className="favorite-grid">
          {popular.slice(0, 4).map((product, index) => (
            <ProductCard product={product} index={index + 3} key={product.id} />
          ))}
        </div>
      </section>

      <section className="brand-panel">
        <div className="brand-panel-image">
          {heroProduct ? <img src={productImage(heroProduct)} alt={heroProduct.name} /> : null}
        </div>
        <div className="brand-panel-copy">
          <p className="tiny-label">About us</p>
          <h2>Multi-brand shoes, kept clear and easy to buy.</h2>
          <p>
            Nawamu is shaped like a modern marketplace, but kept calm: quick search, visible prices, cart, M-Pesa checkout, support,
            and order tracking.
          </p>
          <div className="service-row">
            <span>Variant stock</span>
            <span>M-Pesa ready</span>
            <span>Order tracking</span>
          </div>
        </div>
      </section>

      <section className="home-section explore-layout">
        <div className="section-side-copy">
          <p className="tiny-label">Explore</p>
          <h2>Shop by customer</h2>
          <p>Men, women, kids, and unisex pairs are handled as backend filters.</p>
        </div>
        <div className="room-grid">
          <Link to="/shop?gender=men" className="room-card">
            <span />
            <h3>Men</h3>
            <p>Runners, sneakers, boots, and daily pairs.</p>
          </Link>
          <Link to="/shop?gender=women" className="room-card">
            <span />
            <h3>Women</h3>
            <p>Clean styles from multiple brands.</p>
          </Link>
          <Link to="/shop?gender=kids" className="room-card">
            <span />
            <h3>Kids</h3>
            <p>Simple filtering for young shoppers.</p>
          </Link>
        </div>
      </section>

      <section className="home-section brand-cloud">
        <div className="simple-heading">
          <h2>Browse brands</h2>
          <Link to="/shop">All products</Link>
        </div>
        <div className="brand-tags">
          {(brands.length ? brands : fallbackBrands).slice(0, 10).map((brand) => (
            <Link key={brand.id} to={`/shop?brand=${brand.slug}`}>
              {brand.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="quiet-cta">
        <div>
          <h2>Ready to find your next pair?</h2>
          <p>Search by brand, category, gender, size, colour, or price.</p>
        </div>
        <Link to="/shop?q=best%20shoes%20of%20men" className="quiet-button light-button">
          Start shopping
        </Link>
      </section>

      <section className="home-section testimonial-section">
        <div className="simple-heading">
          <h2>What customers say</h2>
          <span>Real reviews appear once products are delivered and approved.</span>
        </div>
        <div className="minimal-reviews">
          {(reviews.length ? reviews : demoReviews).map((review) => (
            <article key={review.id}>
              <div className="review-avatar" />
              <p>{review.comment}</p>
              <strong>{review.user_name}</strong>
              <span>★ {review.rating}.0</span>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section inspiration-block">
        <h2>Shop inspirations</h2>
        <div className="inspiration-grid">
          <Link to="/shop?style=running">Running shoes</Link>
          <Link to="/shop?style=casual">Casual sneakers</Link>
          <Link to="/shop?style=boots">Boots</Link>
          <Link to="/shop?in_stock=true">In stock today</Link>
        </div>
      </section>

      <section className="home-section faq-compact">
        <h2>Details before you decide</h2>
        {faqs.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>
    </>
  );
}

const fallbackBrands: Brand[] = [
  { id: 1, name: "Nike", slug: "nike", description: "" },
  { id: 2, name: "Adidas", slug: "adidas", description: "" },
  { id: 3, name: "Puma", slug: "puma", description: "" },
  { id: 4, name: "New Balance", slug: "new-balance", description: "" },
];

const demoReviews: Review[] = [
  {
    id: 1,
    product: 1,
    user_name: "Nawamu customer",
    rating: 5,
    title: "Clean fit",
    comment: "The product page was clear, checkout was quick, and the size was right.",
    is_verified_purchase: true,
    created_at: "",
  },
  {
    id: 2,
    product: 1,
    user_name: "Returning buyer",
    rating: 5,
    title: "Easy",
    comment: "I liked being able to search by size and track the order after payment.",
    is_verified_purchase: true,
    created_at: "",
  },
];

const faqs = [
  {
    question: "Do you offer shoes for men, women, and kids?",
    answer: "Yes. The shop filters products by gender, category, brand, size, colour, and stock.",
  },
  {
    question: "Can I add to cart before logging in?",
    answer: "Yes. The cart uses a backend cart token and can continue after login.",
  },
  {
    question: "How does checkout work?",
    answer: "Checkout creates an order in Django, reserves stock, and starts the M-Pesa payment flow.",
  },
  {
    question: "Can I contact support?",
    answer: "Yes. Contact messages become support tickets that admin can reply to.",
  },
];
