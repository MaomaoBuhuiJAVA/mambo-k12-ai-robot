import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import JSZip from "jszip";

const SOURCE_DIRECTORY = "E:/WechatFile/xwechat_files/wxid_xyw8zuia0xqs22_a2b3/msg/file/2026-08";
const FOLDER_SOURCE_DIRECTORY = "C:/Users/Administrator/Desktop/绘本";
const ASSET_DIRECTORY = "public/assets/storybooks";
const MANIFEST_DIRECTORY = "src/data/storybooks";

const BOOKS = [
  {
    id: "lava-lesson-01",
    fileName: "熔岩第一绘本.docx",
    moduleId: "lava-cavern",
    lessonNumber: 1,
    title: "星宝熔岩山 AI 隐私小卫士",
    summary: "星宝在熔岩山探索时，学会识别个人隐私、拒绝隐私索取，并安全地使用 AI。",
    knowledgePointIds: ["个人隐私", "隐私保护", "安全使用 AI", "拒绝不当索取"],
  },
  {
    id: "lava-lesson-02",
    fileName: "熔岩第二绘本.docx",
    moduleId: "lava-cavern",
    lessonNumber: 2,
    title: "星宝熔岩山 AI 防骗小卫士",
    summary: "星宝学习识别仿冒头像、合成语音和可疑链接，知道暂停、留证、核验和求助。",
    knowledgePointIds: ["深度合成", "可疑链接", "保存线索", "身份核验", "寻求帮助"],
  },
  {
    id: "lava-lesson-03",
    fileName: "熔岩第三绘本(1).docx",
    moduleId: "lava-cavern",
    lessonNumber: 3,
    title: "星宝熔岩山 AI 安全小卫士",
    summary: "星宝学习最小权限和安全规则，遇到危险内容时停止操作并向可信的大人求助。",
    knowledgePointIds: ["最小权限", "安全规则", "危险内容", "停止操作", "寻求帮助"],
  },
  {
    id: "castle-lesson-02",
    fileName: "第2课时_重复图案怎样接下去.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "castle-1",
    lessonNumber: 2,
    title: "星宝的城堡图案规律奇遇记",
    summary: "星宝来到天空之城城堡，学习从重复和变化中发现规律，分开观察颜色与形状，并用新位置验证规律。",
    knowledgePointIds: ["重复规律", "多项观察", "颜色与形状", "规律验证", "唯一答案"],
  },
  {
    id: "castle-lesson-03",
    fileName: "第3课时绘本无拼音.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "castle-1",
    lessonNumber: 3,
    title: "城堡的最终秘密",
    summary: "星宝在城堡最终之地理解观察镜的秘密，学习从大量图像中提取线索、发现规律并持续验证。",
    knowledgePointIds: ["观察线索", "可见特征", "发现规律", "样本积累", "持续验证"],
  },
  {
    id: "technology-lesson-01",
    fileName: "核心实验室第四绘本.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "core-lab",
    lessonNumber: 1,
    title: "星宝核心实验室 数据小卫士",
    summary: "星宝在核心实验室认识能量晶体，学习制作数据表，记录颜色、形状、亮度和重量，并核对观察数据。",
    knowledgePointIds: ["数据记录", "数据表", "可见特征", "观察对比", "数据核对"],
  },
  {
    id: "technology-lesson-02",
    fileName: "核心实验室第五绘本.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "core-lab",
    lessonNumber: 2,
    title: "星宝核心实验室 分类小卫士",
    summary: "星宝在核心实验室按照颜色和形状给能量水晶分组，学习寻找共同特征并用不同规则进行分类。",
    knowledgePointIds: ["分类", "共同特征", "颜色分类", "形状分类", "多种分类规则"],
  },
  {
    id: "technology-lesson-03",
    fileName: "核心实验室第六绘本.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "core-lab",
    lessonNumber: 3,
    title: "星宝核心实验室 AI 规则小卫士",
    summary: "星宝和 AI 机器人学习使用 AI 的安全规则，学会管理权限、写清规则，遇到危险内容及时停止并求助。",
    knowledgePointIds: ["AI 使用规则", "权限管理", "清晰规则", "风险识别", "停止与求助"],
  },
  {
    id: "forest-lesson-01",
    fileName: "第7课时绘本无拼音.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "tree-sanctuary",
    lessonNumber: 1,
    title: "古树圣地的探险须知",
    summary: "星宝学习把任务、对象、篇幅和重点说清楚，再核验 AI 起草的探险须知。",
    knowledgePointIds: ["任务说明", "目标对象", "表达要求", "清晰指令", "核验 AI 草稿"],
  },
  {
    id: "forest-lesson-02",
    fileName: "第8课时绘本无拼音.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "tree-sanctuary",
    lessonNumber: 2,
    title: "年轮墙上的证据",
    summary: "星宝在年轮墙上查找原始记录，比较通知草稿与证据并标记待确认内容。",
    knowledgePointIds: ["证据来源", "原始记录", "交叉核对", "待确认", "事实核验"],
  },
  {
    id: "forest-lesson-03",
    fileName: "第9课时绘本无拼音.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "tree-sanctuary",
    lessonNumber: 3,
    title: "通知上的名字",
    summary: "星宝学习在通知中说明资料来源、AI 的帮助和自己的责任，让内容可追溯。",
    knowledgePointIds: ["资料来源", "AI 协作说明", "署名责任", "可追溯", "人类负责"],
  },
  {
    id: "desert-lesson-07",
    fileName: "第7课时_线索和证据一样吗.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "desert-temple",
    lessonNumber: 7,
    title: "线索和证据一样吗",
    summary: "星宝在沙漠神殿学习区分说法、证据和猜测，理解线索与证据的不同。",
    knowledgePointIds: ["说法", "证据", "猜测", "线索与证据", "证据范围"],
  },
  {
    id: "desert-lesson-08",
    fileName: "第8课时_哪条证据更可靠.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "desert-temple",
    lessonNumber: 8,
    title: "哪条证据更可靠",
    summary: "星宝在沙漠神殿从来源、时间和一致性三个维度判断证据的可靠性。",
    knowledgePointIds: ["证据来源", "时效性", "内容一致性", "原始记录", "交叉验证"],
  },
  {
    id: "desert-lesson-09",
    fileName: "第9课时_证据不够时怎样判断.docx",
    sourceDirectory: FOLDER_SOURCE_DIRECTORY,
    moduleId: "desert-temple",
    lessonNumber: 9,
    title: "证据不够时怎样判断",
    summary: "星宝在沙漠神殿学习证据不足时暂不下结论，并根据新证据更新判断。",
    knowledgePointIds: ["暂时不能确定", "事实核验", "结论更新", "AI 信息核验", "证据不足"],
  },
];

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function textFromParagraph(xml) {
  return decodeXml(
    [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => match[1])
      .join("")
      .replace(/<w:tab\s*\/>/g, " "),
  ).trim();
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
  const match = text.match(/^第?\s*([0-9一二三四五六七八九十]+)\s*页\s*[：:]\s*(.*)$/);
  if (!match) return null;
  const pageNumber = chineseNumber(match[1]);
  return Number.isInteger(pageNumber)
    ? { pageNumber, title: match[2].trim() || `第 ${pageNumber} 页` }
    : null;
}

function dialogueCue(text, pageNumber, order) {
  const match = text.match(/^(旁白|星宝|AI\s*小?精灵|AI\s*机器人|城堡守卫|守卫|机器人|系统|合成语音)\s*(?:[：:]\s*|（([^）]+)）\s*[：:]?\s*)(.+)$/);
  if (!match) return null;
  const speaker = match[1].replace(/\s/g, "");
  const directionMatch = match[3].match(/^（([^）]+)）\s*(.+)$/);
  const stageDirection = match[2]?.trim() || directionMatch?.[1].trim();
  const speakerId = speaker === "旁白"
    ? "narrator"
    : speaker === "星宝"
      ? "starbao"
      : speaker === "守卫" || speaker === "城堡守卫"
        ? "guardian"
        : speaker === "系统" || speaker === "合成语音"
          ? "system"
          : "ai_sprite";
  return {
    id: `p${String(pageNumber).padStart(2, "0")}-${speakerId}-${order}`,
    speaker: speakerId,
    text: directionMatch ? directionMatch[2].trim() : match[3].trim(),
    ...(stageDirection ? { stageDirection } : {}),
    order,
    displayMode: speakerId === "narrator" ? "caption" : "bubble",
  };
}

function imageSize(buffer, extension) {
  if (extension === ".png") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return { width: 1200, height: 900 };
}

function parsePages(documentXml, relationshipsXml) {
  const relationshipTargets = new Map(
    [...relationshipsXml.matchAll(/<Relationship\s+Id="([^"]+)"[^>]+Target="([^"]+)"[^>]*\/>/g)]
      .map((match) => [match[1], match[2]]),
  );
  const pages = [];
  let currentPage = null;

  const createImageDelimitedPage = () => {
    const pageNumber = pages.length + 1;
    currentPage = {
      pageNumber,
      title: `第 ${pageNumber} 页`,
      imageTarget: null,
      narration: [],
      dialogue: [],
      question: null,
      optionLine: null,
      answer: null,
      correctFeedback: null,
      incorrectFeedback: null,
    };
    pages.push(currentPage);
  };

  for (const paragraphXml of documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
    const xml = paragraphXml[0];
    const text = textFromParagraph(xml);
    const heading = pageHeading(text);
    if (heading) {
      currentPage = { ...heading, imageTarget: null, narration: [], dialogue: [], question: null, optionLine: null, answer: null, correctFeedback: null, incorrectFeedback: null };
      pages.push(currentPage);
      continue;
    }
    const imageId = xml.match(/r:embed="([^"]+)"/)?.[1];
    if (imageId) {
      // Some no-pinyin exports omit "第 N 页" headings and use one image
      // paragraph per page. Treat each image as a page boundary in that form.
      if (!currentPage || currentPage.imageTarget) createImageDelimitedPage();
      currentPage.imageTarget = relationshipTargets.get(imageId) ?? null;
      continue;
    }
    if (!currentPage) continue;
    if (!text) continue;

    const prompt = text.match(/^(?:第\s*\d+\s*页)?互动(?:题|小问答)[：:]\s*(.+)$/);
    if (prompt) {
      currentPage.question = prompt[1].trim();
      continue;
    }
    const options = text.match(/^选项[：:]\s*(.+)$/);
    if (options) {
      const rawOptions = options[1].trim();
      currentPage.optionLine = (rawOptions.includes("|")
        ? rawOptions.split("|")
        : rawOptions.split(/\s+(?=[A-D][.、)）])/))
        .map((option) => option.trim())
        .filter(Boolean);
      continue;
    }
    const answer = text.match(/^(?:答案|标准答案)[：:]\s*(.+)$/);
    if (answer) {
      currentPage.answer = answer[1].trim();
      continue;
    }
    const correctFeedback = text.match(/^答对反馈[：:]\s*(.+)$/);
    if (correctFeedback) {
      currentPage.correctFeedback = correctFeedback[1].trim();
      continue;
    }
    const incorrectFeedback = text.match(/^答错反馈[：:]\s*(.+)$/);
    if (incorrectFeedback) {
      currentPage.incorrectFeedback = incorrectFeedback[1].trim();
      continue;
    }

    const cue = dialogueCue(text, currentPage.pageNumber, currentPage.dialogue.length + 1);
    if (cue?.speaker === "narrator") {
      currentPage.narration.push(cue.text);
    } else if (cue) {
      currentPage.dialogue.push(cue);
    } else {
      currentPage.narration.push(text);
    }
  }
  return pages;
}

function questionFromPage(page) {
  if (!page.question || !page.optionLine || !page.answer || !page.correctFeedback || !page.incorrectFeedback) return undefined;
  if (!page.optionLine.includes(page.answer) || new Set(page.optionLine).size !== page.optionLine.length) return undefined;
  return {
    prompt: page.question,
    options: page.optionLine,
    answer: page.answer,
    correctFeedback: page.correctFeedback,
    incorrectFeedback: page.incorrectFeedback,
  };
}

function identifierFor(bookId) {
  return bookId.replaceAll("-", "_").toUpperCase();
}

for (const book of BOOKS) {
  const source = await readFile(join(book.sourceDirectory ?? SOURCE_DIRECTORY, book.fileName));
  const archive = await JSZip.loadAsync(source);
  const documentXml = await archive.file("word/document.xml").async("string");
  const relationshipsXml = await archive.file("word/_rels/document.xml.rels").async("string");
  const pages = parsePages(documentXml, relationshipsXml);

  if (pages.length !== 10 || pages.some((page, index) => page.pageNumber !== index + 1 || !page.imageTarget)) {
    throw new Error(`${book.fileName} does not have ten complete, ordered pages.`);
  }

  const assetDirectory = join(ASSET_DIRECTORY, book.id);
  await mkdir(assetDirectory, { recursive: true });
  const manifestPages = [];
  for (const page of pages) {
    const extension = extname(page.imageTarget).toLowerCase();
    const archiveImage = archive.file(`word/${page.imageTarget}`);
    if (!archiveImage || !/^\.(png|jpe?g)$/.test(extension)) {
      throw new Error(`${book.fileName} page ${page.pageNumber} image is missing or unsupported.`);
    }
    const image = await archiveImage.async("nodebuffer");
    const destinationName = `page-${String(page.pageNumber).padStart(2, "0")}${extension === ".jpg" ? ".jpeg" : extension}`;
    await writeFile(join(assetDirectory, destinationName), image);
    const size = imageSize(image, extension);
    manifestPages.push({
      pageNumber: page.pageNumber,
      title: page.title,
      image: {
        src: `/assets/storybooks/${book.id}/${destinationName}`,
        alt: `${book.title}第 ${page.pageNumber} 页：${page.title}`,
        ...size,
      },
      narration: page.narration.join(" ") || "请阅读本页绘本内容。",
      dialogue: page.dialogue,
      ...(questionFromPage(page) ? { question: questionFromPage(page) } : {}),
    });
  }

  const manifest = {
    schemaVersion: 1,
    id: book.id,
    moduleId: book.moduleId,
    lessonNumber: book.lessonNumber,
    stage: "lower_primary",
    title: book.title,
    summary: book.summary,
    source: {
      originalFileName: book.fileName,
      documentSha256: createHash("sha256").update(source).digest("hex").toUpperCase(),
      contentVersion: "2026-08-24",
    },
    knowledgePointIds: book.knowledgePointIds,
    pages: manifestPages,
  };
  const identifier = identifierFor(book.id);
  const sourceText = [
    'import { importedStorybookManifestSchema, type ImportedStorybookManifest } from "./storybook-manifest";',
    "",
    `export const ${identifier}: ImportedStorybookManifest = importedStorybookManifestSchema.parse(${JSON.stringify(manifest, null, 2)});`,
    "",
  ].join("\n");
  await writeFile(join(MANIFEST_DIRECTORY, `${book.id}.ts`), sourceText);
  console.log(`${book.id}: ${manifestPages.length} pages imported`);
}
