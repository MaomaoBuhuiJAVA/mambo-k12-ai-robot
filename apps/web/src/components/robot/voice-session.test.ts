import { describe, expect, it } from "vitest";

import { encodeWav } from "./voice-session";

describe("encodeWav", () => {
  it("encodes mono 16-bit PCM with a RIFF header", () => {
    const wav = encodeWav(new Float32Array([0, -1, 1]), 16_000);
    const bytes = new Uint8Array(wav);
    const header = new TextDecoder().decode(bytes.slice(0, 4));

    expect(header).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(bytes.byteLength).toBe(44 + 6);
  });
});
