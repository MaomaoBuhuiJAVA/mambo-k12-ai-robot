import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LabRunner } from "./worker-controller";
import type { LabTerminalResponse } from "./lab-protocol";
import { PythonLab } from "./python-lab";

vi.mock("./monaco-python-editor", () => ({
  MonacoPythonEditor: ({ value, onChange }: { value: string; onChange(value: string): void }) => (
    <textarea aria-label="Python 代码" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

function fakeRunner(): LabRunner {
  return {
    initialize: vi.fn(),
    getStatus: vi.fn(() => "ready" as const),
    subscribe: vi.fn((listener: (status: "ready") => void) => {
      listener("ready");
      return () => undefined;
    }),
    run: vi.fn(async () => ({
      type: "result" as const,
      id: "550e8400-e29b-41d4-a716-446655440000",
      durationMs: 12,
      passed: true,
      output: [{ stream: "stdout" as const, text: "挑战测试：全部通过" }],
    })),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("PythonLab", () => {
  it("offers templates plus run, stop and reset controls", async () => {
    const user = userEvent.setup();
    const runner = fakeRunner();
    render(<PythonLab createRunner={() => runner} />);

    expect(screen.getByRole("button", { name: "冒泡排序" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "图像分类" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "运行代码" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "停止运行" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重置代码" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "运行代码" }));
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({ templateId: "bubble-sort" }));
    expect(await screen.findByText("挑战测试：全部通过")).toBeInTheDocument();
  });

  it("switches templates and reset restores starter code", async () => {
    const user = userEvent.setup();
    render(<PythonLab createRunner={fakeRunner} />);

    await user.click(screen.getByRole("button", { name: "图像分类" }));
    const editor = screen.getByRole("textbox", { name: "Python 代码" });
    expect((editor as HTMLTextAreaElement).value).toContain("classify_image");

    await user.clear(editor);
    await user.type(editor, "print('changed')");
    await user.click(screen.getByRole("button", { name: "重置代码" }));
    expect((editor as HTMLTextAreaElement).value).toContain("classify_image");
  });

  it("enables stop while running and disposes the worker on unmount", async () => {
    const user = userEvent.setup();
    let listener: ((status: "ready" | "running") => void) | undefined;
    const runner = fakeRunner();
    runner.subscribe = vi.fn((nextListener) => {
      listener = nextListener;
      nextListener("ready");
      return () => undefined;
    });
    runner.run = vi.fn(() => {
      listener?.("running");
      return new Promise<LabTerminalResponse>(() => undefined);
    });
    const { unmount } = render(<PythonLab createRunner={() => runner} />);

    await user.click(screen.getByRole("button", { name: "运行代码" }));
    const stop = screen.getByRole("button", { name: "停止运行" });
    expect(stop).toBeEnabled();
    await user.click(stop);
    expect(runner.stop).toHaveBeenCalledOnce();

    unmount();
    expect(runner.dispose).toHaveBeenCalledOnce();
  });

  it("offers an explicit retry after initialization failure", async () => {
    const user = userEvent.setup();
    let listener: ((status: "ready" | "error") => void) | undefined;
    const runner = fakeRunner();
    runner.subscribe = vi.fn((nextListener) => {
      listener = nextListener;
      nextListener("ready");
      return () => undefined;
    });
    render(<PythonLab createRunner={() => runner} />);

    listener?.("error");
    await user.click(await screen.findByRole("button", { name: "重试加载" }));

    expect(runner.initialize).toHaveBeenCalledTimes(2);
  });
});
