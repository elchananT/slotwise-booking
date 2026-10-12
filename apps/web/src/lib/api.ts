import type {
  AuthResponse,
  AuthTokens,
  Booking,
  BookingStatus,
  Business,
  CreateBookingInput,
  CreatedBooking,
  DashboardData,
  DayAvailability,
  EmailLog,
  Me,
  MonthAvailability,
  Owner,
  Paginated,
  PublicBookingSummary,
  PublicBusiness,
  Service,
  Staff,
  TimeOff,
  WorkingHours,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4002/api/v1").replace(/\/$/, "");

const REFRESH_KEY = "slotwise.refresh";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public error?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ---------------- token store ---------------- */
let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
const authLostListeners = new Set<() => void>();

export const tokenStore = {
  getRefresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(tokens: AuthTokens) {
    accessToken = tokens.accessToken;
    try {
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    } catch {
      /* storage unavailable: the session just won't survive a reload */
    }
  },
  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
  hasAccess: () => accessToken !== null,
  onAuthLost(fn: () => void) {
    authLostListeners.add(fn);
    return () => authLostListeners.delete(fn);
  },
};

/** Single-flight: concurrent 401s share one refresh request. */
export function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return Promise.resolve(false);
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error("refresh failed");
      const data = (await res.json()) as AuthTokens;
      tokenStore.set(data);
      return true;
    } catch {
      tokenStore.clear();
      authLostListeners.forEach((fn) => fn());
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/* ---------------- core request ---------------- */
type Query = Record<string, string | number | boolean | undefined | null>;
interface ReqOpts {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText || "Request failed";
  let error: string | undefined;
  try {
    const data = await res.json();
    error = data.error;
    message = Array.isArray(data.message) ? data.message.join(". ") : (data.message ?? message);
  } catch {
    /* non-JSON error */
  }
  return new ApiError(res.status, message, error);
}

async function request<T>(path: string, opts: ReqOpts = {}): Promise<T> {
  const { method = "GET", body, query, auth = false, signal } = opts;
  const run = () =>
    fetch(buildUrl(path, query), {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res: Response;
  try {
    res = await run();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && auth) {
    if (await refreshSession()) {
      try {
        res = await run();
      } catch {
        throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
      }
    } else {
      tokenStore.clear();
      authLostListeners.forEach((fn) => fn());
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const authed = <T>(path: string, opts: Omit<ReqOpts, "auth"> = {}) => request<T>(path, { ...opts, auth: true });

/** Lists may come back bare or wrapped as { items }. */
function asList<T>(x: T[] | { items: T[] }): T[] {
  return Array.isArray(x) ? x : (x?.items ?? []);
}

/* ---------------- endpoints ---------------- */
export interface BookingFilters {
  from?: string;
  to?: string;
  staffId?: string;
  status?: BookingStatus | "";
  q?: string;
  page?: number;
  pageSize?: number;
}

export const api = {
  auth: {
    register: (b: { email: string; name: string; password: string }) =>
      request<AuthResponse>("/auth/register", { method: "POST", body: b }),
    login: (b: { email: string; password: string }) => request<AuthResponse>("/auth/login", { method: "POST", body: b }),
    logout: () => authed<void>("/auth/logout", { method: "POST" }),
    me: async (): Promise<Me> => {
      // Contract: "owner + business (or null)" — accept flat or nested.
      const raw = await authed<(Owner & { business?: Business | null }) | { owner: Owner; business?: Business | null }>(
        "/auth/me",
      );
      if ("owner" in raw) return { ...raw.owner, business: raw.business ?? null };
      return { ...raw, business: raw.business ?? null };
    },
  },
  business: {
    get: () => authed<Business>("/business"),
    create: (b: {
      name: string;
      slug?: string;
      timezone: string;
      description?: string;
      phone?: string;
      address?: string;
    }) => authed<Business>("/business", { method: "POST", body: b }),
  },
  services: {
    list: async () => asList(await authed<Service[] | { items: Service[] }>("/services")),
    create: (b: Omit<Service, "id">) => authed<Service>("/services", { method: "POST", body: b }),
    update: (id: string, b: Partial<Omit<Service, "id">>) => authed<Service>(`/services/${id}`, { method: "PATCH", body: b }),
    remove: (id: string) => authed<Service | void>(`/services/${id}`, { method: "DELETE" }),
  },
  staff: {
    list: async () => asList(await authed<Staff[] | { items: Staff[] }>("/staff")),
    create: (b: { name: string; title?: string; serviceIds: string[] }) => authed<Staff>("/staff", { method: "POST", body: b }),
    update: (id: string, b: { name?: string; title?: string | null; active?: boolean; serviceIds?: string[] }) =>
      authed<Staff>(`/staff/${id}`, { method: "PATCH", body: b }),
    remove: (id: string) => authed<Staff | void>(`/staff/${id}`, { method: "DELETE" }),
    setHours: (id: string, hours: Array<Pick<WorkingHours, "weekday" | "startMinute" | "endMinute">>) =>
      authed<unknown>(`/staff/${id}/hours`, { method: "PUT", body: { hours } }),
    addTimeOff: (id: string, b: { startsAt: string; endsAt: string; reason?: string }, force = false) =>
      authed<TimeOff>(`/staff/${id}/time-off`, { method: "POST", body: b, query: { force: force ? "true" : undefined } }),
  },
  timeOff: {
    remove: (id: string) => authed<void>(`/time-off/${id}`, { method: "DELETE" }),
  },
  bookings: {
    list: (f: BookingFilters = {}) => authed<Paginated<Booking>>("/bookings", { query: { ...f } }),
    get: (id: string) => authed<Booking>(`/bookings/${id}`),
    setStatus: (id: string, status: BookingStatus) =>
      authed<Booking>(`/bookings/${id}/status`, { method: "PATCH", body: { status } }),
    reschedule: (id: string, b: { startsAt: string; staffId?: string }) =>
      authed<Booking>(`/bookings/${id}/reschedule`, { method: "POST", body: b }),
  },
  dashboard: () => authed<DashboardData>("/dashboard"),
  emails: async (): Promise<EmailLog[]> => asList(await authed<EmailLog[] | { items: EmailLog[] }>("/emails", { query: { pageSize: 100 } })),
  pub: {
    business: (slug: string, signal?: AbortSignal) => request<PublicBusiness>(`/public/${encodeURIComponent(slug)}`, { signal }),
    availability: (slug: string, q: { serviceId: string; date: string; staffId?: string }, signal?: AbortSignal) =>
      request<DayAvailability>(`/public/${encodeURIComponent(slug)}/availability`, { query: q, signal }),
    month: (slug: string, q: { serviceId: string; month: string; staffId?: string }, signal?: AbortSignal) =>
      request<MonthAvailability>(`/public/${encodeURIComponent(slug)}/availability/month`, { query: q, signal }),
    book: (slug: string, b: CreateBookingInput) =>
      request<CreatedBooking>(`/public/${encodeURIComponent(slug)}/bookings`, { method: "POST", body: b }),
    booking: (token: string) => request<PublicBookingSummary>(`/public/bookings/${encodeURIComponent(token)}`),
    cancel: (token: string) => request<PublicBookingSummary>(`/public/bookings/${encodeURIComponent(token)}/cancel`, { method: "POST" }),
    reschedule: (token: string, b: { startsAt: string; staffId?: string }) =>
      request<PublicBookingSummary>(`/public/bookings/${encodeURIComponent(token)}/reschedule`, { method: "POST", body: b }),
    icsUrl: (token: string) => `${API_URL}/public/bookings/${encodeURIComponent(token)}/ics`,
  },
};
