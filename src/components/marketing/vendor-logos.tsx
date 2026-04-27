
const vendors = [
  { name: "OpenAI", color: "#000000" },
  { name: "Anthropic", color: "#D4A574" },
  { name: "Google", color: "#4285F4" },
  { name: "Meta", color: "#0668E1" },
  { name: "Mistral", color: "#F54E42" },
  { name: "DeepSeek", color: "#4D6BFE" },
  { name: "xAI", color: "#000000" },
  { name: "Cohere", color: "#39594D" },
  { name: "NVIDIA", color: "#76B900" },
  { name: "Amazon", color: "#FF9900" },
];

export function VendorLogos() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
      {vendors.map((v) => (
        <span
          key={v.name}
          className="text-base font-semibold tracking-tight opacity-60 transition-opacity hover:opacity-100"
          style={{ color: v.color }}
        >
          {v.name}
        </span>
      ))}
    </div>
  );
}
