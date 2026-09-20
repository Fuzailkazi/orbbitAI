import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { LandingClient } from "./landing-client";

export default async function LandingPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const isGuestDemo = cookieStore.get("orbbit_guest_demo")?.value === "true";
  const isAuthenticated = !!user || isGuestDemo;

  return <LandingClient isAuthenticated={isAuthenticated} />;
}
