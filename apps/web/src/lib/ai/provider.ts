import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_BASE_URL = "https://api.deepseek.com";

export function getChatModel(modelId = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required");
  }

  const deepseek = createOpenAICompatible({
    name: "deepseek",
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL,
    includeUsage: true,
  });
  return deepseek.chatModel(modelId);
}
