import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function Avatar({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ background: color }}
      className={cn("inline-grid size-12 shrink-0 place-items-center rounded-full text-[0.95rem] font-semibold text-[#fff7e8] shadow-[0_1px_0_rgb(255_255_255/0.3)_inset]", className)}
    >
      {initials(name)}
    </span>
  );
}
