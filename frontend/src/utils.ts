import type { Product } from "./api/types";

export function money(value: string | number | undefined | null) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(numeric);
}

export function rating(value: string | number) {
  return Number(value || 0).toFixed(1);
}

const fallbackImages = [
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=85",
];

export function productImage(product: Product, index = 0) {
  const primary = product.primary_image?.image || product.images?.find((image) => image.is_primary)?.image || product.images?.[0]?.image;
  if (primary) return primary;
  return fallbackImages[(product.id + index) % fallbackImages.length];
}

export function firstAvailableVariant(product: Product) {
  return product.variants?.find((variant) => variant.is_active && variant.stock_quantity > 0) || product.variants?.[0];
}
