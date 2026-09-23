import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Independent AI model evaluation platform. Compare 400+ models across accuracy, latency, and cost with standardized, reproducible benchmarks and Wilson confidence intervals.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Orbbit — AI Model Evaluation & Benchmarking",
    template: "%s · Orbbit",
  },
  description: DESCRIPTION,
  applicationName: "Orbbit",
  keywords: [
    "AI model evaluation",
    "LLM benchmarks",
    "model leaderboard",
    "OpenRouter",
    "MMLU",
    "GSM8K",
    "HumanEval",
  ],
  openGraph: {
    type: "website",
    siteName: "Orbbit",
    title: "Orbbit — AI Model Evaluation & Benchmarking",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbbit — AI Model Evaluation & Benchmarking",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAFA",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          {/* Cache Components safety net: a page that reads request data (cookies, uncached
              queries) outside its own Suspense/loading.tsx still streams instead of failing the
              prerender. Routes with their own boundaries (every dashboard route) never hit it. */}
          <Suspense>{children}</Suspense>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
