import { api } from "../api/client";
import type { Product } from "../api/types";
import { Link } from "../state/router";
import { firstAvailableVariant, money, productImage, rating } from "../utils";

type ProductCardProps = {
  product: Product;
  index?: number;
  onCartChange?: () => void;
};

export function ProductCard({ product, index = 0, onCartChange }: ProductCardProps) {
  const variant = product.variants?.find((item) => item.stock_quantity > 0) || product.variants?.[0];

  async function addQuick() {
    const selected = variant || firstAvailableVariant(await api.product(product.slug));
    if (!selected) return;
    await api.addCartItem(selected.id, 1);
    onCartChange?.();
  }

  return (
    <article className="product-card">
      <Link to={`/shop/${product.slug}`} className="product-image-wrap">
        <img src={productImage(product, index)} alt={product.name} loading="lazy" />
        <span className="product-chip">{product.gender}</span>
      </Link>
      <div className="product-meta">
        <div>
          <p>{product.brand?.name}</p>
          <Link to={`/shop/${product.slug}`}>
            <h3>{product.name}</h3>
          </Link>
        </div>
        <strong>{money(product.min_price || product.base_price)}</strong>
      </div>
      <div className="product-row">
        <span>★ {rating(product.rating_avg)} · {product.sold_count} sold</span>
        <button onClick={addQuick}>
          Add
        </button>
      </div>
    </article>
  );
}
