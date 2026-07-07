import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Product, ProductVariant, Review } from "../api/types";
import { ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { ProductCard } from "../components/ProductCard";
import { SectionHeader } from "../components/SectionHeader";
import { Link, useRouter } from "../state/router";
import { firstAvailableVariant, money, productImage, rating } from "../utils";

export function ProductDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const detail = await api.product(slug);
        const [reviewData, relatedData] = await Promise.all([
          api.productReviews(slug),
          api.products(`?category=${detail.category.slug}&page_size=4`),
        ]);
        setProduct(detail);
        setReviews(reviewData.results);
        setRelated(relatedData.results.filter((item) => item.slug !== detail.slug));
        setSelectedVariant(firstAvailableVariant(detail) || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load product.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const sizes = useMemo(() => Array.from(new Set(product?.variants?.map((variant) => variant.size) || [])), [product]);
  const colors = useMemo(() => Array.from(new Set(product?.variants?.map((variant) => variant.color) || [])), [product]);

  async function addToCart(event: FormEvent) {
    event.preventDefault();
    if (!selectedVariant) return;
    setStatus("");
    try {
      await api.addCartItem(selectedVariant.id, quantity);
      setStatus("Added to cart.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not add to cart.");
    }
  }

  async function favorite() {
    if (!product) return;
    try {
      await api.favoriteProduct(product.slug);
      setStatus("Saved to favorites.");
    } catch {
      router.navigate("/login");
    }
  }

  if (loading) return <LoadingBlock label="Loading product" />;
  if (error) return <ErrorBlock message={error} />;
  if (!product) return null;

  return (
    <>
      <section className="detail-layout">
        <div className="detail-gallery">
          <img src={productImage(product)} alt={product.name} />
          <div className="thumb-row">
            {(product.images?.length ? product.images : [{ id: 0, image: productImage(product), alt_text: product.name, is_primary: true }]).slice(0, 4).map((image) => (
              <img key={image.id} src={image.image} alt={image.alt_text || product.name} />
            ))}
          </div>
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{product.brand.name} · {product.category.name}</p>
          <h1>{product.name}</h1>
          <div className="price-row">
            <strong>{money(selectedVariant?.price || product.base_price)}</strong>
            {product.compare_at_price ? <span>{money(product.compare_at_price)}</span> : null}
          </div>
          <p className="rating-line">★ {rating(product.rating_avg)} · {product.review_count} reviews · {product.sold_count} sold</p>
          <p>{product.description}</p>

          <form onSubmit={addToCart} className="buy-box">
            <div>
              <span className="form-label">Size</span>
              <div className="choice-row">
                {sizes.map((size) => (
                  <button
                    type="button"
                    className={selectedVariant?.size === size ? "selected" : ""}
                    key={size}
                    onClick={() => {
                      const next = product.variants?.find((variant) => variant.size === size && variant.color === selectedVariant?.color) || product.variants?.find((variant) => variant.size === size);
                      setSelectedVariant(next || null);
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="form-label">Color</span>
              <div className="choice-row">
                {colors.map((color) => (
                  <button
                    type="button"
                    className={selectedVariant?.color === color ? "selected" : ""}
                    key={color}
                    onClick={() => {
                      const next = product.variants?.find((variant) => variant.color === color && variant.size === selectedVariant?.size) || product.variants?.find((variant) => variant.color === color);
                      setSelectedVariant(next || null);
                    }}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
            <label className="field compact-field">
              <span>Quantity</span>
              <input min="1" max={selectedVariant?.stock_quantity || 1} type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <p className="stock-note">
              {selectedVariant ? `${selectedVariant.stock_quantity} available for ${selectedVariant.size} / ${selectedVariant.color}` : "No variant selected"}
            </p>
            <div className="button-row">
              <button className="button primary" disabled={!selectedVariant || selectedVariant.stock_quantity <= 0}>
                Add to cart
              </button>
              <button type="button" className="button ghost" onClick={favorite}>
                Save
              </button>
            </div>
            {status ? <p className="inline-status">{status}</p> : null}
          </form>
        </div>
      </section>

      <section className="section two-col detail-info">
        <div>
          <h2>Product details</h2>
          <p>{product.description}</p>
        </div>
        <div>
          <h2>Buying path</h2>
          <ul className="clean-list">
            <li>Select size and color from real variant stock.</li>
            <li>Add to cart using the Django cart token.</li>
            <li>Checkout starts an M-Pesa payment request.</li>
          </ul>
        </div>
      </section>

      <section className="section">
        <SectionHeader eyebrow="Reviews" title="What buyers say" />
        <div className="review-list">
          {reviews.length ? reviews.map((review) => (
            <article key={review.id}>
              <strong>★ {review.rating}.0</strong>
              <h3>{review.title || "Customer review"}</h3>
              <p>{review.comment}</p>
              <span>{review.user_name}</span>
            </article>
          )) : <p>No reviews yet. Delivered customers can review this product.</p>}
        </div>
      </section>

      {related.length ? (
        <section className="section">
          <SectionHeader eyebrow="Related products" title="More in this category">
            <Link to={`/shop?category=${product.category.slug}`}>View category</Link>
          </SectionHeader>
          <div className="product-grid compact">
            {related.map((item, index) => <ProductCard product={item} index={index + 1} key={item.id} />)}
          </div>
        </section>
      ) : null}
    </>
  );
}
