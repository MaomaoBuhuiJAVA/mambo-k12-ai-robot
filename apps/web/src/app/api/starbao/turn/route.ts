import { z } from "zod";

import { getCourseById } from "@/data/curriculum";
import { buildCourseFallback } from "@/lib/ai/course-fallback";
import { requestDifyDialogue } from "@/lib/dify/dialogue-client";
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

function toDialogueHistory(messages: StarbaoMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));
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

function gradeForStage(stage: "lower_primary" | "upper_primary" | "middle_school" | "high_school"): number {
  switch (stage) {
    case "lower_primary": return 2;
    case "upper_primary": return 5;
    case "middle_school": return 8;
    case "high_school": return 11;
  }
}

async function collectDifyAnswer(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  const consumeLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    try {
      const payload: unknown = JSON.parse(line.slice(5).trim());
      if (payload && typeof payload === "object" && "text" in payload && typeof payload.text === "string") {
        answer += payload.text;
      }
    } catch {
      // Ignore malformed stream events and use the course fallback when needed.
    }
  };

  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline).replace(/\r$/u, ""));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    const tail = buffer.trim();
    if (tail) consumeLine(tail);
  } finally {
    reader.releaseLock();
  }
  return answer.trim();
}

async function generateDifyReply({
  stage,
  course,
  clientMessageId,
  messages,
  question,
}: {
  stage: "lower_primary" | "upper_primary" | "middle_school" | "high_school";
  course: NonNullable<ReturnType<typeof getCourseById>>;
  clientMessageId: string;
  messages: StarbaoMessage[];
  question: string;
}): Promise<string> {
  const knowledgePointIds = course.knowledgePointTags.map((tag) => `${course.id}:${tag}`).slice(0, 12);
  const traceId = `starbao:${clientMessageId}`;
  const context = {
    schemaVersion: 1,
    traceId,
    anonymousLearnerId: "starbao-homepage",
    stage,
    grade: gradeForStage(stage),
    teachingMode: "storybook",
    activityId: `homepage:${course.id}`,
    courseId: course.id,
    moduleId: null,
    storybookId: null,
    pageNumber: null,
    knowledgePointIds,
    completedActivityIds: [],
    masterySummary: [],
    misconceptionTags: [],
    recentEvidenceSummary: [],
    allowedActionIds: [],
  };
  const result = await requestDifyDialogue({
    context_json: JSON.stringify(context),
    trace_id: traceId,
    anonymous_learner_id: context.anonymousLearnerId,
    stage,
    teaching_mode: "storybook",
    activity_id: context.activityId,
    course_id: course.id,
    course_title: course.title,
    course_overview: course.explanation.overview,
    knowledge_point_ids: JSON.stringify(knowledgePointIds),
    question,
    messages_json: JSON.stringify(toDialogueHistory(messages)),
  }, { allowedSourceIds: [] });
  if (!result.ok) return buildCourseFallback(course);

  const answer = await collectDifyAnswer(result.stream);
  return answer || buildCourseFallback(course);
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

    const answer = await generateDifyReply({
      stage: parsed.data.stage,
      course,
      clientMessageId: parsed.data.clientMessageId,
      messages: historyWithUserMessage(snapshot.messages, userMessage),
      question: parsed.data.text,
    });

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
