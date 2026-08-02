import { afterEach, describe, expect, it, vi } from "vitest";

import {
  beginFaceEnrollment,
  cancelFaceEnrollment,
  deleteFaceIdentity,
  fetchFaceIdentities,
  fetchFaceIdentityStatus,
  parseFaceIdentityList,
  parseFaceIdentitySnapshot,
  startFaceIdentity,
  stopFaceIdentity,
} from "./face-identity-client";

const identity = {
  id: "student-1",
  label: "小明",
  samples: 5,
  created_at: "2026-07-19T00:00:00Z",
};

const runningSnapshot = {
  status: "running",
  state: "recognizing",
  message: "正在确认身份",
  enrollment: null,
  identity: {
    ...identity,
    confidence: 0.94,
    confirmed: false,
  },
  error: null,
};

describe("parseFaceIdentitySnapshot", () => {
  it("accepts the complete public face-status payload", () => {
    expect(parseFaceIdentitySnapshot(runningSnapshot)).toEqual({
      status: "running",
      state: "recognizing",
      message: "正在确认身份",
      enrollment: null,
      identity: {
        id: "student-1",
        label: "小明",
        samples: 5,
        createdAt: "2026-07-19T00:00:00Z",
        confidence: 0.94,
        confirmed: false,
      },
      error: null,
    });
  });

  it("rejects an unrecognized status", () => {
    expect(parseFaceIdentitySnapshot({ ...runningSnapshot, status: "online" })).toBeNull();
  });

  it("rejects raw embeddings from a recognition response", () => {
    expect(parseFaceIdentitySnapshot({
      ...runningSnapshot,
      identity: { ...runningSnapshot.identity, embedding: [0.1, 0.2] },
    })).toBeNull();
  });

  it("rejects invalid public identity labels", () => {
    expect(parseFaceIdentitySnapshot({
      ...runningSnapshot,
      identity: { ...runningSnapshot.identity, label: "   " },
    })).toBeNull();
  });

  it("rejects unavailable statuses without an error object", () => {
    expect(parseFaceIdentitySnapshot({
      ...runningSnapshot,
      status: "unavailable",
      state: "idle",
      error: null,
    })).toBeNull();
  });

  it("rejects error statuses with missing or malformed errors", () => {
    const withoutError = {
      status: "error",
      state: "unknown",
      message: runningSnapshot.message,
      enrollment: runningSnapshot.enrollment,
      identity: runningSnapshot.identity,
    };

    expect(parseFaceIdentitySnapshot(withoutError)).toBeNull();
    expect(parseFaceIdentitySnapshot({
      ...runningSnapshot,
      status: "error",
      state: "unknown",
      error: { code: "face_engine_unavailable" },
    })).toBeNull();
  });
});

describe("parseFaceIdentityList", () => {
  it("accepts public identities and converts their field names", () => {
    expect(parseFaceIdentityList({ count: 1, identities: [identity] })).toEqual({
      count: 1,
      identities: [{
        id: "student-1",
        label: "小明",
        samples: 5,
        createdAt: "2026-07-19T00:00:00Z",
      }],
    });
  });

  it("rejects raw embeddings from the identities listing", () => {
    expect(parseFaceIdentityList({
      count: 1,
      identities: [{ ...identity, embedding: [0.1, 0.2] }],
    })).toBeNull();
  });

  it("rejects an identities count that does not match its public entries", () => {
    expect(parseFaceIdentityList({ count: 2, identities: [identity] })).toBeNull();
  });

  it("rejects a successful identities response that carries error null", () => {
    expect(parseFaceIdentityList({ count: 1, identities: [identity], error: null })).toBeNull();
  });

  it("accepts a backend identity-store failure only with a complete public error", () => {
    expect(parseFaceIdentityList({
      count: 1,
      identities: [identity],
      error: {
        code: "face_identity_store_unavailable",
        message: "Identity store is unavailable",
      },
    })).toMatchObject({
      count: 1,
      error: { code: "face_identity_store_unavailable" },
    });
  });
});

describe("face identity requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a Chinese nickname as JSON to the local enrollment endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(runningSnapshot), { status: 202 }));
    vi.stubGlobal("fetch", fetch);

    await expect(beginFaceEnrollment("小明")).resolves.toMatchObject({
      status: "running",
      identity: { label: "小明" },
    });
    expect(fetch).toHaveBeenCalledWith("/_mambo/face/enroll", expect.objectContaining({
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "小明" }),
    }));
  });

  it("uses the local proxy for every face operation and sends JSON for mutations", async () => {
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith("/identities") || path.endsWith("/identities/delete")
        ? { count: 1, identities: [identity] }
        : runningSnapshot;
      return Promise.resolve(new Response(JSON.stringify(body)));
    });
    vi.stubGlobal("fetch", fetch);

    await fetchFaceIdentityStatus();
    await startFaceIdentity();
    await stopFaceIdentity();
    await cancelFaceEnrollment();
    await fetchFaceIdentities();
    await deleteFaceIdentity("student-1");

    expect(fetch).toHaveBeenNthCalledWith(1, "/_mambo/face/status", { cache: "no-store" });
    expect(fetch).toHaveBeenNthCalledWith(2, "/_mambo/face/start", expect.objectContaining({
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    }));
    expect(fetch).toHaveBeenNthCalledWith(3, "/_mambo/face/stop", expect.objectContaining({
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    }));
    expect(fetch).toHaveBeenNthCalledWith(4, "/_mambo/face/cancel-enrollment", expect.objectContaining({
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    }));
    expect(fetch).toHaveBeenNthCalledWith(5, "/_mambo/face/identities", { cache: "no-store" });
    expect(fetch).toHaveBeenNthCalledWith(6, "/_mambo/face/identities/delete", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ id: "student-1" }),
      headers: { "Content-Type": "application/json" },
    }));
  });

  it("normalizes transport and invalid-payload failures to face_identity_unavailable", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "invalid" })));
    vi.stubGlobal("fetch", fetch);

    await expect(fetchFaceIdentityStatus()).rejects.toThrow("face_identity_unavailable");
  });
});
