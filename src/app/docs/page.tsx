import type { Metadata } from "next";
import { DocsClient } from "./docs-client";

export const metadata: Metadata = {
  title: "Documentation — Orbbit AI Evaluation Observatory",
  description: "Learn how to use Orbbit to benchmark AI models, evaluate accuracy, analyze token economics, configure Dynamic Value Score, and run custom evaluation suites.",
};

export default function DocsPage() {
  return <DocsClient />;
}
