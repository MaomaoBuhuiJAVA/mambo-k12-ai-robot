import type { ReadonlyCurriculumCourse } from "@/data/curriculum";
import { getKnowledgeContextForCourse } from "@/data/knowledge-sources";

export function buildCourseFallback(course: ReadonlyCurriculumCourse): string {
  const knowledge = getKnowledgeContextForCourse(course.id);
  const verifiedFact = knowledge?.facts[0]?.statement;
  const lessonFact = verifiedFact ?? `${course.explanation.keyIdeas[0]}。${course.explanation.workedExample}`;
  const citation = verifiedFact && knowledge?.sources.length ? " [S1]" : "";
  return `AI 服务暂时不可用，我先根据本课内容回答：${lessonFact}${citation} 你可以稍后重试上一问。`;
}
