import { z } from "zod";

import {
  getStarbaoSnapshot,
  type StarbaoConversation,
  type StarbaoMessage,
  StarbaoCoreError,
  updateStarbaoSpeakerSetting,
} from "@/lib/starbao-core";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const querySchema = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

const settingsSchema = z.object({
  speakOnOrangePi: z.boolean(),
}).strict();

function toPublicConversation(conversation: StarbaoConversation) {
  return {
    conversationId: conversation.conversation_id,
    deviceId: conversation.device_id,
    speakOnOrangePi: conversation.speak_on_orangepi,
    latestSequence: conversation.latest_sequence,
  };
}

function toPublicMessage(message: StarbaoMessage) {
  return {
    messageId: message.message_id,
    conversationId: message.conversation_id,
    sequence: message.sequence,
    clientMessageId: message.client_message_id,
    role: message.role,
    origin: message.origin,
    content: message.content,
    replyToMessageId: message.reply_to_message_id,
    announceOnOrangePi: message.announce_on_orangepi,
    createdAt: message.created_at,
  };
}

function errorResponse(error: unknown): Response {
  if (error instanceof StarbaoCoreError && error.code === "STARBAO_NOT_CONFIGURED") {
    return Response.json({ error: "STARBAO_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE_HEADERS });
  }
  return Response.json({ error: "STARBAO_UNAVAILABLE" }, { status: 503, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    after: url.searchParams.get("after") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "INVALID_STARBAO_QUERY" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const snapshot = await getStarbaoSnapshot(parsed.data);
    return Response.json({
      conversation: toPublicConversation(snapshot.conversation),
      messages: snapshot.messages.map(toPublicMessage),
      latestSequence: snapshot.latestSequence,
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_STARBAO_SETTINGS" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_STARBAO_SETTINGS" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const conversation = await updateStarbaoSpeakerSetting(parsed.data.speakOnOrangePi);
    return Response.json({ conversation: toPublicConversation(conversation) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
