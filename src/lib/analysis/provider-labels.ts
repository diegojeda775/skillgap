export type ProviderId = "claude" | "openai" | "gemini";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
};

export function providerLabel(id: string) {
  return PROVIDER_LABELS[id as ProviderId] ?? id;
}
