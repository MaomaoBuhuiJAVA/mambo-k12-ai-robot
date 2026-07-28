import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    chatModel: vi.fn((modelId: string) => ({ modelId })),
  })),
}));

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { getChatModel } from "./provider";

describe("getChatModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uses DeepSeek's current Flash model by default", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("DEEPSEEK_MODEL", undefined);

    getChatModel();

    expect(createOpenAICompatible).toHaveBeenCalledWith(expect.objectContaining({
      name: "deepseek",
      apiKey: "test-key",
      baseURL: "https://api.deepseek.com",
    }));
    const provider = vi.mocked(createOpenAICompatible).mock.results[0]?.value as { chatModel: ReturnType<typeof vi.fn> };
    expect(provider.chatModel).toHaveBeenCalledWith("deepseek-v4-flash");
  });

  it("allows the deployment to override the model", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-custom");

    getChatModel();

    const provider = vi.mocked(createOpenAICompatible).mock.results[0]?.value as { chatModel: ReturnType<typeof vi.fn> };
    expect(provider.chatModel).toHaveBeenCalledWith("deepseek-custom");
  });
});
