"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { DateTime, monthDays } from "@/lib/time";

export type DayState = boolean | undefined; // true = has slots, false = none, undefined = unknown/loading

interface Props {
  /** First day of the visible month, in the business time zone. */
  month: DateTime;
  /** Today (business zone). Days before it are disabled. */
  today: DateTime;
  /** Last bookable day (business zone), optional. */
  lastDay?: DateTime;
  selected?: string | null; // yyyy-MM-dd
  availability: Record<string, DayState>;
  loading?: boolean;
  onSelect: (isoDate: string) => void;
  onMonthChange: (m: DateTime) => void;
  size?: "md" | "sm";
}

const ease = [0.16, 1, 0.3, 1] as const;

export function MonthCalendar({ month, today, lastDay, selected, availability, loading, onSelect, onMonthChange, size = "md" }: Props) {
  const cells = monthDays(month);
  const gridRef = useRef<HTMLDivElement>(null);
  const canPrev = month.startOf("month") > today.startOf("month");
  const canNext = !lastDay || month.endOf("month") < lastDay.startOf("day");
  const todayIso = today.toISODate();
  const firstEnabled =
    selected ?? cells.find((c) => c && c.toISODate()! >= todayIso!)?.toISODate() ?? cells.find(Boolean)?.toISODate();

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const d = keys[e.key];
    if (!d) return;
    const active = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
    if (!active) return;
    e.preventDefault();
    const next = DateTime.fromISO(active.dataset.date!, { zone: month.zone }).plus({ days: d });
    if (next.month !== month.month) {
      if ((d < 0 && !canPrev) || (d > 0 && !canNext)) return;
      onMonthChange(next.startOf("month"));
      requestAnimationFrame(() =>
        requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-date="${next.toISODate()}"]`)?.focus()),
      );
      return;
    }
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${next.toISODate()}"]`)?.focus();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="display text-2xl" aria-live="polite">
          {month.toFormat("LLLL")} <span className="text-ink-2">{month.toFormat("yyyy")}</span>
        </h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Previous month"
            disabled={!canPrev}
            onClick={() => onMonthChange(month.minus({ months: 1 }).startOf("month"))}
            className="grid size-10 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sunken disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={!canNext}
            onClick={() => onMonthChange(month.plus({ months: 1 }).startOf("month"))}
            className="grid size-10 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sunken disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-ink-2" aria-hidden>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={month.toFormat("yyyy-MM")}
          ref={gridRef}
          role="group"
          aria-label={month.toFormat("LLLL yyyy")}
          onKeyDown={onKey}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.28, ease }}
          className="grid grid-cols-7 gap-y-1"
        >
          {cells.map((c, i) => {
            if (!c) return <div key={`b${i}`} />;
            const iso = c.toISODate()!;
            const past = iso < todayIso!;
            const beyond = lastDay ? iso > lastDay.toISODate()! : false;
            const state = availability[iso];
            const available = state === true && !past && !beyond;
            const isSel = selected === iso;
            const isToday = iso === todayIso;
            const disabled = past || beyond || state === false;
            return (
              <div key={iso} className="flex justify-center">
                <button
                  type="button"
                  data-date={iso}
                  tabIndex={iso === firstEnabled ? 0 : -1}
                  disabled={disabled}
                  aria-pressed={isSel}
                  aria-label={`${c.toFormat("cccc, LLLL d")}${available ? ", times available" : disabled ? ", unavailable" : ""}`}
                  onClick={() => onSelect(iso)}
                  className={cn(
                    "relative grid place-items-center rounded-full text-[0.95rem] tnum transition-[background-color,color,transform] duration-200 ease-[var(--ease-out-expo)]",
                    size === "sm" ? "size-10" : "size-11 sm:size-12",
                    disabled ? "text-ink-2/45" : "text-ink hover:bg-sunken",
                    isSel && "!bg-brand font-semibold !text-on-brand shadow-[0_6px_14px_-6px_rgb(217_96_59/0.8)]",
                    isToday && !isSel && "ring-1 ring-ink/40",
                    state === undefined && !disabled && loading && "animate-pulse",
                  )}
                >
                  {c.day}
                  {available && (
                    <span
                      aria-hidden
                      className={cn("absolute bottom-1.5 size-1.5 rounded-full", isSel ? "bg-on-brand" : "bg-teal-fg")}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
