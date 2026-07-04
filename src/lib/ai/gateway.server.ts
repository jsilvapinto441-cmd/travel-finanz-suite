// Server-only helper for Lovable AI Gateway (OpenAI-compatible).
export const LOVABLE_AI_BASE = "https://ai.gateway.lovable.dev/v1";

export function getLovableApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

export function lovableHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${getLovableApiKey()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}
