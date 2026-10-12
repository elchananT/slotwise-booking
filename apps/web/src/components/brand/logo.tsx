import Link from "next/link";
import { cn } from "@/lib/cn";

/** Mark: a ticket with a single "slot" cut into it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect x="1" y="3" width="30" height="26" rx="9" fill="var(--terracotta)" />
      <circle cx="1" cy="16" r="3.6" fill="var(--cream-100)" />
      <circle cx="31" cy="16" r="3.6" fill="var(--cream-100)" />
      <rect x="9" y="12.2" width="14" height="7.6" rx="3.8" fill="var(--cream-50)" />
      <circle cx="12.9" cy="16" r="1.5" fill="var(--teal)" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-full", className)} aria-label="Slotwise home">
      <LogoMark />
      <span className="display text-[1.4rem] leading-none font-semibold tracking-tight">Slotwise</span>
    </Link>
  );
}
