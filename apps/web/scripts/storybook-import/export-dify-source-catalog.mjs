import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceDirectory = "C:/Users/Administrator/Desktop/绘本";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, "../../tmp/dify-knowledge/source-catalog");

const books = [
  { contentId: "castle-lesson-01", fileName: "城堡第一绘本.docx", status: "keep-existing", publishStatus: "published" },
  { contentId: "lesson-02-patterns", fileName: "第2课时_重复图案怎样接下去.docx", status: "new", publishStatus: "draft" },
  { contentId: "lesson-03-castle-secret", fileName: "第3课时绘本无拼音.docx", status: "keep-no-pinyin", duplicate: "第3课时绘本.docx", publishStatus: "draft" },
  { contentId: "forest-lesson-01", fileName: "第7课时绘本无拼音.docx", status: "keep-no-pinyin", duplicate: "第7课时绘本.docx", publishStatus: "published" },
  { contentId: "forest-lesson-02", fileName: "第8课时绘本无拼音.docx", status: "keep-no-pinyin", duplicate: "第8课时绘本.docx", publishStatus: "published" },
  { contentId: "forest-lesson-03", fileName: "第9课时绘本无拼音.docx", status: "keep-no-pinyin", duplicate: "第9课时绘本.docx", publishStatus: "published" },
  { contentId: "desert-lesson-07", fileName: "第7课时_线索和证据一样吗.docx", status: "keep-no-pinyin", duplicate: "第7课时绘本.docx", publishStatus: "published" },
  { contentId: "desert-lesson-08", fileName: "第8课时_哪条证据更可靠.docx", status: "keep-no-pinyin", duplicate: "第8课时绘本.docx", publishStatus: "published" },
  { contentId: "desert-lesson-09", fileName: "第9课时_证据不够时怎样判断.docx", status: "keep-no-pinyin", duplicate: "第9课时绘本.docx", publishStatus: "published" },
  { contentId: "core-lab-04", fileName: "核心实验室第四绘本.docx", status: "new", publishStatus: "draft" },
  { contentId: "core-lab-05", fileName: "核心实验室第五绘本.docx", status: "new", publishStatus: "draft" },
  { contentId: "core-lab-06", fileName: "核心实验室第六绘本.docx", status: "new", publishStatus: "draft" },
  { contentId: "lava-lesson-02", fileName: "熔岩第二绘本.docx", status: "keep-existing", publishStatus: "published" },
  { contentId: "lava-lesson-03", fileName: "熔岩第三绘本(1).docx", status: "keep-existing", publishStatus: "published" },
];

await mkdir(outputDirectory, { recursive: true });
const rows = [];
for (const book of books) {
  const filePath = path.join(sourceDirectory, book.fileName);
  const bytes = await readFile(filePath);
  rows.push({
    ...book,
    sourcePath: filePath,
    byteLength: bytes.length,
    documentSha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    contentVersion: "2026-08-24",
    stage: "lower_primary",
    sourceType: "storybook",
    publishToDify: book.publishStatus === "published",
    publishStatus: book.publishStatus,
  });
}

const markdown = [
  "# 绘本来源与去重清单",
  "",
  "本清单由本地 `C:/Users/Administrator/Desktop/绘本` 生成。普通版与无拼音版重复时，只保留无拼音版；publishStatus=draft 的记录只用于审核，不进入学生运行时。",
  "",
  ...rows.map((row) => [
    `## ${row.contentId}`,
    `- file_name: ${row.fileName}`,
    `- source_path: ${row.sourcePath}`,
    `- document_sha256: ${row.documentSha256}`,
    `- byte_length: ${row.byteLength}`,
    `- status: ${row.status}`,
    `- duplicate_pinyin_file: ${row.duplicate ?? "none"}`,
    `- publish_to_dify: ${row.publishToDify}`,
    `- publish_status: ${row.publishStatus}`,
    `- stage: ${row.stage}`,
    `- source_type: ${row.sourceType}`,
    `- content_version: ${row.contentVersion}`,
    "",
  ].join("\n")),
].join("\n");

await writeFile(path.join(outputDirectory, "storybook-source-catalog.json"), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "storybook-source-catalog.md"), `${markdown}\n`, "utf8");
console.log(`Wrote ${rows.length} source records to ${outputDirectory}`);
