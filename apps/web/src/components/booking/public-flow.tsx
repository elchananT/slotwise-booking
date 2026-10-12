"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, ChevronRight, Copy, CalendarPlus, MapPin, Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { duration, errorMessage, money } from "@/lib/format";
import { hashIndex, staffColor } from "@/lib/staff-colors";
import { fmtDateLong, fmtTime } from "@/lib/time";
import type { AvailabilitySlot, CreatedBooking, PublicBusiness, PublicStaff, Service } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, InlineError, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { LogoMark } from "@/components/brand/logo";
import { DateTimePicker } from "./date-time-picker";
import { Ticket } from "./ticket";

type Step = "service" | "staff" | "time" | "details" | "done";
const ease = [0.16, 1, 0.3, 1] as const;

export function PublicFlow({ slug }: { slug: string }) {
  const q = useQuery((signal) => api.pub.business(slug, signal), [slug]);

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden">
        <div className="absolute -top-40 -left-32 size-[34rem] rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--terracotta) 22%, transparent), transparent)" }} />
        <div className="absolute -top-52 right-0 size-[38rem] rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--teal) 18%, transparent), transparent)" }} />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        <div className="flex items-center justify-end py-4">
          <ThemeToggle />
        </div>
        {q.loading ? (
          <LoadingShell />
        ) : q.error || !q.data ? (
          <NotFound error={q.error} retry={q.refetch} />
        ) : (
          <Flow data={q.data} slug={slug} />
        )}
        <footer className="mt-20 flex items-center justify-center gap-2 text-sm text-ink-2">
          <LogoMark className="size-5" />
          Scheduling by{" "}
          <Link href="/" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-brand">
            Slotwise
          </Link>
        </footer>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mt-8" aria-busy aria-label="Loading booking page">
      <Skeleton className="h-14 w-2/3 max-w-md" />
      <Skeleton className="mt-4 h-5 w-full max-w-lg" />
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="hidden h-96 rounded-3xl lg:block" />
      </div>
    </div>
  );
}

function NotFound({ error, retry }: { error: string | null; retry: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <EmptyState
        icon={<MapPin className="size-6" />}
        title="We can't find this booking page"
        body={error ?? "Check the link you were given, or ask the business for a new one."}
        action={
          <Button variant="ghost" onClick={retry}>
            Try again
          </Button>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Flow({ data, slug }: { data: PublicBusiness; slug: string }) {
  const { business, services, staff } = data;
  const zone = business.timezone;
  const toast = useToast();

  const [step, setStep] = useState<Step>("service");
  const [dir, setDir] = useState(1);
  const [service, setService] = useState<Service | null>(null);
  const [anyStaff, setAnyStaff] = useState(true);
  const [pro, setPro] = useState<PublicStaff | null>(null);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [booked, setBooked] = useState<CreatedBooking | null>(null);

  const eligible = useMemo(() => (service ? staff.filter((s) => s.serviceIds.includes(service.id)) : []), [staff, service]);

  function go(next: Step, d = 1) {
    setDir(d);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseService(s: Service) {
    setService(s);
    setSlot(null);
    const list = staff.filter((p) => p.serviceIds.includes(s.id));
    setPro(list.length === 1 ? list[0]! : null);
    setAnyStaff(list.length !== 1);
    go(list.length <= 1 ? "time" : "staff");
  }

  const staffName = pro ? pro.name : slot && service && eligible.length > 1 ? "Any professional" : null;
  const steps: Array<{ id: Step; label: string; skip?: boolean }> = [
    { id: "service", label: "Service" },
    { id: "staff", label: "Professional", skip: !!service && eligible.length <= 1 },
    { id: "time", label: "Date & time" },
    { id: "details", label: "Your details" },
  ];
  const order: Step[] = ["service", "staff", "time", "details", "done"];
  const idx = order.indexOf(step);

  return (
    <>
      <motion.header initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }} className="mt-2 max-w-3xl">
        <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-medium">{business.name}</h1>
        {business.description && <p className="mt-4 max-w-xl text-lg text-ink-2">{business.description}</p>}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          {business.address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {business.address}
            </span>
          )}
          {business.phone && (
            <a href={`tel:${business.phone}`} className="inline-flex items-center gap-1.5 hover:text-ink">
              <Phone className="size-4" aria-hidden /> {business.phone}
            </a>
          )}
        </div>
      </motion.header>

      {step !== "done" && (
        <nav aria-label="Booking steps" className="mt-10 flex flex-wrap gap-2">
          {steps
            .filter((s) => !s.skip)
            .map((s) => {
              const si = order.indexOf(s.id);
              const done = si < idx;
              const current = s.id === step;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!done}
                  aria-current={current ? "step" : undefined}
                  onClick={() => go(s.id, -1)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                    current && "border-ink bg-ink text-page",
                    done && "border-line-strong bg-paper text-ink hover:bg-sunken",
                    !done && !current && "border-line text-ink-2/70",
                  )}
                >
                  {done && <Check className="size-3.5 text-teal-fg" aria-hidden />}
                  {s.label}
                </button>
              );
            })}
        </nav>
      )}

      <div className={cn("mt-8 grid gap-8", step !== "done" && "lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-12")}>
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.section
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -16 }}
              transition={{ duration: 0.38, ease }}
            >
              {step === "service" && <ServiceStep services={services} staff={staff} selected={service} onPick={chooseService} />}
              {step === "staff" && service && (
                <StaffStep
                  list={eligible}
                  anyStaff={anyStaff}
                  pro={pro}
                  onAny={() => {
                    setAnyStaff(true);
                    setPro(null);
                    setSlot(null);
                    go("time");
                  }}
                  onPick={(p) => {
                    setAnyStaff(false);
                    setPro(p);
                    setSlot(null);
                    go("time");
                  }}
                />
              )}
              {step === "time" && service && (
                <div>
                  <h2 className="mb-6 text-3xl">Pick a day and time</h2>
                  <DateTimePicker
                    slug={slug}
                    serviceId={service.id}
                    staffId={pro?.id}
                    timezone={zone}
                    maxAdvanceDays={business.maxAdvanceDays}
                    selected={slot}
                    onSelect={setSlot}
                    refreshKey={refreshKey}
                  />
                  <div className="mt-8 flex items-center justify-between gap-3">
                    <Button variant="quiet" onClick={() => go(eligible.length > 1 ? "staff" : "service", -1)}>
                      <ArrowLeft className="size-4" aria-hidden /> Back
                    </Button>
                    <Button size="lg" disabled={!slot} onClick={() => go("details")}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}
              {step === "details" && service && slot && (
                <DetailsStep
                  slug={slug}
                  service={service}
                  slot={slot}
                  staffId={pro?.id}
                  onBack={() => go("time", -1)}
                  onConflict={() => {
                    setSlot(null);
                    setRefreshKey((k) => k + 1);
                    go("time", -1);
                    toast("That time was just taken. Pick another one.", "error");
                  }}
                  onBooked={(b) => {
                    setBooked(b);
                    go("done");
                  }}
                />
              )}
              {step === "done" && booked && service && (
                <Done
                  booked={booked}
                  service={service}
                  businessName={business.name}
                  address={business.address}
                  zone={zone}
                  staffName={booked.staff?.name ?? pro?.name ?? null}
                  onAgain={() => {
                    setBooked(null);
                    setSlot(null);
                    setService(null);
                    setPro(null);
                    go("service", -1);
                  }}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        {step !== "done" && (
          <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Appointment summary">
            <Ticket
              businessName={business.name}
              address={business.address}
              service={service}
              staffName={staffName}
              startsAt={slot?.start}
              zone={zone}
            />
          </aside>
        )}
      </div>
    </>
  );
}

/* ------------------------------ steps ------------------------------ */

function ServiceStep({
  services,
  staff,
  selected,
  onPick,
}: {
  services: Service[];
  staff: PublicStaff[];
  selected: Service | null;
  onPick: (s: Service) => void;
}) {
  if (!services.length)
    return <EmptyState icon={<Sparkles className="size-6" />} title="Nothing to book yet" body="This business hasn't published any services." />;
  return (
    <div>
      <h2 className="mb-6 text-3xl">What are you booking?</h2>
      <ul className="flex flex-col gap-3">
        {services.map((s, i) => {
          const bookable = staff.some((p) => p.serviceIds.includes(s.id));
          const isSel = selected?.id === s.id;
          return (
            <motion.li key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05, ease }}>
              <button
                type="button"
                disabled={!bookable}
                onClick={() => onPick(s)}
                aria-pressed={isSel}
                className={cn(
                  "group flex w-full items-center gap-4 rounded-[1.75rem] border bg-paper p-5 text-left transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)] sm:p-6",
                  "hover:-translate-y-0.5 hover:border-teal-fg hover:shadow-[0_18px_30px_-20px_rgb(var(--shadow-ink)/0.4)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
                  isSel ? "border-brand" : "border-line",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="display text-xl leading-snug sm:text-2xl">{s.name}</div>
                  {s.description && <p className="mt-1 line-clamp-2 text-ink-2">{s.description}</p>}
                  <p className="mt-2 text-sm text-ink-2">
                    {duration(s.durationMinutes)}
                    {!bookable && " · No one is taking bookings for this yet"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tnum">{money(s.priceCents, s.currency)}</div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-2 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function StaffStep({
  list,
  anyStaff,
  pro,
  onAny,
  onPick,
}: {
  list: PublicStaff[];
  anyStaff: boolean;
  pro: PublicStaff | null;
  onAny: () => void;
  onPick: (p: PublicStaff) => void;
}) {
  return (
    <div>
      <h2 className="mb-6 text-3xl">Who would you like to see?</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="sm:col-span-2">
          <button
            type="button"
            onClick={onAny}
            aria-pressed={anyStaff && !pro}
            className="flex w-full items-center gap-4 rounded-[1.75rem] border border-dashed border-line-strong bg-paper p-5 text-left transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-teal-fg"
          >
            <span className="relative grid h-12 w-[4.25rem] shrink-0 place-items-center" aria-hidden>
              {list.slice(0, 3).map((p, i) => (
                <span key={p.id} className="absolute" style={{ left: i * 14 }}>
                  <Avatar name={p.name} color={staffColor(hashIndex(p.id))} className="size-10 border-2 border-paper text-xs" />
                </span>
              ))}
            </span>
            <span>
              <span className="display block text-xl">Any professional</span>
              <span className="text-ink-2">The earliest time wins. We assign whoever is free.</span>
            </span>
          </button>
        </li>
        {list.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              aria-pressed={pro?.id === p.id}
              className={cn(
                "flex w-full items-center gap-4 rounded-[1.75rem] border bg-paper p-5 text-left transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-teal-fg",
                pro?.id === p.id ? "border-brand" : "border-line",
              )}
            >
              <Avatar name={p.name} color={staffColor(hashIndex(p.id))} className="size-14 text-lg" />
              <span>
                <span className="display block text-xl">{p.name}</span>
                {p.title && <span className="text-ink-2">{p.title}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailsStep({
  slug,
  service,
  slot,
  staffId,
  onBack,
  onConflict,
  onBooked,
}: {
  slug: string;
  service: Service;
  slot: AvailabilitySlot;
  staffId?: string;
  onBack: () => void;
  onConflict: () => void;
  onBooked: (b: CreatedBooking) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const nameErr = touched && name.trim().length < 2 ? "Tell us your name." : null;
  const emailErr = touched && !emailOk ? "Enter a valid email so you can manage your booking." : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (name.trim().length < 2 || !emailOk) return;
    setBusy(true);
    setError(null);
    try {
      const b = await api.pub.book(slug, {
        serviceId: service.id,
        staffId,
        startsAt: slot.start,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onBooked(b);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) onConflict();
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2 className="mb-2 text-3xl">Almost there</h2>
      <p className="mb-6 text-ink-2">No account needed. We use these details to confirm your visit.</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={nameErr} className="sm:col-span-2">
          {(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Email" error={emailErr}>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Phone" optional>
          {(p) => <Input {...p} type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label="Anything we should know?" optional className="sm:col-span-2">
          {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />}
        </Field>
      </div>
      <p className="mt-5 text-sm text-ink-2">You can cancel or reschedule from your booking link until 2 hours before the start.</p>
      <div className="mt-4">
        <InlineError message={error} />
      </div>
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="quiet" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Button>
        <Button type="submit" size="lg" loading={busy}>
          Confirm booking
        </Button>
      </div>
    </form>
  );
}

function Done({
  booked,
  service,
  businessName,
  address,
  zone,
  staffName,
  onAgain,
}: {
  booked: CreatedBooking;
  service: Service;
  businessName: string;
  address: string | null;
  zone: string;
  staffName: string | null;
  onAgain: () => void;
}) {
  const toast = useToast();
  const manageUrl = typeof window !== "undefined" ? `${window.location.origin}/booking/${booked.manageToken}` : `/booking/${booked.manageToken}`;
  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease }}
          className="mx-auto grid size-16 place-items-center rounded-full bg-teal text-on-teal"
        >
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.25, ease }} />
          </svg>
        </motion.div>
        <h2 className="mt-6 text-[clamp(2.2rem,5vw,3.25rem)]">You&rsquo;re booked.</h2>
        <p className="mt-2 text-lg text-ink-2">
          {fmtDateLong(booked.startsAt, zone)} at {fmtTime(booked.startsAt, zone)}
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease }} className="relative mt-8">
        <Ticket
          businessName={businessName}
          address={address}
          service={service}
          staffName={staffName}
          startsAt={booked.startsAt}
          zone={zone}
          footer={
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-2">Booking reference</span>
              <span className="display tnum text-xl font-semibold tracking-wide">{booked.reference}</span>
            </div>
          }
        />
        <div
          aria-hidden
          className="stamp-in pointer-events-none absolute -top-5 -right-2 rounded-xl border-[3px] border-brand px-3 py-1 text-brand-deep sm:-right-6"
          style={{ animationDelay: "0.9s", transform: "rotate(-6deg)" }}
        >
          <span className="display text-xl font-semibold tracking-wide">Confirmed</span>
        </div>
      </motion.div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <a href={api.pub.icsUrl(booked.manageToken)} download className="inline-flex">
          <span className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 font-semibold text-on-brand transition hover:brightness-105">
            <CalendarPlus className="size-4" aria-hidden /> Add to calendar
          </span>
        </a>
        <LinkButton href={`/booking/${booked.manageToken}`} variant="ghost" className="h-12">
          Manage booking
        </LinkButton>
      </div>

      <div className="mt-6 rounded-3xl bg-sunken p-5">
        <p className="font-medium">Keep your booking link</p>
        <p className="mt-1 text-sm text-ink-2">It&rsquo;s how you cancel or reschedule. Anyone with the link can change this booking.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-full bg-paper px-4 py-2.5 text-xs text-ink-2">{manageUrl}</code>
          <Button
            variant="soft"
            size="sm"
            aria-label="Copy booking link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(manageUrl);
                toast("Booking link copied");
              } catch {
                toast("Couldn't copy. Select the link and copy it manually.", "error");
              }
            }}
          >
            <Copy className="size-4" aria-hidden /> Copy
          </Button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Button variant="quiet" onClick={onAgain}>
          Book something else
        </Button>
      </div>
    </div>
  );
}

