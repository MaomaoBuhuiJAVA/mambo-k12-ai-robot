import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/app/preview/page.module.css"), "utf8");

function rule(selector: string) {
  const match = stylesheet.match(new RegExp(`\\.${selector}\\s*\\{([\\s\\S]*?)\\}`));
  expect(match, `Missing .${selector} rule`).not.toBeNull();
  return match?.[1] ?? "";
}

function lastRule(selector: string) {
  const matches = [...stylesheet.matchAll(new RegExp(`\\.${selector}\\s*\\{([\\s\\S]*?)\\}`, "g"))];
  expect(matches, `Missing .${selector} rule`).not.toHaveLength(0);
  return matches.at(-1)?.[1] ?? "";
}

describe("Starbao chat visual styling", () => {
  it("uses the requested gold pixel ghost instead of the blue cube loader", () => {
    expect(rule("starbaoThinkingGhost")).toContain("--ghost-fill: rgb(255, 198, 14)");
    expect(rule("starbaoThinkingGhostBody")).toMatch(/width:\s*140px/);
    expect(rule("starbaoThinkingGhostBody")).toMatch(/height:\s*140px/);
    expect(rule("starbaoThinkingGhostBody")).toContain("grid-template-columns: repeat(14, 1fr)");
    expect(stylesheet).toContain("@keyframes starbaoGhostUpNDown");
    expect(stylesheet).toContain("@keyframes starbaoGhostFlicker0");
    expect(stylesheet).toContain("@keyframes starbaoGhostEyes");
  });

  it("uses the supplied sky artwork across the whole chat panel with a readable overlay", () => {
    expect(lastRule("petPanel")).toContain('background: url("/assets/chat/starbao-sky-dialogue.png") center / cover no-repeat');
    expect(lastRule("petPanel")).toContain("isolation: isolate");
    expect(stylesheet).toContain(".petPanel::before");
    expect(stylesheet).toContain("background: rgba(7, 38, 58, 0.52)");
    expect(stylesheet).toContain(".petPanel > *");
    expect(lastRule("messageList")).toContain("background: transparent");
  });

  it("uses a pixel speech-bubble treatment in chat", () => {
    expect(stylesheet).toContain(".message::after");
    expect(stylesheet).toContain("border: 3px solid #243c53");
    expect(stylesheet).toContain("border-radius: 0");
  });

  it("keeps the open exhibition art inside its responsive scene bounds", () => {
    expect(stylesheet).toMatch(/\.exhibitArtwork img\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%[\s\S]*?\}/);
  });

  it("renders the exhibition as transparent artwork instead of colored cards", () => {
    expect(rule("exhibitHall")).toContain("background: transparent");
    expect(rule("exhibitHall")).toContain("border: 0");
    expect(rule("exhibitBay")).toContain("background: transparent");
    expect(stylesheet).not.toContain('.exhibitBay[data-stage="primary"] { background:');
  });

  it("uses the requested clone-text underline interaction for exhibition buttons", () => {
    expect(rule("exhibitStageLink")).toContain("width: 140px");
    expect(rule("exhibitStageLink")).toContain("height: 56px");
    expect(stylesheet).toContain(".exhibitStageLink::before");
    expect(stylesheet).toContain(".exhibitStageLink:hover .exhibitStageLinkClone > span");
    expect(stylesheet).toContain(".exhibitStageLink:hover svg");
  });

  it("keeps the mobile exhibition swipeable without exposing a native scrollbar", () => {
    expect(stylesheet).toContain(".exhibitHall::-webkit-scrollbar { display: none; }");
    expect(stylesheet).toContain("scrollbar-width: none");
  });

  it("slightly reduces the primary exhibit artwork to balance the three learning stages", () => {
    expect(stylesheet).toMatch(/\.exhibitBay\[data-stage="primary"\]\s+\.exhibitArtwork img\s*\{[\s\S]*?width:\s*90%[\s\S]*?height:\s*90%[\s\S]*?\}/);
  });

  it("aligns the desktop journey panel with the first line of the hero title", () => {
    expect(stylesheet).toContain("top: calc(clamp(172px, 25vh, 222px) + 20px);");
    expect(stylesheet).not.toContain(".heroJourney { top: 96px;");
  });

  it("uses an image-backed chat preview and a compact dark terminal treatment", () => {
    expect(rule("featureScreenshot")).toContain("object-fit: cover");
    expect(lastRule("codingScene")).toContain("background: #0d1117");
    expect(lastRule("petPanel")).toContain("min-height: 382px");
    expect(lastRule("petPanelHeader")).toContain("padding: 8px 12px");
  });

});
