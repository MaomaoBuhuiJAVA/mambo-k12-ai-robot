import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn((modelId: string) => ({ modelId })),
}));

import { google } from "@ai-sdk/google";

import { getGoogleModel } from "./provider";

describe("getGoogleModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uses the current stable Flash model by default", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", undefined);

    getGoogleModel();

    expect(google).toHaveBeenCalledWith("gemini-3.5-flash");
  });

  it("allows the deployment to override the model", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-custom");

    getGoogleModel();

    expect(google).toHaveBeenCalledWith("gemini-custom");
  });
});
