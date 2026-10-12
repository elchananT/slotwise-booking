"use client";
import { CalendarCheck, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { colorOf } from "@/lib/staff-colors";
import { nowIn } from "@/lib/time";
import { useQuery } from "@/lib/use-query";
import { PageHeader } from "@/components/app/app-shell";
import { DayBars, HBars } from "@/components/app/charts";
import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export default function DashboardPage() {
  const { business, me } = useAuth();
  const toast = useToast();
  const q = useQuery(() => api.dashboard(), []);
  const svc = useQuery(() => api.services.list(), []);
  const staffQ = useQuery(() => api.staff.list(), []);
  const currency = svc.data?.[0]?.currency ?? "USD";
  const zone = business!.timezone;
  const todayIso = nowIn(zone).toISODate()!;
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/b/${business!.slug}` : `/b/${business!.slug}`;
  const d = q.data;
  const first = me?.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={first ? `Hello, ${first}` : "Dashboard"}
        subtitle={`How ${business!.name} is doing.`}
        actions={
          <LinkButton href="/app/calendar" variant="ghost">
            <CalendarCheck className="size-4" aria-hidden /> Open calendar
          </LinkButton>
        }
      />

      {q.error ? (
        <ErrorState message={q.error} onRetry={q.refetch} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Today" value={d?.todayCount} suffix={d?.todayCount === 1 ? "booking" : "bookings"} href="/app/calendar" loading={q.loading} />
            <Stat label="Coming up" value={d?.upcomingCount} suffix="confirmed" href="/app/bookings" loading={q.loading} />
            <Stat label="Last 30 days" text={d ? money(d.revenueCentsLast30, currency) : undefined} suffix="from bookings" loading={q.loading} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <section className="surface p-6 sm:p-8" aria-labelledby="chart-days">
              <h2 id="chart-days" className="text-2xl">
                Bookings per day
              </h2>
              <p className="mb-6 text-sm text-ink-2">The last 30 days. Today is in terracotta.</p>
              {q.loading ? <Skeleton className="h-64 rounded-2xl" /> : d && d.bookingsByDay.some((x) => x.count > 0) ? <DayBars data={d.bookingsByDay} todayIso={todayIso} /> : <EmptyState title="No bookings in the last 30 days" body="Share your booking page and they'll appear here." className="py-10" />}
            </section>

            <section className="surface flex flex-col justify-between gap-5 p-6 sm:p-8" aria-labelledby="share">
              <div>
                <h2 id="share" className="text-2xl">
                  Your booking page
                </h2>
                <p className="mt-1 text-sm text-ink-2">Send this link to customers. No account needed.</p>
                <code className="mt-5 block truncate rounded-full bg-sunken px-4 py-3 text-sm">{pageUrl}</code>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="soft"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pageUrl);
                      toast("Link copied");
                    } catch {
                      toast("Couldn't copy the link", "error");
                    }
                  }}
                >
                  <Copy className="size-4" aria-hidden /> Copy link
                </Button>
                <a href={`/b/${business!.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 font-medium hover:bg-sunken">
                  Open <ExternalLink className="size-4" aria-hidden />
                </a>
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="surface p-6 sm:p-8" aria-labelledby="top-s">
              <h2 id="top-s" className="mb-6 text-2xl">
                Top services
              </h2>
              {q.loading ? (
                <Skeleton className="h-40 rounded-2xl" />
              ) : d?.topServices.length ? (
                <HBars rows={d.topServices.map((s) => ({ key: s.name, label: s.name, value: s.count }))} />
              ) : (
                <p className="text-ink-2">Once customers book, your most popular services rank here.</p>
              )}
            </section>
            <section className="surface p-6 sm:p-8" aria-labelledby="util">
              <h2 id="util" className="text-2xl">
                How busy each person is
              </h2>
              <p className="mb-6 text-sm text-ink-2">Booked time as a share of working hours.</p>
              {q.loading ? (
                <Skeleton className="h-40 rounded-2xl" />
              ) : d?.utilizationByStaff.length ? (
                <HBars
                  unit="%"
                  max={100}
                  rows={d.utilizationByStaff.map((s) => ({
                    key: s.staffId,
                    label: s.name,
                    value: Math.round(s.percent),
                    color: colorOf(staffQ.data ?? [], s.staffId),
                    lead: <Avatar name={s.name} color={colorOf(staffQ.data ?? [], s.staffId)} className="size-7 text-[0.65rem]" />,
                  }))}
                />
              ) : (
                <p className="text-ink-2">
                  Add staff and weekly hours on the{" "}
                  <Link href="/app/staff" className="underline underline-offset-4">
                    Staff page
                  </Link>{" "}
                  to see this.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, text, suffix, href, loading }: { label: string; value?: number; text?: string; suffix: string; href?: string; loading?: boolean }) {
  const body = (
    <>
      <p className="text-sm font-medium text-ink-2">{label}</p>
      {loading ? <Skeleton className="mt-3 h-12 w-24" /> : <p className="display tnum mt-1 text-[3.25rem] leading-none font-medium">{text ?? value}</p>}
      <p className="mt-2 text-sm text-ink-2">{suffix}</p>
    </>
  );
  const cls = "surface block p-6";
  return href ? (
    <Link href={href} className={cls + " transition-transform duration-300 hover:-translate-y-0.5"}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
