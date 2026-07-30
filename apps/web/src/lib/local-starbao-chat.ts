import "server-only";

import type {
  StarbaoConversation,
  StarbaoMessage,
  StarbaoMessageInput,
  StarbaoSnapshot,
} from "./starbao-core";

const LOCAL_CONVERSATION_ID = "local-web-preview";
const LOCAL_DEVICE_ID = "local-browser";

let conversation: StarbaoConversation | undefined;
let messages: StarbaoMessage[] = [];

function createConversation(): StarbaoConversation {
  return {
    conversation_id: LOCAL_CONVERSATION_ID,
    device_id: LOCAL_DEVICE_ID,
    speak_on_orangepi: false,
    latest_sequence: 0,
  };
}

function currentConversation(): StarbaoConversation {
  if (!conversation) conversation = createConversation();
  return conversation;
}

function copyConversation(value: StarbaoConversation): StarbaoConversation {
  return { ...value };
}

function copyMessage(value: StarbaoMessage): StarbaoMessage {
  return { ...value };
}

export function isLocalStarbaoChatEnabled(): boolean {
  return process.env.LOCAL_AI_CHAT === "true" && process.env.NODE_ENV !== "production";
}

export async function getLocalStarbaoSnapshot(
  { after = 0, limit = 100 }: { after?: number; limit?: number } = {},
): Promise<StarbaoSnapshot> {
  if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Invalid local Starbao snapshot query");
  }
  const current = currentConversation();
  return {
    conversation: copyConversation(current),
    messages: messages.filter((message) => message.sequence > after).slice(0, limit).map(copyMessage),
    latestSequence: current.latest_sequence,
  };
}

export async function updateLocalStarbaoSpeakerSetting(speakOnOrangePi: boolean): Promise<StarbaoConversation> {
  conversation = { ...currentConversation(), speak_on_orangepi: speakOnOrangePi };
  return copyConversation(conversation);
}

export async function appendLocalStarbaoMessage(input: StarbaoMessageInput): Promise<StarbaoMessage> {
  const existing = messages.find((message) => message.client_message_id === input.clientMessageId);
  if (existing) return copyMessage(existing);

  const current = currentConversation();
  const sequence = current.latest_sequence + 1;
  const message: StarbaoMessage = {
    message_id: `local-message-${sequence}-${crypto.randomUUID()}`,
    conversation_id: current.conversation_id,
    sequence,
    client_message_id: input.clientMessageId,
    role: input.role,
    origin: input.origin,
    content: input.content,
    reply_to_message_id: input.replyToMessageId ?? null,
    announce_on_orangepi: input.announceOnOrangePi ?? false,
    created_at: new Date().toISOString(),
  };
  messages = [...messages, message];
  conversation = { ...current, latest_sequence: sequence };
  return copyMessage(message);
}

export function resetLocalStarbaoChatForTests(): void {
  conversation = undefined;
  messages = [];
}