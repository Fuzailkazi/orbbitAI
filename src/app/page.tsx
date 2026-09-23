import "@/components/marketing/landing/landing-motion.css";
import { LandingView } from "@/components/marketing/landing/landing-view";
import { getLandingData } from "@/components/marketing/landing/showcase";

/**
 * Landing page. Static with Cache Components: counts and the evaluation showcase come from the
 * cached data layer (src/lib/data), so the whole page is served from the prerendered shell. The only
 * request-time read — whether the visitor is signed in — streams into small AuthAware slots.
 */
export default async function LandingPage() {
  const { stats, showcase } = await getLandingData();
  return <LandingView stats={stats} showcase={showcase} />;
}
