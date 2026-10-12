"use client";
import { motion } from "motion/react";
import { CalendarPlus, CalendarClock, Phone, TicketX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import { browserZone, fmtDateLong, fmtTime, nowIn } from "@/lib/time";
import type { AvailabilitySlot, PublicBookingSummary } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, InlineError, Skeleton, StatusBadge } from "@/components/ui/feedback";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { DateTimePicker } from "./date-time-picker";
import { Ticket } from "./ticket";

const CANCEL_WINDOW_MIN = 120;
const ease = [0.16, 1, 0.3, 1] as const;

export function ManageBooking({ token }: { token: string }) {
  const q = useQuery(() => api.pub.booking(token), [token]);
  const [dialog, setDialog] = useState<null | "cancel" | "reschedule">(null);
  const toast = useToast();
  const b = q.data;
  const zone = b?.business?.timezone ?? browserZone();

  const startsSoon = b ? new Date(b.startsAt).getTime() - nowIn("UTC").toMillis() < CANCEL_WINDOW_MIN * 60_000 : false;
  const past = b ? new Date(b.endsAt).getTime() < nowIn("UTC").toMillis() : false;
  const active = b?.status === "CONFIRMED" && !past;

  function replace(next: PublicBookingSummary) {
    // The API may return a slimmer object: merge so related data (service, staff, business) is kept.
    q.setData({ ...(b as PublicBookingSummary), ...next, service: next.service ?? b?.service, staff: next.staff ?? b?.staff, business: next.business ?? b?.business });
  }

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] overflow-hidden" style={{ maskImage: "linear-gradient(to bottom, black 55%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)" }}>
        <div className="absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--teal) 16%, transparent), transparent)" }} />
      </div>
      <div className="relative mx-auto max-w-xl px-4 pb-20 sm:px-6">
        <div className="flex items-center justify-between py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink">
            <LogoMark className="size-6" /> Slotwise
          </Link>
          <ThemeToggle />
        </div>

        {q.loading ? (
          <div className="mt-8" aria-busy aria-label="Loading your booking">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="mt-8 h-96 rounded-3xl" />
          </div>
        ) : q.error || !b ? (
          <div className="mt-12">
            <EmptyState
              icon={<TicketX className="size-6" />}
              title="This booking link doesn't work"
              body="It may be mistyped or expired. Check the link in your confirmation, or contact the business."
              action={<Button variant="ghost" onClick={q.refetch}>Try again</Button>}
            />
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="mt-6">
              <div className="mb-3 flex items-center gap-3">
                <StatusBadge status={b.status} />
                <span className="tnum text-sm text-ink-2">Ref {b.reference}</span>
              </div>
              <h1 className="text-[clamp(2rem,6vw,3rem)] leading-[1.05]">
                {b.status === "CANCELLED"
                  ? "This appointment was cancelled"
                  : past
                    ? "This appointment has passed"
                    : `${b.customerName.split(" ")[0]}, you're booked`}
              </h1>
              <p className="mt-2 text-lg text-ink-2">
                {fmtDateLong(b.startsAt, zone)} at {fmtTime(b.startsAt, zone)}
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease }} className={cn("relative mt-7", b.status === "CANCELLED" && "opacity-70")}>
              <Ticket
                businessName={b.business?.name ?? "Your appointment"}
                address={b.business?.address}
                service={b.service ? { ...b.service, priceCents: b.service.priceCents, currency: b.service.currency } : null}
                staffName={b.staff?.name}
                startsAt={b.startsAt}
                zone={zone}
              />
              {b.status === "CANCELLED" && (
                <div aria-hidden className="stamp-in pointer-events-none absolute top-10 right-4 rounded-xl border-[3px] border-danger px-3 py-1 text-danger">
                  <span className="display text-xl font-semibold">Cancelled</span>
                </div>
              )}
            </motion.div>

            {active && (
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <a href={api.pub.icsUrl(token)} download className="sm:col-span-2">
                  <span className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 font-semibold text-on-brand transition hover:brightness-105">
                    <CalendarPlus className="size-4" aria-hidden /> Add to calendar
                  </span>
                </a>
                <Button variant="ghost" size="lg" onClick={() => setDialog("reschedule")}>
                  <CalendarClock className="size-4" aria-hidden /> Reschedule
                </Button>
                <Button variant="danger" size="lg" disabled={startsSoon} onClick={() => setDialog("cancel")}>
                  Cancel appointment
                </Button>
              </div>
            )}
            {active && startsSoon && (
              <p className="mt-4 rounded-2xl bg-amber-soft px-4 py-3 text-sm">
                Cancelling closes 2 hours before the start.
                {b.business?.phone && (
                  <>
                    {" "}
                    Call{" "}
                    <a className="inline-flex items-center gap-1 font-medium underline underline-offset-2" href={`tel:${b.business.phone}`}>
                      <Phone className="size-3.5" aria-hidden /> {b.business.phone}
                    </a>{" "}
                    if you can&rsquo;t make it.
                  </>
                )}
              </p>
            )}
            {b.status === "CANCELLED" && b.business?.slug && (
              <div className="mt-7">
                <Link href={`/b/${b.business.slug}`} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-5 font-semibold text-on-brand">
                  Book a new time
                </Link>
              </div>
            )}

            <CancelDialog
              open={dialog === "cancel"}
              onClose={() => setDialog(null)}
              onConfirm={async () => {
                const res = await api.pub.cancel(token);
                replace({ ...(b as PublicBookingSummary), ...res, status: res?.status ?? "CANCELLED" });
                setDialog(null);
                toast("Appointment cancelled");
              }}
            />
            {dialog === "reschedule" && (
              <RescheduleDialog
                b={b}
                zone={zone}
                onClose={() => setDialog(null)}
                onDone={(next) => {
                  replace(next);
                  setDialog(null);
                  toast("Appointment moved");
                }}
                token={token}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CancelDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} title="Cancel this appointment?" description="The time goes back to the business's calendar. You can book again whenever you like.">
      <div className="mt-2 flex flex-col gap-4">
        <InlineError message={error} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Keep appointment
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancel appointment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function RescheduleDialog({
  b,
  zone,
  token,
  onClose,
  onDone,
}: {
  b: PublicBookingSummary;
  zone: string;
  token: string;
  onClose: () => void;
  onDone: (b: PublicBookingSummary) => void;
}) {
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [same, setSame] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = b.business?.slug;
  const staffId = b.staff?.id ?? b.staffId;

  async function confirm() {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.pub.reschedule(token, { startsAt: slot.start, staffId: same ? staffId : undefined });
      onDone({ ...b, ...res, startsAt: res?.startsAt ?? slot.start });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Pick a new time" description={`Currently ${fmtDateLong(b.startsAt, zone)} at ${fmtTime(b.startsAt, zone)}.`} wide>
      {!slug ? (
        <InlineError message="This booking doesn't include its business page, so new times can't be loaded." />
      ) : (
        <div className="flex flex-col gap-6">
          {b.staff?.name && (
            <div role="group" aria-label="Professional" className="inline-flex self-start rounded-full bg-sunken p-1">
              {[
                [true, `Same professional (${b.staff.name})`],
                [false, "Any professional"],
              ].map(([v, label]) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={same === v}
                  onClick={() => {
                    setSame(v as boolean);
                    setSlot(null);
                  }}
                  className={cn("rounded-full px-4 py-2 text-sm font-medium transition-colors", same === v ? "bg-paper shadow-sm" : "text-ink-2 hover:text-ink")}
                >
                  {label as string}
                </button>
              ))}
            </div>
          )}
          <DateTimePicker
            slug={slug}
            serviceId={b.service?.id ?? b.serviceId}
            staffId={same ? staffId : undefined}
            timezone={zone}
            maxAdvanceDays={60}
            selected={slot}
            onSelect={setSlot}
          />
          <InlineError message={error} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">{slot ? `New time: ${fmtDateLong(slot.start, zone)} at ${fmtTime(slot.start, zone)}` : "Choose a new day and time."}</p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose}>
                Keep current time
              </Button>
              <Button disabled={!slot} loading={busy} onClick={confirm}>
                Confirm new time
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
