import { ImageResponse } from "next/og";

export const alt = "Orbbit — Independent AI model evaluation & benchmarking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// next/og (Satori) cannot resolve CSS variables, so the light-theme token values are mirrored here.
const TOKENS = {
  background: "#FAFAFA",
  card: "#FFFFFF",
  foreground: "#171717",
  muted: "#737373",
  border: "#E5E5E5",
  brand: "#2563EB",
  track: "#F5F5F5",
} as const;

const ROWS = [
  { label: "MMLU", value: 92.4, lo: 91.2, hi: 93.4 },
  { label: "GSM8K", value: 95.1, lo: 94.0, hi: 96.0 },
  { label: "HumanEval", value: 88.7, lo: 85.1, hi: 91.6 },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: TOKENS.background,
          padding: 64,
          fontFamily: "sans-serif",
          color: TOKENS.foreground,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: TOKENS.foreground,
                color: TOKENS.card,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              O
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>Orbbit</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.05, maxWidth: 560 }}>
              AI model evaluation you can trust
            </div>
            <div style={{ fontSize: 26, color: TOKENS.muted, maxWidth: 540, lineHeight: 1.35 }}>
              Accuracy, latency and cost across 400+ models — every score with a Wilson 95% CI.
            </div>
          </div>
        </div>

        <div
          style={{
            width: 440,
            alignSelf: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 28,
            background: TOKENS.card,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 28,
            padding: 40,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 600 }}>Benchmark accuracy</div>
          {ROWS.map((r) => (
            <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}>
                <span style={{ color: TOKENS.muted }}>{r.label}</span>
                <span style={{ fontWeight: 600 }}>
                  {r.value.toFixed(1)}%
                  <span style={{ color: TOKENS.muted, fontWeight: 400, marginLeft: 8, fontSize: 16 }}>
                    {r.lo.toFixed(1)}–{r.hi.toFixed(1)}
                  </span>
                </span>
              </div>
              <div style={{ display: "flex", height: 10, borderRadius: 999, background: TOKENS.track }}>
                <div style={{ width: `${r.value}%`, borderRadius: 999, background: TOKENS.brand }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
