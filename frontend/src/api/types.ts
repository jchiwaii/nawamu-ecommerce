export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string;
};

export type Brand = {
  id: number;
  name: string;
  slug: string;
  description: string;
};

export type ProductImage = {
  id: number;
  image: string;
  alt_text: string;
  is_primary: boolean;
};

export type ProductVariant = {
  id: number;
  sku: string;
  size: string;
  color: string;
  price: string;
  price_override: string | null;
  stock_quantity: number;
  is_active: boolean;
  is_low_stock: boolean;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  category: Category;
  brand: Brand;
  gender: "men" | "women" | "unisex" | "kids";
  style: string;
  base_price: string;
  compare_at_price: string | null;
  min_price?: string;
  primary_image?: ProductImage | null;
  images?: ProductImage[];
  variants?: ProductVariant[];
  tags?: { id: number; name: string; slug: string }[];
  rating_avg: string;
  review_count: number;
  sold_count: number;
  is_featured: boolean;
  is_favorite?: boolean;
};

export type Review = {
  id: number;
  product: number;
  user_name: string;
  rating: number;
  title: string;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
};

export type CartItem = {
  id: number;
  variant: ProductVariant;
  product: Product;
  quantity: number;
  unit_price: string;
  line_total: string;
};

export type OrderItem = {
  id: number;
  product: Product;
  variant: number | null;
  product_name: string;
  variant_sku: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: string;
  line_total: string;
};

export type Cart = {
  id: number;
  token: string;
  status: string;
  items: CartItem[];
  subtotal: string;
  item_count: number;
};

export type User = {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: string;
};

export type Order = {
  id: number;
  number: string;
  status: string;
  total: string;
  subtotal: string;
  shipping_amount: string;
  customer_note: string;
  courier_name: string;
  tracking_number: string;
  tracking_url: string;
  items: OrderItem[];
  status_history: { id: number; status: string; note: string; created_at: string }[];
  created_at: string;
};

export type SupportTicket = {
  id: number;
  subject: string;
  email: string;
  phone: string;
  category: string;
  priority: string;
  status: string;
  messages: { id: number; sender_type: string; sender_name: string; body: string; created_at: string }[];
};
