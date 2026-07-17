"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  Bot,
  CirclePlay,
  PencilLine,
  Send,
  Square,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";
import type { Stage } from "@/lib/domain";

import { MediaInput } from "./media-input";

type Author = "assistant" | "learner";
type Message = {
  id: string;
  author: Author;
  text: string;
  image?: string;
  seeded?: true;
};

const actions = [
  { label: "讲个故事", icon: BookOpenText },
  { label: "演示一下", icon: CirclePlay },
  { label: "来道练习", icon: PencilLine },
];

const fallback = (course: CurriculumCourse) =>
  `我先用课程内容回答。我们继续围绕“${course.title}”来想：${course.explanation.keyIdeas[0]}。${course.explanation.workedExample}`;

function createWelcomeMessages(course: CurriculumCourse): Message[] {
  return [
    {
      id: "welcome",
      author: "assistant",
      seeded: true,
      text: `你好，我是 Mambo。今天我们一起学习“${course.title}”。${course.summary}`,
    },
    {
      id: "guide",
      author: "assistant",
      seeded: true,
      text: `先抓住一个关键点：${course.explanation.keyIdeas[0]}。你想从哪种方式开始？`,
    },
  ];
}

function buildChatHistory(messages: Message[], current: Message) {
  const completedTurns: Array<{ role: "user" | "assistant"; content: string }> = [];
  let expectedRole: "user" | "assistant" = "user";

  for (const message of messages) {
    if (message.seeded || !message.text.trim()) continue;

    const role = message.author === "learner" ? "user" : "assistant";
    if (role !== expectedRole) continue;
    completedTurns.push({ role, content: message.text });
    expectedRole = expectedRole === "user" ? "assistant" : "user";
  }

  if (completedTurns.at(-1)?.role === "user") completedTurns.pop();

  return [
    ...completedTurns.slice(-18),
    {
      role: "user" as const,
      content: current.text,
      ...(current.image ? { image: current.image } : {}),
    },
  ];
}

function MessageItem({ message, onSpeak, onStopSpeaking }: {
  message: Message;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
}) {
  const isAssistant = message.author === "assistant";

  return (
    <article className="message" data-author={message.author}>
      <span className="message__avatar" aria-hidden="true">
        {isAssistant ? <Bot size={18} /> : <UserRound size={18} />}
      </span>
      <div className="message__body">
        <span className="message__author">{isAssistant ? "Mambo" : "我"}</span>
        {message.image && (
          <Image className="message__image" src={message.image} alt="学生发送的图片" width={140} height={120} unoptimized />
        )}
        <p>{message.text}</p>
        {isAssistant && message.text && (
          <span className="message__speech-actions">
            <button type="button" className="message__speech" aria-label="朗读回答" onClick={() => onSpeak(message.text)}>
              <Volume2 size={15} />
            </button>
            <button type="button" className="message__speech" aria-label="停止朗读" onClick={onStopSpeaking}>
              <VolumeX size={15} />
            </button>
          </span>
        )}
      </div>
    </article>
  );
}

export function ConversationClassroom({ course, stage }: { course: CurriculumCourse; stage: Stage }) {
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => createWelcomeMessages(course));
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    controllerRef.current?.abort();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = stage === "lower_primary" ? 0.85 : 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  async function ask(question: string, attachedImage = image) {
    if (!question.trim() || busy) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      author: "learner",
      text: question,
      ...(attachedImage ? { image: attachedImage } : {}),
    };
    const assistantId = crypto.randomUUID();
    const history = buildChatHistory(messages, userMessage);
    const controller = new AbortController();

    setMessages((current) => [...current, userMessage, { id: assistantId, author: "assistant", text: "" }]);
    setDraft("");
    setImage(null);
    setLastQuestion(question);
    setBusy(true);
    controllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, courseId: course.id, messages: history }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("unavailable");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: answer } : item));
      }
      answer += decoder.decode();
      if (!answer) throw new Error("empty");
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: answer } : item));
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        setMessages((current) => current.filter((item) => item.id !== assistantId || Boolean(item.text)));
      } else {
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: fallback(course) } : item));
      }
    } finally {
      setBusy(false);
      controllerRef.current = null;
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section className="conversation-classroom" id="conversation-classroom" aria-label="对话课堂">
      <header className="classroom-header">
        <div>
          <span className="classroom-header__label">今日课程</span>
          <h1>{course.title}</h1>
          <p>{course.summary}</p>
        </div>
        <span className="classroom-header__subject" aria-label="课程知识点">{course.knowledgePointTags[0]}</span>
      </header>

      <div className="message-list" role="log" aria-live="polite">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} onSpeak={speak} onStopSpeaking={stopSpeaking} />
        ))}
      </div>

      {lastQuestion && !busy && (
        <button type="button" className="retry-answer" onClick={() => void ask(lastQuestion, null)}>重试上一问</button>
      )}
      <div className="quick-actions" aria-label="快捷学习方式">
        {actions.map(({ label, icon: Icon }) => (
          <button type="button" key={label} onClick={() => void ask(label, null)}>
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </div>

      <form className="message-composer" onSubmit={submit}>
        <MediaInput image={image} onImageChange={setImage} onTranscript={setDraft} />
        <label className="sr-only" htmlFor="classroom-message">给 Mambo 发消息</label>
        <input id="classroom-message" aria-label="给 Mambo 发消息" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="写下你的问题..." autoComplete="off" />
        {busy ? (
          <button type="button" className="message-composer__stop" aria-label="停止回答" onClick={() => controllerRef.current?.abort()}>
            <Square size={16} /><span>停止回答</span>
          </button>
        ) : (
          <button type="submit" aria-label="发送消息"><Send size={18} aria-hidden="true" /></button>
        )}
      </form>
    </section>
  );
}
