"use client";
import { motion } from "motion/react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/cn";
import { inZone, zoneLabel, browserZone } from "@/lib/time";
import type { AvailabilitySlot } from "@/lib/types";
import { Skeleton } from "@/components/ui/feedback";

export function ZoneToggle({
  businessZone,
  value,
  onChange,
}: {
  businessZone: string;
  value: string;
  onChange: (z: string) => void;
}) {
  const mine = browserZone();
  const differs = mine !== businessZone;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
      <span className="inline-flex items-center gap-1.5">
        <Globe className="size-4 text-teal-fg" aria-hidden />
        Times shown in {zoneLabel(value)}
      </span>
      {differs && (
        <button
          type="button"
          onClick={() => onChange(value === businessZone ? mine : businessZone)}
          className="rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-sunken"
        >
          {value === businessZone ? "Use my time zone" : "Use business time"}
        </button>
      )}
    </div>
  );
}

const PARTS = [
  { key: "morning", label: "Morning", test: (h: number) => h < 12 },
  { key: "afternoon", label: "Afternoon", test: (h: number) => h >= 12 && h < 17 },
  { key: "evening", label: "Evening", test: (h: number) => h >= 17 },
];

export function SlotGrid({
  slots,
  zone,
  selected,
  onSelect,
  loading,
}: {
  slots: AvailabilitySlot[] | undefined;
  zone: string;
  selected: string | null;
  onSelect: (s: AvailabilitySlot) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy aria-label="Loading times">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-full" />
        ))}
      </div>
    );
  }
  if (!slots?.length) return null;
  return (
    <div className="flex flex-col gap-5">
      {PARTS.map((part) => {
        const list = slots.filter((s) => part.test(inZone(s.start, zone).hour));
        if (!list.length) return null;
        return (
          <section key={part.key} aria-label={part.label}>
            <h4 className="mb-2 font-sans text-sm font-medium text-ink-2">{part.label}</h4>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {list.map((s, i) => {
                const isSel = selected === s.start;
                return (
                  <motion.button
                    key={s.start}
                    type="button"
                    aria-pressed={isSel}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.018, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => onSelect(s)}
                    className={cn(
                      "h-12 rounded-full border text-[0.95rem] tnum transition-[background-color,border-color,color,box-shadow] duration-200",
                      isSel
                        ? "border-brand bg-brand font-semibold text-on-brand shadow-[0_6px_14px_-6px_rgb(217_96_59/0.8)]"
                        : "border-line-strong bg-paper text-ink hover:border-teal-fg hover:bg-teal-soft",
                    )}
                  >
                    {inZone(s.start, zone).toFormat("h:mm a")}
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
