"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme";
import { cn } from "@/lib/cn";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const snapshot = () => document.documentElement.dataset.theme === "dark";

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          /* ignore */
        }
      }}
      className={cn("grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink", className)}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
