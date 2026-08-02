import { act, renderHook, waitFor } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSharedStarbaoConversation } from "./use-shared-starbao-conversation";

const conversation = {
  conversationId: "conv-1",
  deviceId: "orangepi4pro-dev-01",
  speakOnOrangePi: false,
  latestSequence: 4,
};

const firstMessage = {
  messageId: "message-4",
  conversationId: "conv-1",
  sequence: 4,
  clientMessageId: "web-message-4",
  role: "user" as const,
  origin: "web" as const,
  content: "Explain the next step",
  replyToMessageId: null,
  announceOnOrangePi: false,
  createdAt: "2026-07-19T09:00:00Z",
};

const secondMessage = {
  messageId: "message-5",
  conversationId: "conv-1",
  sequence: 5,
  clientMessageId: "web-message-4:assistant",
  role: "assistant" as const,
  origin: "starbao" as const,
  content: "Compare the two nearby numbers first.",
  replyToMessageId: "message-4",
  announceOnOrangePi: false,
  createdAt: "2026-07-19T09:00:01Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve: resolve! };
}

describe("useSharedStarbaoConversation", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("hydrates canonical history then sends an idempotent turn through the BFF", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "message-4" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }))
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        userMessage: firstMessage,
        assistantMessage: secondMessage,
        latestSequence: 5,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toEqual([firstMessage]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/starbao?after=0&limit=100",
      expect.objectContaining({ cache: "no-store" }),
    );

    await act(async () => {
      await result.current.sendTurn({
        text: "Explain the next step",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
        origin: "orangepi",
      });
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/starbao/turn",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: expect.stringMatching(/"origin":"orangepi"/),
      }),
    );
    expect(result.current.messages).toEqual([firstMessage, secondMessage]);
    expect(result.current.latestSequence).toBe(5);
  });

  it("shows an optimistic user message until the canonical turn replaces it", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "turn-1" });
    const turnResponse = deferred<Response>();
    const optimisticText = "What should I try next?";
    const canonicalUserMessage = {
      ...firstMessage,
      messageId: "message-1",
      sequence: 1,
      clientMessageId: "web-turn-1",
      content: optimisticText,
      createdAt: "2026-07-19T09:00:00Z",
    };
    const canonicalAssistantMessage = {
      ...secondMessage,
      messageId: "message-2",
      sequence: 2,
      clientMessageId: "web-turn-1:assistant",
      content: "Start by comparing the first two values.",
      replyToMessageId: "message-1",
      createdAt: "2026-07-19T09:00:01Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation: { ...conversation, latestSequence: 0 },
        messages: [],
        latestSequence: 0,
      }))
      .mockReturnValueOnce(turnResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendTurn({
        text: optimisticText,
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      });
    });

    expect(result.current.isSending).toBe(true);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      messageId: "pending:web-turn-1",
      clientMessageId: "web-turn-1",
      role: "user",
      content: optimisticText,
    });

    await act(async () => {
      turnResponse.resolve(jsonResponse({
        conversation: { ...conversation, latestSequence: 2 },
        userMessage: canonicalUserMessage,
        assistantMessage: canonicalAssistantMessage,
        latestSequence: 2,
      }));
      await sendPromise;
    });

    expect(result.current.isSending).toBe(false);
    expect(result.current.messages).toEqual([canonicalUserMessage, canonicalAssistantMessage]);
  });

  it("removes only the optimistic message when sending a turn fails", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "turn-failure" });
    const turnResponse = deferred<Response>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }))
      .mockReturnValueOnce(turnResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendTurn({
        text: "This request will fail",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      });
    });

    expect(result.current.messages.map((message) => message.messageId)).toEqual([
      "message-4",
      "pending:web-turn-failure",
    ]);

    await act(async () => {
      turnResponse.resolve(jsonResponse({ error: "unavailable" }, 503));
      await expect(sendPromise).rejects.toThrow("STARBAO_UNAVAILABLE");
    });

    expect(result.current.messages).toEqual([firstMessage]);
    expect(result.current.error).toBe("STARBAO_UNAVAILABLE");
    expect(result.current.isSending).toBe(false);
  });

  it("settles a turn started before mount effects initialize the session", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "before-mount-effect" });
    const initialRefresh = deferred<Response>();
    const turnResponse = deferred<Response>();
    const fetchMock = vi.fn((url: string) => (
      url === "/api/starbao/turn" ? turnResponse.promise : initialRefresh.promise
    ));
    vi.stubGlobal("fetch", fetchMock);

    let sendPromise!: Promise<unknown>;
    const { result } = renderHook(() => {
      const sharedConversation = useSharedStarbaoConversation({ pollIntervalMs: 60_000 });
      const startedRef = useRef(false);

      useLayoutEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        sendPromise = sharedConversation.sendTurn({
          text: "Before mount effect",
          stage: "lower_primary",
          courseId: "lower-bubble-sort",
        });
      }, [sharedConversation.sendTurn]);

      return sharedConversation;
    });

    await waitFor(() => expect(result.current.isSending).toBe(true));
    expect(result.current.messages.some((message) => message.messageId === "pending:web-before-mount-effect")).toBe(true);

    await act(async () => {
      turnResponse.resolve(jsonResponse({ error: "unavailable" }, 503));
      await expect(sendPromise).rejects.toThrow("STARBAO_UNAVAILABLE");
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBe("STARBAO_UNAVAILABLE");

    await act(async () => {
      initialRefresh.resolve(jsonResponse({ conversation, messages: [], latestSequence: 0 }));
    });
  });

  it("keeps the cursor when an empty snapshot reports an older sequence", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }))
      .mockResolvedValueOnce(jsonResponse({
        conversation: { ...conversation, latestSequence: 3 },
        messages: [],
        latestSequence: 3,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.latestSequence).toBe(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/starbao?after=4&limit=100",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("rejects a second turn while the first optimistic turn is in flight", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "single-flight-turn" });
    const firstTurnResponse = deferred<Response>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }))
      .mockReturnValueOnce(firstTurnResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let firstSend!: Promise<unknown>;
    act(() => {
      firstSend = result.current.sendTurn({
        text: "First turn",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      });
    });

    await act(async () => {
      await expect(result.current.sendTurn({
        text: "Second turn",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      })).rejects.toThrow("STARBAO_BUSY");
    });

    expect(result.current.messages.filter((message) => message.messageId.startsWith("pending:"))).toHaveLength(1);
    expect(result.current.isSending).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstTurnResponse.resolve(jsonResponse({ error: "unavailable" }, 503));
      await expect(firstSend).rejects.toThrow("STARBAO_UNAVAILABLE");
    });

    expect(result.current.isSending).toBe(false);
  });

  it("rejects a turn response with malformed message roles", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "malformed-turn" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }))
      .mockResolvedValueOnce(jsonResponse({
        conversation: { ...conversation, latestSequence: 6 },
        userMessage: {
          ...firstMessage,
          messageId: "message-6",
          sequence: 5,
          clientMessageId: "web-malformed-turn",
          role: "assistant",
        },
        assistantMessage: {
          ...secondMessage,
          messageId: "message-7",
          sequence: 6,
          clientMessageId: "web-malformed-turn:assistant",
          replyToMessageId: "message-6",
        },
        latestSequence: 6,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.sendTurn({
        text: "Malformed response",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      })).rejects.toThrow("STARBAO_UNAVAILABLE");
    });

    expect(result.current.messages).toEqual([firstMessage]);
    expect(result.current.error).toBe("STARBAO_UNAVAILABLE");
  });

  it("keeps newer conversation settings when a stale refresh resolves after a PATCH", async () => {
    const staleRefresh = deferred<Response>();
    const updatedConversation = { ...conversation, speakOnOrangePi: true, latestSequence: 5 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }))
      .mockReturnValueOnce(staleRefresh.promise)
      .mockResolvedValueOnce(jsonResponse({ conversation: updatedConversation }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    await act(async () => {
      await result.current.setSpeakOnOrangePi(true);
    });
    expect(result.current.conversation).toEqual(updatedConversation);

    await act(async () => {
      staleRefresh.resolve(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }));
      await refreshPromise;
    });

    expect(result.current.conversation).toEqual(updatedConversation);
  });

  it("keeps a newer speak setting when a stale turn response resolves", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "turn-after-setting" });
    const turnResponse = deferred<Response>();
    const updatedConversation = { ...conversation, speakOnOrangePi: true };
    const canonicalUserMessage = {
      ...firstMessage,
      messageId: "message-5",
      sequence: 5,
      clientMessageId: "web-turn-after-setting",
      content: "Turn after setting",
    };
    const canonicalAssistantMessage = {
      ...secondMessage,
      messageId: "message-6",
      sequence: 6,
      clientMessageId: "web-turn-after-setting:assistant",
      replyToMessageId: "message-5",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }))
      .mockReturnValueOnce(turnResponse.promise)
      .mockResolvedValueOnce(jsonResponse({ conversation: updatedConversation }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendTurn({
        text: "Turn after setting",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      });
    });

    await act(async () => {
      await result.current.setSpeakOnOrangePi(true);
    });
    expect(result.current.conversation?.speakOnOrangePi).toBe(true);

    await act(async () => {
      turnResponse.resolve(jsonResponse({
        conversation: { ...conversation, latestSequence: 6, speakOnOrangePi: false },
        userMessage: canonicalUserMessage,
        assistantMessage: canonicalAssistantMessage,
        latestSequence: 6,
      }));
      await sendPromise;
    });

    expect(result.current.conversation?.speakOnOrangePi).toBe(true);
    expect(result.current.messages).toEqual([firstMessage, canonicalUserMessage, canonicalAssistantMessage]);
  });

  it("applies canonical turn conversation after a normal refresh while it is pending", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "turn-after-refresh" });
    const turnResponse = deferred<Response>();
    const canonicalConversation = { ...conversation, latestSequence: 6 };
    const canonicalUserMessage = {
      ...firstMessage,
      messageId: "message-5",
      sequence: 5,
      clientMessageId: "web-turn-after-refresh",
      content: "Turn after refresh",
    };
    const canonicalAssistantMessage = {
      ...secondMessage,
      messageId: "message-6",
      sequence: 6,
      clientMessageId: "web-turn-after-refresh:assistant",
      replyToMessageId: "message-5",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }))
      .mockReturnValueOnce(turnResponse.promise)
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendTurn({
        text: "Turn after refresh",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      });
    });

    await act(async () => {
      await result.current.refresh();
    });

    await act(async () => {
      turnResponse.resolve(jsonResponse({
        conversation: canonicalConversation,
        userMessage: canonicalUserMessage,
        assistantMessage: canonicalAssistantMessage,
        latestSequence: 6,
      }));
      await sendPromise;
    });

    expect(result.current.conversation).toEqual(canonicalConversation);
    expect(result.current.messages).toEqual([firstMessage, canonicalUserMessage, canonicalAssistantMessage]);
  });

  it("ignores a stale settings PATCH after the hook is disabled and re-enabled", async () => {
    const staleSettings = deferred<Response>();
    const staleConversation = { ...conversation, speakOnOrangePi: true, latestSequence: 5 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }))
      .mockReturnValueOnce(staleSettings.promise)
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSharedStarbaoConversation({ enabled, pollIntervalMs: 60_000 }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let settingsPromise!: Promise<unknown>;
    act(() => {
      settingsPromise = result.current.setSpeakOnOrangePi(true);
    });

    act(() => {
      rerender({ enabled: false });
    });
    act(() => {
      rerender({ enabled: true });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    await act(async () => {
      staleSettings.resolve(jsonResponse({ conversation: staleConversation }));
      await settingsPromise;
    });

    expect(result.current.conversation).toEqual(conversation);
    expect(result.current.error).toBeNull();
  });

  it("keeps the most recently requested setting when PATCHes resolve out of order", async () => {
    const firstSettingsResponse = deferred<Response>();
    const secondSettingsResponse = deferred<Response>();
    const enabledConversation = { ...conversation, speakOnOrangePi: true };
    const disabledConversation = { ...conversation, speakOnOrangePi: false };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }))
      .mockReturnValueOnce(firstSettingsResponse.promise)
      .mockReturnValueOnce(secondSettingsResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let firstSettingsPromise!: Promise<unknown>;
    let secondSettingsPromise!: Promise<unknown>;
    act(() => {
      firstSettingsPromise = result.current.setSpeakOnOrangePi(true);
      secondSettingsPromise = result.current.setSpeakOnOrangePi(false);
    });

    await act(async () => {
      secondSettingsResponse.resolve(jsonResponse({ conversation: disabledConversation }));
      await secondSettingsPromise;
    });
    expect(result.current.conversation?.speakOnOrangePi).toBe(false);

    await act(async () => {
      firstSettingsResponse.resolve(jsonResponse({ conversation: enabledConversation }));
      await firstSettingsPromise;
    });

    expect(result.current.conversation?.speakOnOrangePi).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("retains the conversation and reports an in-session settings PATCH error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversation, messages: [firstMessage], latestSequence: 4 }))
      .mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 60_000 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.setSpeakOnOrangePi(true)).rejects.toThrow("STARBAO_UNAVAILABLE");
    });

    expect(result.current.conversation).toEqual(conversation);
    expect(result.current.error).toBe("STARBAO_UNAVAILABLE");
  });

  it("invalidates an old rejected turn after the hook is disabled and re-enabled", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "old-turn" });
    const oldTurnResponse = deferred<Response>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }))
      .mockReturnValueOnce(oldTurnResponse.promise)
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSharedStarbaoConversation({ enabled, pollIntervalMs: 60_000 }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendTurn({
        text: "Old request",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      });
    });

    expect(result.current.isSending).toBe(true);
    expect(result.current.messages.some((message) => message.messageId === "pending:web-old-turn")).toBe(true);

    act(() => {
      rerender({ enabled: false });
    });
    act(() => {
      rerender({ enabled: true });
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toEqual([firstMessage]);
    expect(result.current.isSending).toBe(false);

    await act(async () => {
      oldTurnResponse.resolve(jsonResponse({ error: "unavailable" }, 503));
      await expect(sendPromise).rejects.toThrow("STARBAO_UNAVAILABLE");
    });

    expect(result.current.messages).toEqual([firstMessage]);
    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps a failing turn active when only the poll interval changes", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "poll-interval-turn" });
    const turnResponse = deferred<Response>();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }))
      .mockReturnValueOnce(turnResponse.promise)
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ pollIntervalMs }: { pollIntervalMs: number }) => (
        useSharedStarbaoConversation({ enabled: true, pollIntervalMs })
      ),
      { initialProps: { pollIntervalMs: 60_000 } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendTurn({
        text: "Poll interval request",
        stage: "lower_primary",
        courseId: "lower-bubble-sort",
      });
    });

    act(() => {
      rerender({ pollIntervalMs: 30_000 });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    await act(async () => {
      turnResponse.resolve(jsonResponse({ error: "unavailable" }, 503));
      await expect(sendPromise).rejects.toThrow("STARBAO_UNAVAILABLE");
    });

    expect(result.current.messages).toEqual([firstMessage]);
    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBe("STARBAO_UNAVAILABLE");
  });

  it("uses the last canonical sequence as the polling cursor", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation,
        messages: [firstMessage],
        latestSequence: 4,
      }))
      .mockResolvedValueOnce(jsonResponse({
        conversation: { ...conversation, latestSequence: 5 },
        messages: [secondMessage],
        latestSequence: 5,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 1_000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.latestSequence).toBe(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/starbao?after=4&limit=100",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result.current.messages).toEqual([firstMessage, secondMessage]);
  });

  it("does not skip a paged history backlog when Core reports a later sequence", async () => {
    vi.useFakeTimers();
    const backlogMessage = { ...firstMessage, sequence: 100, messageId: "message-100" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        conversation: { ...conversation, latestSequence: 250 },
        messages: [backlogMessage],
        latestSequence: 250,
      }))
      .mockResolvedValueOnce(jsonResponse({
        conversation: { ...conversation, latestSequence: 250 },
        messages: [],
        latestSequence: 250,
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSharedStarbaoConversation({ pollIntervalMs: 1_000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.latestSequence).toBe(100);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/starbao?after=100&limit=100",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
