import type {
  AdminDashboard,
  AdminUser,
  Brand,
  Cart,
  Category,
  Order,
  Paginated,
  Product,
  Review,
  SupportTicket,
  User,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const TOKEN_KEY = "nawamu.access";
const REFRESH_KEY = "nawamu.refresh";
const CART_KEY = "nawamu.cartToken";

type RequestOptions = RequestInit & { auth?: boolean };

export function getCartToken() {
  return localStorage.getItem(CART_KEY);
}

export function setCartToken(token: string) {
  localStorage.setItem(CART_KEY, token);
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const cartToken = getCartToken();
  const token = getAccessToken();

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (cartToken) headers.set("X-Cart-Token", cartToken);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || JSON.stringify(data);
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  categories: () => apiFetch<Paginated<Category> | Category[]>("/categories/"),
  brands: () => apiFetch<Paginated<Brand> | Brand[]>("/brands/"),
  products: (query = "") => apiFetch<Paginated<Product>>(`/products/${query}`),
  product: (slug: string) => apiFetch<Product>(`/products/${slug}/`),
  productReviews: (slug: string) => apiFetch<Paginated<Review>>(`/products/${slug}/reviews/`),
  favoriteProduct: (slug: string) => apiFetch(`/products/${slug}/favorite/`, { method: "POST" }),
  unfavoriteProduct: (slug: string) => apiFetch(`/products/${slug}/favorite/`, { method: "DELETE" }),
  favorites: () => apiFetch<Paginated<{ id: number; product_detail: Product }>>("/favorites/"),
  cart: () => apiFetch<Cart>("/cart/current/"),
  addCartItem: (variantId: number, quantity: number) =>
    apiFetch<Cart>("/cart/add_item/", {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, quantity }),
    }).then((cart) => {
      setCartToken(cart.token);
      return cart;
    }),
  updateCartItem: (itemId: number, quantity: number) =>
    apiFetch<Cart>("/cart/update_item/", {
      method: "PATCH",
      body: JSON.stringify({ item_id: itemId, quantity }),
    }),
  removeCartItem: (itemId: number) =>
    apiFetch<Cart>("/cart/remove_item/", {
      method: "DELETE",
      body: JSON.stringify({ item_id: itemId }),
    }),
  checkout: (payload: Record<string, unknown>) =>
    apiFetch<{ order: Order; payment: Record<string, unknown> }>("/checkout/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: async (email: string, password: string) => {
    const data = await apiFetch<{ access: string; refresh: string }>("/auth/token/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(TOKEN_KEY, data.access);
    localStorage.setItem(REFRESH_KEY, data.refresh);
    return data;
  },
  register: async (payload: { email: string; password: string; full_name: string; phone: string }) => {
    await apiFetch<User>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return api.login(payload.email, payload.password);
  },
  me: () => apiFetch<User>("/auth/me/"),
  orders: (query = "") => apiFetch<Paginated<Order>>(`/orders/${query}`),
  order: (number: string) => apiFetch<Order>(`/orders/${number}/`),
  supportTickets: () => apiFetch<Paginated<SupportTicket>>("/support/tickets/"),
  createSupportTicket: (payload: Record<string, unknown>) =>
    apiFetch<SupportTicket>("/support/tickets/", { method: "POST", body: JSON.stringify(payload) }),
  replySupportTicket: (id: number, body: string) =>
    apiFetch<SupportTicket>(`/support/tickets/${id}/reply/`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  adminDashboard: () => apiFetch<AdminDashboard>("/admin/dashboard/"),
  adminUsers: (query = "") => apiFetch<Paginated<AdminUser>>(`/admin/users/${query}`),
  adminUpdateOrderStatus: (number: string, payload: Record<string, unknown>) =>
    apiFetch<Order>(`/orders/${number}/update_status/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminResolveTicket: (id: number) => apiFetch<SupportTicket>(`/support/tickets/${id}/resolve/`, { method: "POST" }),
  adminCloseTicket: (id: number) => apiFetch<SupportTicket>(`/support/tickets/${id}/close/`, { method: "POST" }),
  adminReplyTicket: (id: number, body: string, isInternalNote = false) =>
    apiFetch<SupportTicket>(`/support/tickets/${id}/reply/`, {
      method: "POST",
      body: JSON.stringify({ body, is_internal_note: isInternalNote }),
    }),
  adminApproveReview: (id: number) => apiFetch<Review>(`/reviews/${id}/approve/`, { method: "POST" }),
  adminRejectReview: (id: number) => apiFetch<Review>(`/reviews/${id}/reject/`, { method: "POST" }),
};

export function asList<T>(payload: Paginated<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}
