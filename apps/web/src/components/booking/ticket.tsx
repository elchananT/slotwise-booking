import { CalendarDays, Clock, MapPin, User, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { duration, money } from "@/lib/format";
import { fmtDateLong, fmtTime, inZone, zoneLabel } from "@/lib/time";

interface Props {
  businessName: string;
  address?: string | null;
  service?: { name: string; durationMinutes: number; priceCents: number; currency: string } | null;
  staffName?: string | null;
  startsAt?: string | null;
  zone: string;
  footer?: ReactNode;
  className?: string;
}

function Row({ icon, label, children, empty }: { icon: ReactNode; label: string; children?: ReactNode; empty: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-ink-2">{label}</div>
        {children ? <div className="font-medium break-words">{children}</div> : <div className="text-ink-2/60">{empty}</div>}
      </div>
    </div>
  );
}

/** The appointment "ticket": fills in as the customer progresses. */
export function Ticket({ businessName, address, service, staffName, startsAt, zone, footer, className }: Props) {
  return (
    <div className={cn("ticket overflow-hidden", className)}>
      <div className="px-6 pt-6 pb-5">
        <p className="text-sm text-ink-2">Your appointment at</p>
        <p className="display text-2xl leading-tight">{businessName}</p>
        <div className="mt-5 flex flex-col gap-4">
          <Row icon={<Clock className="size-4" />} label="Service" empty="Choose a service">
            {service && (
              <>
                {service.name} <span className="font-normal text-ink-2">· {duration(service.durationMinutes)}</span>
              </>
            )}
          </Row>
          <Row icon={<User className="size-4" />} label="With" empty="Anyone, or pick someone">
            {staffName}
          </Row>
          <Row icon={<CalendarDays className="size-4" />} label="When" empty="Pick a day and time">
            {startsAt && (
              <>
                {fmtDateLong(startsAt, zone)}
                <br />
                <span className="tnum">
                  {fmtTime(startsAt, zone)}
                  {service && ` – ${fmtTime(inZone(startsAt, zone).plus({ minutes: service.durationMinutes }).toUTC().toISO()!, zone)}`}
                </span>
                <span className="block text-xs font-normal text-ink-2">{zoneLabel(zone)}</span>
              </>
            )}
          </Row>
        </div>
      </div>
      <div className="perforation" aria-hidden />
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
          {address ? (
            <>
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{address}</span>
            </>
          ) : (
            <span>{zone.split("/").pop()?.replace(/_/g, " ")}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-lg font-semibold tnum">
          <Wallet className="size-4 text-ink-2" aria-hidden />
          {service ? money(service.priceCents, service.currency) : "—"}
        </div>
      </div>
      {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
    </div>
  );
}
