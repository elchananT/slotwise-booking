/** Typed model of every API response (mirrors docs/CONTRACT.md). */

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export interface Owner {
  id: string;
  email: string;
  name: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  phone: string | null;
  address: string | null;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  currency: string;
  active: boolean;
}

export interface WorkingHours {
  id?: string;
  staffId?: string;
  weekday: number; // 0 = Sunday
  startMinute: number;
  endMinute: number;
}

export interface TimeOff {
  id: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface Staff {
  id: string;
  name: string;
  title: string | null;
  active: boolean;
  /** Owner list returns assignments as ids and/or nested rows; both are normalised in the UI. */
  serviceIds?: string[];
  services?: Array<string | { serviceId?: string; service?: Pick<Service, "id" | "name"> }>;
  hours?: WorkingHours[];
  timeOff?: TimeOff[];
}

export interface BookingRef {
  id: string;
  reference: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  blockedUntil?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  serviceId: string;
  staffId: string;
  businessId?: string;
  createdAt?: string;
}

export interface Booking extends BookingRef {
  service?: Pick<Service, "id" | "name" | "durationMinutes" | "priceCents" | "currency">;
  staff?: Pick<Staff, "id" | "name">;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  body: string;
  businessId?: string;
  createdAt: string;
}

export interface DashboardData {
  todayCount: number;
  upcomingCount: number;
  revenueCentsLast30: number;
  bookingsByDay: Array<{ date: string; count: number }>;
  topServices: Array<{ name: string; count: number }>;
  utilizationByStaff: Array<{ staffId: string; name: string; percent: number }>;
}

/* ---- auth ---- */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
export interface AuthResponse extends AuthTokens {
  owner: Owner;
}
export interface Me extends Owner {
  business: Business | null;
}

/* ---- public ---- */
export interface PublicStaff {
  id: string;
  name: string;
  title: string | null;
  serviceIds: string[];
}
export interface PublicBusiness {
  business: Business;
  services: Service[];
  staff: PublicStaff[];
}
export interface AvailabilitySlot {
  start: string; // UTC instant
  staffIds: string[];
}
export interface DayAvailability {
  date: string;
  timezone: string;
  slots: AvailabilitySlot[];
}
export interface MonthAvailability {
  days: Array<{ date: string; available: boolean }>;
}
export interface PublicBookingSummary extends BookingRef {
  manageToken?: string;
  service?: Pick<Service, "id" | "name" | "durationMinutes" | "priceCents" | "currency" | "description">;
  staff?: Pick<Staff, "id" | "name" | "title">;
  business?: Pick<Business, "id" | "name" | "slug" | "timezone" | "phone" | "address">;
}
export interface CreatedBooking extends PublicBookingSummary {
  manageToken: string;
}

export interface CreateBookingInput {
  serviceId: string;
  staffId?: string;
  startsAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
}
