import { describe, expect, it } from "vitest";

import { getCourseById } from "@/data/curriculum";

import { buildCourseFallback } from "./course-fallback";

describe("buildCourseFallback", () => {
  it("uses a verified fact and source marker for grounded courses", () => {
    const course = getCourseById("lower-bubble-sort")!;
    expect(buildCourseFallback(course)).toContain("相邻元素");
    expect(buildCourseFallback(course)).toContain("[S1]");
  });

  it("does not invent a citation for an ungrounded course", () => {
    const course = getCourseById("upper-loop-maze")!;
    expect(buildCourseFallback(course)).toContain(course.explanation.keyIdeas[0]);
    expect(buildCourseFallback(course)).not.toMatch(/\[S\d+\]/);
  });
});
