import type { CourseExercise } from "@/data/curriculum";
import type { Stage } from "@/lib/domain";

export interface GradeResult {
  correct: boolean;
  score: number;
  feedback: string;
  knowledgePointIds: string[];
  nextAction: "next" | "retry";
}

const STAGE_FEEDBACK: Record<Stage, { correct: string; incorrect: string }> = {
  lower_primary: {
    correct: "小侦探找到了关键线索。",
    incorrect: "小侦探先慢慢看一个动作，再试一次。",
  },
  upper_primary: {
    correct: "你正确运用了这条规则。",
    incorrect: "回到题目中的规则，逐步检查后再试一次。",
  },
  middle_school: {
    correct: "你的判断和执行依据一致。",
    incorrect: "请写出每一步的依据，再定位出现偏差的位置。",
  },
  high_school: {
    correct: "结论与条件、边界和执行结果一致。",
    incorrect: "重新核对输入条件、执行边界与可复核证据。",
  },
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : null;
}

function isCorrect(exercise: CourseExercise, submitted: unknown): boolean {
  if (exercise.type === "order") {
    if (!Array.isArray(submitted) || submitted.length !== exercise.answer.length) return false;
    const normalized = submitted.map(normalizeText);
    if (normalized.some((item) => item === null)) return false;
    if (new Set(normalized).size !== normalized.length) return false;
    return normalized.every((item, index) => item === normalizeText(exercise.answer[index]));
  }

  const normalized = normalizeText(submitted);
  return normalized !== null && normalized === normalizeText(exercise.answer);
}

export function gradeExercise(
  exercise: CourseExercise,
  submitted: unknown,
  stage: Stage,
): GradeResult {
  const correct = isCorrect(exercise, submitted);
  const ageFeedback = STAGE_FEEDBACK[stage][correct ? "correct" : "incorrect"];
  const courseFeedback = exercise.feedback[correct ? "correct" : "incorrect"];

  return {
    correct,
    score: correct ? 1 : 0,
    feedback: `${courseFeedback} ${ageFeedback}`,
    knowledgePointIds: [...exercise.knowledgePointTags],
    nextAction: correct ? "next" : "retry",
  };
}
