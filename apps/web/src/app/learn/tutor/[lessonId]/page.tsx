import { notFound, redirect } from "next/navigation";
import { resolveLearningRoute } from "@/data/learning-route";
import { getCourseLesson, getStructuredCourse } from "@/data/course-structure";
import { TutorTheater } from "@/features/ai-tutor/tutor-theater";

interface TutorPageProps {
  params: Promise<{ lessonId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TutorPage({ params, searchParams }: TutorPageProps) {
  const [{ lessonId: rawLessonId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  let lessonId = rawLessonId;
  try { lessonId = decodeURIComponent(rawLessonId); } catch { /* The lookup below safely rejects malformed input. */ }
  const route = resolveLearningRoute({
    page: "tutor",
    stage: firstParam(query.stage),
    grade: firstParam(query.grade),
    lessonId,
    activityId: firstParam(query.activity),
    templateId: firstParam(query.template),
    mode: firstParam(query.mode),
  });
  if (route.kind === "redirect") redirect(route.canonicalPath);
  const lesson = getCourseLesson(route.lessonId ?? lessonId);
  const course = lesson ? getStructuredCourse(lesson.courseId) : undefined;
  if (!lesson || !course) notFound();
  return <TutorTheater course={course.course} lesson={lesson} enableDify />;
}
