export type GestureVoiceCommand =
  | "start"
  | "stop"
  | { type: "device"; action: "capture_snapshot" };

const START_COMMANDS = new Set([
  "开启手势",
  "打开手势",
  "启动手势",
  "开启手势控制",
  "打开手势控制",
  "启动手势控制",
]);

const STOP_COMMANDS = new Set([
  "关闭手势",
  "停止手势",
  "禁用手势",
  "关闭手势控制",
  "停止手势控制",
  "禁用手势控制",
]);

const CAPTURE_SNAPSHOT_COMMANDS = new Set([
  "点击拍照",
  "拍照",
  "帮我拍照",
  "拍一张照片",
  "拍张照片",
]);

function normalizeCommand(text: string): string {
  return text.trim().replace(/[\s,，。.!！?？、]/g, "");
}

export function parseGestureVoiceCommand(text: string): GestureVoiceCommand | null {
  const command = normalizeCommand(text);
  if (START_COMMANDS.has(command)) return "start";
  if (STOP_COMMANDS.has(command)) return "stop";
  if (CAPTURE_SNAPSHOT_COMMANDS.has(command)) {
    return { type: "device", action: "capture_snapshot" };
  }
  return null;
}
