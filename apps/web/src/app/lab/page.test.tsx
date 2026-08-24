import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

vi.mock("@/features/lab/python-lab", () => ({
  PythonLab: ({ initialMode, initialStage, initialTemplateId }: {
    initialMode?: string;
    initialStage?: string;
    initialTemplateId?: string;
  }) => <div data-testid="python-lab">{initialStage}|{initialTemplateId}|{initialMode ?? "none"}</div>,
}));

vi.mock("@/features/learning-hub/learning-platform-shell", () => ({
  LearningPlatformShell: ({ children, contentTitle, initialStage, initialView }: {
    children: React.ReactNode;
    contentTitle: string;
    initialStage: string;
    initialView: string;
  }) => <div data-testid="learning-platform-shell">{`${initialStage}|${initialView}|${contentTitle}`}{children}</div>,
}));

import LabPage from "./page";

describe("LabPage", () => {
  it("parses the guided mode and passes it to the lab entry flow", async () => {
    render(await LabPage({
      searchParams: Promise.resolve({
        stage: "middle_school",
        template: "image-classifier",
        mode: "guided",
      }),
    }));

    expect(screen.getByTestId("learning-platform-shell")).toHaveTextContent("middle_school|courses|Python 编程实验室");
    expect(screen.getByTestId("python-lab")).toHaveTextContent("middle_school|image-classifier|guided");
  });

  it("redirects an unknown mode to the safe lab entry", async () => {
    await expect(LabPage({
      searchParams: Promise.resolve({ mode: "unsafe" }),
    })).rejects.toThrow("NEXT_REDIRECT:/lab");
  });

  it("pins project mode to the versioned model-audit template", async () => {
    render(await LabPage({
      searchParams: Promise.resolve({
        stage: "high_school",
        template: "bubble-sort",
        mode: "project",
      }),
    }));

    expect(screen.getByTestId("python-lab")).toHaveTextContent("high_school|model-audit|project");
  });

  it("redirects a cross-stage template before rendering the lab", async () => {
    await expect(LabPage({
      searchParams: Promise.resolve({
        stage: "middle_school",
        template: "python-data-basics",
        mode: "independent",
      }),
    })).rejects.toThrow("NEXT_REDIRECT:/learn?stage=middle_school&grade=middle_1&view=courses");
  });
});
