import { useRef, useState, type KeyboardEvent } from "react";
import {
  BookOpenCheck,
  Boxes,
  CirclePlay,
  Lightbulb,
  PackageOpen,
  Target,
} from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";
import { ResourceLibrary } from "@/features/courses/resource-library";
import { BubbleSortAnimation } from "@/features/animation/bubble-sort-animation";
import { NeuralNetworkAnimation } from "@/features/animation/neural-network-animation";
import { StorybookPlayer } from "@/features/storybook/storybook-player";
import { QuizPlayer } from "@/features/quiz/quiz-player";

type CanvasTab = "course" | "animation" | "storybook" | "resources" | "exercise";

const TABS: ReadonlyArray<{ value: CanvasTab; label: string }> = [
  { value: "course", label: "课程" },
  { value: "animation", label: "动画" },
  { value: "storybook", label: "绘本" },
  { value: "resources", label: "资源" },
  { value: "exercise", label: "练习" },
];

export function TeachingCanvas({ course }: { course: CurriculumCourse }) {
  const [activeTab, setActiveTab] = useState<CanvasTab>("course");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function activateTab(index: number) {
    const normalized = (index + TABS.length) % TABS.length;
    setActiveTab(TABS[normalized].value);
    tabRefs.current[normalized]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activateTab(nextIndex);
  }

  return (
    <aside className="teaching-canvas" id="teaching-canvas" aria-label="教学画布">
      <header className="teaching-canvas__header">
        <div className="panel-heading">
          <span className="panel-heading__icon" aria-hidden="true">
            <BookOpenCheck size={18} />
          </span>
          <div>
            <h2>教学画布</h2>
            <p>{course.title}</p>
          </div>
        </div>

        <div className="canvas-tabs" role="tablist" aria-label="教学内容">
          {TABS.map((tab, index) => (
            <button
              id={`canvas-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              aria-controls={`canvas-panel-${tab.value}`}
              tabIndex={activeTab === tab.value ? 0 : -1}
              ref={(node) => { tabRefs.current[index] = node; }}
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {TABS.map((tab) => (
        <div
          className="canvas-panel"
          id={`canvas-panel-${tab.value}`}
          role="tabpanel"
          aria-labelledby={`canvas-tab-${tab.value}`}
          hidden={activeTab !== tab.value}
          key={tab.value}
        >
          {activeTab === tab.value ? <CanvasContent tab={tab.value} course={course} /> : null}
        </div>
      ))}
    </aside>
  );
}

function CanvasContent({ tab, course }: { tab: CanvasTab; course: CurriculumCourse }) {
  if (tab === "course") return <CourseView course={course} />;
  if (tab === "animation") return <AnimationView course={course} />;
  if (tab === "storybook") return <StorybookPlayer course={course} />;
  if (tab === "resources") return <ResourceLibrary course={course} />;
  return <QuizPlayer course={course} />;
}

function CourseView({ course }: { course: CurriculumCourse }) {
  return (
    <div className="course-view">
      <CanvasSection title="学习目标" icon={Target} tone="teal">
        <ul className="content-list">
          {course.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </CanvasSection>

      <CanvasSection title="核心讲解" icon={Lightbulb} tone="yellow">
        <p className="canvas-section__overview">{course.explanation.overview}</p>
        <ul className="key-idea-list">
          {course.explanation.keyIdeas.map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>
      </CanvasSection>

      <CanvasSection title="课堂材料" icon={PackageOpen} tone="coral">
        <ul className="material-list">
          {course.materials.map((material) => (
            <li key={material.name}>
              <Boxes size={15} aria-hidden="true" />
              <span>{material.name}</span>
            </li>
          ))}
        </ul>
      </CanvasSection>
    </div>
  );
}

function AnimationView({ course }: { course: CurriculumCourse }) {
  if (/bubble|sort/i.test(`${course.id} ${course.animation.template}`)) {
    return <BubbleSortAnimation stage={course.stage} />;
  }
  if (/neural|classif|feature|picture-label/i.test(`${course.id} ${course.animation.template}`)) {
    return <NeuralNetworkAnimation stage={course.stage} />;
  }

  return (
    <div className="animation-view">
      <div className="animation-view__title">
        <CirclePlay size={20} aria-hidden="true" />
        <div>
          <h3>演示轨迹</h3>
          <p>{course.animation.template}</p>
        </div>
      </div>
      <ol className="animation-steps">
        {course.animation.steps.map((step, index) => (
          <li key={step.id}>
            <span aria-hidden="true">{index + 1}</span>
            <p>{step.narration}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface CanvasSectionProps {
  title: string;
  icon: typeof Target;
  tone: "teal" | "yellow" | "coral";
  children: React.ReactNode;
}

function CanvasSection({
  title,
  icon: Icon,
  tone,
  children,
}: CanvasSectionProps) {
  return (
    <section className="canvas-section" data-tone={tone}>
      <h3>
        <Icon size={17} aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}
