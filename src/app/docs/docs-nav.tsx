"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { CATEGORIES, SECTIONS } from "./docs-data";

interface ActiveSectionState {
  activeSection: string;
  setActiveSection: (id: string) => void;
}

const ActiveSectionContext = createContext<ActiveSectionState>({
  activeSection: SECTIONS[0].id,
  setActiveSection: () => {},
});

/**
 * Scroll-spy for the docs page. The page content is server-rendered; this provider only tracks
 * which section is in view so the two nav islands can highlight it.
 */
export function DocsNavProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  // Scroll-spy: highlight the section currently in view (subscription only, no data fetching).
  useEffect(() => {
    const targets = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return <ActiveSectionContext value={{ activeSection, setActiveSection }}>{children}</ActiveSectionContext>;
}

/** Compact section nav for < lg (the sidebar is hidden there). */
export function DocsMobileNav() {
  const { activeSection, setActiveSection } = use(ActiveSectionContext);
  return (
    <nav
      aria-label="Documentation sections"
      className="lg:hidden sticky top-16 z-40 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-6 scrollbar-none">
        {SECTIONS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setActiveSection(item.id)}
              aria-current={isActive ? "location" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-border bg-card text-foreground font-semibold shadow-2xs"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.title.replace(/^\d+\.\s*/, "")}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

/** Sidebar search filter + grouped section links (desktop). */
export function DocsSidebarNav() {
  const { activeSection, setActiveSection } = use(ActiveSectionContext);
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.trim().toLowerCase();
  const filteredSections = SECTIONS.filter(
    (s) => s.title.toLowerCase().includes(query) || s.category.toLowerCase().includes(query)
  );

  return (
    <>
      {/* Search filter */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          aria-label="Filter documentation sections"
          placeholder="Filter documentation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
        />
      </div>

      {/* Nav Groupings */}
      <nav className="space-y-4 text-xs">
        {CATEGORIES.map((category) => {
          const categorySections = filteredSections.filter((s) => s.category === category);
          if (categorySections.length === 0) return null;

          return (
            <div key={category} className="space-y-1.5">
              <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground px-3">
                {category}
              </p>
              <div className="space-y-0.5">
                {categorySections.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setActiveSection(item.id)}
                      aria-current={isActive ? "location" : undefined}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium ${
                        isActive
                          ? "bg-muted text-foreground font-semibold shadow-2xs border border-border"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <span>{item.title}</span>
                      {isActive && <ChevronRight className="h-3 w-3 text-brand" />}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filteredSections.length === 0 && (
          <p className="px-3 text-muted-foreground">No sections match &ldquo;{searchQuery}&rdquo;.</p>
        )}
      </nav>
    </>
  );
}
