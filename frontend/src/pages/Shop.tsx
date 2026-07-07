import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, asList } from "../api/client";
import type { Brand, Category, Product } from "../api/types";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/AsyncState";
import { ProductCard } from "../components/ProductCard";
import { Field, Select } from "../components/forms";
import { PageHero } from "../components/PageHero";
import { useRouter } from "../state/router";

export function Shop() {
  const { path, navigate } = useRouter();
  const params = useMemo(() => new URLSearchParams(path.split("?")[1] || ""), [path]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(params.get("q") || "");

  useEffect(() => {
    setSearch(params.get("q") || "");
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = path.includes("?") ? `?${path.split("?")[1]}` : "?page_size=24";
        const [productData, categoryData, brandData] = await Promise.all([
          api.products(query),
          api.categories(),
          api.brands(),
        ]);
        setProducts(productData.results);
        setCategories(asList(categoryData));
        setBrands(asList(brandData));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load products.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [path, params]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (String(value).trim()) next.set(key, String(value));
    }
    navigate(`/shop?${next.toString()}`);
  }

  return (
    <>
      <PageHero
        eyebrow="Shop"
        title="Find the pair that fits the day."
        copy="Search, filter by category, gender, brand, size, and color. Results come directly from Django."
      />
      <section className="shop-layout">
        <aside className="filters-panel">
          <form onSubmit={submit}>
            <Field label="Search" name="q" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="best shoes of men" />
            <Select label="Category" name="category" defaultValue={params.get("category") || ""}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option value={category.slug} key={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select label="Brand" name="brand" defaultValue={params.get("brand") || ""}>
              <option value="">All brands</option>
              {brands.map((brand) => (
                <option value={brand.slug} key={brand.id}>
                  {brand.name}
                </option>
              ))}
            </Select>
            <Select label="Gender" name="gender" defaultValue={params.get("gender") || ""}>
              <option value="">All</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="unisex">Unisex</option>
              <option value="kids">Kids</option>
            </Select>
            <div className="filter-row">
              <Field label="Min price" name="min_price" type="number" defaultValue={params.get("min_price") || ""} />
              <Field label="Max price" name="max_price" type="number" defaultValue={params.get("max_price") || ""} />
            </div>
            <div className="filter-row">
              <Field label="Size" name="size" placeholder="42" defaultValue={params.get("size") || ""} />
              <Field label="Color" name="color" placeholder="Black" defaultValue={params.get("color") || ""} />
            </div>
            <button className="button primary full" type="submit">
              Apply filters
            </button>
          </form>
        </aside>
        <div className="shop-results">
          <div className="results-bar">
            <p>{products.length} products</p>
            <button onClick={() => navigate("/shop?ordering=-sold_count")}>Most popular</button>
            <button onClick={() => navigate("/shop?ordering=base_price")}>Lowest price</button>
          </div>
          {loading ? <LoadingBlock label="Loading products" /> : null}
          {error ? <ErrorBlock message={error} /> : null}
          {!loading && !error && products.length === 0 ? (
            <EmptyBlock>No products matched those filters.</EmptyBlock>
          ) : null}
          <div className="product-grid">
            {products.map((product, index) => (
              <ProductCard product={product} index={index} key={product.id} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
