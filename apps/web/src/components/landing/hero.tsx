"use client";
import { motion } from "motion/react";
import { LinkButton } from "@/components/ui/button";
import { BookingDemo } from "./booking-demo";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero({ nav }: { nav: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden">
      {/* appointment-book ruling + warm light, all static gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 2.74rem, var(--line) 2.74rem calc(2.74rem + 1px))",
          maskImage: "linear-gradient(to bottom, black 20%, transparent 95%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 20%, transparent 95%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-48 -right-40 size-[46rem] rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--terracotta) 26%, transparent), transparent)" }} />
      <div aria-hidden className="pointer-events-none absolute top-1/2 -left-64 size-[36rem] rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--teal) 16%, transparent), transparent)" }} />

      {nav}
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pt-10 pb-20 sm:px-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10 lg:pt-16 lg:pb-28">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
            className="text-[clamp(2.9rem,6.2vw,5.4rem)] leading-[0.98] font-medium tracking-[-0.025em]"
          >
            Let people book you,{" "}
            <span aria-hidden className="relative -top-[0.04em] mx-[0.04em] inline-flex h-[0.72em] w-[1.5em] -rotate-3 items-center justify-start rounded-full bg-brand pl-[0.14em] align-middle shadow-[0_0.08em_0_rgb(0_0_0/0.12)]">
              <span className="size-[0.4em] rounded-full bg-teal" />
            </span>{" "}
            not play phone&nbsp;tag.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease }}
            className="mt-7 max-w-xl text-xl leading-relaxed text-ink-2"
          >
            Slotwise gives your studio, clinic or chair a booking page that knows your hours, your staff, your buffers and your time zone. Every slot a customer sees is one you can actually take.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.22, ease }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <LinkButton href="/register" size="lg">
              Create your booking page
            </LinkButton>
            <LinkButton href="/b/lumen-studio" variant="ghost" size="lg">
              Try a live booking page
            </LinkButton>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }} className="mt-5 text-sm text-ink-2">
            Setup is three short steps: your business, your services, your weekly hours.
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, y: 32, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 1, delay: 0.25, ease }}>
          <BookingDemo />
        </motion.div>
      </div>
    </section>
  );
}
