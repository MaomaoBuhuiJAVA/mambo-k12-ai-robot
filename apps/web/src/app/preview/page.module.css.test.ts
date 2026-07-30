import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/app/preview/page.module.css"), "utf8");
const spriteStylesheet = readFileSync(resolve(process.cwd(), "src/components/starbao/starbao-sprite.module.css"), "utf8");

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
  it("uses the original pixel ghost as the chat waiting indicator", () => {
    expect(rule("starbaoThinkingGhost")).toContain("--ghost-fill: rgb(255, 198, 14)");
    expect(rule("starbaoThinkingGhostBody")).toContain("grid-template-columns: repeat(14, 1fr)");
    expect(rule("starbaoThinkingGhostBody")).toContain("animation: starbaoGhostUpNDown 500ms steps(2, end) infinite");
    expect(stylesheet).toContain("@keyframes starbaoGhostFlicker0");
    expect(stylesheet).toContain("@keyframes starbaoGhostEyes");
  });

  it("uses the supplied aligned frame sheets for Starbao animations", () => {
    expect(spriteStylesheet).toContain("background-size: 1800% 100%");
    expect(spriteStylesheet).toContain("animation: starbaoEighteenFrameSequence var(--starbao-frame-duration, 1.08s) linear infinite");
    expect(spriteStylesheet).toContain("idle-cycle.png");
    expect(spriteStylesheet).toContain("thinking-cycle.png");
    expect(spriteStylesheet).toContain("cheer-cycle.png");
    expect(spriteStylesheet).toContain("sleep-cycle.png");
    expect(spriteStylesheet).toContain("drawing-cycle.png");
    expect(spriteStylesheet).toContain("walk-cycle.png");
    expect(spriteStylesheet).toContain("@keyframes starbaoEighteenFrameSequence");
    expect(spriteStylesheet).toContain("94.444%, 100% { background-position: 100% 0; }");
  });

  it("uses the supplied twelve-frame thinking sheet without sampling a blank frame", () => {
    expect(spriteStylesheet).toContain(".mood-thinking {");
    expect(spriteStylesheet).toContain("background-size: 1200% 100%;");
    expect(spriteStylesheet).toContain("animation: starbaoTwelveFrameSequence 1.2s linear infinite;");
    expect(spriteStylesheet).toContain("@keyframes starbaoTwelveFrameSequence");
    expect(spriteStylesheet).toContain("91.667%, 100% { background-position: 100% 0; }");
  });

  it("uses the supplied ten-frame sheets for idle and sleep cycles", () => {
    expect(spriteStylesheet).toContain(".mood-idle {");
    expect(spriteStylesheet).toContain("animation: starbaoTenFrameSequence 50s linear infinite;");
    expect(spriteStylesheet).toContain('background-image: url("/assets/pets/twinkle-twinkle/idle-cycle.png");');
    const sleepRule = spriteStylesheet.match(/\.mood-sleep\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(sleepRule).toContain('background-image: url("/assets/pets/twinkle-twinkle/sleep-cycle.png");');
    expect(sleepRule).toContain("background-size: 1000% 100%;");
    expect(sleepRule).toContain("animation: starbaoSleepSequence 2s steps(1, end) infinite;");
    expect(sleepRule).not.toContain("animation: none;");
    expect(spriteStylesheet).toContain("@keyframes starbaoTenFrameSequence");
    expect(spriteStylesheet).toContain("@keyframes starbaoSleepSequence");
    expect(spriteStylesheet).toContain("0%, 9.999% { background-position: 1.1523% 0; }");
    expect(spriteStylesheet).toContain("90%, 100% { background-position: 97.7726% 0; }");
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

  it("keeps the exhibition stage labels static", () => {
    expect(rule("exhibitStageLabel")).toContain("width: 140px");
    expect(rule("exhibitStageLabel")).toContain("min-height: 56px");
    expect(stylesheet).not.toContain(".exhibitStageLink");
    expect(stylesheet).not.toContain("@keyframes exhibitFloat");
  });

  it("moves the floating Starbao within the hero and pauses it while chat is open", () => {
    expect(rule("heroPetPatrol")).toContain("animation: heroPetPatrolMotion 17.28s linear");
    expect(rule("heroPetPatrol")).toContain("contain: layout;");
    expect(rule("heroPetPatrol")).not.toContain("contain: layout paint;");
    expect(rule("heroPetPatrol")).toContain("left: clamp(58px, 5.8vw, 75px)");
    expect(rule("heroPetPatrolPaused")).toContain("animation-play-state: paused");
    expect(rule("petLauncher")).toContain("margin-top: 111px");
    expect(rule("petPatrolSprite")).toContain("animation: heroPetPatrolFacing 17.28s");
    expect(rule("petPatrolWalk")).toContain("heroPetPatrolWalkVisibility 17.28s");
    expect(stylesheet).toContain("@keyframes heroPetPatrolMotion");
    expect(stylesheet).toContain("@keyframes heroPetPatrolFacing");
    expect(stylesheet).toContain("@keyframes heroPetPatrolWalkVisibility");
    expect(stylesheet).toContain("56.25%, 68.749% { transform: scaleX(-1);");
    expect(stylesheet).toContain("24.999% { transform: translate3d(0, 0, 0);");
    expect(stylesheet).toContain('.heroPetPatrol[data-pet-mood="sleep"] { animation: none; transform: translate3d(0, 0, 0); }');
    expect(stylesheet).toContain('.heroPetPatrolPaused .petPatrolSprite, .heroPetPatrol[data-pet-mood="sleep"] .petPatrolSprite { animation-play-state: paused; }');
    expect(stylesheet).toContain('.heroPetPatrolPaused .petPatrolIdle, .heroPetPatrol[data-pet-mood="sleep"] .petPatrolIdle { animation-play-state: paused; opacity: 1 !important; }');
    expect(stylesheet).toContain('.heroPetPatrolPaused .petPatrolWalk, .heroPetPatrol[data-pet-mood="sleep"] .petPatrolWalk { animation-play-state: paused; opacity: 0 !important; }');
  });

  it("keeps the patrol route and the valid eighteen-frame walk sequence aligned", () => {
    expect(rule("heroPetPatrol")).toContain("animation: heroPetPatrolMotion 17.28s linear infinite");
    expect(rule("petPatrolSprite")).toContain("animation: heroPetPatrolFacing 17.28s");
    expect(rule("petPatrolIdle")).toContain("animation: heroPetPatrolIdleVisibility 17.28s");
    expect(rule("petPatrolWalk")).toContain("animation: heroPetPatrolWalkVisibility 17.28s");
    expect(stylesheet).toContain("37.5%, 56.249% { transform: translate3d(var(--pet-patrol-distance), 0, 0);");
    expect(stylesheet).toContain("56.25%, 68.749% { transform: scaleX(-1);");
    expect(spriteStylesheet).toContain("@keyframes starbaoEighteenFrameSequence");
    expect(spriteStylesheet).not.toContain("105.8823529412% 0");
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
    expect(rule("featureScreenshot")).toContain("object-fit: contain");
    expect(lastRule("voiceScene")).toContain("background: #1b4760");
    expect(stylesheet).toContain('background: url("/assets/chat/starbao-dialogue-preview.png") center / cover no-repeat;');
    expect(stylesheet).toMatch(/\.voiceScene\s+\.featureScreenshot\s*\{[\s\S]*?inset:\s*0[\s\S]*?transform:\s*none[\s\S]*?\}/);
    expect(lastRule("codingScene")).toContain("background: #0d1117");
    expect(lastRule("petPanel")).toContain("min-height: 382px");
    expect(lastRule("petPanelHeader")).toContain("padding: 8px 12px");
  });

});
