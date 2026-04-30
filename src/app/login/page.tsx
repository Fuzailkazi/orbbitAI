"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Code2, Mail, Loader2 } from "lucide-react";

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
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleOAuth(provider: "github" | "google") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
              <span className="text-sm font-bold text-white">O</span>
            </div>
            <span className="text-lg font-bold text-slate-900">Orbbit</span>
          </Link>
        </div>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Welcome back</CardTitle>
            <p className="text-sm text-slate-500">Sign in to your account</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <button onClick={() => handleOAuth("github")} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                <Code2 className="h-4 w-4" /> Continue with GitHub
              </button>
              <button onClick={() => handleOAuth("google")} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                <Mail className="h-4 w-4" /> Continue with Google
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">or</span></div>
            </div>
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="h-10 border-slate-200 bg-slate-50 text-sm" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-medium text-slate-600">Password</label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="h-10 border-slate-200 bg-slate-50 text-sm" />
              </div>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-700">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
