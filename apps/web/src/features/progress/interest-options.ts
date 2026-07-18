export const INTEREST_OPTIONS = [
  { id: "algorithm", label: "算法与排序", keywords: ["算法", "排序", "循环"] },
  { id: "image", label: "图像识别", keywords: ["图片", "图像", "分类", "像素"] },
  { id: "programming", label: "编程实践", keywords: ["代码", "编程", "变量"] },
  { id: "data", label: "数据与公平", keywords: ["数据", "偏差", "审计"] },
] as const;

export function interestKeywords(interest: string): readonly string[] {
  const option = INTEREST_OPTIONS.find((candidate) => candidate.id === interest);
  const fallback = interest.trim();
  return option?.keywords ?? (fallback ? [fallback] : []);
}
