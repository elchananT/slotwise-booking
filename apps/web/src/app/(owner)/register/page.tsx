"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/app/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineError } from "@/components/ui/feedback";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/format";

export default function RegisterPage() {
  const { register, status } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (status === "authed") router.replace("/app");
  }, [status, router]);

  const pwErr = touched && password.length < 8 ? "Use at least 8 characters." : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (password.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/app/setup");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Open your booking page"
      subtitle="Three short steps: your business, your services, your hours."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-ink underline underline-offset-4 decoration-brand">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="Your name">{(p) => <Input {...p} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Email">{(p) => <Input {...p} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password" hint="At least 8 characters." error={pwErr}>
          {(p) => <Input {...p} type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <InlineError message={error} />
        <Button type="submit" size="lg" loading={busy} className="mt-1">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
