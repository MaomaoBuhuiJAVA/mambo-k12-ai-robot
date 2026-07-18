import type { ReadonlyCurriculumCourse } from "@/data/curriculum";

export interface StorybookIllustration {
  readonly src: string;
  readonly alt: string;
}

const ILLUSTRATIONS = {
  sorting: { src: "/storybook/sorting-lab.png", alt: "四个数字泡泡相邻排队并用弧线标出移动方向" },
  feature: { src: "/storybook/feature-studio.png", alt: "输入节点、隐藏特征节点和输出节点连接成分类计算图" },
  data: { src: "/storybook/data-journey.png", alt: "四块编号数据沿处理流程依次传递" },
  review: { src: "/storybook/reflection-board.png", alt: "学习复盘板上列出三项已完成检查" },
} as const satisfies Record<string, StorybookIllustration>;

interface IllustrationPage {
  readonly title: string;
  readonly narration?: string;
  readonly scene: string;
}

export function selectStorybookIllustration(
  course: ReadonlyCurriculumCourse,
  page: IllustrationPage,
  index: number,
  totalPages = course.storybook.length,
): StorybookIllustration {
  const content = `${page.title} ${page.narration ?? ""} ${page.scene}`;
  if (index === totalPages - 1 || /总结|复盘|回顾|完成|终点|报告预测|检验规则/.test(content)) {
    return ILLUSTRATIONS.review;
  }

  const courseContext = `${course.id} ${course.title} ${course.animation.template}`;
  const isSorting = /冒泡|排序|bubble|sort/i.test(courseContext);
  const isClassification = /神经|分类|图像|特征|neural|classif|picture-label/i.test(courseContext);

  if (isSorting) {
    return /记录|次数|轮次|数据/.test(content) ? ILLUSTRATIONS.data : ILLUSTRATIONS.sorting;
  }
  if (isClassification) {
    return /特征|连接|权重|类别|概率|分类|标签|规则|线索/.test(content) ? ILLUSTRATIONS.feature : ILLUSTRATIONS.data;
  }
  if (/排序|相邻|交换/.test(content)) return ILLUSTRATIONS.sorting;
  if (/神经|特征|类别|概率|分类/.test(content)) return ILLUSTRATIONS.feature;
  return ILLUSTRATIONS.data;
}
