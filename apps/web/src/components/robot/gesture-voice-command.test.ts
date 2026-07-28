import { describe, expect, it } from "vitest";

import { parseGestureVoiceCommand } from "./gesture-voice-command";

describe("parseGestureVoiceCommand", () => {
  it("recognizes explicit start phrases despite speech punctuation", () => {
    expect(parseGestureVoiceCommand("打开手势控制。")).toBe("start");
    expect(parseGestureVoiceCommand("启动手势")).toBe("start");
  });

  it("recognizes explicit stop phrases", () => {
    expect(parseGestureVoiceCommand("关闭手势控制")) .toBe("stop");
    expect(parseGestureVoiceCommand("停止手势")) .toBe("stop");
  });

  it("does not treat a question about gestures as a device command", () => {
    expect(parseGestureVoiceCommand("怎么开启手势控制")) .toBeNull();
    expect(parseGestureVoiceCommand("请讲解手势控制")) .toBeNull();
  });

  it("recognizes explicit capture snapshot phrases", () => {
    const captureSnapshot = { type: "device", action: "capture_snapshot" };

    for (const phrase of ["点击拍照", "拍照", "帮我拍照", "拍一张照片", "拍张照片"]) {
      expect(parseGestureVoiceCommand(phrase)).toEqual(captureSnapshot);
    }
  });

  it("does not treat photo help or ordinary speech as a capture command", () => {
    expect(parseGestureVoiceCommand("拍照功能怎么用")).toBeNull();
    expect(parseGestureVoiceCommand("今天天气怎么样")).toBeNull();
  });
});
