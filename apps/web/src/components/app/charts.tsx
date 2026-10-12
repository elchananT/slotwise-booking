"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { DateTime } from "@/lib/time";

const ease = [0.16, 1, 0.3, 1] as const;

/** 30-day bar chart: plain flex bars, so it scales with the container and each bar is focusable. */
export function DayBars({ data, todayIso }: { data: Array<{ date: string; count: number }>; todayIso: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const top = Math.max(4, Math.ceil(max / 4) * 4);
  const total = data.reduce((a, d) => a + d.count, 0);
  const sel = active !== null ? data[active] : null;

  return (
    <figure aria-label={`Bookings per day over the last 30 days, ${total} in total`}>
      <div className="relative flex gap-3">
        <div className="flex h-56 flex-col justify-between pb-0.5 text-xs text-ink-2 tnum" aria-hidden>
          {[top, top / 2, 0].map((t) => (
            <span key={t} className="leading-none">
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex h-56 flex-col justify-between" aria-hidden>
            {[top, top / 2, 0].map((t) => (
              <div key={t} className="border-t border-dashed border-line" />
            ))}
          </div>
          <div className="relative flex h-56 items-end gap-[3px] sm:gap-1" onMouseLeave={() => setActive(null)}>
            {data.map((d, i) => {
              const isToday = d.date === todayIso;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={`${DateTime.fromISO(d.date).toFormat("cccc LLL d")}: ${d.count} booking${d.count === 1 ? "" : "s"}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="group flex h-full flex-1 items-end rounded-sm focus-visible:outline-offset-1"
                >
                  <motion.span
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.7, delay: i * 0.012, ease }}
                    style={{ height: `${Math.max(d.count ? 4 : 1.5, (d.count / top) * 100)}%`, transformOrigin: "bottom" }}
                    className={cn(
                      "block w-full rounded-t-full transition-colors",
                      d.count === 0 ? "bg-line-strong" : isToday ? "bg-brand" : "bg-teal group-hover:bg-teal-fg group-focus-visible:bg-teal-fg",
                    )}
                  />
                </button>
              );
            })}
          </div>
          {sel && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-2xl bg-ink px-3 py-2 text-xs whitespace-nowrap text-page shadow-lg"
              style={{ left: `clamp(0%, calc(${((active + 0.5) / data.length) * 100}% - 3rem), calc(100% - 6rem))` }}
            >
              <span className="font-semibold tnum">
                {sel.count} booking{sel.count === 1 ? "" : "s"}
              </span>
              <span className="ml-2 opacity-70">{DateTime.fromISO(sel.date).toFormat("ccc LLL d")}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-xs text-ink-2 tnum" aria-hidden>
            <span>{data[0] && DateTime.fromISO(data[0].date).toFormat("LLL d")}</span>
            <span>{data[Math.floor(data.length / 2)] && DateTime.fromISO(data[Math.floor(data.length / 2)]!.date).toFormat("LLL d")}</span>
            <span>{data.at(-1) && DateTime.fromISO(data.at(-1)!.date).toFormat("LLL d")}</span>
          </div>
        </div>
      </div>
    </figure>
  );
}

export function HBars({ rows, unit = "", max }: { rows: Array<{ key: string; label: string; value: number; color?: string; lead?: React.ReactNode }>; unit?: string; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              {r.lead}
              <span className="truncate font-medium">{r.label}</span>
            </span>
            <span className="shrink-0 font-semibold tnum">
              {r.value}
              {unit}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${r.label}: ${r.value}${unit}`}>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.07, ease }}
              style={{ width: `${Math.min(100, (r.value / m) * 100)}%`, background: r.color ?? "var(--teal)", transformOrigin: "left" }}
              className="h-full rounded-full"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
