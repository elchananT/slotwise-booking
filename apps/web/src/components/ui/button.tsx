import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "teal" | "ghost" | "soft" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none transition-[transform,background-color,box-shadow,color,border-color] duration-200 ease-[var(--ease-out-expo)] active:translate-y-px disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-offset-2";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-on-brand font-semibold shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_6px_14px_-6px_rgb(217_96_59/0.7)] hover:brightness-[1.06] hover:-translate-y-px",
  teal: "bg-teal text-on-teal shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_6px_14px_-6px_rgb(15_92_92/0.6)] hover:brightness-110 hover:-translate-y-px",
  ghost: "border border-line-strong text-ink hover:bg-sunken",
  soft: "bg-sunken text-ink hover:bg-[color-mix(in_srgb,var(--cream-200)_80%,var(--ink-900)_8%)]",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:border-danger/60",
  quiet: "text-ink-2 hover:text-ink hover:bg-sunken",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-8 text-base",
};

export function buttonStyles(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant, size, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonStyles(variant, size, className)} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonStyles(variant, size, className)} {...rest} />;
}
