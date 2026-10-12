"use client";
import { Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { duration, errorMessage, money } from "@/lib/format";
import type { Service } from "@/lib/types";
import { useQuery } from "@/lib/use-query";
import { PageHeader } from "@/components/app/app-shell";
import { ServiceForm } from "@/components/app/forms";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, EmptyState, ErrorState, InlineError, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export default function ServicesPage() {
  const q = useQuery(() => api.services.list(), []);
  const toast = useToast();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Services"
        subtitle="What customers can book. Buffers block time after a visit without showing on the booking page."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden /> Add service
          </Button>
        }
      />

      {q.loading ? (
        <div className="flex flex-col gap-3" aria-busy aria-label="Loading services">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : q.error ? (
        <ErrorState message={q.error} onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Scissors className="size-6" />}
          title="No services yet"
          body="Add what you offer, with a length and a price, and it appears on your booking page."
          action={<Button onClick={() => setEditing("new")}>Add your first service</Button>}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {q.data.map((s) => (
            <li key={s.id} className="surface flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-2xl">
                    {s.name}
                    {!s.active && <Badge tone="neutral">Hidden</Badge>}
                  </h2>
                  {s.description && <p className="mt-1 line-clamp-2 text-ink-2">{s.description}</p>}
                </div>
                <p className="display tnum shrink-0 text-2xl">{money(s.priceCents, s.currency)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-2">
                  {duration(s.durationMinutes)}
                  {s.bufferMinutes > 0 && ` · ${s.bufferMinutes} min buffer after`}
                </p>
                <div className="flex gap-1">
                  <Button variant="quiet" size="sm" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
                    <Pencil className="size-4" aria-hidden /> Edit
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => {
                      setDelError(null);
                      setDeleting(s);
                    }}
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden /> Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New service" : "Edit service"}>
        {editing !== null && (
          <ServiceForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            submitLabel={editing === "new" ? "Add service" : "Save changes"}
            onCancel={() => setEditing(null)}
            onSubmit={async (v) => {
              if (editing === "new") {
                await api.services.create(v);
                toast("Service added");
              } else {
                await api.services.update(editing.id, v);
                toast("Service saved");
              }
              setEditing(null);
              q.refetch();
            }}
          />
        )}
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name ?? "service"}?`} description="If this service already has bookings it is hidden from your booking page instead of deleted, so history stays intact.">
        <div className="flex flex-col gap-4">
          <InlineError message={delError} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={delBusy}
              onClick={async () => {
                if (!deleting) return;
                setDelBusy(true);
                setDelError(null);
                try {
                  await api.services.remove(deleting.id);
                  toast("Service removed");
                  setDeleting(null);
                  q.refetch();
                } catch (e) {
                  setDelError(errorMessage(e));
                } finally {
                  setDelBusy(false);
                }
              }}
            >
              Delete service
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
