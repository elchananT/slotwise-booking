"use client";
import { ArrowLeft, CalendarClock, Check, Mail, Phone, UserX, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { duration, errorMessage, money } from "@/lib/format";
import { fmtDateLong, fmtTime, inZone } from "@/lib/time";
import type { AvailabilitySlot, Booking, BookingStatus, Business, Service, Staff } from "@/lib/types";
import { DateTimePicker } from "@/components/booking/date-time-picker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InlineError, StatusBadge } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export function bookingService(b: Booking, services: Service[]) {
  return b.service ?? services.find((s) => s.id === b.serviceId);
}
export function bookingStaffName(b: Booking, staff: Staff[]) {
  return b.staff?.name ?? staff.find((s) => s.id === b.staffId)?.name ?? "Unassigned";
}

export function BookingDialog({
  booking,
  business,
  services,
  staff,
  onClose,
  onChanged,
}: {
  booking: Booking | null;
  business: Business;
  services: Service[];
  staff: Staff[];
  onClose: () => void;
  onChanged: (b: Booking) => void;
}) {
  return (
    <Dialog open={!!booking} onClose={onClose} title={booking ? booking.customerName : "Booking"} description={booking ? `Reference ${booking.reference}` : undefined} wide>
      {booking && <Body key={booking.id} booking={booking} business={business} services={services} staff={staff} onClose={onClose} onChanged={onChanged} />}
    </Dialog>
  );
}

function Body({
  booking,
  business,
  services,
  staff,
  onClose,
  onChanged,
}: {
  booking: Booking;
  business: Business;
  services: Service[];
  staff: Staff[];
  onClose: () => void;
  onChanged: (b: Booking) => void;
}) {
  const toast = useToast();
  const zone = business.timezone;
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const service = bookingService(booking, services);

  async function setStatus(status: BookingStatus, msg: string) {
    setBusy(status);
    setError(null);
    try {
      const updated = await api.bookings.setStatus(booking.id, status);
      onChanged({ ...booking, ...updated, status: updated?.status ?? status });
      toast(msg);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function reschedule() {
    if (!slot) return;
    setBusy("reschedule");
    setError(null);
    try {
      const updated = await api.bookings.reschedule(booking.id, { startsAt: slot.start, staffId: booking.staffId });
      onChanged({ ...booking, ...updated, startsAt: updated?.startsAt ?? slot.start });
      toast("Booking moved");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  }

  if (mode === "reschedule") {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <button type="button" onClick={() => setMode("view")} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Back to booking
        </button>
        <p className="text-ink-2">
          Move {booking.customerName} from {fmtDateLong(booking.startsAt, zone)} at {fmtTime(booking.startsAt, zone)}. Same professional ({bookingStaffName(booking, staff)}).
        </p>
        <DateTimePicker
          slug={business.slug}
          serviceId={booking.serviceId}
          staffId={booking.staffId}
          timezone={zone}
          maxAdvanceDays={business.maxAdvanceDays}
          selected={slot}
          onSelect={setSlot}
        />
        <InlineError message={error} />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <Button disabled={!slot} loading={busy === "reschedule"} onClick={reschedule}>
            Move booking
          </Button>
        </div>
      </div>
    );
  }

  const end = inZone(booking.endsAt, zone);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <StatusBadge status={booking.status} />
      </div>
      <dl className="grid gap-4 rounded-3xl bg-sunken p-5 text-sm sm:grid-cols-2">
        <Item label="When">
          {fmtDateLong(booking.startsAt, zone)}
          <br />
          <span className="tnum">
            {fmtTime(booking.startsAt, zone)} – {end.toFormat("h:mm a")}
          </span>
        </Item>
        <Item label="Service">
          {service?.name ?? "Service"}
          {service && (
            <span className="block text-ink-2">
              {duration(service.durationMinutes)} · {money(service.priceCents, service.currency)}
            </span>
          )}
        </Item>
        <Item label="With">{bookingStaffName(booking, staff)}</Item>
        <Item label="Customer">
          {booking.customerName}
          <a href={`mailto:${booking.customerEmail}`} className="mt-0.5 flex items-center gap-1.5 text-ink-2 hover:text-ink">
            <Mail className="size-3.5" aria-hidden /> {booking.customerEmail}
          </a>
          {booking.customerPhone && (
            <a href={`tel:${booking.customerPhone}`} className="mt-0.5 flex items-center gap-1.5 text-ink-2 hover:text-ink">
              <Phone className="size-3.5" aria-hidden /> {booking.customerPhone}
            </a>
          )}
        </Item>
        {booking.notes && (
          <Item label="Notes" wide>
            {booking.notes}
          </Item>
        )}
      </dl>
      <InlineError message={error} />
      {booking.status === "CONFIRMED" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="teal" size="sm" loading={busy === "COMPLETED"} onClick={() => setStatus("COMPLETED", "Marked as completed")}>
            <Check className="size-4" aria-hidden /> Completed
          </Button>
          <Button variant="soft" size="sm" loading={busy === "NO_SHOW"} onClick={() => setStatus("NO_SHOW", "Marked as no-show")}>
            <UserX className="size-4" aria-hidden /> No-show
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode("reschedule")}>
            <CalendarClock className="size-4" aria-hidden /> Reschedule
          </Button>
          <Button variant="danger" size="sm" loading={busy === "CANCELLED"} onClick={() => setStatus("CANCELLED", "Booking cancelled")}>
            <XCircle className="size-4" aria-hidden /> Cancel booking
          </Button>
        </div>
      )}
    </div>
  );
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
