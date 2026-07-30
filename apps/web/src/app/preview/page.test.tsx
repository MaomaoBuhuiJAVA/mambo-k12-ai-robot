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
      content: "我想看看泡泡排序",
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
      content: "我们先比较相邻的两个数字。",
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

    expect(screen.getByText("我想看看泡泡排序")).toBeInTheDocument();
    expect(screen.getByText("我们先比较相邻的两个数字。")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "设备信息" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "图像分类" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "去二楼" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "同步到香橙派播报" })).not.toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "和星宝说点什么" });
    fireEvent.change(input, { target: { value: "带我从第一步开始" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(sendTurn).toHaveBeenCalledWith({
      text: "带我从第一步开始",
      stage: "lower_primary",
      courseId: "lower-bubble-sort",
      origin: "web",
    });
  });

  it("uses Chinese identity copy in the compact Starbao chat header", () => {
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));

    const panel = screen.getByRole("complementary", { name: "星星智能体面板" });
    expect(panel).toHaveTextContent("星宝");
    expect(panel).toHaveTextContent("学习伙伴 · 在线");
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

    const panel = screen.getByRole("complementary", { name: "星星智能体面板" });
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

    const chatPreview = screen.getByRole("group", { name: "星宝聊天窗口预览" });
    expect(chatPreview).toContainElement(screen.getByRole("img", { name: "星宝聊天窗口截图" }));

    const terminalPreview = screen.getByRole("group", { name: "Python 终端预览" });
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

    expect(screen.queryByRole("button", { name: "小小探索家，小学低年级，故事 · 声音 · 观察" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "创意实验室，小学高年级，动画 · 编程 · 实验" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "未来研究所，初中 · 高中，算法 · 模型 · 项目" })).not.toBeInTheDocument();
    expect(screen.queryByText("点击楼层，进入对应的学习屋")).not.toBeInTheDocument();
  });

  it("does not render the house scene beside the homepage introduction", () => {
    const { container } = render(<PreviewPage />);

    expect(container.querySelector("#house")).not.toBeInTheDocument();
  });

  it("does not render the removed hero house or its foundation", () => {
    const { container } = render(<PreviewPage />);

    expect(screen.queryByText("给每个好奇心一间房")).not.toBeInTheDocument();
    expect(screen.queryByText("星星机器人 · 演示在线")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("三层学习屋")).not.toBeInTheDocument();
    expect(container.querySelector("img[src*='user-house-three-level.png']")).not.toBeInTheDocument();
    expect(container.querySelector("img[src*='user-house-foundation.png']")).not.toBeInTheDocument();
  });

  it("places the interactive Starbao journey card in the hero", () => {
    render(<PreviewPage />);

    const journey = screen.getByRole("region", { name: "星宝学习旅程" });
    expect(journey).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前往第 1 步" })).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "下一步" }));

    expect(screen.getByRole("button", { name: "前往第 2 步" })).toHaveAttribute("aria-current", "step");
  });

  it("keeps the woodland path in sync across next, direct-path, and previous navigation", () => {
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByRole("button", { name: "前往第 2 步" })).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "前往第 4 步" }));
    expect(screen.getByRole("button", { name: "前往第 4 步" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "开始" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "上一步" }));
    expect(screen.getByRole("button", { name: "前往第 3 步" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { name: "你对AI了解多少？" })).toBeInTheDocument();
  });

  it("keeps the clickable woodland path above the changing step content", () => {
    expect(stepperSource).toMatch(/progressTrack: \{[\s\S]*?zIndex: 2,/);
    expect(stepperSource).toMatch(/content: \{[\s\S]*?zIndex: 1,/);
  });

  it("uses centered concise choice labels and centers each pinecone number", () => {
    expect(journeyCardSource).toContain("label: '新人'");
    expect(journeyCardSource).toContain("label: '高手'");
    expect(journeyCardSource).toContain("label: '程序员'");
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
    expect(Array.from(container.querySelectorAll("[class*='exhibitStageLabel']")).map((label) => label.textContent)).toEqual(["小学", "初中", "高中"]);
    expect(screen.getByRole("region", { name: "成长展厅" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "从绘本到编程，星宝如影随形" })).toBeInTheDocument();
    expect(screen.getByText("从小教到大")).toBeInTheDocument();
    expect(screen.getByText("Ai学习伙伴-星宝")).toBeInTheDocument();

    expect(screen.queryByRole("group", { name: "选择学习阶段" })).not.toBeInTheDocument();
    expect(container.querySelector("[class*='exhibitBayLabel']")).not.toBeInTheDocument();
    expect(screen.queryByText("星宝的像素旅程")).not.toBeInTheDocument();
    expect(container.querySelector("a[href='#classroom']")).not.toBeInTheDocument();
    expect(container.querySelector("footer")).not.toBeInTheDocument();
    expect(container.querySelector("[class*='floorDetail']")).not.toBeInTheDocument();
    expect(screen.queryByText("网站功能")).not.toBeInTheDocument();
    expect(screen.queryByText("01 · 智能语音对话")).not.toBeInTheDocument();
    expect(screen.queryByText("02 · 绘本动画阅读")).not.toBeInTheDocument();
    expect(screen.queryByText("03 · 编程实操训练")).not.toBeInTheDocument();
    expect(screen.queryByText("桌面上的小伙伴")).not.toBeInTheDocument();
  });

  it("keeps the exhibit artwork and labels free of hover routing behavior", () => {
    const { container } = render(<PreviewPage />);

    expect(screen.queryByText("读写启蒙")).not.toBeInTheDocument();
    expect(screen.queryByText("思考进阶")).not.toBeInTheDocument();
    expect(screen.queryByText("编程创造")).not.toBeInTheDocument();
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
    expect(previewPageSource).toContain("StarbaoSprite mood={petMood}");
    expect(previewPageSource).toContain('StarbaoSprite mood="walk"');
    expect(previewStylesSource).toContain("@keyframes heroPetPatrolMotion");
    expect(previewStylesSource).toContain("@keyframes heroPetPatrolFacing");
    expect(previewStylesSource).toContain("17.28s linear");
    expect(starbaoSpriteStylesSource).toContain("walk-cycle.png");
    expect(starbaoSpriteStylesSource).toContain("starbaoEighteenFrameSequence");
    expect(starbaoSpriteStylesSource).not.toContain("105.8823529412% 0");
    expect(previewStylesSource).toContain("animation-play-state: paused");

    fireEvent.click(launcher);
    expect(screen.getByRole("complementary", { name: "星星智能体面板" })).toBeInTheDocument();
  });

  it("uses the original pixel indicator instead of the thinking frame sheet and loading dots", () => {
    sharedConversationState.isSending = true;
    render(<PreviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "Open star chat" }));

    const thinkingStatus = screen.getByRole("status", { name: "Starbao is thinking" });
    expect(screen.getByTestId("starbao-thinking-ghost")).toBeInTheDocument();
    expect(screen.queryByTestId("starbao-thinking-sprite")).not.toBeInTheDocument();
    expect(screen.queryByTestId("starbao-thinking-dot")).not.toBeInTheDocument();
    expect(thinkingStatus).not.toHaveTextContent("星宝正在思考");
  });

  it("uses sleep after inactivity and celebrates when a Starbao reply completes", async () => {
    vi.useFakeTimers();
    try {
      const { container, unmount } = render(<PreviewPage />);
      act(() => vi.advanceTimersByTime(6500));
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
    fireEvent.change(screen.getByRole("textbox", { name: "和星宝说点什么" }), { target: { value: "这个答案对吗" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(container.querySelector('#top [data-starbao-mood="thinking"]')).toBeInTheDocument();
    await act(async () => {
      resolveTurn?.();
      await Promise.resolve();
    });
    expect(container.querySelector('#top [data-starbao-mood="cheer"]')).toBeInTheDocument();
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

    expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument();

    dispatchGestureNavigation("next");
    expect(screen.getByText("第 2 / 3 页")).toBeInTheDocument();

    dispatchGestureNavigation("previous");
    expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument();

    dispatchGestureNavigation("previous");
    expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument();

    dispatchGestureNavigation("next");
    dispatchGestureNavigation("next");
    dispatchGestureNavigation("next");
    expect(screen.getByText("第 3 / 3 页")).toBeInTheDocument();
  });

  it("removes its global gesture navigation listener when it unmounts", () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<PreviewPage />);

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(GESTURE_NAVIGATE_EVENT, expect.any(Function));
    removeEventListener.mockRestore();
  });
});
