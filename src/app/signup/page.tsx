"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AuthDivider, AuthShell, GuestDemoButton } from "@/components/marketing/auth-shell";

/** supabase-js is only needed on submit: load it on demand (warmed on first focus of the form). */
function loadSupabaseClient() {
  return import("@/lib/supabase/client");
}

const MIN_PASSWORD_LENGTH = 6;

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const clientModule = await loadSupabaseClient().catch(() => null);
    if (!clientModule) {
      setError("Couldn't reach the sign-in service. Check your connection and try again.");
      setLoading(false);
      return;
    }
    const supabase = clientModule.createBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Email confirmation disabled in Supabase → a session exists immediately.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setLoading(false);
    setConfirmationSentTo(email);
  }

  const footer = (
    <>
      Already have an account?{" "}
      <Link href="/login" className="font-semibold text-foreground hover:underline">
        Sign in
      </Link>
    </>
  );

  if (confirmationSentTo) {
    return (
      <AuthShell title="Check your email" description="One more step to activate your account" footer={footer}>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Mail className="h-6 w-6" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground" role="status">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-foreground break-all">{confirmationSentTo}</span>. Open it to
            confirm your account and get started.
          </p>
          <div className="space-y-1.5 rounded-xl border border-border bg-muted/50 p-3 text-left text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Didn&apos;t receive it?
            </div>
            <p>Check your spam or junk folder, or wait a few moments for the email to arrive.</p>
          </div>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Link href="/login" className={cn(buttonVariants(), "h-10 flex-1")}>
              Go to sign in
              <ArrowRight data-icon="inline-end" />
            </Link>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={() => setConfirmationSentTo(null)}
            >
              Use another email
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create an account" description="Save custom benchmarks and evaluation history" footer={footer}>
      <GuestDemoButton redirectTo="/dashboard" disabled={loading} onError={setError} />

      <AuthDivider label="or sign up with email" />

      <form onFocus={() => void loadSupabaseClient()} onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-medium text-muted-foreground">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="h-10"
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="h-10 w-full">
          {loading && <Loader2 className="animate-spin" data-icon="inline-start" />}
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
