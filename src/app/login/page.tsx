"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex min-h-screen items-center justify-center bg-[#FBFBFA] swiss-dot-grid px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white font-mono font-bold text-sm shadow-2xs">
              <span>O</span>
            </div>
            <div className="text-left">
              <span className="text-sm font-semibold tracking-tight text-zinc-950 block">Orbbit</span>
              <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-zinc-400 block -mt-0.5">OBSERVATORY OS</span>
            </div>
          </Link>
        </div>
        <div className="double-bezel">
          <div className="double-bezel-inner p-6 space-y-5">
            <div className="text-center pb-1 border-b border-black/[0.05]">
              <h2 className="text-base font-semibold text-zinc-950 tracking-tight">Access Control</h2>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">AUTHENTICATE WITH OBSERVATORY NODE</p>
            </div>
            
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div>
                <label htmlFor="email" className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@domain.com"
                  required
                  className="h-10 rounded-xl border-black/[0.08] bg-white text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Security Token / Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-10 rounded-xl border-black/[0.08] bg-white text-xs font-mono"
                />
              </div>
              {error && <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-mono text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex h-10 w-full items-center justify-center rounded-xl bg-zinc-950 text-xs font-mono uppercase tracking-wider font-semibold text-white transition-all hover:bg-zinc-850 active:scale-[0.98] disabled:opacity-50 shadow-2xs"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-orange-500" /> : "AUTHENTICATE"}
              </button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-black/[0.06]" />
              </div>
              <div className="relative flex justify-center text-[9px] uppercase font-mono tracking-[0.16em]">
                <span className="bg-white px-2 text-zinc-400">Recruiter & Reviewer Quick Pass</span>
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
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-zinc-50 text-xs font-mono uppercase tracking-wider font-semibold text-zinc-900 transition-all hover:bg-zinc-100 hover:border-black/[0.15] shadow-2xs active:scale-[0.98]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-orange-600 animate-pulse" />
              <span>EXPLORE DEMO AS GUEST</span>
            </button>
            <p className="text-center text-[10px] font-mono text-zinc-400">
              1-click instant session. No credentials required.
            </p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs font-mono text-zinc-500">
          Need a dedicated account?{" "}
          <Link href="/signup" className="font-semibold text-zinc-950 hover:underline">
            Register node
          </Link>
        </p>
      </div>
    </div>
  );
}
