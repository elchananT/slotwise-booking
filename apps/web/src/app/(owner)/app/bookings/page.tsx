"use client";
import { ChevronLeft, ChevronRight, ListChecks, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type BookingFilters } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { DateTime, fmtDate, fmtTime } from "@/lib/time";
import type { Booking, BookingStatus } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { PageHeader } from "@/components/app/app-shell";
import { BookingDialog, bookingService, bookingStaffName } from "@/components/app/booking-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";

const PAGE_SIZE = 15;
type Range = "upcoming" | "past" | "all";

export default function BookingsPage() {
  const { business } = useAuth();
  const zone = business!.timezone;
  const [range, setRange] = useState<Range>("upcoming");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [staffId, setStaffId] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Booking | null>(null);
  const [nowIso] = useState(() => DateTime.now().toUTC().toISO()!);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const staffQ = useQuery(() => api.staff.list(), []);
  const svcQ = useQuery(() => api.services.list(), []);

  const filters = useMemo<BookingFilters>(() => {
    const f: BookingFilters = { page, pageSize: PAGE_SIZE, status, staffId, q };
    if (fromDate || toDate) {
      if (fromDate) f.from = DateTime.fromISO(fromDate, { zone }).startOf("day").toUTC().toISO()!;
      if (toDate) f.to = DateTime.fromISO(toDate, { zone }).endOf("day").toUTC().toISO()!;
    } else if (range === "upcoming") f.from = nowIso;
    else if (range === "past") f.to = nowIso;
    return f;
  }, [page, status, staffId, q, fromDate, toDate, range, zone, nowIso]);

  const list = useQuery((signal) => { void signal; return api.bookings.list(filters); }, [filters]);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const staff = staffQ.data ?? [];
  const services = svcQ.data ?? [];
  const custom = !!(fromDate || toDate);

  function reset<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every appointment, newest customers and oldest history alike. Click a row for details and actions." />

      <div className="surface mb-6 flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Time range" className="inline-flex rounded-full bg-sunken p-1">
            {(["upcoming", "past", "all"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={!custom && range === r}
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  reset(setRange)(r);
                }}
                className={cn("rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors", !custom && range === r ? "bg-paper shadow-sm" : "text-ink-2 hover:text-ink")}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
            <Input aria-label="Search by customer or reference" placeholder="Search name, email or reference" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 pl-11" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select aria-label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value as BookingStatus | "")} className="h-11">
            <option value="">All statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No-show</option>
          </Select>
          <Select aria-label="Staff member" value={staffId} onChange={(e) => reset(setStaffId)(e.target.value)} className="h-11">
            <option value="">Everyone</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            From
            <Input type="date" value={fromDate} onChange={(e) => reset(setFromDate)(e.target.value)} className="h-11" />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            To
            <Input type="date" value={toDate} onChange={(e) => reset(setToDate)(e.target.value)} className="h-11" />
          </label>
        </div>
      </div>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.refetch} />
      ) : list.loading && !list.data ? (
        <div className="flex flex-col gap-2" aria-busy aria-label="Loading bookings">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !list.data?.items.length ? (
        <EmptyState icon={<ListChecks className="size-6" />} title="No bookings match" body="Try a wider date range, or clear the filters." />
      ) : (
        <>
          <div className={cn("transition-opacity", list.loading && "opacity-60")}>
            {/* table on md+ */}
            <div className="surface hidden overflow-hidden md:block">
              <table className="w-full text-left">
                <thead className="border-b border-line text-sm text-ink-2">
                  <tr>
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Service</th>
                    <th className="px-5 py-3 font-medium">With</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((b) => (
                    <tr key={b.id} onClick={() => setOpen(b)} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-sunken/60">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <button type="button" onClick={() => setOpen(b)} className="text-left" aria-label={`Open booking ${b.reference}`}>
                          <span className="block font-medium">{fmtDate(b.startsAt, zone)}</span>
                          <span className="tnum text-sm text-ink-2">{fmtTime(b.startsAt, zone)}</span>
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="block font-medium">{b.customerName}</span>
                        <span className="text-sm text-ink-2">{b.customerEmail}</span>
                      </td>
                      <td className="px-5 py-3.5">{bookingService(b, services)?.name ?? "Service"}</td>
                      <td className="px-5 py-3.5">{bookingStaffName(b, staff)}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* cards on mobile */}
            <ul className="flex flex-col gap-2 md:hidden">
              {list.data.items.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => setOpen(b)} className="surface flex w-full flex-col gap-2 p-4 text-left">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium">
                        {fmtDate(b.startsAt, zone)} · <span className="tnum">{fmtTime(b.startsAt, zone)}</span>
                      </span>
                      <StatusBadge status={b.status} />
                    </span>
                    <span>{b.customerName}</span>
                    <span className="text-sm text-ink-2">
                      {bookingService(b, services)?.name ?? "Service"} with {bookingStaffName(b, staff)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-2 tnum">
              {list.data.total} booking{list.data.total === 1 ? "" : "s"} · page {page} of {pages}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}

      <BookingDialog
        booking={open}
        business={business!}
        services={services}
        staff={staff}
        onClose={() => setOpen(null)}
        onChanged={() => list.refetch()}
      />
    </>
  );
}
