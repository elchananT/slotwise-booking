"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { duration, errorMessage, money, slugify } from "@/lib/format";
import { allZones, browserZone } from "@/lib/time";
import type { Service, Staff } from "@/lib/types";
import { hashIndex, staffColor } from "@/lib/staff-colors";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/button";
import { InlineError, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { HoursEditor } from "./hours-editor";
import { ServiceForm, ServicePicker } from "./forms";

const ease = [0.16, 1, 0.3, 1] as const;
const STEPS = ["Your business", "Your services", "Team and hours"] as const;

type Hours = Array<{ weekday: number; startMinute: number; endMinute: number }>;
const DEFAULT_HOURS: Hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 540, endMinute: 1020 }));

export function SetupWizard() {
  const { business, setBusiness } = useAuth();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [booted, setBooted] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  // Resume where the owner left off.
  useEffect(() => {
    if (!business) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBooted(true);
      return;
    }
    let alive = true;
    Promise.all([api.services.list(), api.staff.list()])
      .then(([sv, st]) => {
        if (!alive) return;
        setServices(sv);
        setStaff(st);
        setStep(sv.length === 0 ? 1 : st.length === 0 ? 2 : 3);
      })
      .catch(() => alive && setStep(1))
      .finally(() => alive && setBooted(true));
    return () => {
      alive = false;
    };
    // run once per business existence
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!business]);

  if (!booted)
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-8 h-72 rounded-3xl" />
      </div>
    );

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-10">
        <Logo href="/app/setup" />
        <div className="flex items-center gap-2">
          {business && (
            <Link href="/app" className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink">
              Skip to dashboard
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-4 pb-24 sm:px-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="Setup progress" className="lg:sticky lg:top-8 lg:self-start">
          <ol className="flex gap-2 lg:flex-col lg:gap-1">
            {STEPS.map((label, i) => {
              const done = step > i;
              const current = step === i;
              return (
                <li key={label} className="min-w-0 flex-1 lg:flex-none">
                  <div className={cn("flex items-center gap-3 rounded-full px-1 py-1.5 lg:px-3", current && "lg:bg-sunken")}>
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tnum",
                        done ? "bg-teal text-on-teal" : current ? "bg-brand text-on-brand" : "bg-sunken text-ink-2",
                      )}
                    >
                      {done ? <Check className="size-4" aria-hidden /> : i + 1}
                    </span>
                    <span className={cn("hidden truncate font-medium sm:block", current ? "text-ink" : "text-ink-2")}>{label}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease }}>
              {step === 0 && (
                <BusinessStep
                  onDone={(b) => {
                    setBusiness(b);
                    setStep(1);
                  }}
                />
              )}
              {step === 1 && (
                <ServicesStep
                  services={services}
                  setServices={setServices}
                  onBack={business ? undefined : () => setStep(0)}
                  onNext={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <StaffStep
                  services={services}
                  staff={staff}
                  setStaff={setStaff}
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                />
              )}
              {step === 3 && <Finish slug={business?.slug} onBack={() => setStep(2)} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-[clamp(2.2rem,5vw,3.5rem)] leading-[1.03]">{title}</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-2">{body}</p>
    </div>
  );
}

/* ------------------------------ 1. business ------------------------------ */

function BusinessStep({ onDone }: { onDone: (b: Awaited<ReturnType<typeof api.business.create>>) => void }) {
  const zones = useMemo(() => allZones(), []);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezone(browserZone());
  }, []);

  const shownSlug = slugTouched ? slug : slugify(name);
  const nameErr = touched && name.trim().length < 2 ? "Enter your business name." : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const b = await api.business.create({
        name: name.trim(),
        slug: shownSlug || undefined,
        timezone,
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      onDone(b);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <StepTitle title="Tell us about your business" body="This is what customers see at the top of your booking page." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" error={nameErr} className="sm:col-span-2">
          {(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lumen Studio" autoFocus />}
        </Field>
        <Field label="Page address" hint={`Customers will book at /b/${shownSlug || "your-name"}`} optional className="sm:col-span-2">
          {(f) => (
            <Input
              {...f}
              value={shownSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="lumen-studio"
            />
          )}
        </Field>
        <Field label="Time zone" hint="Your opening hours are read in this zone." className="sm:col-span-2">
          {(f) => (
            <Select {...f} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {!zones.includes(timezone) && <option>{timezone}</option>}
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Short description" optional className="sm:col-span-2">
          {(f) => <Textarea {...f} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" maxLength={300} />}
        </Field>
        <Field label="Phone" optional>
          {(f) => <Input {...f} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label="Address" optional>
          {(f) => <Input {...f} value={address} onChange={(e) => setAddress(e.target.value)} />}
        </Field>
      </div>
      <div className="mt-5">
        <InlineError message={error} />
      </div>
      <div className="mt-8 flex justify-end">
        <Button type="submit" size="lg" loading={busy}>
          Save and continue
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------ 2. services ------------------------------ */

function ServicesStep({
  services,
  setServices,
  onBack,
  onNext,
}: {
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  onBack?: () => void;
  onNext: () => void;
}) {
  const toast = useToast();
  return (
    <div>
      <StepTitle title="What do you offer?" body="Add at least one service. You can add more, or edit them, from the Services page later." />
      {services.length > 0 && (
        <ul className="mb-8 flex flex-col gap-2">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-sm text-ink-2">
                  {duration(s.durationMinutes)}
                  {s.bufferMinutes ? ` + ${s.bufferMinutes} min buffer` : ""}
                </p>
              </div>
              <span className="tnum font-semibold">{money(s.priceCents, s.currency)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="surface p-6 sm:p-8">
        <h2 className="mb-5 text-2xl">{services.length ? "Add another service" : "Your first service"}</h2>
        <ServiceForm
          submitLabel="Add service"
          onSubmit={async (v) => {
            const created = await api.services.create(v);
            setServices((l) => [...l, created]);
            toast(`${created.name} added`);
          }}
        />
      </div>
      <div className="mt-8 flex items-center justify-between">
        {onBack ? (
          <Button variant="quiet" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
        ) : (
          <span />
        )}
        <Button size="lg" disabled={!services.length} onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ 3. staff ------------------------------ */

function StaffStep({
  services,
  staff,
  setStaff,
  onBack,
  onNext,
}: {
  services: Service[];
  staff: Staff[];
  setStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>(services.map((s) => s.id));
  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS);
  const [resetKey, setResetKey] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (name.trim().length < 2) return;
    if (!serviceIds.length) return setError("Choose at least one service this person offers.");
    if (!hours.length) return setError("Mark at least one block of working hours.");
    setBusy(true);
    setError(null);
    try {
      const created = await api.staff.create({ name: name.trim(), title: title.trim() || undefined, serviceIds });
      await api.staff.setHours(created.id, hours);
      setStaff((l) => [...l, { ...created, hours: hours as Staff["hours"], serviceIds }]);
      toast(`${created.name} added`);
      setName("");
      setTitle("");
      setTouched(false);
      setResetKey(String(Date.now()));
      setHours(DEFAULT_HOURS);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <StepTitle title="Who takes the bookings?" body="Add each person, choose what they offer, and paint the hours they work. Include yourself if you take appointments." />
      {staff.length > 0 && (
        <ul className="mb-8 flex flex-wrap gap-3">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-full border border-line bg-paper py-2 pr-5 pl-2">
              <Avatar name={s.name} color={staffColor(hashIndex(s.id))} className="size-9 text-sm" />
              <span className="font-medium">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} noValidate className="surface p-6 sm:p-8">
        <h2 className="mb-5 text-2xl">{staff.length ? "Add another person" : "Your first team member"}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" error={touched && name.trim().length < 2 ? "Enter a name." : null}>
            {(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Title" optional>
            {(f) => <Input {...f} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior stylist" />}
          </Field>
        </div>
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Offers</p>
          <ServicePicker services={services} value={serviceIds} onChange={setServiceIds} />
        </div>
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium">Weekly hours</p>
          <HoursEditor initial={hours} resetKey={resetKey} onChange={setHours} />
        </div>
        <div className="mt-5">
          <InlineError message={error} />
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit" loading={busy}>
            Add to team
          </Button>
        </div>
      </form>
      <div className="mt-8 flex items-center justify-between">
        <Button variant="quiet" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Button>
        <Button size="lg" disabled={!staff.length} onClick={onNext}>
          Finish setup
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ done ------------------------------ */

function Finish({ slug, onBack }: { slug?: string; onBack: () => void }) {
  const toast = useToast();
  const url = typeof window !== "undefined" && slug ? `${window.location.origin}/b/${slug}` : `/b/${slug}`;
  return (
    <div>
      <StepTitle title="Your booking page is live." body="Share this link anywhere customers find you. They don't need an account to book." />
      <div className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
        <code className="min-w-0 flex-1 truncate rounded-full bg-sunken px-5 py-3 text-ink">{url}</code>
        <div className="flex gap-2">
          <Button
            variant="soft"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast("Link copied");
              } catch {
                toast("Couldn't copy the link", "error");
              }
            }}
          >
            Copy link
          </Button>
          <a href={`/b/${slug}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 font-medium hover:bg-sunken">
            Open page
          </a>
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between">
        <Button variant="quiet" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Button>
        <LinkButton href="/app" size="lg">
          Go to your dashboard
        </LinkButton>
      </div>
    </div>
  );
}

