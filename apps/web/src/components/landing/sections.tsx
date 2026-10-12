"use client";
import { motion } from "motion/react";
import { Ban, Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/button";

const ease = [0.16, 1, 0.3, 1] as const;

/* ------------------------------ how it works ------------------------------ */

function HoursPaint() {
  // 7 days x 10 half-hour-ish rows; a hand-picked pattern, painted in on view.
  const pattern = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0],
    [1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  ];
  return (
    <motion.div initial="hide" whileInView="show" viewport={{ once: true, margin: "-20% 0px" }} className="grid grid-cols-7 gap-1.5" aria-hidden>
      {pattern.map((col, d) => (
        <div key={d} className="flex flex-col gap-1.5">
          {col.map((on, r) => (
            <motion.span
              key={r}
              variants={{ hide: { opacity: 0.0, scale: 0.6 }, show: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.35, delay: (d * 10 + r) * 0.012, ease }}
              className={cn("h-3.5 rounded-md", on ? "bg-teal" : "bg-sunken")}
            />
          ))}
        </div>
      ))}
    </motion.div>
  );
}

function ShareLink() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-full border border-line-strong bg-paper py-2 pr-2 pl-4 text-sm">
        <span className="min-w-0 flex-1 truncate tnum text-ink-2">
          …/b/<span className="font-medium text-ink">your-studio</span>
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-sunken">
          <Copy className="size-4" />
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-sm text-ink-2">
        {["Instagram bio", "WhatsApp status", "Google Business profile", "Email signature"].map((t) => (
          <span key={t} className="rounded-full bg-sunken px-3 py-1">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniWeek() {
  const lanes = [
    { name: "Maya", color: "#d9603b", blocks: [[1, 2], [3.5, 1], [6, 2]] },
    { name: "Noam", color: "#0f5c5c", blocks: [[0, 1.5], [2.5, 2], [5.5, 1]] },
    { name: "Dana", color: "#b8892b", blocks: [[1.5, 1], [4, 2.5]] },
  ];
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {lanes.map((l) => (
        <div key={l.name} className="flex items-center gap-3">
          <span className="w-10 text-xs font-medium text-ink-2">{l.name}</span>
          <div className="relative h-8 flex-1 rounded-full bg-sunken">
            {l.blocks.map(([start, len], i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scaleX: 0.4 }}
                whileInView={{ opacity: 1, scaleX: 1 }}
                viewport={{ once: true, margin: "-20% 0px" }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1, ease }}
                style={{ left: `${(start! / 8) * 100}%`, width: `${(len! / 8) * 100}%`, background: l.color, transformOrigin: "left" }}
                className="absolute inset-y-1 rounded-full"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  {
    title: "Paint your week",
    body: "Add your services and staff, then drag across a grid to mark when each person works. Split shifts and days off just work.",
    visual: <HoursPaint />,
  },
  {
    title: "Share one link",
    body: "Your booking page lives at its own address. Put it wherever customers already find you.",
    visual: <ShareLink />,
  },
  {
    title: "Watch the day fill in",
    body: "Bookings land on a calendar with a lane for every person. Click one to mark it done, move it or cancel it.",
    visual: <MiniWeek />,
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-8 border-y border-line bg-paper/60">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-[clamp(2.4rem,5vw,4rem)] leading-[1.02]">From empty calendar to a page you can send.</h2>
          <p className="mt-5 max-w-md text-lg text-ink-2">The setup wizard takes you through it in order. You can change every part later.</p>
        </div>
        <ol className="flex flex-col gap-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="surface grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-8">
              <div>
                <span className="display tnum grid size-10 place-items-center rounded-full bg-brand text-lg font-semibold text-on-brand">{i + 1}</span>
                <h3 className="mt-4 text-2xl">{s.title}</h3>
                <p className="mt-2 text-ink-2">{s.body}</p>
              </div>
              <div className="flex items-center">
                <div className="w-full">{s.visual}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------ never double-booked ------------------------------ */

export function NeverTwice() {
  const hours = ["9", "10", "11", "12"];
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-10">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className="text-[clamp(2.4rem,5vw,4rem)] leading-[1.02]">Two people, one slot, one yes.</h2>
          <p className="mt-5 max-w-lg text-lg text-ink-2">
            When two customers go for the same time, the booking is written inside a serializable transaction. One gets confirmed. The other is told it was just taken and sent back to pick again.
          </p>
          <p className="mt-4 max-w-lg text-lg text-ink-2">
            The check counts the buffer you set after each service, time off, and your minimum notice, so a 10 minute clean-up is never double-sold.
          </p>
        </div>

        <motion.div
          initial="hide"
          whileInView="show"
          viewport={{ once: true, margin: "-15% 0px" }}
          className="surface p-6 sm:p-8"
          role="img"
          aria-label="A timeline where one customer books 10:00 and a second customer trying 10:15 is told the time was just taken"
        >
          <div className="flex justify-between pl-14 text-xs text-ink-2 tnum" aria-hidden>
            {hours.map((h) => (
              <span key={h}>{h}:00</span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3" aria-hidden>
            <span className="w-11 text-xs font-medium text-ink-2">Maya</span>
            <div className="relative h-14 flex-1 rounded-2xl bg-sunken">
              <motion.div
                variants={{ hide: { opacity: 0, scaleX: 0.3 }, show: { opacity: 1, scaleX: 1 } }}
                transition={{ duration: 0.6, delay: 0.2, ease }}
                style={{ left: "25%", width: "25%", transformOrigin: "left" }}
                className="absolute inset-y-1.5 grid place-items-center rounded-xl bg-teal text-sm font-medium text-on-teal"
              >
                Haircut
              </motion.div>
              <motion.div
                variants={{ hide: { opacity: 0 }, show: { opacity: 1 } }}
                transition={{ duration: 0.4, delay: 0.7 }}
                style={{ left: "50%", width: "6%" }}
                className="absolute inset-y-1.5 rounded-xl border border-dashed border-line-strong"
                title="Buffer"
              />
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 text-sm" aria-hidden>
            <motion.div
              variants={{ hide: { opacity: 0, x: -14 }, show: { opacity: 1, x: 0 } }}
              transition={{ duration: 0.5, delay: 0.9, ease }}
              className="flex items-center gap-3 rounded-2xl bg-teal-soft px-4 py-3 text-teal-fg"
            >
              <Check className="size-5 shrink-0" />
              <span className="font-medium">Customer A, 10:00: confirmed</span>
            </motion.div>
            <motion.div
              variants={{ hide: { opacity: 0, x: -14 }, show: { opacity: 1, x: 0 } }}
              transition={{ duration: 0.5, delay: 1.15, ease }}
              className="flex items-center gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-danger"
            >
              <Ban className="size-5 shrink-0" />
              <span className="font-medium">Customer B, 10:15, at the same moment: that time was just taken</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------ what's inside ------------------------------ */

const DETAILS: Array<[string, string]> = [
  ["Staff with their own weeks", "Each person has their own hours, including split shifts, and only offers the services you assign them."],
  ["Buffers after appointments", "Add clean-up or notes time to a service. It blocks the calendar without showing up as part of the visit."],
  ["Time zones that behave", "Hours are kept in your zone, daylight-saving days included. Customers can switch the slot list to their own time."],
  ["Cancel and reschedule by link", "Every booking gets a private link. Customers cancel until 2 hours before, move the time, or add it to their calendar."],
  ["An outbox you can read", "Confirmations and cancellations are written to an emails page in your dashboard so you can see what customers would receive."],
  ["The numbers that matter", "Bookings per day, your top services, revenue over 30 days and how busy each person is."],
];

export function Details() {
  return (
    <section id="details" className="scroll-mt-8 mx-auto max-w-7xl px-5 pb-24 sm:px-10">
      <h2 className="max-w-3xl text-[clamp(2.4rem,5vw,4rem)] leading-[1.02]">Built for how appointments actually work.</h2>
      <dl className="mt-12 grid gap-x-16 md:grid-cols-2">
        {DETAILS.map(([t, b]) => (
          <div key={t} className="border-t-2 border-dashed border-line-strong py-7">
            <dt className="display text-2xl">{t}</dt>
            <dd className="mt-2 max-w-md text-ink-2">{b}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-[2rem] bg-sunken p-7 sm:p-9">
        <h3 className="text-2xl">Not here yet</h3>
        <p className="mt-2 max-w-3xl text-ink-2">
          Slotwise doesn&rsquo;t take payments, send real emails or texts, or have customer accounts. It covers one location per business and one-off bookings, not repeating ones. Those are left out on purpose until the booking part is right.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------ closing CTA + footer ------------------------------ */

export function ClosingCta() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-10">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-teal px-7 py-16 text-on-teal sm:px-16 sm:py-20">
        <div aria-hidden className="absolute -right-24 -bottom-32 size-[30rem] rounded-full" style={{ background: "radial-gradient(closest-side, rgb(217 96 59 / 0.55), transparent)" }} />
        <div className="relative max-w-2xl">
          <h2 className="text-[clamp(2.4rem,5vw,4rem)] leading-[1.02]">Give your customers a page they&rsquo;ll finish.</h2>
          <p className="mt-5 max-w-lg text-lg opacity-85">Create an account, add what you offer, and share the link. You&rsquo;ll see your first booking on the calendar.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/register" size="lg">
              Create your booking page
            </LinkButton>
            <LinkButton href="/b/lumen-studio" size="lg" variant="ghost" className="border-white/40 text-on-teal hover:bg-white/10">
              See a sample page
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
