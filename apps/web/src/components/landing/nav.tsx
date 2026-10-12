import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Nav() {
  return (
    <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-10">
      <Logo />
      <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
        <Link href="#how" className="hidden rounded-full px-4 py-2 text-[0.95rem] font-medium text-ink-2 hover:text-ink md:block">
          How it works
        </Link>
        <Link href="#details" className="hidden rounded-full px-4 py-2 text-[0.95rem] font-medium text-ink-2 hover:text-ink md:block">
          What&rsquo;s inside
        </Link>
        <ThemeToggle />
        <Link href="/login" className="rounded-full px-3 py-2 text-[0.95rem] font-medium text-ink hover:bg-sunken sm:px-4">
          Sign in
        </Link>
        <LinkButton href="/register" size="sm" className="hidden sm:inline-flex">
          Get started
        </LinkButton>
      </nav>
    </header>
  );
}
