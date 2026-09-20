"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 text-center flex flex-col items-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-primary-foreground font-bold text-sm">
              <span>O</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">Orbbit</span>
          </Link>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Sign in to your account
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 w-full">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block font-sans text-xs text-muted-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block font-sans text-xs text-muted-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive font-sans">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 font-sans text-muted-foreground">Or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              try {
                await fetch("/api/auth/demo", { method: "POST" });
                router.push("/dashboard");
                router.refresh();
              } catch {
                router.push("/dashboard");
              }
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.98]"
          >
            <span>Continue as guest</span>
          </button>
        </div>

        <p className="mt-6 text-center font-sans text-xs text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="font-semibold text-foreground hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
