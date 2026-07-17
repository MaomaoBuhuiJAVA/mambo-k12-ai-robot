import { FormEvent, useState } from "react";
import {
  BookOpenText,
  Bot,
  CirclePlay,
  PencilLine,
  Send,
  UserRound,
} from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";

interface ClassroomMessage {
  id: string;
  author: "assistant" | "learner";
  text: string;
}

interface ConversationClassroomProps {
  course: CurriculumCourse;
}

const QUICK_ACTIONS = [
  { label: "讲个故事", icon: BookOpenText },
  { label: "演示一下", icon: CirclePlay },
  { label: "来道练习", icon: PencilLine },
] as const;

function makeQuickReply(course: CurriculumCourse, action: string) {
  if (action === "讲个故事") {
    return `${course.storybook[0].narration} 接下来留意：${course.storybook[0].interaction}`;
  }

  if (action === "演示一下") {
    return `我们从第一步开始：${course.animation.steps[0].narration}`;
  }

  return `先试这一题：${course.exercises[0].prompt}`;
}

function makeLocalReply(course: CurriculumCourse) {
  return `我们继续围绕“${course.title}”来想：${course.explanation.keyIdeas[0]}。先看这个例子：${course.explanation.workedExample}`;
}

export function ConversationClassroom({ course }: ConversationClassroomProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ClassroomMessage[]>(() => [
    {
      id: `${course.id}-welcome`,
      author: "assistant",
      text: `你好，我是 Mambo。今天我们一起学习“${course.title}”。${course.summary}`,
    },
    {
      id: `${course.id}-guide`,
      author: "assistant",
      text: `先抓住一个关键点：${course.explanation.keyIdeas[0]}。你想从哪种方式开始？`,
    },
  ]);

  function appendExchange(prompt: string, reply: string) {
    setMessages((currentMessages) => {
      const nextIndex = currentMessages.length;

      return [
        ...currentMessages,
        {
          id: `${course.id}-learner-${nextIndex}`,
          author: "learner",
          text: prompt,
        },
        {
          id: `${course.id}-assistant-${nextIndex + 1}`,
          author: "assistant",
          text: reply,
        },
      ];
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();

    if (message.length === 0) {
      return;
    }

    appendExchange(message, makeLocalReply(course));
    setDraft("");
  }

  function handleQuickAction(action: string) {
    appendExchange(action, makeQuickReply(course, action));
  }

  return (
    <section
      className="conversation-classroom"
      id="conversation-classroom"
      aria-label="对话课堂"
    >
      <header className="classroom-header">
        <div>
          <span className="classroom-header__label">今日课程</span>
          <h1>{course.title}</h1>
          <p>{course.summary}</p>
        </div>
        <span className="classroom-header__subject" aria-label="课程知识点">
          {course.knowledgePointTags[0]}
        </span>
      </header>

      <div className="message-list" role="log" aria-live="polite">
        {messages.map((message) => {
          const isAssistant = message.author === "assistant";
          const MessageIcon = isAssistant ? Bot : UserRound;

          return (
            <article
              className="message"
              data-author={message.author}
              key={message.id}
            >
              <span className="message__avatar" aria-hidden="true">
                <MessageIcon size={18} />
              </span>
              <div className="message__body">
                <span className="message__author">
                  {isAssistant ? "Mambo" : "我"}
                </span>
                <p>{message.text}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="quick-actions" aria-label="快捷学习方式">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;

          return (
            <button
              type="button"
              key={action.label}
              onClick={() => handleQuickAction(action.label)}
            >
              <Icon size={16} aria-hidden="true" />
              {action.label}
            </button>
          );
        })}
      </div>

      <form className="message-composer" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="classroom-message">
          给 Mambo 发消息
        </label>
        <input
          id="classroom-message"
          aria-label="给 Mambo 发消息"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="写下你的问题..."
          autoComplete="off"
        />
        <button type="submit" aria-label="发送消息">
          <Send size={18} aria-hidden="true" />
          <span className="sr-only">发送消息</span>
        </button>
      </form>
    </section>
  );
}
