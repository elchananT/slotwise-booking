"use client";
import { CalendarDays, ExternalLink, LayoutDashboard, LogOut, Mail, Scissors, Users, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/feedback";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/bookings", label: "Bookings", icon: ListChecks },
  { href: "/app/services", label: "Services", icon: Scissors },
  { href: "/app/staff", label: "Staff", icon: Users },
  { href: "/app/emails", label: "Emails", icon: Mail },
];

export function AppGate({ children }: { children: ReactNode }) {
  const { status, business } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const inSetup = path.startsWith("/app/setup");

  useEffect(() => {
    if (status === "anon") router.replace("/login");
    else if (status === "authed" && !business && !inSetup) router.replace("/app/setup");
  }, [status, business, inSetup, router]);

  if (status !== "authed" || (!business && !inSetup)) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy aria-label="Loading your workspace">
        <div className="flex w-64 flex-col items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    );
  }
  if (inSetup) return <>{children}</>;
  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  const { business, me, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const doLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-5 py-6 lg:flex">
        <Logo href="/app" className="px-2" />
        <div className="mt-8 rounded-3xl bg-sunken p-4">
          <p className="display truncate text-lg leading-tight">{business?.name}</p>
          <a
            href={`/b/${business?.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-teal-fg underline-offset-4 hover:underline"
          >
            Open booking page <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
        <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => {
            const active = n.exact ? path === n.href : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-full px-4 font-medium transition-colors",
                  active ? "bg-ink text-page" : "text-ink-2 hover:bg-sunken hover:text-ink",
                )}
              >
                <n.icon className="size-[18px]" aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
          <div className="min-w-0 px-2">
            <p className="truncate text-sm font-medium">{me?.name}</p>
            <p className="truncate text-xs text-ink-2">{me?.email}</p>
          </div>
          <div className="flex shrink-0">
            <ThemeToggle />
            <button
              type="button"
              onClick={doLogout}
              aria-label="Sign out"
              className="grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            >
              <LogOut className="size-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* mobile bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 pt-3">
            <Logo href="/app" />
            <div className="flex">
              <ThemeToggle />
              <button type="button" onClick={doLogout} aria-label="Sign out" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-sunken">
                <LogOut className="size-[18px]" />
              </button>
            </div>
          </div>
          <nav aria-label="Main" className="scroll-thin flex gap-1.5 overflow-x-auto px-4 py-3">
            {NAV.map((n) => {
              const active = n.exact ? path === n.href : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium",
                    active ? "bg-ink text-page" : "bg-sunken text-ink-2",
                  )}
                >
                  <n.icon className="size-4" aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[84rem] px-4 py-8 sm:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.05]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
