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
  parent?: number | null;
  description: string;
  is_active?: boolean;
  sort_order?: number;
};

export type Brand = {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active?: boolean;
};

export type ProductImage = {
  id: number;
  image: string;
  alt_text: string;
  is_primary: boolean;
};

export type ProductVariant = {
  id: number;
  product?: number;
  product_name?: string;
  sku: string;
  size: string;
  color: string;
  price: string;
  price_override: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_low_stock: boolean;
};

export type Payment = {
  id: number;
  order: number;
  order_number: string;
  provider: "mpesa";
  status: "pending" | "processing" | "success" | "failed" | "cancelled";
  amount: string;
  currency: string;
  phone: string;
  merchant_request_id: string;
  checkout_request_id: string;
  receipt_number: string;
  result_code: string;
  result_description: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
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
  is_active?: boolean;
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
  is_staff?: boolean;
};

export type AdminUser = User & {
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  email_verified: boolean;
  order_count: number;
  date_joined: string;
  last_login: string | null;
};

export type AdminDashboard = {
  metrics: {
    revenue: string;
    orders_total: number;
    orders_pending_payment: number;
    orders_to_fulfill: number;
    customers_total: number;
    products_active: number;
    low_stock_count: number;
    pending_support_count: number;
  };
  low_stock: {
    variant_id: number;
    sku: string;
    product: string;
    size: string;
    color: string;
    stock_quantity: number;
    threshold: number;
  }[];
  best_sellers: {
    id: number;
    name: string;
    slug: string;
    sold_count: number;
    rating_avg: string;
  }[];
  recent_orders: {
    id: number;
    number: string;
    customer: string;
    status: string;
    total: string;
    created_at: string;
  }[];
  pending_tickets: {
    id: number;
    subject: string;
    email: string;
    priority: string;
    status: string;
    last_message_at: string;
  }[];
  order_status_counts: { status: string; count: number }[];
};

export type Order = {
  id: number;
  number: string;
  status: string;
  fulfillment_method: "delivery" | "pickup";
  delivery_location: string;
  preferred_delivery_window: string;
  pickup_location: string;
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
