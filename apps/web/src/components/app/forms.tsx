"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import type { Service, Staff } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";

export type ServiceInput = Omit<Service, "id">;
const CURRENCIES = ["USD", "EUR", "GBP", "ILS", "CAD", "AUD"];

export function ServiceForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Service;
  submitLabel: string;
  onSubmit: (v: ServiceInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [mins, setMins] = useState(String(initial?.durationMinutes ?? 45));
  const [buffer, setBuffer] = useState(String(initial?.bufferMinutes ?? 0));
  const [price, setPrice] = useState(initial ? String(initial.priceCents / 100) : "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const m = Number(mins);
  const b = Number(buffer);
  const p = Number(price);
  const errs = {
    name: name.trim().length < 2 ? "Give the service a name." : null,
    mins: !Number.isInteger(m) || m < 5 || m > 480 || m % 5 ? "Use 5 to 480 minutes, in steps of 5." : null,
    buffer: !Number.isInteger(b) || b < 0 || b > 240 || b % 5 ? "Use 0 to 240 minutes, in steps of 5." : null,
    price: price === "" || !(p >= 0) ? "Enter a price. Use 0 for free." : null,
  };
  const invalid = Object.values(errs).some(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: m,
        bufferMinutes: b,
        priceCents: Math.round(p * 100),
        currency,
        active,
      });
      if (!initial) {
        setName("");
        setDescription("");
        setPrice("");
        setTouched(false);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <Field label="Name" error={touched ? errs.name : null} className="sm:col-span-2">
        {(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} placeholder="Haircut" />}
      </Field>
      <Field label="Description" optional className="sm:col-span-2">
        {(f) => <Textarea {...f} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" maxLength={300} />}
      </Field>
      <Field label="Duration (minutes)" error={touched ? errs.mins : null}>
        {(f) => <Input {...f} type="number" inputMode="numeric" min={5} max={480} step={5} value={mins} onChange={(e) => setMins(e.target.value)} />}
      </Field>
      <Field label="Buffer after (minutes)" hint="Blocked after the visit, e.g. for clean-up." error={touched ? errs.buffer : null}>
        {(f) => <Input {...f} type="number" inputMode="numeric" min={0} max={240} step={5} value={buffer} onChange={(e) => setBuffer(e.target.value)} />}
      </Field>
      <Field label="Price" error={touched ? errs.price : null}>
        {(f) => <Input {...f} type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45" />}
      </Field>
      <Field label="Currency">
        {(f) => (
          <Select {...f} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        )}
      </Field>
      {initial && (
        <div className="flex items-center justify-between rounded-2xl bg-sunken px-4 py-3 sm:col-span-2">
          <div>
            <p className="font-medium">Bookable</p>
            <p className="text-sm text-ink-2">Turn off to hide it from your booking page.</p>
          </div>
          <Switch checked={active} onChange={setActive} label="Bookable" />
        </div>
      )}
      <div className="sm:col-span-2">
        <InlineError message={error} />
      </div>
      <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Service assignment chips shared by staff forms. */
export function ServicePicker({
  services,
  value,
  onChange,
}: {
  services: Service[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!services.length) return <p className="text-sm text-ink-2">Add a service first, then assign it here.</p>;
  return (
    <div role="group" aria-label="Services offered" className="flex flex-wrap gap-2">
      {services.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== s.id) : [...value, s.id])}
            className={cn(
              "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
              on ? "border-teal bg-teal text-on-teal" : "border-line-strong bg-paper text-ink hover:bg-sunken",
              !s.active && "opacity-60",
            )}
          >
            {s.name}
            {!s.active && " (off)"}
          </button>
        );
      })}
    </div>
  );
}

export function staffServiceIds(s: Staff): string[] {
  if (s.serviceIds) return s.serviceIds;
  return (s.services ?? [])
    .map((x) => (typeof x === "string" ? x : (x.serviceId ?? x.service?.id)))
    .filter((x): x is string => !!x);
}
