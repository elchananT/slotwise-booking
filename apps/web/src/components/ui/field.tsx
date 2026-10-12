"use client";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-[var(--radius-field)] border border-line-strong bg-paper px-4 text-ink placeholder:text-ink-2/70 transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-teal-fg focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--teal-fg)_20%,transparent)] disabled:opacity-60 aria-[invalid=true]:border-danger";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  optional?: boolean;
  children: (p: { id: string; "aria-invalid": boolean | undefined; "aria-describedby": string | undefined }) => ReactNode;
}

export function Field({ label, hint, error, className, optional, children }: FieldProps) {
  const id = useId();
  const descId = `${id}-d`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-2">optional</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error || hint ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} className={cn("text-sm", error ? "text-danger" : "text-ink-2")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, "h-12", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...p },
  ref,
) {
  return <textarea ref={ref} className={cn(control, "min-h-24 py-3 leading-relaxed", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...p },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        control,
        "h-12 appearance-none bg-no-repeat pr-10",
        "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")] bg-[position:right_1rem_center]",
        className,
      )}
      {...p}
    >
      {children}
    </select>
  );
});

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-50",
        checked ? "border-teal bg-teal" : "border-line-strong bg-sunken",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5.5 rounded-full bg-paper shadow transition-transform duration-200 ease-[var(--ease-out-expo)]",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
