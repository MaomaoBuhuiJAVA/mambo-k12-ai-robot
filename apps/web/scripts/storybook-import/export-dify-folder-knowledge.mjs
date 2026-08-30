import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = "C:/Users/Administrator/Desktop/绘本";
const outputDirectory = path.resolve(scriptDirectory, "../../tmp/dify-knowledge/folder-storybooks");

const books = [
  { contentId: "castle-lesson-01", fileName: "城堡第一绘本.docx", moduleId: "castle-1", lessonNumber: 1, publishStatus: "published" },
  { contentId: "lesson-02-patterns", fileName: "第2课时_重复图案怎样接下去.docx", moduleId: "castle-1", lessonNumber: 2, publishStatus: "draft" },
  { contentId: "lesson-03-castle-secret", fileName: "第3课时绘本无拼音.docx", moduleId: "castle-1", lessonNumber: 3, publishStatus: "draft" },
  { contentId: "forest-lesson-01", fileName: "第7课时绘本无拼音.docx", moduleId: "tree-sanctuary", lessonNumber: 1, publishStatus: "published" },
  { contentId: "forest-lesson-02", fileName: "第8课时绘本无拼音.docx", moduleId: "tree-sanctuary", lessonNumber: 2, publishStatus: "published" },
  { contentId: "forest-lesson-03", fileName: "第9课时绘本无拼音.docx", moduleId: "tree-sanctuary", lessonNumber: 3, publishStatus: "published" },
  { contentId: "desert-lesson-07", fileName: "第7课时_线索和证据一样吗.docx", moduleId: "desert-temple", lessonNumber: 7, publishStatus: "published" },
  { contentId: "desert-lesson-08", fileName: "第8课时_哪条证据更可靠.docx", moduleId: "desert-temple", lessonNumber: 8, publishStatus: "published" },
  { contentId: "desert-lesson-09", fileName: "第9课时_证据不够时怎样判断.docx", moduleId: "desert-temple", lessonNumber: 9, publishStatus: "published" },
  { contentId: "core-lab-04", fileName: "核心实验室第四绘本.docx", moduleId: "core-lab", lessonNumber: 4, publishStatus: "draft" },
  { contentId: "core-lab-05", fileName: "核心实验室第五绘本.docx", moduleId: "core-lab", lessonNumber: 5, publishStatus: "draft" },
  { contentId: "core-lab-06", fileName: "核心实验室第六绘本.docx", moduleId: "core-lab", lessonNumber: 6, publishStatus: "draft" },
  { contentId: "lava-lesson-02", fileName: "熔岩第二绘本.docx", moduleId: "lava-cavern", lessonNumber: 2, publishStatus: "published" },
  { contentId: "lava-lesson-03", fileName: "熔岩第三绘本(1).docx", moduleId: "lava-cavern", lessonNumber: 3, publishStatus: "published" },
];

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function paragraphText(xml) {
  return decodeXml(
    [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => match[1])
      .join("")
      .trim(),
  );
}

function chineseNumber(value) {
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (/^\d+$/.test(value)) return Number(value);
  if (digits[value]) return digits[value];
  if (/^十[一二三四五六七八九]$/.test(value)) return 10 + digits[value[1]];
  if (/^[二三四五六七八九]十$/.test(value)) return digits[value[0]] * 10;
  return Number.NaN;
}

function pageHeading(text) {
  const match = text.match(/^第\s*([0-9一二三四五六七八九十]+)\s*页\s*[：:]?\s*(.*)$/);
  if (!match) return null;
  const pageNumber = chineseNumber(match[1]);
  return Number.isInteger(pageNumber)
    ? { pageNumber, title: match[2].trim() || `第 ${pageNumber} 页` }
    : null;
}

function speakerLine(text) {
  const match = text.match(/^(旁白|星宝|AI\s*小?精灵|古树守卫|城堡守卫|守卫|机器人|系统|合成语音)\s*[：:]\s*(.+)$/);
  return match ? { speaker: match[1].replaceAll(/\s/g, ""), text: match[2].trim() } : null;
}

function parseDocument(xml) {
  const pages = [];
  let current = null;
  let pendingHeading = null;
  for (const match of xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
    const xmlParagraph = match[0];
    const text = paragraphText(xmlParagraph);
    const heading = pageHeading(text);
    if (heading) {
      pendingHeading = heading;
      continue;
    }
    if (xmlParagraph.includes("r:embed=")) {
      const pageNumber = pages.length + 1;
      current = {
        pageNumber,
        title: pendingHeading?.title || `第 ${pageNumber} 页`,
        narration: [],
        dialogue: [],
      };
      pages.push(current);
      pendingHeading = null;
      continue;
    }
    if (!current || !text) continue;
    const cue = speakerLine(text);
    if (cue?.speaker === "旁白") current.narration.push(cue.text);
    else if (cue) current.dialogue.push(cue);
    else current.narration.push(text);
  }
  return pages;
}

function renderBook(book, pages, sourceSha256) {
  const lines = [
    `# ${book.contentId}`,
    "",
    "## Source metadata",
    `- storybook_id: ${book.contentId}`,
    `- module_id: ${book.moduleId}`,
    `- lesson_number: ${book.lessonNumber}`,
    "- stage: lower_primary",
    `- source_file: ${book.fileName}`,
    `- source_sha256: ${sourceSha256}`,
    "- source_type: storybook",
    "- content_version: 2026-08-24",
    `- publish_status: ${book.publishStatus}`,
    "- pinyin_duplicate_policy: keep_no_pinyin_version",
  ];
  for (const page of pages) {
    lines.push(
      "",
      `## Page ${page.pageNumber}: ${page.title}`,
      `- page_number: ${page.pageNumber}`,
      "",
      "### Narration",
      page.narration.join(" ") || "本页没有单独旁白。",
      "",
      "### Dialogue",
      ...(page.dialogue.length > 0
        ? page.dialogue.map((cue, index) => `- [${index + 1}] ${cue.speaker}: ${cue.text}`)
        : ["本页没有角色对白。"]),
    );
  }
  return `${lines.join("\n")}\n`;
}

await mkdir(outputDirectory, { recursive: true });
const combined = [
  "# 星宝 K12 绘本知识库（绘本文件夹去重版）",
  "",
  "仅包含 C:/Users/Administrator/Desktop/绘本 中选定的无拼音版本和唯一版本。带拼音重复文件不在本批次上传清单中。",
];
const published = [
  "# 星宝 K12 绘本知识库（已发布）",
  "",
  "只包含网站已发布、允许进入学生运行时的绘本。publish_status=published。",
];
const draft = [
  "# 星宝 K12 绘本知识库（待审核）",
  "",
  "仅供内容审核使用，publish_status=draft，不得接入学生运行时或小学战斗检索。",
];
const manifest = [];

for (const book of books) {
  const sourcePath = path.join(sourceDirectory, book.fileName);
  const source = await readFile(sourcePath);
  const archive = await JSZip.loadAsync(source);
  const documentXml = await archive.file("word/document.xml").async("string");
  const pages = parseDocument(documentXml);
  if (pages.length === 0) throw new Error(`${book.fileName}: no page headings found`);
  const sourceSha256 = createHash("sha256").update(source).digest("hex").toUpperCase();
  const document = renderBook(book, pages, sourceSha256);
  await writeFile(path.join(outputDirectory, `${book.contentId}.md`), document, "utf8");
  // Dify's Markdown parser has failed on some cloud uploads; keep a plain-text
  // twin for the runtime knowledge base while retaining Markdown for review.
  await writeFile(path.join(outputDirectory, `${book.contentId}.txt`), document, "utf8");
  combined.push("", "---", "", document.trimEnd());
  (book.publishStatus === "published" ? published : draft).push("", "---", "", document.trimEnd());
  manifest.push({
    ...book,
    sourceSha256,
    pageCount: pages.length,
    sourceType: "storybook",
    stage: "lower_primary",
    contentVersion: "2026-08-24",
    publishToDify: book.publishStatus === "published",
    publishStatus: book.publishStatus,
  });
}

await writeFile(path.join(outputDirectory, "k12-storybooks-folder-2026-08-24.md"), `${combined.join("\n")}\n`, "utf8");
await writeFile(path.join(outputDirectory, "k12-storybooks-published-2026-08-24.md"), `${published.join("\n")}\n`, "utf8");
await writeFile(path.join(outputDirectory, "k12-storybooks-draft-2026-08-24.md"), `${draft.join("\n")}\n`, "utf8");
await writeFile(path.join(outputDirectory, "k12-storybooks-folder-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${manifest.length} Dify storybook documents to ${outputDirectory}`);
