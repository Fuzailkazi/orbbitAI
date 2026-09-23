import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route";
import { safeRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth_callback", requestUrl.origin));
  }

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_callback", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
