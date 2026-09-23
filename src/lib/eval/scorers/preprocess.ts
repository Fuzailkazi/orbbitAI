/**
 * Shared response preprocessing for every scorer.
 *
 * Reasoning models (DeepSeek-R1, QwQ, some Qwen/GLM builds…) emit their chain of thought in
 * `<think>…</think>` / `<reasoning>…</reasoning>` / `<thinking>…</thinking>` blocks before the
 * final answer. Anything inside those blocks is scratch work and must never be read as the
 * answer, so it is removed before extraction.
 */

const REASONING_TAGS = ["think", "thinking", "reasoning", "reflection"] as const;

function stripTag(text: string, tag: string): string {
  // Complete blocks.
  let out = text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi"), "");
  // An unterminated opening tag (response truncated mid-thought): everything after it is scratch work.
  out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*$`, "i"), "");
  // A dangling closing tag (some providers drop the opening tag): everything before it is scratch work.
  const closeRe = new RegExp(`</${tag}\\s*>`, "gi");
  let lastClose = -1;
  let closeLength = 0;
  for (let m = closeRe.exec(out); m !== null; m = closeRe.exec(out)) {
    lastClose = m.index;
    closeLength = m[0].length;
  }
  if (lastClose >= 0) out = out.slice(lastClose + closeLength);
  return out;
}

/** Removes reasoning blocks and trims. Safe on plain responses (returns them trimmed). */
export function preprocessResponse(response: string | null | undefined): string {
  if (typeof response !== "string") return "";
  let out = response;
  for (const tag of REASONING_TAGS) out = stripTag(out, tag);
  return out.trim();
}
