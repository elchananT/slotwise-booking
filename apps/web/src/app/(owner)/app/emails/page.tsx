"use client";
import { Inbox, Mail } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/time";
import type { EmailLog } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media";
import { useQuery } from "@/lib/use-query";
import { PageHeader } from "@/components/app/app-shell";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";

export default function EmailsPage() {
  const { business } = useAuth();
  const zone = business!.timezone;
  const q = useQuery(() => api.emails(), []);
  const [sel, setSel] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const wide = useMediaQuery("(min-width: 1024px)");
  const current = q.data?.find((e) => e.id === sel) ?? (wide ? q.data?.[0] : undefined);

  return (
    <>
      <PageHeader title="Emails" subtitle="Everything Slotwise would send to customers, newest first. Delivery isn't connected yet, so this outbox is a record of what was queued." />

      {q.loading ? (
        <div className="grid gap-6 lg:grid-cols-[24rem_1fr]" aria-busy aria-label="Loading emails">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="hidden h-96 rounded-3xl lg:block" />
        </div>
      ) : q.error ? (
        <ErrorState message={q.error} onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Inbox className="size-6" />} title="The outbox is empty" body="Confirmation and cancellation emails show up here as customers book." />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
          <ul className="flex max-h-[70dvh] flex-col gap-2 overflow-y-auto pr-1 scroll-thin" aria-label="Emails">
            {q.data.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={current?.id === m.id}
                  onClick={() => {
                    setSel(m.id);
                    if (!wide) setModal(true);
                  }}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-colors",
                    current?.id === m.id && wide ? "border-ink bg-paper" : "border-line hover:bg-sunken",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{m.subject}</span>
                    <span className="shrink-0 text-xs text-ink-2 tnum">{fmtDateTime(m.createdAt, zone)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-2">To {m.to}</span>
                </button>
              </li>
            ))}
          </ul>
          {wide && current && <Letter m={current} zone={zone} />}
        </div>
      )}

      <Dialog open={modal && !wide && !!current} onClose={() => setModal(false)} title={current?.subject ?? "Email"} wide>
        {current && <Letter m={current} zone={zone} bare />}
      </Dialog>
    </>
  );
}

function Letter({ m, zone, bare }: { m: EmailLog; zone: string; bare?: boolean }) {
  return (
    <article className={cn(!bare && "surface sticky top-6 p-8")}>
      {!bare && <h2 className="text-3xl">{m.subject}</h2>}
      <dl className={cn("flex flex-col gap-1 border-b border-line pb-4 text-sm", !bare && "mt-4")}>
        <div className="flex gap-2">
          <dt className="w-10 text-ink-2">To</dt>
          <dd className="flex min-w-0 items-center gap-1.5 break-all">
            <Mail className="size-3.5 shrink-0 text-ink-2" aria-hidden /> {m.to}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-10 text-ink-2">Sent</dt>
          <dd className="tnum">{fmtDateTime(m.createdAt, zone)}</dd>
        </div>
      </dl>
      <div className="pt-5 leading-relaxed whitespace-pre-wrap">{m.body}</div>
    </article>
  );
}
