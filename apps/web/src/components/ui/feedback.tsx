"use client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-14 text-center", className)}>
      {icon && <div className="grid size-14 place-items-center rounded-full bg-sunken text-ink-2">{icon}</div>}
      <h3 className="text-xl">{title}</h3>
      {body && <p className="max-w-sm text-ink-2">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft px-6 py-10 text-center", className)}>
      <AlertTriangle className="size-6 text-danger" aria-hidden />
      <p className="max-w-md text-ink">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-ink">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      {message}
    </p>
  );
}

export type BadgeTone = "teal" | "brand" | "neutral" | "danger" | "amber";
const tones: Record<BadgeTone, string> = {
  teal: "bg-teal-soft text-teal-fg",
  brand: "bg-brand-soft text-brand-deep",
  neutral: "bg-sunken text-ink-2",
  danger: "bg-danger-soft text-danger",
  amber: "bg-amber-soft text-ink",
};
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [BadgeTone, string]> = {
    CONFIRMED: ["teal", "Confirmed"],
    COMPLETED: ["neutral", "Completed"],
    CANCELLED: ["danger", "Cancelled"],
    NO_SHOW: ["amber", "No-show"],
  };
  const [tone, label] = map[status] ?? ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
}
