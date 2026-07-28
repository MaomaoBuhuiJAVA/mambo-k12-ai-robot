import { afterEach, describe, expect, it, vi } from "vitest";

import { calculateRms, encodeWav } from "./voice-session";

describe("calculateRms", () => {
  it("reports the amplitude of a PCM frame", () => {
    expect(calculateRms(new Float32Array([0, 0.5, -0.5, 0]))).toBeCloseTo(0.3536, 4);
    expect(calculateRms(new Float32Array())).toBe(0);
  });
});

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

describe("PcmRecorder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the microphone stream open until deferred cleanup", async () => {
    const track = { stop: vi.fn() };
    const processor = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const mute = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const context = {
      sampleRate: 16_000,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createMediaStreamSource: vi.fn(() => source),
      createScriptProcessor: vi.fn(() => processor),
      createGain: vi.fn(() => mute),
    };
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });
    const FakeAudioContext = vi.fn(function FakeAudioContext() {
      return context;
    });
    vi.stubGlobal("AudioContext", FakeAudioContext);

    const { PcmRecorder } = await import("./voice-session");
    const recorder = new PcmRecorder();
    await recorder.start();
    await recorder.stop({ release: false });

    expect(track.stop).not.toHaveBeenCalled();
    expect(context.close).not.toHaveBeenCalled();

    const cleanup = recorder.cancel();
    expect(cleanup).toBeInstanceOf(Promise);
    await cleanup;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
