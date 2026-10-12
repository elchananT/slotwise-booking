"use client";
import { motion } from "motion/react";
import { CalendarCheck2, ShieldCheck, Globe2 } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const ease = [0.16, 1, 0.3, 1] as const;

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-5 py-5 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10"
        >
          <h1 className="text-[clamp(2.2rem,5vw,3.25rem)] leading-[1.03]">{title}</h1>
          <p className="mt-3 mb-8 text-lg text-ink-2">{subtitle}</p>
          {children}
          <div className="mt-8 text-center text-ink-2">{footer}</div>
        </motion.div>
      </div>

      <aside aria-hidden className="relative hidden overflow-hidden bg-teal text-on-teal lg:block">
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 20% 0%, rgb(255 255 255 / 0.14), transparent), radial-gradient(50% 50% at 100% 100%, rgb(217 96 59 / 0.45), transparent)" }} />
        <div className="relative flex h-full flex-col justify-between p-14">
          <p className="display max-w-sm text-4xl leading-[1.1]">Your calendar, answering the phone for you.</p>
          <ul className="flex flex-col gap-4 text-lg">
            {[
              [CalendarCheck2, "Opening hours, buffers and time off handled for you"],
              [ShieldCheck, "Two people can never take the same slot"],
              [Globe2, "Customers see times in their own time zone"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof CalendarCheck2;
              return (
                <li key={i} className="flex items-center gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/12">
                    <I className="size-5" />
                  </span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
