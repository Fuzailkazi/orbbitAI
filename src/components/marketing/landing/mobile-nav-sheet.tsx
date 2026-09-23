"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { NavLink } from "./shared";

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: readonly NavLink[];
  /** Server-rendered, auth-aware call-to-action block at the bottom of the sheet. */
  cta: ReactNode;
}

/** The < md navigation drawer. Loaded on demand by MobileNav so desktop never downloads it. */
export function MobileNavSheet({ open, onOpenChange, links, cta }: MobileNavSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              O
            </span>
            Orbbit
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">{cta}</div>
      </SheetContent>
    </Sheet>
  );
}
