import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createDefaultLearningState } from "@/lib/learning-store";
import { CourseCatalog } from "./course-catalog";

describe("CourseCatalog", () => {
  it("renders real middle-school courses and routes the available course action to course detail", () => {
    render(<CourseCatalog grade="middle_1" stage="middle_school" state={createDefaultLearningState()} />);

    expect(screen.getByRole("heading", { name: "人工智能基础：从规则到学习" })).toBeVisible();
    expect(screen.getByRole("link", { name: "人工智能基础：从规则到学习" }))
      .toHaveAttribute("href", "/learn/course/middle-ai-foundations?stage=middle_school&grade=middle_1");
    expect(screen.getByRole("link", { name: "人工智能基础：从规则到学习：开始" }))
      .toHaveAttribute("href", "/workspace?course=middle-ai-foundations&stage=middle_school&grade=middle_1");
    expect(screen.getByRole("link", { name: "人工智能基础：从规则到学习：AI 导师学习" }))
      .toHaveAttribute("href", "/learn/tutor/middle-ai-foundations%3Aconcepts%3Arules-and-models?stage=middle_school&grade=middle_1");
    expect(screen.getByRole("link", { name: "Python 编程入门：让步骤运行起来：查看课程详情" }))
      .toHaveAttribute("href", "/learn/course/middle-python-basics?stage=middle_school&grade=middle_1");
    expect(screen.getAllByText(/需要先完成：/).length).toBeGreaterThan(0);
  });

  it("filters the existing catalog by query and actual lab availability", async () => {
    const user = userEvent.setup();
    render(<CourseCatalog grade="middle_3" stage="middle_school" state={createDefaultLearningState()} />);

    await user.type(screen.getByRole("searchbox", { name: "搜索课程或知识点" }), "安全");
    expect(screen.getByRole("heading", { name: "AI 安全：先核对，再使用" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "人工智能基础：从规则到学习" })).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "搜索课程或知识点" }));
    await user.click(screen.getByRole("button", { name: "含实验" }));
    expect(screen.getAllByText("含实验").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "人工智能基础：从规则到学习" })).not.toBeInTheDocument();
  });

  it("shows only the selected grade's path and keeps its deep links", () => {
    render(<CourseCatalog grade="middle_3" stage="middle_school" state={createDefaultLearningState()} />);

    expect(screen.getByRole("link", { name: "数据偏差侦探社" }))
      .toHaveAttribute("href", "/learn/course/middle-data-bias?stage=middle_school&grade=middle_3");
    expect(screen.getByRole("link", { name: "数据偏差侦探社：查看课程详情" }))
      .toHaveAttribute("href", "/learn/course/middle-data-bias?stage=middle_school&grade=middle_3");
    expect(screen.getByText("4 门课程")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "人工智能基础：从规则到学习" })).not.toBeInTheDocument();
  });

  it("filters middle-school courses by the documented subject categories", async () => {
    const user = userEvent.setup();
    render(<CourseCatalog grade="middle_2" stage="middle_school" state={createDefaultLearningState()} />);

    await user.click(screen.getByRole("button", { name: "Python" }));

    expect(screen.getByRole("heading", { name: "Python 编程入门：让步骤运行起来" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "人工智能基础：从规则到学习" })).not.toBeInTheDocument();
  });

  it("filters high-school courses by model audit and project categories", async () => {
    const user = userEvent.setup();
    render(<CourseCatalog grade="high_3" stage="high_school" state={createDefaultLearningState()} />);

    await user.click(screen.getByRole("button", { name: "模型审计" }));
    expect(screen.getByRole("heading", { name: "图像分类系统审计" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Python 数据实验" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "项目" }));
    expect(screen.getByRole("heading", { name: "AI 综合项目与答辩" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "图像分类系统审计" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AI 综合项目与答辩：打开项目工作台" }))
      .toHaveAttribute("href", "/high/project/capstone");
  });

  it("keeps every configured high-school laboratory course in the laboratory filter", async () => {
    const user = userEvent.setup();
    render(<CourseCatalog grade="high_1" stage="high_school" state={createDefaultLearningState()} />);

    await user.click(screen.getByRole("button", { name: "含实验" }));

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "Python 数据实验" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "排序算法实验：冒泡排序" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "机器学习流程" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "分类、回归与指标" })).toBeVisible();
  });

  it("switches from a scan-friendly summary to a detailed activity sequence", async () => {
    const user = userEvent.setup();
    render(<CourseCatalog grade="middle_1" stage="middle_school" state={createDefaultLearningState()} />);

    expect(screen.queryByRole("list", { name: "人工智能基础：从规则到学习学习活动流程" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "详细" }));

    const flow = screen.getByRole("list", { name: "人工智能基础：从规则到学习学习活动流程" });
    expect(flow).toBeVisible();
    expect(within(flow).getByText("讲解")).toBeVisible();
    expect(within(flow).getByText("演示")).toBeVisible();
    expect(within(flow).getByText("阶段评价")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "概览" }));
    expect(screen.queryByRole("list", { name: "人工智能基础：从规则到学习学习活动流程" })).not.toBeInTheDocument();
  });

  it("shows stable card metadata and a continue CTA for an active course", () => {
    const state = createDefaultLearningState();
    state.stageProgressByStage.middle_school.activeActivityId = "middle-ai-foundations-lesson";

    render(<CourseCatalog grade="middle_1" stage="middle_school" state={state} />);

    const heading = screen.getByRole("heading", { name: "人工智能基础：从规则到学习" });
    const card = heading.closest("article");
    expect(card).not.toBeNull();
    expect(card).toHaveAttribute("data-course-theme", "teal");
    expect(within(card as HTMLElement).getByText("基础")).toBeVisible();
    expect(within(card as HTMLElement).getByText("约 30 分钟")).toBeVisible();
    expect(screen.getByRole("link", { name: "人工智能基础：从规则到学习：继续学习" })).toBeVisible();
  });

  it("filters the catalog to courses with an AI tutor flow", async () => {
    const user = userEvent.setup();
    render(<CourseCatalog grade="middle_1" stage="middle_school" state={createDefaultLearningState()} />);

    const tutorFilter = screen.getByRole("switch", { name: /AI 导师/ });
    expect(tutorFilter).toHaveAttribute("aria-checked", "false");
    await user.click(tutorFilter);

    expect(tutorFilter).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/^\d+ 门课程$/, { selector: "p" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: /AI 导师学习/ }).length).toBeGreaterThan(0);
  });
});
