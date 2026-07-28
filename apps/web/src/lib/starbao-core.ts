import "server-only";

import { z } from "zod";

import { proxyCore } from "./core-proxy";

const MAX_RESPONSE_BYTES = 256 * 1024;
const CORE_TIMEOUT_MS = 5_000;

const conversationSchema = z.object({
  conversation_id: z.string().min(1).max(128),
  device_id: z.string().min(3).max(64),
  speak_on_orangepi: z.boolean(),
  latest_sequence: z.number().int().nonnegative(),
});

const messageSchema = z.object({
  message_id: z.string().min(1).max(128),
  conversation_id: z.string().min(1).max(128),
  sequence: z.number().int().positive(),
  client_message_id: z.string().min(1).max(128),
  role: z.enum(["user", "assistant", "system"]),
  origin: z.enum(["web", "orangepi", "asr", "starbao"]),
  content: z.string().min(1).max(20_000),
  reply_to_message_id: z.string().min(1).max(128).nullable(),
  announce_on_orangepi: z.boolean(),
  created_at: z.string().datetime({ offset: true }),
});

const messageListSchema = z.object({
  messages: z.array(messageSchema).max(100),
  latest_sequence: z.number().int().nonnegative(),
});

const messageInputSchema = z.object({
  clientMessageId: z.string().min(1).max(128),
  role: z.enum(["user", "assistant", "system"]),
  origin: z.enum(["web", "orangepi", "asr", "starbao"]),
  content: z.string().min(1).max(20_000),
  replyToMessageId: z.string().min(1).max(128).optional(),
  announceOnOrangePi: z.boolean().optional(),
});

export type StarbaoConversation = z.infer<typeof conversationSchema>;
export type StarbaoMessage = z.infer<typeof messageSchema>;
export type StarbaoMessageInput = z.infer<typeof messageInputSchema>;

export type StarbaoSnapshot = {
  conversation: StarbaoConversation;
  messages: StarbaoMessage[];
  latestSequence: number;
};

export class StarbaoCoreError extends Error {
  constructor(
    public readonly code: "STARBAO_NOT_CONFIGURED" | "STARBAO_UNAVAILABLE" | "STARBAO_INVALID_RESPONSE",
  ) {
    super(code);
    this.name = "StarbaoCoreError";
  }
}

function configuredDeviceId(): string {
  const deviceId = process.env.CORE_DEVICE_ID?.trim();
  if (!deviceId || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(deviceId)) {
    throw new StarbaoCoreError("STARBAO_NOT_CONFIGURED");
  }
  return deviceId;
}

async function parseCoreJson(response: Response): Promise<unknown> {
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    await response.body?.cancel();
    throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  }
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_RESPONSE_BYTES) {
    throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  }
}

async function requestCore(path: string, init: RequestInit): Promise<unknown> {
  let response: Response | null;
  try {
    response = await proxyCore(path, init, {
      timeoutMs: CORE_TIMEOUT_MS,
      maxResponseBytes: MAX_RESPONSE_BYTES,
    });
  } catch {
    throw new StarbaoCoreError("STARBAO_UNAVAILABLE");
  }

  if (!response) throw new StarbaoCoreError("STARBAO_NOT_CONFIGURED");
  if (!response.ok) {
    await response.body?.cancel();
    throw new StarbaoCoreError("STARBAO_UNAVAILABLE");
  }
  return parseCoreJson(response);
}

function conversationPath(deviceId: string): string {
  return `/api/v1/starbao/conversations/${encodeURIComponent(deviceId)}`;
}

export async function getStarbaoConversation(): Promise<StarbaoConversation> {
  const response = await requestCore(conversationPath(configuredDeviceId()), { method: "GET" });
  const parsed = conversationSchema.safeParse(response);
  if (!parsed.success) throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  return parsed.data;
}

export async function getStarbaoMessages(
  { after = 0, limit = 100 }: { after?: number; limit?: number } = {},
): Promise<{ messages: StarbaoMessage[]; latestSequence: number }> {
  if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  }
  const deviceId = configuredDeviceId();
  const query = new URLSearchParams({ after: String(after), limit: String(limit) });
  const response = await requestCore(`${conversationPath(deviceId)}/messages?${query.toString()}`, { method: "GET" });
  const parsed = messageListSchema.safeParse(response);
  if (!parsed.success) throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  return { messages: parsed.data.messages, latestSequence: parsed.data.latest_sequence };
}

export async function getStarbaoSnapshot(
  options: { after?: number; limit?: number } = {},
): Promise<StarbaoSnapshot> {
  const [conversation, messageList] = await Promise.all([
    getStarbaoConversation(),
    getStarbaoMessages(options),
  ]);
  return {
    conversation,
    messages: messageList.messages,
    latestSequence: messageList.latestSequence,
  };
}

export async function updateStarbaoSpeakerSetting(speakOnOrangePi: boolean): Promise<StarbaoConversation> {
  const response = await requestCore(`${conversationPath(configuredDeviceId())}/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ speak_on_orangepi: speakOnOrangePi }),
  });
  const parsed = conversationSchema.safeParse(response);
  if (!parsed.success) throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  return parsed.data;
}

export async function appendStarbaoMessage(input: StarbaoMessageInput): Promise<StarbaoMessage> {
  const parsedInput = messageInputSchema.safeParse(input);
  if (!parsedInput.success) throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  const response = await requestCore(`${conversationPath(configuredDeviceId())}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_message_id: parsedInput.data.clientMessageId,
      role: parsedInput.data.role,
      origin: parsedInput.data.origin,
      content: parsedInput.data.content,
      reply_to_message_id: parsedInput.data.replyToMessageId,
      announce_on_orangepi: parsedInput.data.announceOnOrangePi ?? false,
    }),
  });
  const parsed = messageSchema.safeParse(response);
  if (!parsed.success) throw new StarbaoCoreError("STARBAO_INVALID_RESPONSE");
  return parsed.data;
}
