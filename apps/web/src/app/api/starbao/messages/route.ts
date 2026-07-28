import { z } from "zod";

import {
  appendStarbaoMessage,
  type StarbaoMessage,
  StarbaoCoreError,
} from "@/lib/starbao-core";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const browserMessageSchema = z.object({
  clientMessageId: z.string().min(1).max(128),
  role: z.literal("user").optional(),
  origin: z.enum(["web", "orangepi", "asr"]).default("web"),
  content: z.string().trim().min(1).max(20_000),
}).strict();

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

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "INVALID_STARBAO_MESSAGE" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const parsed = browserMessageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_STARBAO_MESSAGE" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const message = await appendStarbaoMessage({
      clientMessageId: parsed.data.clientMessageId,
      role: "user",
      origin: parsed.data.origin,
      content: parsed.data.content,
      announceOnOrangePi: false,
    });
    return Response.json({ message: toPublicMessage(message) }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
