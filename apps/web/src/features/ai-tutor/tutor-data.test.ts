import { describe, expect, it } from "vitest";

import { getCourseLesson, getStructuredCourse } from "@/data/course-structure";
import {
  createMockTutorEvents,
  createTutorLearningContext,
  createTutorProtocolWhitelist,
  createTutorSeedLesson,
  EMPTY_TUTOR_MOCK_SESSION,
  getMockEventsForSlide,
  reduceTutorMockEvent,
  validateTutorStream,
} from "./tutor-data";

function getSeed() {
  const course = getStructuredCourse("middle-ai-foundations");
  const lesson = getCourseLesson("middle-ai-foundations:concepts:rules-and-models");
  if (!course || !lesson) throw new Error("Expected the configured middle-school lesson");
  return createTutorSeedLesson(course.course, lesson);
}

describe("tutor seed lesson and local stream", () => {
  it("creates a stable five-slide lesson with a checkpoint", () => {
    const seed = getSeed();

    expect(seed.schemaVersion).toBe(1);
    expect(seed.slides.map((slide) => slide.type)).toEqual([
      "title",
      "concept",
      "process",
      "checkpoint",
      "summary",
    ]);
    expect(seed.slides[3]?.interaction?.correctIndex).toBe(0);
  });

  it("reduces a versioned Mock event stream into presentation state", () => {
    const seed = getSeed();
    const events = createMockTutorEvents(seed);
    const state = events.reduce(reduceTutorMockEvent, EMPTY_TUTOR_MOCK_SESSION);

    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      type: "session.started",
      traceId: `local:${seed.lessonId}`,
    });
    expect(state.sessionId).toBe(`seed:${seed.lessonId}`);
    expect(state.title).toBe(seed.title);
    expect(state.readySlideIds).toEqual(seed.slides.map((slide) => slide.id));
    expect(state.narrationBySlideId.checkpoint).toBe(seed.slides[3]?.narration);
    expect(state.interactionSlideIds).toEqual(["checkpoint"]);
    expect(state.completed).toBe(true);
  });

  it("creates a LearningContextV2 and validates every local event against its whitelist", () => {
    const seed = getSeed();
    const course = getStructuredCourse(seed.courseId);
    const lesson = getCourseLesson(seed.lessonId);
    if (!course || !lesson) throw new Error("Expected the configured lesson");
    const context = createTutorLearningContext(course.course, lesson);
    const whitelist = createTutorProtocolWhitelist(course.course, lesson, seed, context);
    const events = createMockTutorEvents(seed);
    const result = validateTutorStream(events, context, whitelist);

    expect(context.schemaVersion).toBe(2);
    expect(context.teachingMode).toBe("ai_tutor");
    expect(result.ok).toBe(true);
    expect(events.find((event) => event.type === "plan.ready")).toMatchObject({
      plan: { courseId: seed.courseId, lessonId: seed.lessonId },
    });
  });

  it("fails closed when a stream event changes its slide identity", () => {
    const seed = getSeed();
    const course = getStructuredCourse(seed.courseId);
    const lesson = getCourseLesson(seed.lessonId);
    if (!course || !lesson) throw new Error("Expected the configured lesson");
    const context = createTutorLearningContext(course.course, lesson);
    const whitelist = createTutorProtocolWhitelist(course.course, lesson, seed, context);
    const events = createMockTutorEvents(seed).map((event) => {
      if (event.type !== "slide.ready") return event;
      return { ...event, slide: { ...event.slide, slideId: "forged-slide" } };
    });

    const result = validateTutorStream(events, context, whitelist);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.path.includes("slideId"))).toBe(true);
  });

  it("returns only the events belonging to the requested slide", () => {
    const seed = getSeed();
    const checkpointEvents = getMockEventsForSlide(createMockTutorEvents(seed), "checkpoint");

    expect(checkpointEvents.map((event) => event.type)).toEqual([
      "slide.ready",
      "narration.segment",
      "interaction.ready",
    ]);
  });
});
