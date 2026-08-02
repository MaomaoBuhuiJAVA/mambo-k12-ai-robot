"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

const DEFAULT_POLL_INTERVAL_MS = 2_000;

const conversationSchema = z.object({
  conversationId: z.string().min(1).max(128),
  deviceId: z.string().min(3).max(64),
  speakOnOrangePi: z.boolean(),
  latestSequence: z.number().int().nonnegative(),
}).strict();

const messageSchema = z.object({
  messageId: z.string().min(1).max(128),
  conversationId: z.string().min(1).max(128),
  sequence: z.number().int().positive(),
  clientMessageId: z.string().min(1).max(128),
  role: z.enum(["user", "assistant", "system"]),
  origin: z.enum(["web", "orangepi", "asr", "starbao"]),
  content: z.string().min(1).max(20_000),
  replyToMessageId: z.string().min(1).max(128).nullable(),
  announceOnOrangePi: z.boolean(),
  createdAt: z.string().min(1),
}).strict();

const snapshotSchema = z.object({
  conversation: conversationSchema,
  messages: z.array(messageSchema).max(100),
  latestSequence: z.number().int().nonnegative(),
}).strict();

const turnResponseSchema = z.object({
  conversation: conversationSchema,
  userMessage: messageSchema.extend({ role: z.literal("user") }),
  assistantMessage: messageSchema.extend({ role: z.literal("assistant") }),
  latestSequence: z.number().int().nonnegative(),
}).strict();

const settingsResponseSchema = z.object({
  conversation: conversationSchema,
}).strict();

export type SharedStarbaoConversation = z.infer<typeof conversationSchema>;
export type SharedStarbaoMessage = z.infer<typeof messageSchema>;

export type SharedStarbaoTurnInput = {
  text: string;
  stage: "lower_primary" | "upper_primary" | "middle_school" | "high_school";
  courseId: string;
  origin?: "web" | "orangepi" | "asr";
};

export type UseSharedStarbaoConversationOptions = {
  enabled?: boolean;
  pollIntervalMs?: number;
};

function mergeMessages(
  existing: SharedStarbaoMessage[],
  incoming: SharedStarbaoMessage[],
): SharedStarbaoMessage[] {
  const canonicalUserClientMessageIds = new Set(
    incoming
      .filter((message) => message.role === "user")
      .map((message) => message.clientMessageId),
  );
  const byId = new Map(
    existing
      .filter((message) => (
        !message.messageId.startsWith("pending:")
        || !canonicalUserClientMessageIds.has(message.clientMessageId)
      ))
      .map((message) => [message.messageId, message]),
  );
  for (const message of incoming) byId.set(message.messageId, message);
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

function createClientMessageId(): string {
  const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `web-${randomId}`.slice(0, 118);
}

function deliveredCursor(
  currentCursor: number,
  snapshot: z.infer<typeof snapshotSchema>,
): number {
  if (snapshot.messages.length === 0) {
    return currentCursor;
  }
  return Math.max(currentCursor, ...snapshot.messages.map((message) => message.sequence));
}

async function parseResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("STARBAO_UNAVAILABLE");
  }
  const parsed = schema.safeParse(body);
  if (!response.ok || !parsed.success) throw new Error("STARBAO_UNAVAILABLE");
  return parsed.data;
}

export function useSharedStarbaoConversation(
  { enabled = true, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS }: UseSharedStarbaoConversationOptions = {},
) {
  const [conversation, setConversation] = useState<SharedStarbaoConversation | null>(null);
  const [messages, setMessages] = useState<SharedStarbaoMessage[]>([]);
  const [latestSequence, setLatestSequence] = useState(0);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const sessionVersionRef = useRef(0);
  const conversationMutationVersionRef = useRef(0);
  const settingsRequestVersionRef = useRef(0);
  const sendInFlightRef = useRef(false);
  const refreshInFlightRef = useRef<number | null>(null);

  const applyConversation = useCallback((
    nextConversation: SharedStarbaoConversation,
    { isWrite = false }: { isWrite?: boolean } = {},
  ) => {
    setConversation(nextConversation);
    if (isWrite) conversationMutationVersionRef.current += 1;
  }, []);

  const applySnapshot = useCallback((
    snapshot: z.infer<typeof snapshotSchema>,
    {
      updateConversation = true,
      isConversationWrite = false,
    }: { updateConversation?: boolean; isConversationWrite?: boolean } = {},
  ) => {
    latestSequenceRef.current = deliveredCursor(latestSequenceRef.current, snapshot);
    if (updateConversation) applyConversation(snapshot.conversation, { isWrite: isConversationWrite });
    setMessages((current) => mergeMessages(current, snapshot.messages));
    setLatestSequence(latestSequenceRef.current);
  }, [applyConversation]);

  const refresh = useCallback(async ({ reset = false } = {}) => {
    if (!enabled) return;
    const refreshSessionVersion = sessionVersionRef.current;
    const refreshConversationVersion = conversationMutationVersionRef.current;
    if (refreshInFlightRef.current === refreshSessionVersion) return;
    refreshInFlightRef.current = refreshSessionVersion;
    const after = reset ? 0 : latestSequenceRef.current;
    if (reset && mountedRef.current && sessionVersionRef.current === refreshSessionVersion) setIsLoading(true);
    try {
      const response = await fetch(`/api/starbao?after=${after}&limit=100`, { cache: "no-store" });
      const snapshot = await parseResponse(response, snapshotSchema);
      if (!mountedRef.current || sessionVersionRef.current !== refreshSessionVersion) return;
      applySnapshot(snapshot, {
        updateConversation: conversationMutationVersionRef.current === refreshConversationVersion,
      });
      setError(null);
    } catch {
      if (mountedRef.current && sessionVersionRef.current === refreshSessionVersion) {
        setError("STARBAO_UNAVAILABLE");
      }
    } finally {
      if (refreshInFlightRef.current === refreshSessionVersion) {
        refreshInFlightRef.current = null;
      }
      if (reset && mountedRef.current && sessionVersionRef.current === refreshSessionVersion) {
        setIsLoading(false);
      }
    }
  }, [applySnapshot, enabled]);

  const sendTurn = useCallback(async (input: SharedStarbaoTurnInput) => {
    if (!enabled) throw new Error("STARBAO_DISABLED");
    if (sendInFlightRef.current) throw new Error("STARBAO_BUSY");
    const turnSessionVersion = sessionVersionRef.current;
    const turnConversationVersion = conversationMutationVersionRef.current;
    const clientMessageId = createClientMessageId();
    const pendingMessage: SharedStarbaoMessage = {
      messageId: `pending:${clientMessageId}`,
      conversationId: conversation?.conversationId ?? "pending",
      sequence: latestSequenceRef.current + 1,
      clientMessageId,
      role: "user",
      origin: input.origin ?? "web",
      content: input.text,
      replyToMessageId: null,
      announceOnOrangePi: false,
      createdAt: new Date().toISOString(),
    };
    sendInFlightRef.current = true;
    setIsSending(true);
    setError(null);
    setMessages((current) => mergeMessages(current, [pendingMessage]));
    try {
      const response = await fetch("/api/starbao/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          clientMessageId,
          text: input.text,
          stage: input.stage,
          courseId: input.courseId,
          origin: input.origin ?? "web",
        }),
      });
      const turn = await parseResponse(response, turnResponseSchema);
      if (mountedRef.current && sessionVersionRef.current === turnSessionVersion) {
        applySnapshot({
          conversation: turn.conversation,
          messages: [turn.userMessage, turn.assistantMessage],
          latestSequence: turn.latestSequence,
        }, {
          updateConversation: conversationMutationVersionRef.current === turnConversationVersion,
          isConversationWrite: true,
        });
        setError(null);
      }
      return turn;
    } catch (caught) {
      if (mountedRef.current && sessionVersionRef.current === turnSessionVersion) {
        setMessages((current) => current.filter((message) => message.messageId !== pendingMessage.messageId));
        setError("STARBAO_UNAVAILABLE");
      }
      throw caught;
    } finally {
      if (sessionVersionRef.current === turnSessionVersion) {
        sendInFlightRef.current = false;
        if (mountedRef.current) setIsSending(false);
      }
    }
  }, [applySnapshot, conversation?.conversationId, enabled]);

  const setSpeakOnOrangePi = useCallback(async (speakOnOrangePi: boolean) => {
    if (!enabled) throw new Error("STARBAO_DISABLED");
    const settingsSessionVersion = sessionVersionRef.current;
    const settingsRequestVersion = settingsRequestVersionRef.current + 1;
    settingsRequestVersionRef.current = settingsRequestVersion;
    try {
      const response = await fetch("/api/starbao", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ speakOnOrangePi }),
      });
      const result = await parseResponse(response, settingsResponseSchema);
      if (
        mountedRef.current
        && sessionVersionRef.current === settingsSessionVersion
        && settingsRequestVersionRef.current === settingsRequestVersion
      ) {
        applyConversation(result.conversation, { isWrite: true });
        setError(null);
      }
      return result.conversation;
    } catch (caught) {
      if (
        mountedRef.current
        && sessionVersionRef.current === settingsSessionVersion
        && settingsRequestVersionRef.current === settingsRequestVersion
      ) {
        setError("STARBAO_UNAVAILABLE");
      }
      throw caught;
    }
  }, [applyConversation, enabled]);

  useEffect(() => {
    mountedRef.current = enabled;
    if (!enabled) {
      sendInFlightRef.current = false;
      setIsSending(false);
      setMessages((current) => current.filter((message) => !message.messageId.startsWith("pending:")));
      return () => {
        mountedRef.current = false;
        sessionVersionRef.current += 1;
      };
    }

    return () => {
      mountedRef.current = false;
      sessionVersionRef.current += 1;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    void refresh({ reset: true });
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, Math.max(1_000, pollIntervalMs));
    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, pollIntervalMs, refresh]);

  return {
    conversation,
    messages,
    latestSequence,
    isLoading: enabled && isLoading,
    isSending,
    error,
    refresh,
    sendTurn,
    setSpeakOnOrangePi,
  };
}
