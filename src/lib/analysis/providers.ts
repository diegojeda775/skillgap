import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ProviderId = "claude" | "openai" | "gemini";

export interface Provider {
  id: ProviderId;
  label: string;
  modelId: string;
  model: LanguageModel;
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
};

/** Every provider with an API key set. Order matters: it breaks ties when merging. */
export function getProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    const modelId = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
    providers.push({ id: "claude", label: PROVIDER_LABELS.claude, modelId, model: createAnthropic()(modelId) });
  }
  if (process.env.OPENAI_API_KEY) {
    const modelId = process.env.OPENAI_MODEL || "gpt-5.5";
    providers.push({ id: "openai", label: PROVIDER_LABELS.openai, modelId, model: createOpenAI()(modelId) });
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const modelId = process.env.GOOGLE_MODEL || "gemini-pro-latest";
    providers.push({ id: "gemini", label: PROVIDER_LABELS.gemini, modelId, model: createGoogleGenerativeAI()(modelId) });
  }

  return providers;
}
