"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { colorOf } from "@/lib/staff-colors";
import { DateTime, inZone, nowIn, weekStart } from "@/lib/time";
import type { Booking, Staff } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media";
import { useQuery } from "@/lib/use-query";
import { PageHeader } from "@/components/app/app-shell";
import { BookingDialog, bookingService, bookingStaffName } from "@/components/app/booking-dialog";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";

const ROW = 56; // px per hour

async function fetchWeek(from: string, to: string): Promise<Booking[]> {
  const all: Booking[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await api.bookings.list({ from, to, page, pageSize: 100 });
    all.push(...res.items);
    if (all.length >= res.total || res.items.length === 0) break;
  }
  return all;
}

export default function CalendarPage() {
  const { business } = useAuth();
  const biz = business!;
  const zone = biz.timezone;
  const desktop = useMediaQuery("(min-width: 768px)", true);

  const [anchor, setAnchor] = useState(() => weekStart(nowIn(zone)));
  const [dayIdx, setDayIdx] = useState(() => nowIn(zone).weekday % 7);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [open, setOpen] = useState<Booking | null>(null);

  const from = anchor.toUTC().toISO()!;
  const to = anchor.plus({ days: 7 }).toUTC().toISO()!;
  const bq = useQuery(() => fetchWeek(from, to), [from, to]);
  const staffQ = useQuery(() => api.staff.list(), []);
  const svcQ = useQuery(() => api.services.list(), []);

  const staff: Staff[] = useMemo(() => {
    const list = staffQ.data ?? [];
    const withBookings = new Set((bq.data ?? []).map((b) => b.staffId));
    return list.filter((s) => s.active || withBookings.has(s.id));
  }, [staffQ.data, bq.data]);
  const lanes = staff.filter((s) => !hidden.includes(s.id));

  const bookings = useMemo(() => (bq.data ?? []).filter((b) => (showCancelled || b.status !== "CANCELLED") && !hidden.includes(b.staffId)), [bq.data, showCancelled, hidden]);

  // visible hour range
  const [lo, hi] = useMemo(() => {
    let a = 9;
    let b = 18;
    for (const bk of bookings) {
      const s = inZone(bk.startsAt, zone);
      const e = inZone(bk.endsAt, zone);
      a = Math.min(a, s.hour);
      b = Math.max(b, e.hour + (e.minute > 0 ? 1 : 0));
    }
    return [Math.max(0, a), Math.min(24, b)];
  }, [bookings, zone]);

  const today = nowIn(zone);
  const days = Array.from({ length: 7 }, (_, i) => anchor.plus({ days: i }));
  const shown = desktop ? days : [days[dayIdx]!];
  const weekLabel = `${days[0]!.toFormat("LLL d")} – ${days[6]!.toFormat(days[0]!.month === days[6]!.month ? "d" : "LLL d")}, ${days[6]!.toFormat("yyyy")}`;

  function go(delta: number) {
    setAnchor((a) => a.plus({ weeks: delta }));
  }
  function goToday() {
    const t = nowIn(zone);
    setAnchor(weekStart(t));
    setDayIdx(t.weekday % 7);
  }

  const countFor = (d: DateTime) => bookings.filter((b) => inZone(b.startsAt, zone).hasSame(d, "day")).length;

  return (
    <>
      <PageHeader title="Calendar" subtitle="One lane per person. Click a booking for details, to move it or to mark it done." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" aria-label="Previous week" onClick={() => go(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="ghost" size="sm" aria-label="Next week" onClick={() => go(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="display ml-2 text-2xl tnum" aria-live="polite">
            {weekLabel}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {staff.map((s) => {
            const on = !hidden.includes(s.id);
            const color = colorOf(staff, s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => setHidden((h) => (on ? [...h, s.id] : h.filter((x) => x !== s.id)))}
                className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors", on ? "border-line-strong bg-paper" : "border-line text-ink-2 opacity-60")}
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: on ? color : "transparent", boxShadow: `inset 0 0 0 1.5px ${color}` }} />
                {s.name.split(" ")[0]}
              </button>
            );
          })}
          <label className="ml-1 inline-flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="size-4 accent-[var(--teal)]" />
            Show cancelled
          </label>
        </div>
      </div>

      {!desktop && (
        <div role="tablist" aria-label="Day of week" className="scroll-thin -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {days.map((d, i) => {
            const n = countFor(d);
            const isToday = d.hasSame(today, "day");
            return (
              <button
                key={i}
                role="tab"
                type="button"
                aria-selected={dayIdx === i}
                onClick={() => setDayIdx(i)}
                className={cn("flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 text-sm transition-colors", dayIdx === i ? "border-ink bg-ink text-page" : "border-line bg-paper")}
              >
                <span className="text-xs opacity-70">{d.toFormat("ccc")}</span>
                <span className={cn("display text-xl leading-tight", isToday && dayIdx !== i && "text-brand-deep")}>{d.day}</span>
                <span className="text-[0.65rem] tnum opacity-70">{n ? `${n} booked` : "free"}</span>
              </button>
            );
          })}
        </div>
      )}

      {bq.error ? (
        <ErrorState message={bq.error} onRetry={bq.refetch} />
      ) : staffQ.loading || (bq.loading && !bq.data) ? (
        <Skeleton className="h-[34rem] rounded-[1.75rem]" />
      ) : !lanes.length ? (
        <div className="surface p-10 text-center text-ink-2">{staff.length ? "All staff are hidden. Turn someone back on above." : "Add staff members to see their lanes here."}</div>
      ) : (
        <div className={cn("surface overflow-x-auto transition-opacity", bq.loading && "opacity-60")}>
          <div className="min-w-0">
            {/* header */}
            <div className="grid border-b border-line" style={{ gridTemplateColumns: `3.25rem repeat(${shown.length}, minmax(0, 1fr))` }}>
              <div />
              {shown.map((d) => {
                const isToday = d.hasSame(today, "day");
                return (
                  <div key={d.toISODate()} className="border-l border-line px-1 py-2.5">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-sm text-ink-2">{d.toFormat("ccc")}</span>
                      <span className={cn("display grid size-8 place-items-center rounded-full text-lg", isToday && "bg-brand text-on-brand")}>{d.day}</span>
                    </div>
                    <div className="mt-1.5 flex" aria-hidden>
                      {lanes.map((s) => (
                        <span key={s.id} className="flex-1 text-center text-[0.65rem] font-semibold" style={{ color: colorOf(staff, s.id) }}>
                          {initials(s.name)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* body */}
            <div className="grid" style={{ gridTemplateColumns: `3.25rem repeat(${shown.length}, minmax(0, 1fr))` }}>
              <div className="relative" style={{ height: (hi - lo) * ROW }} aria-hidden>
                {Array.from({ length: hi - lo }, (_, i) => (
                  <div key={i} className="absolute right-2 -translate-y-2 text-[0.7rem] text-ink-2 tnum" style={{ top: i * ROW }}>
                    {i === 0 ? "" : DateTime.fromObject({ hour: lo + i }).toFormat("h a")}
                  </div>
                ))}
              </div>
              {shown.map((d) => (
                <DayColumn
                  key={d.toISODate()}
                  zone={zone}
                  lo={lo}
                  hi={hi}
                  lanes={lanes}
                  bookings={bookings.filter((b) => inZone(b.startsAt, zone).hasSame(d, "day"))}
                  isToday={d.hasSame(today, "day")}
                  now={today}
                  staff={staff}
                  services={svcQ.data ?? []}
                  onOpen={setOpen}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      {!bq.loading && !bq.error && bq.data && bookings.length === 0 && lanes.length > 0 && (
        <p className="mt-4 text-center text-ink-2">No bookings this week. Share your booking page to fill it.</p>
      )}

      <BookingDialog booking={open} business={biz} services={svcQ.data ?? []} staff={staffQ.data ?? []} onClose={() => setOpen(null)} onChanged={() => bq.refetch()} />
    </>
  );
}

function DayColumn({
  zone,
  lo,
  hi,
  lanes,
  bookings,
  isToday,
  now,
  staff,
  services,
  onOpen,
}: {
  zone: string;
  lo: number;
  hi: number;
  lanes: Staff[];
  bookings: Booking[];
  isToday: boolean;
  now: DateTime;
  staff: Staff[];
  services: import("@/lib/types").Service[];
  onOpen: (b: Booking) => void;
}) {
  const nowTop = ((now.hour * 60 + now.minute) / 60 - lo) * ROW;
  return (
    <div className="relative border-l border-line" style={{ height: (hi - lo) * ROW }}>
      {Array.from({ length: hi - lo }, (_, i) => (
        <div key={i} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * ROW }} />
      ))}
      {lanes.length > 1 &&
        lanes.slice(1).map((s, i) => <div key={s.id} aria-hidden className="absolute inset-y-0 border-l border-dashed border-line/60" style={{ left: `${((i + 1) / lanes.length) * 100}%` }} />)}
      {bookings.map((b) => {
        const s = inZone(b.startsAt, zone);
        const e = inZone(b.endsAt, zone);
        const startMin = s.hour * 60 + s.minute;
        const endMin = e.hasSame(s, "day") ? e.hour * 60 + e.minute : 1440;
        const lane = lanes.findIndex((l) => l.id === b.staffId);
        if (lane < 0) return null;
        const top = (startMin / 60 - lo) * ROW;
        const height = Math.max(24, ((endMin - startMin) / 60) * ROW - 2);
        const color = colorOf(staff, b.staffId);
        const cancelled = b.status === "CANCELLED";
        const done = b.status === "COMPLETED" || b.status === "NO_SHOW";
        const label = `${s.toFormat("h:mm a")}, ${b.customerName}, ${bookingService(b, services)?.name ?? "service"} with ${bookingStaffName(b, staff)}, ${b.status.toLowerCase().replace("_", " ")}`;
        return (
          <button
            key={b.id}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => onOpen(b)}
            style={{
              top,
              height,
              left: `calc(${(lane / lanes.length) * 100}% + 2px)`,
              width: `calc(${100 / lanes.length}% - 4px)`,
              background: cancelled ? "transparent" : color,
              borderColor: color,
              color: cancelled ? "var(--ink-500)" : "#fff7e8",
              backgroundImage: cancelled ? `repeating-linear-gradient(135deg, transparent 0 5px, ${color}33 5px 6px)` : undefined,
            }}
            className={cn(
              "absolute overflow-hidden rounded-xl border px-1.5 py-1 text-left text-[0.7rem] leading-tight shadow-sm transition-[transform,box-shadow] duration-200 hover:z-10 hover:-translate-y-px hover:shadow-md focus-visible:z-10",
              cancelled && "line-through",
              done && "opacity-70",
            )}
          >
            <span className="block truncate font-semibold tnum">{s.toFormat("h:mm")}</span>
            {height > 36 && <span className="block truncate">{b.customerName.split(" ")[0]}</span>}
          </button>
        );
      })}
      {isToday && nowTop >= 0 && nowTop <= (hi - lo) * ROW && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }}>
          <span className="-ml-1 size-2 rounded-full bg-brand" />
          <span className="h-px flex-1 bg-brand" />
        </div>
      )}
    </div>
  );
}
