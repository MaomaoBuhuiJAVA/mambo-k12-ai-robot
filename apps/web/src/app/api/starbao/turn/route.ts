import { generateText, type ModelMessage } from "ai";
import { z } from "zod";

import { getCourseById } from "@/data/curriculum";
import { buildCourseFallback } from "@/lib/ai/course-fallback";
import { getChatModel } from "@/lib/ai/provider";
import { buildSystemPrompt, getChatMaxOutputTokens } from "@/lib/ai/prompt";
import {
  appendStarbaoMessage,
  getStarbaoSnapshot,
  type StarbaoConversation,
  type StarbaoMessage,
  StarbaoCoreError,
} from "@/lib/starbao-core";
import {
  appendLocalStarbaoMessage,
  getLocalStarbaoSnapshot,
  isLocalStarbaoChatEnabled,
} from "@/lib/local-starbao-chat";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_HISTORY_MESSAGES = 20;
const DEEPSEEK_NON_THINKING_MODE = { deepseek: { thinking: { type: "disabled" as const } } };

const turnRequestSchema = z.object({
  clientMessageId: z.string().trim().min(1).max(118),
  text: z.string().trim().min(1).max(4_000),
  stage: z.enum(["lower_primary", "upper_primary", "middle_school", "high_school"]),
  courseId: z.string().trim().min(1).max(128),
  origin: z.enum(["web", "orangepi", "asr"]).default("web"),
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

function assistantClientMessageId(clientMessageId: string): string {
  return `${clientMessageId}:assistant`;
}

function toModelHistory(messages: StarbaoMessage[]): ModelMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content }));
}

function historyWithUserMessage(messages: StarbaoMessage[], userMessage: StarbaoMessage): StarbaoMessage[] {
  const containsUserMessage = messages.some((message) => (
    message.message_id === userMessage.message_id
    || message.client_message_id === userMessage.client_message_id
  ));
  return containsUserMessage ? messages : [...messages, userMessage];
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
    return Response.json({ error: "INVALID_STARBAO_TURN" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const parsed = turnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_STARBAO_TURN" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const course = getCourseById(parsed.data.courseId);
  if (!course || course.stage !== parsed.data.stage) {
    return Response.json({ error: "INVALID_STARBAO_TURN" }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    return Response.json({ error: "AI_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  try {
    const useLocalChat = isLocalStarbaoChatEnabled();
    const [snapshot, userMessage] = await Promise.all([
      useLocalChat
        ? getLocalStarbaoSnapshot({ after: 0, limit: 100 })
        : getStarbaoSnapshot({ after: 0, limit: 100 }),
      (useLocalChat ? appendLocalStarbaoMessage : appendStarbaoMessage)({
        clientMessageId: parsed.data.clientMessageId,
        role: "user",
        origin: parsed.data.origin,
        content: parsed.data.text,
        announceOnOrangePi: false,
      }),
    ]);
    const assistantClientId = assistantClientMessageId(parsed.data.clientMessageId);
    const existingAssistant = snapshot.messages.find((message) => message.client_message_id === assistantClientId);
    if (existingAssistant) {
      return Response.json({
        conversation: toPublicConversation(snapshot.conversation),
        userMessage: toPublicMessage(userMessage),
        assistantMessage: toPublicMessage(existingAssistant),
        latestSequence: Math.max(snapshot.latestSequence, userMessage.sequence, existingAssistant.sequence),
      }, { headers: NO_STORE_HEADERS });
    }

    let answer: string;
    try {
      const result = await generateText({
        model: getChatModel(),
        instructions: buildSystemPrompt({ stage: parsed.data.stage, course }),
        messages: toModelHistory(historyWithUserMessage(snapshot.messages, userMessage)),
        maxOutputTokens: getChatMaxOutputTokens(parsed.data.stage),
        maxRetries: 0,
        providerOptions: DEEPSEEK_NON_THINKING_MODE,
        timeout: 45_000,
      });
      answer = result.text.trim().slice(0, 20_000) || buildCourseFallback(course);
    } catch {
      answer = buildCourseFallback(course);
    }

    const assistantMessage = await (useLocalChat ? appendLocalStarbaoMessage : appendStarbaoMessage)({
      clientMessageId: assistantClientId,
      role: "assistant",
      origin: "starbao",
      content: answer,
      replyToMessageId: userMessage.message_id,
      announceOnOrangePi: snapshot.conversation.speak_on_orangepi || parsed.data.origin !== "web",
    });

    return Response.json({
      conversation: toPublicConversation(snapshot.conversation),
      userMessage: toPublicMessage(userMessage),
      assistantMessage: toPublicMessage(assistantMessage),
      latestSequence: Math.max(snapshot.latestSequence, userMessage.sequence, assistantMessage.sequence),
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
