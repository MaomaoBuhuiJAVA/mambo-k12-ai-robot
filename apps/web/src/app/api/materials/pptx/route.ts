import PptxGenJS from "pptxgenjs";

import {
  buildLessonDocument,
  downloadHeaders,
  invalidMaterialResponse,
  parseMaterialRequest,
} from "@/lib/materials";

const MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const COLORS = { ink: "183B37", teal: "16877A", paper: "F7FAF8", coral: "E66D50", muted: "52706B" };

function addTitle(slide: PptxGenJS.Slide, title: string, kicker: string) {
  slide.background = { color: COLORS.paper };
  slide.addText(kicker, { x: 0.7, y: 0.45, w: 11.8, h: 0.3, fontFace: "Microsoft YaHei", fontSize: 11, color: COLORS.teal, bold: true });
  slide.addText(title, { x: 0.7, y: 0.85, w: 11.8, h: 0.55, fontFace: "Microsoft YaHei", fontSize: 25, color: COLORS.ink, bold: true, breakLine: false });
  slide.addShape("line", { x: 0.7, y: 1.55, w: 11.8, h: 0, line: { color: "C8D9D5", width: 1 } });
}

function addBullets(slide: PptxGenJS.Slide, items: string[], y = 1.85) {
  slide.addText(items.map((text) => ({ text, options: { bullet: { indent: 18 }, breakLine: true } })), {
    x: 0.9, y, w: 11.4, h: 4.65, fontFace: "Microsoft YaHei", fontSize: 18, color: COLORS.ink,
    breakLine: false, paraSpaceAfter: 13, valign: "top", margin: 0.08,
  });
}

export async function POST(request: Request): Promise<Response> {
  const course = await parseMaterialRequest(request);
  if (!course) return invalidMaterialResponse();

  try {
    const lesson = buildLessonDocument(course);
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Mambo K12 AI 教学助手";
    pptx.subject = `${lesson.stageLabel}人工智能通识课`;
    pptx.title = lesson.title;
    pptx.company = "Mambo K12 AI Robot";
    pptx.theme = { headFontFace: "Microsoft YaHei", bodyFontFace: "Microsoft YaHei" };

    const cover = pptx.addSlide();
    cover.background = { color: COLORS.ink };
    cover.addText("MAMBO · AI 通识课", { x: 0.75, y: 0.65, w: 5, h: 0.35, fontSize: 12, color: "67D2C2", bold: true, charSpacing: 1.5 });
    cover.addText(course.title, { x: 0.75, y: 2.05, w: 11.6, h: 1, fontFace: "Microsoft YaHei", fontSize: 38, bold: true, color: "FFFFFF", margin: 0 });
    cover.addText(`${lesson.stageLabel} · ${course.summary}`, { x: 0.78, y: 3.25, w: 10.8, h: 1.05, fontSize: 18, color: "D7E7E3", margin: 0 });
    cover.addShape("rect", { x: 0.78, y: 5.55, w: 2.1, h: 0.08, fill: { color: COLORS.coral }, line: { transparency: 100 } });

    const concepts = pptx.addSlide();
    addTitle(concepts, "核心概念", "01 · 认识问题");
    addBullets(concepts, [course.explanation.overview, ...course.explanation.keyIdeas]);

    const steps = pptx.addSlide();
    addTitle(steps, "动画步骤", "02 · 观察变化");
    addBullets(steps, lesson.animationSteps.map((step, index) => `${index + 1}  ${step}`));

    const practice = pptx.addSlide();
    addTitle(practice, "课堂练习", "03 · 动手验证");
    addBullets(practice, [lesson.activity, ...lesson.quiz.map((item, index) => `${index + 1}. ${item.prompt}`)]);

    const summary = pptx.addSlide();
    addTitle(summary, "总结与回顾", "04 · 说出依据");
    addBullets(summary, [...lesson.learningObjectives, lesson.summary]);
    summary.addText("内容来源：Mambo 项目原创课程数据", { x: 0.9, y: 6.75, w: 6, h: 0.25, fontSize: 9, color: COLORS.muted });

    const output = await pptx.write({ outputType: "uint8array", compression: true });
    const bytes = output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer);
    return new Response(bytes as BodyInit, { headers: downloadHeaders(course, "pptx", MIME) });
  } catch {
    return Response.json({ error: "MATERIAL_GENERATION_FAILED" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
