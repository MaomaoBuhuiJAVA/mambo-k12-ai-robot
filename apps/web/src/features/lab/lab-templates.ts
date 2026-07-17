import type { Stage } from "@/lib/domain";
import type { LabTemplateId } from "./lab-protocol";

export interface LabTemplate {
  id: LabTemplateId;
  label: string;
  title: string;
  task: string;
  hints: readonly string[];
  starterCode: string;
  knowledgePointId: string;
}

export const LAB_TEMPLATES: Record<LabTemplateId, LabTemplate> = {
  "bubble-sort": {
    id: "bubble-sort",
    label: "冒泡排序",
    title: "让相邻数字排好队",
    task: "补全 bubble_sort：返回从小到大排列的新列表，不修改输入列表。",
    hints: [
      "外层循环决定还要完成几轮比较。",
      "只比较相邻的 values[index] 和 values[index + 1]。",
      "左边更大时交换；一轮没有交换就可以提前结束。",
    ],
    starterCode: `def bubble_sort(values):
    result = values[:]
    # TODO: 在这里完成冒泡排序
    return result


print(bubble_sort([5, 1, 4, 2, 8]))`,
    knowledgePointId: "algorithm.bubble-sort",
  },
  "image-classifier": {
    id: "image-classifier",
    label: "图像分类",
    title: "用特征分数选择标签",
    task: "补全 classify_image：根据颜色、形状和纹理分数返回 leaf、ball 或 cup。",
    hints: [
      "先为三个标签建立从 0 开始的分数。",
      "green 对 leaf 加分，round 对 ball 加分，handle 对 cup 加分。",
      "用 max(scores, key=scores.get) 找到分数最高的标签。",
    ],
    starterCode: `def classify_image(features):
    scores = {"leaf": 0, "ball": 0, "cup": 0}
    # TODO: 根据 features 中的 color、shape、texture 更新分数
    return max(scores, key=scores.get)


sample = {"color": "green", "shape": "long", "texture": "veined"}
print(classify_image(sample))`,
    knowledgePointId: "ai.image-classification-features",
  },
};

export const DEFAULT_LAB_TEMPLATE_ID: LabTemplateId = "bubble-sort";

export function getLabTemplate(id: LabTemplateId): LabTemplate {
  return LAB_TEMPLATES[id];
}

export function getLabGuidance(
  id: LabTemplateId,
  stage: Stage,
): Pick<LabTemplate, "task" | "hints"> {
  const template = getLabTemplate(id);
  if (stage === "lower_primary") {
    return id === "bubble-sort"
      ? {
          task: "帮助数字卡从小到大排队。每次只比较两个邻居，原来的数字卡要保留。",
          hints: [
            "先让第一张卡和第二张卡比大小。",
            "左边数字更大，就让两张卡交换位置。",
            "一轮结束后再从队头出发，直到整队都不需要交换。",
          ],
        }
      : {
          task: "给叶子、球和杯子分别计分，再选出分数最高的图片标签。",
          hints: [
            "绿色和叶脉是叶子的线索。",
            "圆形和条纹是球的线索，有把手是杯子的线索。",
            "每找到一条线索就给对应标签加分，最后选最高分。",
          ],
        };
  }
  if (stage === "upper_primary") {
    return id === "bubble-sort"
      ? {
          task: "补全相邻比较和交换，让函数返回有序的新列表。",
          hints: template.hints,
        }
      : {
          task: "把颜色、形状和纹理转成标签分数，返回最高分标签。",
          hints: template.hints,
        };
  }
  if (stage === "middle_school") {
    return id === "bubble-sort"
      ? {
          task: "实现 bubble_sort，并用 swapped 标记在已有序时提前结束。",
          hints: [
            "外层循环逐步缩小尚未确定的区间。",
            "内层循环比较 index 与 index + 1。",
            "本轮未交换说明列表已有序，可以 break。",
          ],
        }
      : {
          task: "设计可解释的特征计分规则，让三个测试样本得到正确标签。",
          hints: template.hints,
        };
  }
  return id === "bubble-sort"
    ? {
        task: "实现不修改输入的 bubble_sort，并加入提前退出以改善已有序输入。",
        hints: [
          "用循环不变量描述每轮结束后已经确定的后缀。",
          "内层比较范围应随 end 递减，避免重复检查确定区间。",
          "用 swapped 证明何时可以安全提前退出。",
        ],
      }
    : {
        task: "实现可审计的特征打分分类器，并说明平分时规则的确定性。",
        hints: [
          "把特征到类别权重的映射集中表达，便于审计。",
          "确保每个测试样本至少有一个区分度足够的强特征。",
          "检查 max 在分数相同时依赖的插入顺序是否符合既定策略。",
        ],
      };
}

export function appendDeterministicChecks(id: LabTemplateId, code: string): string {
  const checks = id === "bubble-sort"
    ? `
_mambo_cases = [([], []), ([1], [1]), ([3, 1, 2], [1, 2, 3]), ([4, 4, -1], [-1, 4, 4])]
for _source, _expected in _mambo_cases:
    _before = _source[:]
    _actual = bubble_sort(_source)
    assert _actual == _expected, f"输入 {_source} 时得到 {_actual}，期望 {_expected}"
    assert _source == _before, "请不要修改传入的原列表"
_mambo_passed = True
print("挑战测试：全部通过")`
    : `
_mambo_cases = [
    ({"color": "green", "shape": "long", "texture": "veined"}, "leaf"),
    ({"color": "white", "shape": "round", "texture": "striped"}, "ball"),
    ({"color": "blue", "shape": "tall", "texture": "handle"}, "cup"),
]
for _features, _expected in _mambo_cases:
    _actual = classify_image(_features)
    assert _actual == _expected, f"特征 {_features} 得到 {_actual}，期望 {_expected}"
_mambo_passed = True
print("挑战测试：全部通过")`;

  return `${code}\n\n# 课程的确定性检查（用于形成性练习）\n${checks}`;
}
