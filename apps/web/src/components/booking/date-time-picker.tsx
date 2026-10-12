"use client";
import { CalendarX2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/use-query";
import { browserZone, nowIn, DateTime } from "@/lib/time";
import type { AvailabilitySlot } from "@/lib/types";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { MonthCalendar, type DayState } from "./month-calendar";
import { SlotGrid, ZoneToggle } from "./slot-grid";

interface Props {
  slug: string;
  serviceId: string;
  staffId?: string;
  timezone: string;
  maxAdvanceDays: number;
  selected: AvailabilitySlot | null;
  onSelect: (slot: AvailabilitySlot) => void;
  /** Bump to refetch availability (e.g. after a 409). */
  refreshKey?: number;
}

export function DateTimePicker({ slug, serviceId, staffId, timezone, maxAdvanceDays, selected, onSelect, refreshKey = 0 }: Props) {
  const [today] = useState(() => nowIn(timezone));
  const [month, setMonth] = useState<DateTime>(() => today.startOf("month"));
  const [date, setDate] = useState<string | null>(null);
  const [viewZone, setViewZone] = useState(timezone);
  const slotsRef = useRef<HTMLDivElement>(null);
  const lastDay = useMemo(() => today.plus({ days: maxAdvanceDays }), [today, maxAdvanceDays]);

  const monthKey = month.toFormat("yyyy-MM");
  const monthQ = useQuery((signal) => api.pub.month(slug, { serviceId, month: monthKey, staffId }, signal), [slug, serviceId, staffId, monthKey, refreshKey]);
  const dayQ = useQuery(
    (signal) => api.pub.availability(slug, { serviceId, date: date!, staffId }, signal),
    [slug, serviceId, staffId, date, refreshKey],
    date !== null,
  );

  const availability = useMemo(() => {
    const out: Record<string, DayState> = {};
    monthQ.data?.days.forEach((d) => (out[d.date] = d.available));
    return out;
  }, [monthQ.data]);

  const anyThisMonth = monthQ.data?.days.some((d) => d.available && d.date >= today.toISODate()!);

  function pickDate(iso: string) {
    setDate(iso);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setTimeout(() => slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
      <div>
        {monthQ.error ? (
          <ErrorState message={monthQ.error} onRetry={monthQ.refetch} />
        ) : (
          <>
            <MonthCalendar
              month={month}
              today={today}
              lastDay={lastDay}
              selected={date}
              availability={availability}
              loading={monthQ.loading}
              onSelect={pickDate}
              onMonthChange={setMonth}
            />
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
              <span aria-hidden className="size-1.5 rounded-full bg-teal-fg" /> Days with a dot have openings
            </p>
            {!monthQ.loading && monthQ.data && !anyThisMonth && (
              <p className="mt-3 rounded-2xl bg-sunken px-4 py-3 text-sm text-ink-2">
                Nothing open in {month.toFormat("LLLL")}. Try the next month.
              </p>
            )}
          </>
        )}
      </div>

      <div ref={slotsRef} className="scroll-mt-24 min-w-0">
        <div className="mb-4">
          <ZoneToggle businessZone={timezone} value={viewZone} onChange={setViewZone} />
          {viewZone !== timezone && <span className="sr-only">Your device time zone is {browserZone()}</span>}
        </div>
        {!date ? (
          <div className="grid min-h-48 place-items-center rounded-3xl border border-dashed border-line-strong p-8 text-center text-ink-2">
            Choose a day to see open times.
          </div>
        ) : dayQ.error ? (
          <ErrorState message={dayQ.error} onRetry={dayQ.refetch} />
        ) : (
          <div aria-live="polite">
            <h3 className="display mb-4 text-2xl">{DateTime.fromISO(date).toFormat("cccc, LLLL d")}</h3>
            {dayQ.loading ? (
              <SlotGrid slots={undefined} zone={viewZone} selected={null} onSelect={() => {}} loading />
            ) : dayQ.data && dayQ.data.slots.length > 0 ? (
              <SlotGrid slots={dayQ.data.slots} zone={viewZone} selected={selected?.start ?? null} onSelect={onSelect} />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line-strong p-8 text-center text-ink-2">
                <CalendarX2 className="size-6" aria-hidden />
                No open times that day. Pick another day.
              </div>
            )}
          </div>
        )}
        {monthQ.loading && !date && <Skeleton className="mt-4 h-4 w-40" />}
      </div>
    </div>
  );
}
