"use client";
import { Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import { hashIndex, staffColor } from "@/lib/staff-colors";
import { DateTime, fmtDateTime } from "@/lib/time";
import type { Service, Staff, TimeOff } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { PageHeader } from "@/components/app/app-shell";
import { ServicePicker, staffServiceIds } from "@/components/app/forms";
import { HoursEditor } from "@/components/app/hours-editor";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, InlineError, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Switch } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

type Hours = Array<{ weekday: number; startMinute: number; endMinute: number }>;
const DEFAULT_HOURS: Hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 540, endMinute: 1020 }));

export default function StaffPage() {
  const staffQ = useQuery(() => api.staff.list(), []);
  const svcQ = useQuery(() => api.services.list(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const staff = staffQ.data;
  const active = useMemo(() => staff?.find((s) => s.id === selected) ?? staff?.[0], [staff, selected]);

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Each person has their own services and weekly hours. Customers only see times when someone is free."
        actions={
          <Button onClick={() => setAdding(true)} disabled={!svcQ.data?.length}>
            <Plus className="size-4" aria-hidden /> Add staff member
          </Button>
        }
      />

      {staffQ.loading || svcQ.loading ? (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]" aria-busy aria-label="Loading staff">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-[40rem] rounded-3xl" />
        </div>
      ) : staffQ.error || svcQ.error ? (
        <ErrorState
          message={staffQ.error ?? svcQ.error ?? ""}
          onRetry={() => {
            staffQ.refetch();
            svcQ.refetch();
          }}
        />
      ) : !staff?.length || !active ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No staff yet"
          body={svcQ.data?.length ? "Add the people who take bookings, including yourself." : "Add a service first, then add the people who offer it."}
          action={svcQ.data?.length ? <Button onClick={() => setAdding(true)}>Add a staff member</Button> : undefined}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] xl:gap-10">
          <ul className="scroll-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Staff members">
            {staff.map((s) => (
              <li key={s.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  aria-pressed={s.id === active.id}
                  onClick={() => setSelected(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-full border py-2 pr-5 pl-2 text-left transition-colors",
                    s.id === active.id ? "border-ink bg-paper shadow-sm" : "border-line hover:bg-sunken",
                  )}
                >
                  <Avatar name={s.name} color={staffColor(hashIndex(s.id))} className="size-10 text-sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-ink-2">{s.active ? s.title || "Staff" : "Inactive"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <StaffPanel key={active.id} staff={active} services={svcQ.data ?? []} onChanged={staffQ.refetch} />
        </div>
      )}

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a staff member" wide>
        {adding && (
          <NewStaff
            services={svcQ.data ?? []}
            onDone={(id) => {
              setAdding(false);
              setSelected(id);
              staffQ.refetch();
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </Dialog>
    </>
  );
}

function NewStaff({ services, onDone, onCancel }: { services: Service[]; onDone: (id: string) => void; onCancel: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [serviceIds, setServiceIds] = useState(services.filter((s) => s.active).map((s) => s.id));
  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter a name.");
    if (!serviceIds.length) return setError("Choose at least one service.");
    setBusy(true);
    setError(null);
    try {
      const s = await api.staff.create({ name: name.trim(), title: title.trim() || undefined, serviceIds });
      if (hours.length) await api.staff.setHours(s.id, hours);
      toast(`${s.name} added`);
      onDone(s.id);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name">{(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <Field label="Title" optional>
          {(f) => <Input {...f} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Offers</p>
        <ServicePicker services={services} value={serviceIds} onChange={setServiceIds} />
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">Weekly hours</p>
        <HoursEditor initial={hours} resetKey="new" onChange={setHours} />
      </div>
      <InlineError message={error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Add staff member
        </Button>
      </div>
    </form>
  );
}

function StaffPanel({ staff, services, onChanged }: { staff: Staff; services: Service[]; onChanged: () => void }) {
  const { business } = useAuth();
  const toast = useToast();
  const zone = business?.timezone ?? "UTC";

  const [name, setName] = useState(staff.name);
  const [title, setTitle] = useState(staff.title ?? "");
  const [isActive, setIsActive] = useState(staff.active);
  const [serviceIds, setServiceIds] = useState(staffServiceIds(staff));
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [hours, setHours] = useState<Hours>((staff.hours ?? []).map((h) => ({ weekday: h.weekday, startMinute: h.startMinute, endMinute: h.endMinute })));
  const [hoursDirty, setHoursDirty] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detailsDirty =
    name !== staff.name ||
    title !== (staff.title ?? "") ||
    isActive !== staff.active ||
    [...serviceIds].sort().join() !== [...staffServiceIds(staff)].sort().join();

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setDetailsError("Enter a name.");
    setSavingDetails(true);
    setDetailsError(null);
    try {
      await api.staff.update(staff.id, { name: name.trim(), title: title.trim() || null, active: isActive, serviceIds });
      toast("Details saved");
      onChanged();
    } catch (err) {
      setDetailsError(errorMessage(err));
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveHours() {
    setSavingHours(true);
    setHoursError(null);
    try {
      await api.staff.setHours(staff.id, hours);
      toast("Weekly hours saved");
      setHoursDirty(false);
      onChanged();
    } catch (err) {
      setHoursError(errorMessage(err));
    } finally {
      setSavingHours(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <form onSubmit={saveDetails} noValidate className="surface p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={staff.name} color={staffColor(hashIndex(staff.id))} className="size-14 text-lg" />
          <h2 className="text-3xl">{staff.name}</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name">{(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Title" optional>
            {(f) => <Input {...f} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
        </div>
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Offers</p>
          <ServicePicker services={services} value={serviceIds} onChange={setServiceIds} />
        </div>
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-sunken px-4 py-3">
          <div>
            <p className="font-medium">Takes bookings</p>
            <p className="text-sm text-ink-2">Turn off to stop offering this person on your booking page.</p>
          </div>
          <Switch checked={isActive} onChange={setIsActive} label="Takes bookings" />
        </div>
        <div className="mt-5">
          <InlineError message={detailsError} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="quiet" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden /> Remove
          </Button>
          <Button type="submit" loading={savingDetails} disabled={!detailsDirty}>
            Save details
          </Button>
        </div>
      </form>

      <section className="surface p-6 sm:p-8" aria-labelledby="hours-h">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="hours-h" className="text-2xl">
              Weekly hours
            </h2>
            <p className="text-sm text-ink-2">In {zone.replace(/_/g, " ")} time. Gaps in the day become breaks.</p>
          </div>
          <Button onClick={saveHours} loading={savingHours} disabled={!hoursDirty}>
            Save hours
          </Button>
        </div>
        <HoursEditor
          initial={hours}
          resetKey={`${staff.id}:${JSON.stringify(staff.hours ?? [])}`}
          onChange={(h) => {
            setHours(h);
            setHoursDirty(true);
          }}
        />
        <div className="mt-4">
          <InlineError message={hoursError} />
        </div>
      </section>

      <TimeOffSection staff={staff} zone={zone} onChanged={onChanged} />

      <RemoveDialog staff={staff} open={confirmDelete} onClose={() => setConfirmDelete(false)} onDone={onChanged} />
    </div>
  );
}

function RemoveDialog({ staff, open, onClose, onDone }: { staff: Staff; open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} title={`Remove ${staff.name}?`} description="If they have bookings they are switched off instead of deleted, so booking history stays intact.">
      <div className="flex flex-col gap-4">
        <InlineError message={error} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Keep them
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.staff.remove(staff.id);
                toast(`${staff.name} removed`);
                onClose();
                onDone();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Remove
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function TimeOffSection({ staff, zone, onChanged }: { staff: Staff; zone: string; onChanged: () => void }) {
  const toast = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  // The API has no "list time off" endpoint, so this shows what the API returned with the staff
  // member (if anything) plus entries added in this session, which can be deleted again.
  const [added, setAdded] = useState<TimeOff[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const list = [...(staff.timeOff ?? []), ...added.filter((a) => !(staff.timeOff ?? []).some((t) => t.id === a.id))]
    .filter((t) => !removed.includes(t.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  function payload() {
    const s = DateTime.fromISO(from, { zone });
    const e = DateTime.fromISO(to, { zone });
    if (!s.isValid || !e.isValid) throw new Error("Choose a start and an end.");
    if (e <= s) throw new Error("The end must be after the start.");
    return { startsAt: s.toUTC().toISO()!, endsAt: e.toUTC().toISO()!, reason: reason.trim() || undefined };
  }

  async function add(force = false) {
    setBusy(true);
    setError(null);
    try {
      const created = await api.staff.addTimeOff(staff.id, payload(), force);
      if (created?.id) setAdded((l) => [...l, created]);
      toast("Time off added");
      setFrom("");
      setTo("");
      setReason("");
      setConflict(null);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(err.message);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-6 sm:p-8" aria-labelledby="off-h">
      <h2 id="off-h" className="text-2xl">
        Time off
      </h2>
      <p className="mb-5 text-sm text-ink-2">Block out holidays or appointments. Times are in {zone.replace(/_/g, " ")} time.</p>

      {list.length > 0 && (
        <ul className="mb-6 flex flex-col gap-2">
          {list.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-sunken px-4 py-3 text-sm">
              <span>
                <span className="font-medium tnum">
                  {fmtDateTime(t.startsAt, zone)} to {fmtDateTime(t.endsAt, zone)}
                </span>
                {t.reason && <span className="ml-2 text-ink-2">{t.reason}</span>}
              </span>
              <Button
                variant="quiet"
                size="sm"
                aria-label="Delete time off"
                onClick={async () => {
                  try {
                    await api.timeOff.remove(t.id);
                    setRemoved((l) => [...l, t.id]);
                    toast("Time off removed");
                    onChanged();
                  } catch (e) {
                    toast(errorMessage(e), "error");
                  }
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add(false);
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="From">{(f) => <Input {...f} type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} required />}</Field>
        <Field label="To">{(f) => <Input {...f} type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} required />}</Field>
        <Field label="Reason" optional className="sm:col-span-2">
          {(f) => <Input {...f} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Holiday" />}
        </Field>
        <div className="sm:col-span-2">
          <InlineError message={error} />
        </div>
        {conflict && (
          <div role="alert" className="rounded-2xl bg-amber-soft p-4 sm:col-span-2">
            <p className="font-medium">This overlaps confirmed bookings.</p>
            <p className="mt-1 text-sm">{conflict}. Adding it anyway won&rsquo;t cancel those bookings. You&rsquo;ll need to move or cancel them yourself.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConflict(null)}>
                Don&rsquo;t add
              </Button>
              <Button size="sm" onClick={() => add(true)} loading={busy}>
                Add anyway
              </Button>
            </div>
          </div>
        )}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" variant="soft" loading={busy && !conflict}>
            Add time off
          </Button>
        </div>
      </form>
    </section>
  );
}

