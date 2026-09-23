"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "./shared";

// The drawer (base-ui Dialog) is only needed below `md`, so it is split out of the landing bundle
// and fetched on demand: desktop visitors never download it.
const MobileNavSheet = dynamic(() => import("./mobile-nav-sheet").then((m) => m.MobileNavSheet), {
  ssr: false,
});

/** Matches Tailwind's `md:hidden` on the trigger (md = 48rem). */
const MOBILE_QUERY = "(max-width: 47.99rem)";

/** Compact menu for < md, where the section links are hidden. */
export function MobileNav({ cta }: { cta: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Mount the drawer closed (after the page is idle) on small screens so its open transition
  // plays exactly as before; a tap before that mounts it on the spot.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(MOBILE_QUERY);
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (!media.matches || idleId !== null || timeoutId !== null) return;
      const mount = () => setMounted(true);
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(mount, { timeout: 2000 });
      } else {
        timeoutId = setTimeout(mount, 300);
      }
    };

    schedule();
    media.addEventListener("change", schedule);
    return () => {
      media.removeEventListener("change", schedule);
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden rounded-full"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <Menu />
      </Button>
      {mounted && <MobileNavSheet open={open} onOpenChange={setOpen} links={NAV_LINKS} cta={cta} />}
    </>
  );
}
