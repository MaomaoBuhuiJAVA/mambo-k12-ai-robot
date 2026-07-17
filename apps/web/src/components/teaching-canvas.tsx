import { useState } from "react";
import {
  BookOpenCheck,
  Boxes,
  CirclePlay,
  Dumbbell,
  Lightbulb,
  PackageOpen,
  Target,
} from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";

type CanvasTab = "course" | "animation" | "exercise";

const TABS: ReadonlyArray<{ value: CanvasTab; label: string }> = [
  { value: "course", label: "课程" },
  { value: "animation", label: "动画" },
  { value: "exercise", label: "练习" },
];

export function TeachingCanvas({ course }: { course: CurriculumCourse }) {
  const [activeTab, setActiveTab] = useState<CanvasTab>("course");

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
          {TABS.map((tab) => (
            <button
              id={`canvas-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              aria-controls={`canvas-panel-${tab.value}`}
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div
        className="canvas-panel"
        id={`canvas-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`canvas-tab-${activeTab}`}
      >
        {activeTab === "course" ? <CourseView course={course} /> : null}
        {activeTab === "animation" ? <AnimationView course={course} /> : null}
        {activeTab === "exercise" ? <ExerciseView course={course} /> : null}
      </div>
    </aside>
  );
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

function ExerciseView({ course }: { course: CurriculumCourse }) {
  return (
    <div className="exercise-view">
      <div className="exercise-view__title">
        <Dumbbell size={20} aria-hidden="true" />
        <div>
          <h3>课堂练习</h3>
          <p>按顺序完成三个小任务</p>
        </div>
      </div>
      <ol className="exercise-list">
        {course.exercises.map((exercise, index) => (
          <li key={exercise.id}>
            <span className="exercise-list__number">{index + 1}</span>
            <div>
              <span className="exercise-list__type">
                {exercise.type === "single_choice"
                  ? "选择"
                  : exercise.type === "order"
                    ? "排序"
                    : "追踪"}
              </span>
              <p>{exercise.prompt}</p>
            </div>
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
