import { describe, expect, it } from "vitest";

import { CURRICULUM, getCourseById } from "@/data/curriculum";

import {
  createSeedStorybook,
  storybookSchema,
} from "./storybook";

const validPage = {
  title: "泡泡排队",
  narration: "三个数字泡泡准备比较身高。",
  scene: "明亮的教室里，数字 3、1、2 站成一排。",
  interactiveQuestion: {
    prompt: "第一对应该比较谁？",
    options: ["3 和 1", "1 和 2"],
    answer: "3 和 1",
    correctFeedback: "正确，排序从相邻的一对开始。",
    incorrectFeedback: "先看队伍最左边相邻的两个泡泡。",
  },
};

describe("storybook schema", () => {
  it("accepts four to eight safe, complete pages", () => {
    expect(storybookSchema.safeParse({
      title: "泡泡排队记",
      summary: "用故事认识相邻比较。",
      pages: Array.from({ length: 4 }, (_, index) => ({ ...validPage, title: `第${index + 1}页` })),
    }).success).toBe(true);
  });

  it("rejects missing questions, unsafe markup, excessive text, and invalid answers", () => {
    const cases = [
      { title: "太短", summary: "不完整", pages: [validPage, validPage, validPage] },
      { title: "危险", summary: "测试", pages: Array(4).fill({ ...validPage, narration: "<script>alert(1)</script>" }) },
      { title: "过长", summary: "测试", pages: Array(4).fill({ ...validPage, scene: "场".repeat(401) }) },
      { title: "错误答案", summary: "测试", pages: Array(4).fill({ ...validPage, interactiveQuestion: { ...validPage.interactiveQuestion, answer: "不存在" } }) },
    ];

    for (const candidate of cases) expect(storybookSchema.safeParse(candidate).success).toBe(false);
  });

  it("builds an original, age-adapted seed storybook from curriculum data", () => {
    const course = getCourseById("lower-bubble-sort");
    if (!course) throw new Error("fixture course missing");

    const storybook = createSeedStorybook(course);
    expect(storybookSchema.parse(storybook)).toEqual(storybook);
    expect(storybook.pages).toHaveLength(4);
    expect(storybook.pages[0].narration).toContain(course.storybook[0].narration);
    expect(storybook.pages.every((page) => page.interactiveQuestion.options.includes(page.interactiveQuestion.answer))).toBe(true);
  });

  it("provides a valid fallback for every published curriculum course", () => {
    for (const course of CURRICULUM) {
      expect(() => storybookSchema.parse(createSeedStorybook(course))).not.toThrow();
    }
  });
});
