import { google } from "@ai-sdk/google";

const DEFAULT_MODEL = "gemini-3.5-flash";

export function getGoogleModel(modelId = process.env.GEMINI_MODEL ?? DEFAULT_MODEL) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required");
  }

  return google(modelId);
}
