"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, CheckCircle, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If session is created immediately (e.g. email confirmations disabled in Supabase)
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Otherwise, email confirmation link has been sent
    setLoading(false);
    setShowConfirmModal(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl">
            <CardHeader className="text-center pt-6 pb-2">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Mail className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-semibold text-slate-900">
                Check your email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6 text-center">
              <p className="text-sm leading-relaxed text-slate-600">
                We sent a confirmation link to <span className="font-semibold text-slate-900">{email}</span>. Please click the link in your email to confirm your account and get started.
              </p>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500 text-left space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Didn&apos;t receive it?
                </div>
                <p>Check your spam or junk folder, or wait a few moments for the confirmation email to arrive.</p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Link
                  href="/login"
                  className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
                >
                  Proceed to Login <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Dismiss
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
            <CardTitle className="text-lg font-semibold text-slate-900">Create an account</CardTitle>
            <p className="text-sm text-slate-500">Start evaluating AI models</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSignup} className="space-y-3">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="h-10 border-slate-200 bg-slate-50 text-sm"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-medium text-slate-600">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="h-10 border-slate-200 bg-slate-50 text-sm"
                />
              </div>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
              </button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
