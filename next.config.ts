import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: data is dynamic unless a scope opts in with "use cache". Shared catalog
  // reads live in src/lib/data (cached + tagged); per-user and in-flight data stay uncached and
  // stream inside <Suspense> (every dashboard route has a loading.tsx boundary).
  cacheComponents: true,

  // Named lifetimes used by src/lib/data. `stale` = client router reuse, `revalidate` = background
  // refresh on the server, `expire` = hard limit before a request must wait for fresh data.
  cacheLife: {
    // Models, benchmarks, spaces: change on sync/import/edit, each of which revalidates its tag.
    catalog: {
      stale: 300,
      revalidate: 3600,
      expire: 86400,
    },
    // Completed-evaluation aggregates (overview, leaderboard, compare, spaces, landing). New runs
    // revalidate the "evaluations" tag; the 5 min window covers runs finished outside Next (CLI batch).
    evaluations: {
      stale: 30,
      revalidate: 300,
      expire: 86400,
    },
  },

  // lucide-react and recharts are already in Next's default optimizePackageImports list;
  // @base-ui/react is imported by subpath, so no barrel optimization is needed.

  // Keep the dev-only Next.js indicator away from the sidebar footer (bottom-left).
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
