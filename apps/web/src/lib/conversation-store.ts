export type StoredConversationMessage = {
  id: string;
  author: "assistant" | "learner";
  text: string;
};

type ConversationMessageCandidate = StoredConversationMessage & {
  image?: string;
  seeded?: true;
};

type ConversationStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_PREFIX = "mambo.conversation.v1";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOTAL_CHARS = 20_000;
const MAX_ID_CHARS = 128;

export function conversationStorageKey(courseId: string): string {
  return `${STORAGE_PREFIX}.${encodeURIComponent(courseId.slice(0, 160))}`;
}

function browserStorage(): ConversationStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeMessages(value: unknown): StoredConversationMessage[] {
  if (!Array.isArray(value)) return [];

  const alternating: StoredConversationMessage[] = [];
  let expectedAuthor: StoredConversationMessage["author"] = "learner";
  for (const item of value.slice(-MAX_MESSAGES * 4)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Record<string, unknown>;
    if (
      candidate.seeded === true
      || candidate.author !== expectedAuthor
      || typeof candidate.id !== "string"
      || candidate.id.length === 0
      || candidate.id.length > MAX_ID_CHARS
      || typeof candidate.text !== "string"
      || candidate.text.trim().length === 0
    ) continue;

    alternating.push({
      id: candidate.id,
      author: expectedAuthor,
      text: candidate.text.slice(0, MAX_MESSAGE_CHARS),
    });
    expectedAuthor = expectedAuthor === "learner" ? "assistant" : "learner";
  }

  if (alternating.at(-1)?.author === "learner") alternating.pop();

  const completePairs: StoredConversationMessage[][] = [];
  for (let index = 0; index + 1 < alternating.length; index += 2) {
    completePairs.push([alternating[index], alternating[index + 1]]);
  }

  const selected: StoredConversationMessage[][] = [];
  let totalChars = 0;
  for (const pair of completePairs.slice(-MAX_MESSAGES / 2).reverse()) {
    const pairChars = pair[0].text.length + pair[1].text.length;
    if (totalChars + pairChars > MAX_TOTAL_CHARS) break;
    selected.unshift(pair);
    totalChars += pairChars;
  }
  return selected.flat();
}

export function loadConversation(
  courseId: string,
  storage: ConversationStorage | null = browserStorage(),
): StoredConversationMessage[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(conversationStorageKey(courseId));
    return raw ? normalizeMessages(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

export function saveConversation(
  courseId: string,
  messages: ConversationMessageCandidate[],
  storage: ConversationStorage | null = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      conversationStorageKey(courseId),
      JSON.stringify(normalizeMessages(messages)),
    );
    return true;
  } catch {
    return false;
  }
}
