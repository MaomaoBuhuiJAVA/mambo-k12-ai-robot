"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BookOpenText, Bot, CirclePlay, PencilLine, Send, Square, UserRound, Volume2, VolumeX } from "lucide-react";
import type { CurriculumCourse } from "@/data/curriculum";
import type { Stage } from "@/lib/domain";
import { MediaInput } from "./media-input";

type Message = { id: string; author: "assistant" | "learner"; text: string; image?: string };
const actions = [{ label: "讲个故事", icon: BookOpenText }, { label: "演示一下", icon: CirclePlay }, { label: "来道练习", icon: PencilLine }];
const fallback = (course: CurriculumCourse) => `我先用课程内容回答。我们继续围绕“${course.title}”来想：${course.explanation.keyIdeas[0]}。${course.explanation.workedExample}`;

export function ConversationClassroom({ course, stage }: { course: CurriculumCourse; stage: Stage }) {
  const [draft, setDraft] = useState(""); const [image, setImage] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [lastQuestion, setLastQuestion] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => [{ id: "welcome", author: "assistant", text: `你好，我是 Mambo。今天我们一起学习“${course.title}”。${course.summary}` }, { id: "guide", author: "assistant", text: `先抓住一个关键点：${course.explanation.keyIdeas[0]}。你想从哪种方式开始？` }]);
  useEffect(() => () => { controllerRef.current?.abort(); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  const append = (message: Message) => setMessages((current) => [...current, message]);
  const speak = (text: string) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "zh-CN"; utterance.rate = stage === "lower_primary" ? .85 : .95; window.speechSynthesis.speak(utterance); };
  const stopSpeaking = () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  async function ask(question: string, attachedImage = image) {
    if (!question.trim() || busy) return;
    const userMessage: Message = { id: crypto.randomUUID(), author: "learner", text: question, ...(attachedImage ? { image: attachedImage } : {}) };
    append(userMessage); setDraft(""); setImage(null); setLastQuestion(question); setBusy(true);
    const assistantId = crypto.randomUUID(); append({ id: assistantId, author: "assistant", text: "" });
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      const history = [...messages, userMessage].slice(-20).map((item) => ({ role: item.author === "learner" ? "user" as const : "assistant" as const, content: item.text || "正在回答", ...(item.image ? { image: item.image } : {}) }));
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, courseId: course.id, messages: history }), signal: controller.signal });
      if (!response.ok || !response.body) throw new Error("unavailable");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let answer = "";
      for (;;) { const { done, value } = await reader.read(); if (done) break; answer += decoder.decode(value, { stream: true }); setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: answer } : item)); }
      if (!answer) throw new Error("empty");
    } catch (error) { if ((error as DOMException).name !== "AbortError") setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: fallback(course) } : item)); }
    finally { setBusy(false); controllerRef.current = null; }
  }
  function submit(event: FormEvent) { event.preventDefault(); void ask(draft); }
  return <section className="conversation-classroom" id="conversation-classroom" aria-label="对话课堂">
    <header className="classroom-header"><div><span className="classroom-header__label">今日课程</span><h1>{course.title}</h1><p>{course.summary}</p></div><span className="classroom-header__subject" aria-label="课程知识点">{course.knowledgePointTags[0]}</span></header>
    <div className="message-list" role="log" aria-live="polite">{messages.map((message) => <article className="message" data-author={message.author} key={message.id}><span className="message__avatar" aria-hidden="true">{message.author === "assistant" ? <Bot size={18} /> : <UserRound size={18} />}</span><div className="message__body"><span className="message__author">{message.author === "assistant" ? "Mambo" : "我"}</span>{message.image && <Image className="message__image" src={message.image} alt="学生发送的图片" width={140} height={120} unoptimized />}<p>{message.text}</p>{message.author === "assistant" && message.text && <span className="message__speech-actions"><button type="button" className="message__speech" aria-label="朗读回答" onClick={() => speak(message.text)}><Volume2 size={15} /></button><button type="button" className="message__speech" aria-label="停止朗读" onClick={stopSpeaking}><VolumeX size={15} /></button></span>}</div></article>)}</div>
    {lastQuestion && !busy && <button type="button" className="retry-answer" onClick={() => void ask(lastQuestion, null)}>重试上一问</button>}
    <div className="quick-actions" aria-label="快捷学习方式">{actions.map(({ label, icon: Icon }) => <button type="button" key={label} onClick={() => void ask(label, null)}><Icon size={16} aria-hidden="true" />{label}</button>)}</div>
    <form className="message-composer" onSubmit={submit}><MediaInput image={image} onImageChange={setImage} onTranscript={setDraft} /><label className="sr-only" htmlFor="classroom-message">给 Mambo 发消息</label><input id="classroom-message" aria-label="给 Mambo 发消息" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="写下你的问题..." autoComplete="off" />{busy ? <button type="button" className="message-composer__stop" aria-label="停止回答" onClick={() => controllerRef.current?.abort()}><Square size={16} /><span>停止回答</span></button> : <button type="submit" aria-label="发送消息"><Send size={18} aria-hidden="true" /></button>}</form>
  </section>;
}
