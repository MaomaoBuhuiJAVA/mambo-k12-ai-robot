import { BookOpen, ChevronRight, Star } from "lucide-react";

import type { CurriculumCourse } from "@/data/curriculum";
import type { Stage } from "@/lib/domain";

import { STAGE_OPTIONS } from "./stage-switcher";

interface CourseRailProps {
  stage: Stage;
  courses: CurriculumCourse[];
  selectedCourseId: string;
  onCourseSelect: (courseId: string) => void;
}

export function CourseRail({
  stage,
  courses,
  selectedCourseId,
  onCourseSelect,
}: CourseRailProps) {
  const stageLabel =
    STAGE_OPTIONS.find((option) => option.value === stage)?.label ?? "当前学段";

  return (
    <aside className="course-rail" id="course-rail" aria-label="课程路径">
      <div className="panel-heading course-rail__heading">
        <span className="panel-heading__icon" aria-hidden="true">
          <BookOpen size={18} />
        </span>
        <div>
          <h2>学习路径</h2>
          <p>{stageLabel}</p>
        </div>
      </div>

      <ol className="course-list" aria-label={`${stageLabel}课程`}>
        {courses.map((course, index) => {
          const isSelected = course.id === selectedCourseId;

          return (
            <li className="course-list__item" key={course.id}>
              <span className="course-list__step" aria-hidden="true">
                {index + 1}
              </span>
              <button
                className="course-list__button"
                type="button"
                aria-pressed={isSelected}
                onClick={() => onCourseSelect(course.id)}
              >
                <span className="course-list__title-row">
                  <strong>{course.title}</strong>
                  {course.featured ? (
                    <span className="course-list__featured">
                      <Star size={13} fill="currentColor" aria-hidden="true" />
                      今日推荐
                    </span>
                  ) : null}
                </span>
                <span className="course-list__summary">{course.summary}</span>
                <ChevronRight
                  className="course-list__chevron"
                  size={17}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
