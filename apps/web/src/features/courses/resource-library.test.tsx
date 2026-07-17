import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getCourseById } from "@/data/curriculum";

import { ResourceLibrary } from "./resource-library";

const course = getCourseById("lower-bubble-sort")!;

afterEach(() => vi.restoreAllMocks());

describe("ResourceLibrary", () => {
  it("downloads generated Word and PowerPoint files from real routes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(new Uint8Array([0x50, 0x4b])));
    const createObjectURL = vi.fn(() => "blob:lesson");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<ResourceLibrary course={course} />);
    const appendChild = vi.spyOn(document.body, "appendChild");
    const schedule = vi.spyOn(window, "setTimeout");
    const wordButton = screen.getByRole("button", { name: "下载 Word 讲义" });
    const slidesButton = screen.getByRole("button", { name: "下载 PowerPoint 课件" });
    await user.click(wordButton);
    await waitFor(() => expect(slidesButton).toBeEnabled());
    await user.click(slidesButton);

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/materials/docx", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/materials/pptx", expect.objectContaining({ method: "POST" }));
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    const downloadedAnchors = appendChild.mock.calls.map(([node]) => node).filter((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
    expect(downloadedAnchors).toHaveLength(2);
    expect(downloadedAnchors.every((anchor) => !anchor.isConnected)).toBe(true);
    expect(schedule.mock.calls.some(([, delay]) => delay === 0)).toBe(true);
    expect(screen.getByText(course.materials[0].name)).toBeVisible();
  });
});
