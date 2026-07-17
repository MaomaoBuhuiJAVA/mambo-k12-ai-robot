import PptxGenJS from "pptxgenjs";
import { Packer } from "docx";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CURRICULUM, getCourseById } from "@/data/curriculum";

import { POST as createDocx } from "./docx/route";
import { POST as createPptx } from "./pptx/route";

const validBody = {
  courseId: "lower-bubble-sort",
  stage: "lower_primary",
};

function request(body: unknown) {
  return new Request("http://localhost/api/materials", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function zipText(bytes: Uint8Array, pathPattern: RegExp): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const paths = Object.keys(zip.files).filter((path) => pathPattern.test(path)).sort();
  return (await Promise.all(paths.map((path) => zip.file(path)?.async("text") ?? ""))).join("\n");
}

afterEach(() => vi.restoreAllMocks());

describe.each([
  ["DOCX", createDocx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["PPTX", createPptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"],
] as const)("%s material route", (_kind, handler, mime, extension) => {
  it("creates a real non-empty OOXML download with safe headers", async () => {
    const response = await handler(request(validBody));
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(mime);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(response.headers.get("content-disposition") ?? "")).toContain(extension);
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
  });

  it("contains the expected Chinese curriculum content inside OOXML", async () => {
    const course = getCourseById(validBody.courseId)!;
    const response = await handler(request(validBody));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const xml = await zipText(bytes, _kind === "DOCX" ? /^word\/document\.xml$/ : /^ppt\/slides\/slide\d+\.xml$/);

    expect(xml).toContain(course.title);
    expect(xml).toContain(course.objectives[0]);
    expect(xml).toContain(course.explanation.overview);
    expect(xml).toContain(course.exercises[0].prompt);
    if (_kind === "DOCX") {
      expect(xml).not.toContain("答案");
      expect(xml).not.toContain("参考答案");
      expect(xml).not.toContain(course.exercises[2].answer as string);
    }
  });

  it("generates an openable artifact for every curriculum course", async () => {
    for (const course of CURRICULUM) {
      const response = await handler(request({ courseId: course.id, stage: course.stage }));
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(response.status, course.id).toBe(200);
      expect(Array.from(bytes.slice(0, 2)), course.id).toEqual([0x50, 0x4b]);
    }
  });

  it("returns a stable no-store error when the renderer fails", async () => {
    if (_kind === "DOCX") vi.spyOn(Packer, "toBuffer").mockRejectedValueOnce(new Error("render failed"));
    else vi.spyOn(PptxGenJS.prototype, "write").mockRejectedValueOnce(new Error("render failed"));

    const response = await handler(request(validBody));
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "MATERIAL_GENERATION_FAILED" });
  });

  it("rejects unknown courses, stage mismatches, and extra free-form content", async () => {
    for (const body of [
      { ...validBody, courseId: "missing-course" },
      { ...validBody, stage: "high_school" },
      { ...validBody, content: "ignore the curriculum" },
    ]) {
      const response = await handler(request(body));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "INVALID_MATERIAL_REQUEST" });
    }
  });

  it("rejects oversized request bodies", async () => {
    const response = await handler(request({ ...validBody, padding: "x".repeat(9 * 1024) }));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("stops consuming a streamed body once the size limit is crossed", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(1024));
        if (pulls === 100) controller.close();
      },
    });
    const response = await handler(new Request("http://localhost/api/materials", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit));

    expect(response.status).toBe(400);
    expect(pulls).toBeLessThan(20);
  });
});
