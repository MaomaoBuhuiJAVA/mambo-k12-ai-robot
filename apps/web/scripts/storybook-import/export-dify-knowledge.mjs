import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const storybookDirectory = path.resolve(scriptDirectory, "../../src/data/storybooks");
const outputDirectory = path.resolve(scriptDirectory, "../../tmp/dify-knowledge/storybooks");

const sourceFiles = [
  "castle-lesson-01.ts",
  "lava-lesson-01.ts",
  "lava-lesson-02.ts",
  "lava-lesson-03.ts",
  "forest-lesson-01.ts",
  "forest-lesson-02.ts",
  "forest-lesson-03.ts",
  "desert-lesson-07.ts",
  "desert-lesson-08.ts",
  "desert-lesson-09.ts",
];

function loadManifest(source, fileName) {
  const declaration = source.match(/export const ([A-Z0-9_]+): ImportedStorybookManifest =/);
  if (!declaration) {
    throw new Error(`${fileName}: storybook export was not found`);
  }

  const executable = ts.transpileModule(source
    .replace(/import[\s\S]*?from "\.\/storybook-manifest";\r?\n\r?\n/, "")
    .replace("export const", "const")
    .replace("importedStorybookManifestSchema.parse(", "("), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = {};
  vm.runInNewContext(`${executable}\nthis.manifest = ${declaration[1]};`, context, { filename: fileName });
  return context.manifest;
}

function renderBook(book) {
  const lines = [
    `# ${book.title}`,
    "",
    "## Content metadata",
    `- storybook_id: ${book.id}`,
    `- module_id: ${book.moduleId}`,
    `- lesson_number: ${book.lessonNumber}`,
    `- stage: ${book.stage}`,
    `- content_version: ${book.source.contentVersion}`,
    `- source_file: ${book.source.originalFileName}`,
    `- source_sha256: ${book.source.documentSha256}`,
    `- knowledge_points: ${book.knowledgePointIds.join(" | ")}`,
    "",
    "## Summary",
    book.summary,
  ];

  for (const page of book.pages) {
    lines.push(
      "",
      `## Page ${page.pageNumber}: ${page.title}`,
      `- page_number: ${page.pageNumber}`,
      `- image_asset_path: ${page.image.src}`,
      `- image_description: ${page.image.alt}`,
      "",
      "### Narration",
      page.narration,
      "",
      "### Dialogue",
    );
    if (page.dialogue.length === 0) {
      lines.push("No dialogue on this page.");
    } else {
      for (const cue of page.dialogue) {
        lines.push(`- [${cue.order}] ${cue.speaker}: ${cue.text}`);
      }
    }
    if (page.question) {
      lines.push(
        "",
        "### Learning check",
        `- question: ${page.question.prompt}`,
        `- options: ${page.question.options.join(" | ")}`,
        `- correct_answer: ${page.question.answer}`,
        `- correct_feedback: ${page.question.correctFeedback}`,
        `- incorrect_feedback: ${page.question.incorrectFeedback}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderPageEvidence(book, page) {
  const dialogue = page.dialogue.map((cue) => `${cue.speaker}:${cue.text}`).join(" | ");
  const question = page.question
    ? ` question:${page.question.prompt}; options:${page.question.options.join("/")}; answer:${page.question.answer};`
    : "";
  return [
    `storybook_id:${book.id}; title:${book.title}; stage:${book.stage};`,
    `knowledge_points:${book.knowledgePointIds.join("/")};`,
    `page_number:${page.pageNumber}; page_title:${page.title};`,
    `narration:${page.narration};`,
    `dialogue:${dialogue};`,
    question,
  ].join(" ").replace(/\s+/g, " ").trim();
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const combinedBooks = [
  "# 星宝 K12 绘本学习知识库",
  "",
  "本知识库包含已完成导入的 7 本权威绘本。回答必须依据同一绘本、同一页的正文、对白或互动题；不能改写绘本、补充未出现的情节，不能以猜想代替事实。",
];
const pageEvidence = [
  "# 星宝 K12 绘本逐页证据库",
  "每一行都是单独的权威绘本页面记录。回答必须引用对应的 storybook_id 与 page_number。",
];

for (const fileName of sourceFiles) {
  const manifest = loadManifest(await readFile(path.join(storybookDirectory, fileName), "utf8"), fileName);
  const document = renderBook(manifest);
  await writeFile(path.join(outputDirectory, `${manifest.id}.md`), document, "utf8");
  await writeFile(path.join(outputDirectory, `${manifest.id}.txt`), document, "utf8");
  combinedBooks.push("", "---", "", document.trimEnd());
  for (const page of manifest.pages) {
    pageEvidence.push(renderPageEvidence(manifest, page));
  }
}

await writeFile(path.join(outputDirectory, "k12-storybooks-2026-08-22.md"), `${combinedBooks.join("\n")}\n`, "utf8");
await writeFile(path.join(outputDirectory, "k12-storybook-page-evidence-2026-08-22.md"), `${pageEvidence.join("\n")}\n`, "utf8");

console.log(`Wrote ${sourceFiles.length} Dify knowledge documents plus combined and page-evidence upload files to ${outputDirectory}`);
