import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import {
  buildLessonDocument,
  downloadHeaders,
  invalidMaterialResponse,
  parseMaterialRequest,
} from "@/lib/materials";

const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function heading(text: string) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 120 } });
}

function bullet(text: string) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 80 } });
}

export async function POST(request: Request): Promise<Response> {
  const course = await parseMaterialRequest(request);
  if (!course) return invalidMaterialResponse();

  try {
    const lesson = buildLessonDocument(course);
    const document = new Document({
      creator: "Mambo K12 AI 教学助手",
      title: lesson.title,
      description: `${lesson.stageLabel}人工智能通识课程学习材料`,
      sections: [{
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [new TextRun({ text: lesson.title, bold: true, size: 38, color: "173F3A" })],
          }),
          new Paragraph({ alignment: AlignmentType.CENTER, text: `适用学段：${lesson.stageLabel}` }),
          heading("一、学习目标"),
          ...lesson.learningObjectives.map(bullet),
          heading("二、核心讲解"),
          ...lesson.explanation.map((text) => new Paragraph({ text, spacing: { after: 110, line: 360 } })),
          heading("三、课堂活动"),
          new Paragraph({ text: lesson.activity, spacing: { after: 100 } }),
          ...lesson.animationSteps.map((step, index) => bullet(`第 ${index + 1} 步：${step}`)),
          heading("四、随堂测验"),
          ...lesson.quiz.flatMap((item, index) => [
            new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${item.prompt}`, bold: true })] }),
            new Paragraph({ text: `参考答案：${item.answer}`, spacing: { after: 110 } }),
          ]),
          heading("五、学习总结"),
          new Paragraph({ text: lesson.summary }),
          new Paragraph({ text: "内容来源：Mambo 项目原创课程数据", spacing: { before: 260 }, style: "Caption" }),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(document);
    return new Response(buffer as BodyInit, { headers: downloadHeaders(course, "docx", MIME) });
  } catch {
    return Response.json({ error: "MATERIAL_GENERATION_FAILED" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
