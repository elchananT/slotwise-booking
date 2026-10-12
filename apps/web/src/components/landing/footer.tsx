import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-10 sm:px-10">
        <Logo />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-ink-2">
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
          <Link href="/register" className="hover:text-ink">
            Create account
          </Link>
          <Link href="/b/lumen-studio" className="hover:text-ink">
            Sample booking page
          </Link>
        </nav>
      </div>
    </footer>
  );
}
