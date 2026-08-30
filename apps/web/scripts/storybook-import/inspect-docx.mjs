import { readFile } from "node:fs/promises";

import JSZip from "jszip";

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error("Usage: node inspect-docx.mjs <source.docx>");
}

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

const archive = await JSZip.loadAsync(await readFile(sourcePath));
const documentXml = await archive.file("word/document.xml").async("string");
const relationshipsXml = await archive.file("word/_rels/document.xml.rels").async("string");
const relationshipTargets = new Map(
  [...relationshipsXml.matchAll(/<Relationship\s+Id="([^"]+)"[^>]+Target="([^"]+)"[^>]*\/>/g)]
    .map((match) => [match[1], match[2]]),
);

const paragraphs = [...documentXml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
  .map((match, index) => {
    const xml = match[0];
    const relationshipIds = [...xml.matchAll(/r:embed="([^"]+)"/g)].map((embed) => embed[1]);
    return {
      index: index + 1,
      pageBreak: /<w:br[^>]+w:type="page"|<w:lastRenderedPageBreak\s*\/>/.test(xml),
      text: textFromParagraph(xml),
      images: relationshipIds.map((id) => relationshipTargets.get(id) ?? id),
    };
  })
  .filter((paragraph) => paragraph.text || paragraph.images.length > 0 || paragraph.pageBreak);

const images = Object.values(archive.files)
  .filter((entry) => /^word\/media\/[^/]+\.(?:png|jpe?g)$/i.test(entry.name))
  .map((entry) => entry.name);

console.log(JSON.stringify({ images, paragraphs }, null, 2));
