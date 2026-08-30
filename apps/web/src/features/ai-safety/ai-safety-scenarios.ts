export interface AiSafetyScenario {
  id: "privacy" | "authorization" | "verification" | "responsibility";
  title: string;
  situation: string;
  action: string;
  reason: string;
}

export const AI_SAFETY_SCENARIOS: readonly AiSafetyScenario[] = [
  { id: "privacy", title: "班级照片", situation: "小组想把带有姓名牌的全班照片上传给分类工具。", action: "先移除不必要的可识别信息，并由教师按规定确认是否可以使用。", reason: "姓名和清晰照片可能识别到具体同学，完成任务不必收集就不应上传。" },
  { id: "authorization", title: "训练资料", situation: "同学发来其他班级的照片，说“网上也有人在用”。", action: "确认来源、用途和明确授权，只使用获准且必要的资料。", reason: "资料公开可见不等于已同意被用于这项训练任务。" },
  { id: "verification", title: "模型结论", situation: "AI 说实验器材“完全安全”，但没有读取现场信息。", action: "把结果当作提示，按学校流程请教师核对现场条件。", reason: "模型预测不是现场事实，也不能替代安全检查流程。" },
  { id: "responsibility", title: "高风险建议", situation: "模型建议把一名同学排除在校园活动之外。", action: "停止自动执行，交由有责任的成人按证据和规定复核。", reason: "涉及他人权益的决定需要人承担责任并说明依据，不能交给模型单独决定。" },
] as const;

export function isSafeScenarioResponse(scenario: AiSafetyScenario, action: string, reason: string): boolean {
  return action === scenario.action && reason === scenario.reason;
}
