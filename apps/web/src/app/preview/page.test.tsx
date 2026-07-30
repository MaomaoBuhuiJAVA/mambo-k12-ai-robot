import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GESTURE_NAVIGATE_EVENT } from "@/components/robot/robot-gesture-provider";
import PreviewPage from "./page";

const push = vi.fn();
const sendTurn = vi.fn();
const setSpeakOnOrangePi = vi.fn();
const previewPageSource = readFileSync(resolve(process.cwd(), "src/app/preview/page.tsx"), "utf8");
const previewStylesSource = readFileSync(resolve(process.cwd(), "src/app/preview/page.module.css"), "utf8");
const starbaoSpriteStylesSource = readFileSync(resolve(process.cwd(), "src/components/starbao/starbao-sprite.module.css"), "utf8");
const journeyCardSource = readFileSync(resolve(process.cwd(), "src/components/star-journey-card/StarJourneyCard.jsx"), "utf8");
const stepperSource = readFileSync(resolve(process.cwd(), "src/components/star-journey-card/Stepper.jsx"), "utf8");
const journeyCardStylesSource = readFileSync(resolve(process.cwd(), "src/components/star-journey-card/StarJourneyCard.module.css"), "utf8");
const sharedConversationState = {
  conversation: {
    conversationId: "conversation-1",
    deviceId: "orangepi4pro-dev-01",
    speakOnOrangePi: false,
    latestSequence: 2,
  },
  messages: [
    {
      messageId: "message-1",
      conversationId: "conversation-1",
      sequence: 1,
      clientMessageId: "web-1",
      role: "user",
      origin: "web",
      content: "????????",
      replyToMessageId: null,
      announceOnOrangePi: false,
      createdAt: "2026-07-19T09:00:00Z",
    },
    {
      messageId: "message-2",
      conversationId: "conversation-1",
      sequence: 2,
      clientMessageId: "web-1:assistant",
      role: "assistant",
      origin: "starbao",
      content: "?????????????",
      replyToMessageId: "message-1",
      announceOnOrangePi: false,
      createdAt: "2026-07-19T09:00:01Z",
    },
  ],
  latestSequence: 2,
  isLoading: false,
  isSending: false,
  error: null,
  refresh: vi.fn(),
  sendTurn,
  setSpeakOnOrangePi,
};

function dispatchGestureNavigation(direction: "previous" | "next") {
  act(() => {
    window.dispatchEvent(new CustomEvent(GESTURE_NAVIGATE_EVENT, { detail: { direction } }));
  });
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, priority, unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; unoptimized?: boolean }) => {
    void priority;
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element -- the test replaces Next Image with a semantic stub.
    return <img alt={alt} {...props} />;
  },
}));

vi.mock("@/features/starbao/use-shared-starbao-conversation", () => ({
  useSharedStarbaoConversation: () => sharedConversationState,
}));

describe("PreviewPage Starbao chat", () => {
  beforeEach(() => {
    push.mockReset();
    sendTurn.mockReset();
    setSpeakOnOrangePi.mockReset();
    sendTurn.mockResolvedValue(undefined);
    setSpeakOnOrangePi.mockResolvedValue(undefined);
    sharedConversationState.isSending = false;
  });

  it("uses the shared Starbao history and submits a web visitor message", () => {
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));

    expect(screen.getByText("????????")).toBeInTheDocument();
    expect(screen.getByText("?????????????")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "????" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "????" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "???" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "????????" })).not.toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "???????" });
    fireEvent.change(input, { target: { value: "????????" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(sendTurn).toHaveBeenCalledWith({
      text: "????????",
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      origin: "web",
    });
  });

  it("uses Chinese identity copy in the compact Starbao chat header", () => {
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));

    const panel = screen.getByRole("complementary", { name: "???????" });
    expect(panel).toHaveTextContent("??");
    expect(panel).toHaveTextContent("???? ? ??");
    expect(panel).not.toHaveTextContent("Twinkle Twinkle");
    expect(panel).not.toHaveTextContent("Star study companion - Online");
  });

  it("does not render the removed header mascot link", () => {
    render(<PreviewPage />);

    expect(screen.queryByRole("link", { name: "\u661f\u5b9d" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "\u6325\u624b\u7684\u661f\u5b9d" })).not.toBeInTheDocument();
  });

  it("moves the open Starbao chat window from its header drag handle", () => {
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));

    const panel = screen.getByRole("complementary", { name: "???????" });
    const handle = screen.getByTestId("starbao-chat-drag-handle");
    Object.defineProperty(panel, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 50, top: 80, width: 360, height: 382 }),
    });
    Object.defineProperty(handle, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(handle, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(handle, "releasePointerCapture", { configurable: true, value: vi.fn() });

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 120, pointerId: 7 });
    fireEvent.pointerMove(handle, { clientX: 230, clientY: 260, pointerId: 7 });
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 260, pointerId: 7 });

    expect(panel).toHaveStyle({ left: "180px", top: "220px", transform: "none" });
  });

  it("moves the hero Starbao without opening chat, then preserves regular click behavior", () => {
    const { container } = render(<PreviewPage />);
    const hero = container.querySelector("#top") as HTMLElement;
    const patrol = container.querySelector("#top [data-patrol-state]") as HTMLDivElement;
    const launcher = screen.getByRole("button", { name: "Open star chat" });
    Object.defineProperty(hero, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 1280, height: 620 }),
    });
    Object.defineProperty(hero, "clientWidth", { configurable: true, value: 1280 });
    Object.defineProperty(hero, "clientHeight", { configurable: true, value: 620 });
    Object.defineProperty(patrol, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 80, top: 240, width: 96, height: 215 }),
    });
    Object.defineProperty(patrol, "offsetWidth", { configurable: true, value: 96 });
    Object.defineProperty(patrol, "offsetHeight", { configurable: true, value: 215 });
    Object.defineProperty(launcher, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(launcher, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(launcher, "releasePointerCapture", { configurable: true, value: vi.fn() });

    fireEvent.pointerDown(launcher, { button: 0, clientX: 100, clientY: 270, pointerId: 11, isPrimary: true });
    fireEvent.pointerMove(launcher, { clientX: 250, clientY: 340, pointerId: 11, isPrimary: true });
    fireEvent.pointerUp(launcher, { clientX: 250, clientY: 340, pointerId: 11, isPrimary: true });
    fireEvent.click(launcher);

    expect(patrol).toHaveStyle({ left: "230px", top: "310px" });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    fireEvent.click(launcher);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("keeps the attached chat window inside a shorter viewport without covering its anchor", () => {
    const originalInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
    let unmount: (() => void) | undefined;

    try {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });

      const rendered = render(<PreviewPage />);
      unmount = rendered.unmount;

      const launcher = screen.getByRole("button", { name: "Open star chat" });
      Object.defineProperty(launcher, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ left: 120, top: 50, width: 96, height: 104 }),
      });

      fireEvent.click(launcher);

      const panel = screen.getByRole("complementary");
      Object.defineProperty(panel, "offsetWidth", { configurable: true, value: 360 });

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });
      expect(panel).toHaveStyle({ top: "166px", height: "382px" });

      Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(panel).toHaveStyle({ left: "228px", top: "15px", height: "370px" });
    } finally {
      unmount?.();
      if (originalInnerWidth) {
        Object.defineProperty(window, "innerWidth", originalInnerWidth);
      }
      if (originalInnerHeight) {
        Object.defineProperty(window, "innerHeight", originalInnerHeight);
      }
    }
  });

  it("uses the woodland glass card shell at its declared aspect ratio without a fixed minimum height", () => {
    expect(journeyCardSource).toContain("aspectRatio: '86 / 55'");
    expect(journeyCardSource).not.toContain("minHeight: '32rem'");
    expect(journeyCardSource).toContain("forest-vine-frame.png");
    expect(journeyCardSource).toContain("cardStyles.glassPanel");
    expect(journeyCardStylesSource).toContain("backdrop-filter: blur(0.7cqw) saturate(0.78);");
    expect(journeyCardStylesSource).toContain("background: rgba(25, 48, 37, 0.54);");
  });

  it("uses the supplied woodland artwork for the frame, route, step markers, options, and next action", () => {
    expect(stepperSource).toContain("forest-vine-connector.png");
    expect(stepperSource).toContain("forest-pinecone-step.png");
    expect(stepperSource).toContain("forest-next-button.png");
    expect(journeyCardStylesSource).toContain("forest-choice-button.png");
    expect(journeyCardSource).toContain("textAlign: 'center'");
    expect(journeyCardSource).not.toContain("backgroundColor: 'rgba(202, 181, 112, 0.84)'");
    expect(journeyCardSource).toContain('src="/assets/starbao-nav-peek.png"');
    expect(journeyCardStylesSource).toContain("top: 50%;");
    expect(journeyCardStylesSource).toContain("left: 50%;");
  });

  it("shows the chat screenshot and a dark Python terminal in the learning previews", () => {
    render(<PreviewPage />);

    const chatPreview = screen.getByRole("group", { name: "????????" });
    expect(chatPreview).toContainElement(screen.getByRole("img", { name: "????????" }));

    const terminalPreview = screen.getByRole("group", { name: "Python ????" });
    expect(terminalPreview).toHaveTextContent("TERMINAL");
    expect(terminalPreview).toHaveTextContent("Python 3.12");
  });

  it("uses the supplied full chat screenshot without cropping", () => {
    expect(previewPageSource).toContain('src="/assets/chat/starbao-dialogue-preview.png"');
    expect(previewStylesSource).toContain(".voiceScene .featureScreenshot");
    expect(previewStylesSource).toContain("inset: 0;");
    expect(previewStylesSource).toContain("object-fit: contain;");
    expect(previewStylesSource).toContain("transform: none;");
    expect(previewStylesSource).toContain('background: url("/assets/chat/starbao-dialogue-preview.png") center / cover no-repeat;');
  });

  it("shows the original pixel thinking indicator in the chat message list while Starbao is sending", () => {
    sharedConversationState.isSending = true;
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));

    const thinkingStatus = screen.getByRole("status", { name: "Starbao is thinking" });
    expect(screen.getByRole("complementary")).toContainElement(thinkingStatus);
    expect(thinkingStatus.parentElement?.className).toContain("messageList");
    expect(screen.getByTestId("starbao-thinking-ghost")).toBeInTheDocument();
  });

  it("does not render the three floor cards over the house scene", () => {
    render(<PreviewPage />);

    expect(screen.queryByRole("button", { name: "?????????????? ? ?? ? ??" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "?????????????? ? ?? ? ??" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "???????? ? ????? ? ?? ? ??" })).not.toBeInTheDocument();
    expect(screen.queryByText("?????????????")).not.toBeInTheDocument();
  });

  it("does not render the house scene beside the homepage introduction", () => {
    const { container } = render(<PreviewPage />);

    expect(container.querySelector("#house")).not.toBeInTheDocument();
  });

  it("does not render the removed hero house or its foundation", () => {
    const { container } = render(<PreviewPage />);

    expect(screen.queryByText("?????????")).not.toBeInTheDocument();
    expect(screen.queryByText("????? ? ????")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("?????")).not.toBeInTheDocument();
    expect(container.querySelector("img[src*='user-house-three-level.png']")).not.toBeInTheDocument();
    expect(container.querySelector("img[src*='user-house-foundation.png']")).not.toBeInTheDocument();
  });

  it("places the interactive Starbao journey card in the hero", () => {
    render(<PreviewPage />);

    const journey = screen.getByRole("region", { name: "??????" });
    expect(journey).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "??? 1 ?" })).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "???" }));

    expect(screen.getByRole("button", { name: "??? 2 ?" })).toHaveAttribute("aria-current", "step");
  });

  it("keeps the woodland path in sync across next, direct-path, and previous navigation", () => {
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "???" }));
    expect(screen.getByRole("button", { name: "??? 2 ?" })).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "??? 4 ?" }));
    expect(screen.getByRole("button", { name: "??? 4 ?" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "??" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "???" }));
    expect(screen.getByRole("button", { name: "??? 3 ?" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { name: "??AI?????" })).toBeInTheDocument();
  });

  it("keeps the clickable woodland path above the changing step content", () => {
    expect(stepperSource).toMatch(/progressTrack: \{[\s\S]*?zIndex: 2,/);
    expect(stepperSource).toMatch(/content: \{[\s\S]*?zIndex: 1,/);
  });

  it("uses centered concise choice labels and centers each pinecone number", () => {
    expect(journeyCardSource).toContain("label: '??'");
    expect(journeyCardSource).toContain("label: '??'");
    expect(journeyCardSource).toContain("label: '???'");
    expect(journeyCardStylesSource).toContain("place-items: center;");
    expect(journeyCardStylesSource).toContain("margin-right: 10px;");
    expect(journeyCardStylesSource).toContain("margin-right: 20px;");
    expect(journeyCardStylesSource).toContain("font-size: 2.95cqw;");
    expect(stepperSource).toContain("top: '78%'");
    expect(stepperSource).toContain("marginTop: '0.8cqw'");
    expect(stepperSource).toContain("marginLeft: '-0.65cqw'");
    expect(stepperSource).toContain("fontSize: 'clamp(15px, 2.65cqw, 17px)'");
    expect(stepperSource).toContain("fontWeight: 900");
  });

  it("uses a Hello World preview in the coding terminal", () => {
    render(<PreviewPage />);

    expect(screen.getByText('print("Hello, World!")')).toBeInTheDocument();
    expect(screen.queryByText("def classify_image(features):")).not.toBeInTheDocument();
  });

  it("guides a learner through stage, AI familiarity, and learning-format choices", () => {
    render(<PreviewPage />);

    expect(screen.getByRole("heading", { name: "\u6b22\u8fce\u6765\u5230\u661f\u5b9dAi\u901a\u8bc6\u6559\u80b2\u8bfe\u5802!" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "\u4e0b\u4e00\u6b65" }));
    const primary = screen.getByRole("radio", { name: "\u5c0f\u5b66" });
    fireEvent.click(primary);
    expect(primary).toBeChecked();
    expect(screen.queryByText("\u4ece\u6545\u4e8b\u3001\u89c2\u5bdf\u548c\u4e92\u52a8\u5f00\u59cb")).not.toBeInTheDocument();
    expect(screen.queryByText("\u9009\u62e9\u5b66\u6bb5")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "\u4e0b\u4e00\u6b65" }));
    expect(screen.getByRole("heading", { name: "\u4f60\u5bf9AI\u4e86\u89e3\u591a\u5c11\uff1f" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "\u65b0\u4eba" })).toBeInTheDocument();
    const familiar = screen.getByRole("radio", { name: "\u9ad8\u624b" });
    expect(screen.getByRole("radio", { name: "\u7a0b\u5e8f\u5458" })).toBeInTheDocument();
    fireEvent.click(familiar);
    expect(familiar).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "\u4e0b\u4e00\u6b65" }));
    expect(screen.getByRole("heading", { name: "\u4f60\u60f3\u5148\u4ece\u54ea\u4e00\u90e8\u5206\u5f00\u59cb\u5b66\u4e60\uff1f" })).toBeInTheDocument();
    const coding = screen.getByRole("radio", { name: "\u7f16\u7a0b" });
    fireEvent.click(coding);
    expect(coding).toBeChecked();
    expect(screen.getByRole("button", { name: "\u5f00\u59cb" })).toBeInTheDocument();
  });

  it("keeps the voice preview focused on chat and presents the reference pet in a pixel wood frame", () => {
    render(<PreviewPage />);

    expect(screen.getByRole("group", { name: "\u661f\u5b9d\u804a\u5929\u7a97\u53e3\u9884\u89c8" })).toContainElement(
      screen.getByRole("img", { name: "\u661f\u5b9d\u804a\u5929\u7a97\u53e3\u622a\u56fe" }),
    );
    expect(screen.queryByText("\u6211\u5728\u8fd9\u91cc\uff01")).not.toBeInTheDocument();
    expect(previewPageSource).not.toContain("styles.robotHalo");
    expect(previewPageSource).not.toContain("styles.robotBubble");
    expect(previewPageSource).toContain("styles.pixelWoodFrame");
  });

  it("renders the growth exhibition with static school-stage labels", () => {
    const { container } = render(<PreviewPage />);

    expect(screen.queryByRole("button", { name: "Open primary learning path" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open middle school learning path" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open high school learning path" })).not.toBeInTheDocument();
    expect(container.querySelectorAll("img[src*='assets/learning-stages/']")).toHaveLength(3);
    expect(Array.from(container.querySelectorAll("[class*='exhibitStageLabel']")).map((label) => label.textContent)).toEqual(["??", "??", "??"]);
    expect(screen.getByRole("region", { name: "????" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "?????????????" })).toBeInTheDocument();
    expect(screen.getByText("?????")).toBeInTheDocument();
    expect(screen.getByText("Ai????-??")).toBeInTheDocument();

    expect(screen.queryByRole("group", { name: "??????" })).not.toBeInTheDocument();
    expect(container.querySelector("[class*='exhibitBayLabel']")).not.toBeInTheDocument();
    expect(screen.queryByText("???????")).not.toBeInTheDocument();
    expect(container.querySelector("a[href='#classroom']")).not.toBeInTheDocument();
    expect(container.querySelector("footer")).not.toBeInTheDocument();
    expect(container.querySelector("[class*='floorDetail']")).not.toBeInTheDocument();
    expect(screen.queryByText("????")).not.toBeInTheDocument();
    expect(screen.queryByText("01 ? ??????")).not.toBeInTheDocument();
    expect(screen.queryByText("02 ? ??????")).not.toBeInTheDocument();
    expect(screen.queryByText("03 ? ??????")).not.toBeInTheDocument();
    expect(screen.queryByText("???????")).not.toBeInTheDocument();
  });

  it("keeps the exhibit artwork and labels free of hover routing behavior", () => {
    const { container } = render(<PreviewPage />);

    expect(screen.queryByText("????")).not.toBeInTheDocument();
    expect(screen.queryByText("????")).not.toBeInTheDocument();
    expect(screen.queryByText("????")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[class*='exhibitBayDetail']")).toHaveLength(0);
    expect(container.querySelectorAll("[class*='exhibitStageLink']")).toHaveLength(0);
    expect(previewPageSource).not.toContain("openSchoolStage");
    expect(previewPageSource).not.toContain("activeExhibitStage");
  });

  it("uses intrinsic image dimensions for school-stage art instead of fill positioning", () => {
    const stageImages = previewPageSource.match(/<Image\s+src=\{stage\.image\}[\s\S]*?\/>/g) ?? [];

    expect(stageImages).toHaveLength(1);
    expect(stageImages.every((image) => !image.includes("fill"))).toBe(true);
    expect(stageImages[0]).toContain('loading={stage.id === "primary" ? "eager" : "lazy"}');
  });

  it("keeps the floating Starbao inside the hero patrol while preserving chat access", () => {
    const { container } = render(<PreviewPage />);
    const launcher = screen.getByRole("button", { name: "Open star chat" });

    expect(container.querySelector("#top")).toContainElement(launcher);
    expect(launcher).not.toHaveAttribute("aria-grabbed");
    expect(previewPageSource).toContain("styles.heroPetPatrol");
    expect(previewPageSource).toContain("styles.petPatrolIdle");
    expect(previewPageSource).toContain("styles.petPatrolWalk");
    expect(previewPageSource).toContain("styles.petPatrolSprite");
    expect(previewPageSource).toContain("data-patrol-state={heroPetPatrolState}");
    expect(previewPageSource).toContain("data-patrol-direction={heroPetPatrolDirection}");
    expect(previewPageSource).toContain("usePatrolMotionState");
    expect(previewPageSource).toContain("StarbaoSprite mood={petMood}");
    expect(previewPageSource).toContain('StarbaoSprite mood="walk"');
    expect(previewStylesSource).toContain("@keyframes heroPetPatrolMotion");
    expect(previewStylesSource).toContain('.heroPetPatrol[data-patrol-direction="left"]');
    expect(previewStylesSource).not.toContain("@keyframes heroPetPatrolFacing");
    expect(previewStylesSource).toContain("17.28s linear");
    expect(starbaoSpriteStylesSource).toContain("walk-cycle.png");
    expect(starbaoSpriteStylesSource).toContain("starbaoEighteenFrameSequence");
    expect(starbaoSpriteStylesSource).not.toContain("105.8823529412% 0");
    expect(previewStylesSource).toContain("animation-play-state: paused");

    fireEvent.click(launcher);
    expect(screen.getByRole("complementary", { name: "???????" })).toBeInTheDocument();
  });

  it("uses the original pixel indicator instead of the thinking frame sheet and loading dots", () => {
    sharedConversationState.isSending = true;
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));

    const thinkingStatus = screen.getByRole("status", { name: "Starbao is thinking" });
    expect(screen.getByTestId("starbao-thinking-ghost")).toBeInTheDocument();
    expect(screen.queryByTestId("starbao-thinking-sprite")).not.toBeInTheDocument();
    expect(screen.queryByTestId("starbao-thinking-dot")).not.toBeInTheDocument();
    expect(thinkingStatus).not.toHaveTextContent("??????");
  });

  it("uses sleep after inactivity and returns to idle when a Starbao reply completes", async () => {
    vi.useFakeTimers();
    try {
      const { container, unmount } = render(<PreviewPage />);
      act(() => vi.advanceTimersByTime(30_000));
      expect(container.querySelector('#top [data-starbao-mood="sleep"]')).toBeInTheDocument();
      unmount();
    } finally {
      vi.useRealTimers();
    }

    let resolveTurn: (() => void) | undefined;
    sendTurn.mockImplementation(() => new Promise<void>((resolve) => {
      resolveTurn = resolve;
    }));
    const { container } = render(<PreviewPage />);
    fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));
    fireEvent.change(screen.getByRole("textbox", { name: "???????" }), { target: { value: "??????" } });
    fireEvent.click(screen.getByRole("button", { name: "??" }));

    expect(container.querySelector('#top [data-starbao-mood="thinking"]')).toBeInTheDocument();
    await act(async () => {
      resolveTurn?.();
      await Promise.resolve();
    });
    expect(container.querySelector('#top [data-starbao-mood="idle"]')).toBeInTheDocument();
  });

  it("scrolls the open chat message list to the bottom while Starbao is sending", () => {
    sharedConversationState.isSending = true;
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 480,
    });

    try {
      render(<PreviewPage />);
      fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));

      const messageList = screen.getByRole("status", { name: "Starbao is thinking" }).parentElement;
      expect(messageList?.scrollTop).toBe(480);
    } finally {
      if (originalScrollHeight) {
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
      }
    }
  });

  it("moves the storybook page with global gesture navigation and stays within its bounds", () => {
    render(<PreviewPage />);

    expect(screen.getByText("? 1 / 3 ?")).toBeInTheDocument();

    dispatchGestureNavigation("next");
    expect(screen.getByText("? 2 / 3 ?")).toBeInTheDocument();

    dispatchGestureNavigation("previous");
    expect(screen.getByText("? 1 / 3 ?")).toBeInTheDocument();

    dispatchGestureNavigation("previous");
    expect(screen.getByText("? 1 / 3 ?")).toBeInTheDocument();

    dispatchGestureNavigation("next");
    dispatchGestureNavigation("next");
    dispatchGestureNavigation("next");
    expect(screen.getByText("? 3 / 3 ?")).toBeInTheDocument();
  });

  it("removes its global gesture navigation listener when it unmounts", () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<PreviewPage />);

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(GESTURE_NAVIGATE_EVENT, expect.any(Function));
    removeEventListener.mockRestore();
  });
});