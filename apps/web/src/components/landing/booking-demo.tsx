"use client";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonthCalendar, type DayState } from "@/components/booking/month-calendar";
import { cn } from "@/lib/cn";
import { DateTime } from "@/lib/time";

const ease = [0.16, 1, 0.3, 1] as const;

const SERVICES = [
  { name: "Haircut", mins: 45, price: "$45", slots: ["9:30 AM", "10:15 AM", "11:00 AM", "1:45 PM", "3:00 PM", "4:30 PM"] },
  { name: "Beard trim", mins: 20, price: "$20", slots: ["9:00 AM", "9:20 AM", "10:40 AM", "12:00 PM", "2:20 PM", "5:00 PM"] },
  { name: "Colour", mins: 90, price: "$110", slots: ["9:00 AM", "11:30 AM", "1:00 PM", "2:30 PM"] },
];

/** Deterministic sample availability: closed Sun/Mon, every 5th day fully booked. */
function sampleAvailability(month: DateTime, today: DateTime) {
  const out: Record<string, DayState> = {};
  for (let d = 1; d <= month.daysInMonth!; d++) {
    const day = month.set({ day: d });
    const open = day.weekday !== 7 && day.weekday !== 1 && d % 5 !== 0;
    out[day.toISODate()!] = open && day >= today.startOf("day");
  }
  return out;
}

type Phase = "pick" | "done";

export function BookingDemo() {
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { margin: "-10% 0px" });

  const [today, setToday] = useState<DateTime | null>(null);
  const [month, setMonth] = useState<DateTime | null>(null);
  const [svc, setSvc] = useState(0);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [auto, setAuto] = useState(true);

  // "now" only exists on the client; render a same-size placeholder until then.
  useEffect(() => {
    const t = DateTime.now().startOf("day");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(t);
    setMonth(t.startOf("month"));
  }, []);

  const availability = useMemo(() => (today && month ? sampleAvailability(month, today) : {}), [today, month]);
  const firstOpen = useMemo(() => {
    if (!today) return null;
    const m = today.startOf("month");
    const av = sampleAvailability(m, today);
    return Object.keys(av).find((k) => av[k] && k > today.plus({ days: 1 }).toISODate()!) ?? Object.keys(av).find((k) => av[k]) ?? null;
  }, [today]);

  const reset = useCallback(() => {
    setDate(null);
    setSlot(null);
    setPhase("pick");
  }, []);

  // Autoplay: choreographed slot selection, loops until the visitor touches something.
  useEffect(() => {
    if (!auto || reduced || !inView || !firstOpen || !today) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    let loop = 0;
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => !cancelled && fn(), ms));
    const run = () => {
      const s = loop % SERVICES.length;
      reset();
      setMonth(today.startOf("month"));
      at(500, () => setSvc(s));
      at(1500, () => setDate(firstOpen));
      at(2700, () => setSlot(SERVICES[s]!.slots[Math.min(1, SERVICES[s]!.slots.length - 1)]!));
      at(3900, () => setPhase("done"));
      at(8200, () => {
        loop += 1;
        run();
      });
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [auto, reduced, inView, firstOpen, today, reset]);

  // Reduced motion / no autoplay: show a meaningful static state.
  useEffect(() => {
    if (reduced && firstOpen && !date && phase === "pick") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(firstOpen);
      setSlot(SERVICES[0]!.slots[1]!);
    }
  }, [reduced, firstOpen, date, phase]);

  const service = SERVICES[svc]!;
  const stop = () => auto && setAuto(false);

  return (
    <div
      ref={wrap}
      onPointerDownCapture={stop}
      onKeyDownCapture={stop}
      className="ticket relative mx-auto w-full max-w-[26.5rem] p-5 sm:p-6"
      role="group"
      aria-label="Interactive booking demo with sample data"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="display text-xl leading-tight">Lumen Studio</p>
          <p className="text-sm text-ink-2">Sample page. Nothing is saved.</p>
        </div>
        <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-fg">Live demo</span>
      </div>

      <div className="relative mt-5 min-h-[34.5rem]">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "pick" ? (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease }}>
              <div role="radiogroup" aria-label="Service" className="flex flex-wrap gap-2">
                {SERVICES.map((s, i) => (
                  <button
                    key={s.name}
                    type="button"
                    role="radio"
                    aria-checked={svc === i}
                    onClick={() => {
                      setSvc(i);
                      setSlot(null);
                    }}
                    className={cn(
                      "h-10 rounded-full border px-4 text-sm font-medium transition-colors duration-200",
                      svc === i ? "border-ink bg-ink text-page" : "border-line-strong bg-paper text-ink hover:bg-sunken",
                    )}
                  >
                    {s.name}
                    <span className={cn("ml-1.5 font-normal", svc === i ? "opacity-70" : "text-ink-2")}>{s.mins}m</span>
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {today && month ? (
                  <MonthCalendar
                    size="sm"
                    month={month}
                    today={today}
                    selected={date}
                    availability={availability}
                    onSelect={(d) => {
                      setDate(d);
                      setSlot(null);
                    }}
                    onMonthChange={setMonth}
                  />
                ) : (
                  <div className="h-[18.5rem]" aria-hidden />
                )}
              </div>

              <div className="mt-4 min-h-[5.5rem]">
                <AnimatePresence mode="wait" initial={false}>
                  {date ? (
                    <motion.div key={`${date}-${svc}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease }}>
                      <p className="mb-2 text-sm text-ink-2">Times on {DateTime.fromISO(date).toFormat("ccc, LLL d")}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {service.slots.slice(0, 6).map((t) => (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={slot === t}
                            onClick={() => setSlot(t)}
                            className={cn(
                              "h-10 rounded-full border text-sm tnum transition-[background-color,border-color,color] duration-200",
                              slot === t
                                ? "border-brand bg-brand font-semibold text-on-brand"
                                : "border-line-strong bg-paper hover:border-teal-fg hover:bg-teal-soft",
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-ink-2">
                      Pick a day with a dot to see open times.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                disabled={!slot}
                onClick={() => setPhase("done")}
                className="mt-5 h-12 w-full rounded-full bg-brand font-semibold text-on-brand shadow-[0_6px_14px_-6px_rgb(217_96_59/0.7)] transition-[opacity,filter] hover:brightness-105 disabled:opacity-40 disabled:shadow-none"
              >
                {slot ? `Book ${service.name} at ${slot}` : "Choose a time"}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease }}
              className="flex min-h-[34.5rem] flex-col"
            >
              <div className="grid size-14 place-items-center rounded-full bg-teal text-on-teal">
                <Check className="size-7" strokeWidth={2.6} aria-hidden />
              </div>
              <h3 className="display mt-5 text-4xl leading-none">You&rsquo;re booked.</h3>
              <p className="mt-3 text-ink-2">
                {date ? DateTime.fromISO(date).toFormat("cccc, LLLL d") : ""} at {slot}
              </p>
              <div className="perforation my-6 !mx-0" aria-hidden />
              <dl className="grid grid-cols-2 gap-y-4 text-sm">
                <div>
                  <dt className="text-ink-2">Service</dt>
                  <dd className="font-medium">{service.name}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">Price</dt>
                  <dd className="font-medium">{service.price}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">Length</dt>
                  <dd className="font-medium">{service.mins} minutes</dd>
                </div>
                <div>
                  <dt className="text-ink-2">Reference</dt>
                  <dd className="display tnum text-lg font-semibold">SW-7K3Q9D</dd>
                </div>
              </dl>
              <div className="relative mt-auto flex items-end justify-between pt-8">
                <button
                  type="button"
                  onClick={() => {
                    setAuto(false);
                    reset();
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-sunken"
                >
                  <RotateCcw className="size-4" aria-hidden /> Book another
                </button>
                <div
                  aria-hidden
                  className="stamp-in rounded-xl border-[3px] border-brand px-3 py-1 text-brand-deep"
                  style={{ animationDelay: "0.35s" }}
                >
                  <span className="display text-2xl font-semibold">Confirmed</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
