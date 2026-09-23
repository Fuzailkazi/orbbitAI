"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthDivider, AuthShell, GuestDemoButton } from "@/components/marketing/auth-shell";
import { safeRedirectPath } from "@/lib/auth/redirect";

/** supabase-js is only needed on submit: load it on demand (warmed on first focus of the form). */
function loadSupabaseClient() {
  return import("@/lib/supabase/client");
}

const CALLBACK_ERRORS: Record<string, string> = {
  auth_callback: "That sign-in link is invalid or has expired. Please sign in again.",
  guest_unavailable: "The guest demo isn't available right now. Please sign in with email.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("next"));
  const callbackError = CALLBACK_ERRORS[searchParams.get("error") ?? ""] ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(callbackError);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent<HTMLFormElement>) {
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <GuestDemoButton redirectTo={redirectTo} disabled={loading} onError={setError} />

      <AuthDivider label="or sign in with email" />

      <form onFocus={() => void loadSupabaseClient()} onSubmit={handleEmailLogin} className="space-y-4">
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
            placeholder="you@example.com"
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
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
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your Orbbit account"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-foreground hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-72" aria-hidden="true" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
