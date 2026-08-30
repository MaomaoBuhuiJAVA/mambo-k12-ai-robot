import type { Stage } from "../lib/domain";

export type ExerciseType = "single_choice" | "multi_select" | "order" | "code_trace" | "code_fill" | "result_interpretation" | "classification";
export type AnimationControl = "play" | "pause" | "step" | "reset" | "speed";

interface ExerciseBase {
  id: string;
  prompt: string;
  feedback: {
    correct: string;
    incorrect: string;
  };
  knowledgePointTags: string[];
}

export interface SingleChoiceExercise extends ExerciseBase {
  type: "single_choice";
  options: string[];
  answer: string;
}

export interface MultiSelectExercise extends ExerciseBase {
  type: "multi_select";
  options: string[];
  answers: string[];
  /** A compact display value for legacy course-summary consumers. */
  answer: string;
}

export interface OrderExercise extends ExerciseBase {
  type: "order";
  items: string[];
  answer: string[];
}

export interface CodeTraceExercise extends ExerciseBase {
  type: "code_trace";
  code: string;
  answer: string;
}

export interface CodeFillExercise extends ExerciseBase {
  type: "code_fill";
  code: string;
  answer: string;
  placeholder?: string;
}

export interface ResultInterpretationExercise extends ExerciseBase {
  type: "result_interpretation";
  result: string;
  options: string[];
  answer: string;
}

export interface ClassificationSample {
  id: string;
  title: string;
  features: string[];
  evidence: string;
}

export interface ClassificationTrainingSample extends ClassificationSample {
  label: string;
}

export interface ClassificationExercise extends ExerciseBase {
  type: "classification";
  labels: string[];
  trainingSamples: ClassificationTrainingSample[];
  testSample: ClassificationSample;
  /** The label selected by a deterministic answer check. */
  answer: string;
  /** Evidence shown after submission to connect the label to observed features. */
  classificationEvidence: string;
}

export type CourseExercise =
  | SingleChoiceExercise
  | MultiSelectExercise
  | OrderExercise
  | CodeTraceExercise
  | CodeFillExercise
  | ResultInterpretationExercise
  | ClassificationExercise;

export interface StorybookPage {
  title: string;
  narration: string;
  scene: string;
  interaction: string;
}

export interface CourseAnimation {
  template: string;
  entities: Array<{
    id: string;
    label: string;
    role: string;
  }>;
  steps: Array<{
    id: string;
    narration: string;
    activeEntityIds: string[];
  }>;
  controls: AnimationControl[];
}

export interface CurriculumCourse {
  id: string;
  title: string;
  summary: string;
  stage: Stage;
  featured: boolean;
  knowledgePointTags: string[];
  objectives: string[];
  ageAdaptation: {
    depth: string;
    language: string;
    activity: string;
  };
  explanation: {
    overview: string;
    keyIdeas: string[];
    workedExample: string;
  };
  materials: Array<{
    name: string;
    purpose: string;
  }>;
  animation: CourseAnimation;
  storybook: StorybookPage[];
  starterCode: string;
  exercises: CourseExercise[];
}

interface CourseSeed {
  id: string;
  title: string;
  summary: string;
  stage: Stage;
  featured: boolean;
  knowledgePointTags: [string, string, ...string[]];
  objectives: [string, string, ...string[]];
  activity: string;
  overview: string;
  keyIdeas: [string, string, ...string[]];
  workedExample: string;
  materials: [string, string, ...string[]];
  animationTemplate: string;
  storyMoments: [string, string, string, string];
  starterCode: string;
  choice: {
    prompt: string;
    options: [string, string, ...string[]];
    answer: string;
  };
  order: {
    prompt: string;
    steps: [string, string, ...string[]];
  };
  trace: {
    prompt: string;
    code: string;
    answer: string;
  };
  interpretation?: {
    prompt: string;
    result: string;
    options: [string, string, ...string[]];
    answer: string;
  };
  classification?: {
    prompt: string;
    labels: [string, string, ...string[]];
    trainingSamples: [
      { id: string; title: string; label: string; features: [string, ...string[]]; evidence: string },
      { id: string; title: string; label: string; features: [string, ...string[]]; evidence: string },
      ...Array<{ id: string; title: string; label: string; features: [string, ...string[]]; evidence: string }>,
    ];
    testSample: { id: string; title: string; features: [string, ...string[]]; evidence: string };
    answer: string;
    classificationEvidence: string;
  };
}

const STAGE_ADAPTATION: Record<Stage, Pick<CurriculumCourse["ageAdaptation"], "depth" | "language">> = {
  lower_primary: {
    depth: "用可移动物品和单步因果建立直觉，不引入抽象公式。",
    language: "短句、角色对话与可观察动作。",
  },
  upper_primary: {
    depth: "把直觉整理为规则，用记录表发现重复模式。",
    language: "明确规则词，并用生活任务连接简单代码。",
  },
  middle_school: {
    depth: "追踪变量、数据流与误差，比较模型行为及其限制。",
    language: "使用准确术语，并要求学生给出因果解释。",
  },
  high_school: {
    depth: "用复杂度、参数、证据和边界条件论证算法选择。",
    language: "采用技术报告语言，区分观察、推断与结论。",
  },
};

const STAGE_INTERACTION: Record<Stage, string> = {
  lower_primary: "拖动或点按一个角色，口头说出下一步。",
  upper_primary: "先填写预测，再点击验证并修正规则。",
  middle_school: "调整一个变量，记录前后状态并解释变化。",
  high_school: "选择实验参数，比较证据后提交可复核结论。",
};

const CONTROLS: AnimationControl[] = [
  "play",
  "pause",
  "step",
  "reset",
  "speed",
];

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ReadonlyCurriculumCourse = DeepReadonly<CurriculumCourse>;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nestedValue of Object.values(
      value as object as Record<string, unknown>,
    )) {
      deepFreeze(nestedValue);
    }
    Object.freeze(value);
  }

  return value as DeepReadonly<T>;
}

function makeCourse(seed: CourseSeed): CurriculumCourse {
  const entityIds = seed.knowledgePointTags.map(
    (_, index) => `${seed.id}-entity-${index + 1}`,
  );

  return {
    id: seed.id,
    title: seed.title,
    summary: seed.summary,
    stage: seed.stage,
    featured: seed.featured,
    knowledgePointTags: [...seed.knowledgePointTags],
    objectives: [...seed.objectives],
    ageAdaptation: {
      ...STAGE_ADAPTATION[seed.stage],
      activity: seed.activity,
    },
    explanation: {
      overview: seed.overview,
      keyIdeas: [...seed.keyIdeas],
      workedExample: seed.workedExample,
    },
    materials: seed.materials.map((name) => ({
      name,
      purpose: `用于“${seed.title}”的观察、操作或记录。`,
    })),
    animation: {
      template: seed.animationTemplate,
      entities: seed.knowledgePointTags.map((label, index) => ({
        id: entityIds[index],
        label,
        role: index === 0 ? "focus" : "support",
      })),
      steps: seed.storyMoments.map((narration, index) => ({
        id: `${seed.id}-step-${index + 1}`,
        narration,
        activeEntityIds: [entityIds[index % entityIds.length]],
      })),
      controls: [...CONTROLS],
    },
    storybook: seed.storyMoments.map((moment, index) => ({
      title: `${seed.title} · 第${index + 1}幕`,
      narration: moment,
      scene: `场景聚焦“${seed.keyIdeas[index % seed.keyIdeas.length]}”，展示动作前后的状态。`,
      interaction: STAGE_INTERACTION[seed.stage],
    })),
    starterCode: seed.starterCode,
    exercises: [
      {
        id: `${seed.id}-choice`,
        type: "single_choice",
        prompt: seed.choice.prompt,
        options: [...seed.choice.options],
        answer: seed.choice.answer,
        feedback: {
          correct: "判断正确，你抓住了当前步骤的关键规则。",
          incorrect: "再对照动作前后的状态，只检查本题对应的一个规则。",
        },
        knowledgePointTags: [seed.knowledgePointTags[0]],
      },
      {
        id: `${seed.id}-order`,
        type: "order",
        prompt: seed.order.prompt,
        items: [...seed.order.steps],
        answer: [...seed.order.steps],
        feedback: {
          correct: "顺序正确，每一步都为下一步准备了所需状态。",
          incorrect: "先找必须最早发生的动作，再检查每一步依赖的结果。",
        },
        knowledgePointTags: [...seed.knowledgePointTags],
      },
      {
        id: `${seed.id}-trace`,
        type: "code_trace",
        prompt: seed.trace.prompt,
        code: seed.trace.code,
        answer: seed.trace.answer,
        feedback: {
          correct: "追踪正确，你按执行顺序更新了变量。",
          incorrect: "逐行写下变量的新值，不要直接猜最终输出。",
        },
        knowledgePointTags: [seed.knowledgePointTags.at(-1) ?? seed.knowledgePointTags[0]],
      },
      {
        id: `${seed.id}-multi-select`,
        type: "multi_select",
        prompt: `学习“${seed.title}”时，哪些内容应该一起记录？`,
        options: [
          ...seed.knowledgePointTags.slice(0, 2),
          "只看最后一次分数",
        ],
        answers: [...seed.knowledgePointTags.slice(0, 2)],
        answer: seed.knowledgePointTags.slice(0, 2).join("、"),
        feedback: {
          correct: "选择完整，学习证据需要同时包含概念和可观察的过程。",
          incorrect: "不要只看最后分数，回到课程目标检查需要记录的概念和过程。",
        },
        knowledgePointTags: [...seed.knowledgePointTags.slice(0, 2)],
      },
      {
        id: `${seed.id}-fill`,
        type: "code_fill",
        prompt: `补全代码输出中的关键结果：${seed.trace.prompt}`,
        code: seed.trace.code,
        answer: seed.trace.answer,
        placeholder: "填写程序输出",
        feedback: {
          correct: "填空正确，输出和执行路径一致。",
          incorrect: "先逐行追踪变量，再把最终输出填入空格。",
        },
        knowledgePointTags: [seed.knowledgePointTags.at(-1) ?? seed.knowledgePointTags[0]],
      },
      ...(seed.interpretation ? [{
        id: `${seed.id}-result`,
        type: "result_interpretation" as const,
        prompt: seed.interpretation.prompt,
        result: seed.interpretation.result,
        options: [...seed.interpretation.options],
        answer: seed.interpretation.answer,
        feedback: {
          correct: "解释正确，你把模型结果当作需要核对的证据，而不是事实本身。",
          incorrect: "先区分模型给出的预测与人工或新证据核对后的事实。",
        },
        knowledgePointTags: [seed.knowledgePointTags.at(-1) ?? seed.knowledgePointTags[0]],
      }] : []),
      ...(seed.classification ? [{
        id: `${seed.id}-classification`,
        type: "classification" as const,
        prompt: seed.classification.prompt,
        labels: [...seed.classification.labels],
        trainingSamples: seed.classification.trainingSamples.map((sample) => ({
          id: sample.id,
          title: sample.title,
          label: sample.label,
          features: [...sample.features],
          evidence: sample.evidence,
        })),
        testSample: {
          id: seed.classification.testSample.id,
          title: seed.classification.testSample.title,
          features: [...seed.classification.testSample.features],
          evidence: seed.classification.testSample.evidence,
        },
        answer: seed.classification.answer,
        classificationEvidence: seed.classification.classificationEvidence,
        feedback: {
          correct: "标签和训练样本中的可观察特征一致。",
          incorrect: "先对照训练样本的标签和特征，再检查待分类样本的证据。",
        },
        knowledgePointTags: [...seed.knowledgePointTags.slice(0, 2)],
      }] : []),
    ],
  };
}

export const CURRICULUM: DeepReadonly<CurriculumCourse[]> = deepFreeze([
  makeCourse({
    id: "lower-bubble-sort",
    title: "冒泡排序",
    summary: "让数字泡泡两两比身高，把较大的泡泡一步步送到队尾。",
    stage: "lower_primary",
    featured: true,
    knowledgePointTags: ["相邻比较", "交换", "从小到大"],
    objectives: ["指出一对相邻数字中较大的数", "用交换动作排好四张数字卡"],
    activity: "四名学生举数字牌站成一排，每次只允许相邻两人换位。",
    overview: "冒泡排序像一队泡泡过窄门：每次只比较邻居，顺序不对就交换。完成一轮后，最大的数字会来到最右边。",
    keyIdeas: ["一次只看相邻两个数", "左边更大时交换", "重复几轮直到没有交换"],
    workedExample: "数字卡 3、1、2 先把 3 和 1 交换成 1、3、2，再把 3 和 2 交换成 1、2、3。",
    materials: ["1 至 6 数字卡", "相邻比较箭头", "轮次贴纸"],
    animationTemplate: "bubble-sort-lane",
    storyMoments: [
      "泡泡邮局收到顺序混乱的 3、1、2 号包裹。",
      "3 号和 1 号相邻，3 更大，于是它们交换位置。",
      "3 号继续和 2 号比较并交换，来到队尾。",
      "新一轮没有需要交换的邻居，队伍整齐完成。",
    ],
    starterCode: "numbers = [3, 1, 2]\n# 观察第一对邻居\nif numbers[0] > numbers[1]:\n    numbers[0], numbers[1] = numbers[1], numbers[0]\nprint(numbers)",
    choice: {
      prompt: "比较 4 和 2 时，为了从小到大排列应该怎样做？",
      options: ["交换位置", "保持不动", "删除 4"],
      answer: "交换位置",
    },
    order: {
      prompt: "把一次相邻比较的动作排成正确顺序。",
      steps: ["选中相邻两个数", "判断左边是否更大", "需要时交换位置"],
    },
    trace: {
      prompt: "运行代码后会打印什么？",
      code: "a = [2, 1]\na[0], a[1] = a[1], a[0]\nprint(a)",
      answer: "[1, 2]",
    },
  }),
  makeCourse({
    id: "lower-picture-labels",
    title: "图片标签小侦探",
    summary: "观察颜色、轮廓和局部特征，为校园图片选择合适标签。",
    stage: "lower_primary",
    featured: false,
    knowledgePointTags: ["图片标签", "可见特征", "分类"],
    objectives: ["说出图片中能看见的两个特征", "按同一条规则给图片分组"],
    activity: "把树叶、足球和水杯图片贴到标签圈中，并说出依据。",
    overview: "图像分类就是根据看得见的线索，把图片放进预先约定的类别。标签说明类别名字，特征说明我们为什么这样判断。",
    keyIdeas: ["先看再命名", "同一轮使用同一规则", "不确定时保留问号标签"],
    workedExample: "圆形、有黑白花纹的图片可放入“足球”标签；只看到圆形还不够确定。",
    materials: ["校园物品图片卡", "彩色标签圈", "问号卡"],
    animationTemplate: "picture-label-bins",
    storyMoments: [
      "机器人收到一篮没有名字的校园照片。",
      "它先观察每张照片的颜色、边缘和形状。",
      "照片按照同一规则进入树叶、球和水杯标签箱。",
      "模糊照片被放进问号箱，等待更多线索。",
    ],
    starterCode: "feature = \"round\"\nif feature == \"round\":\n    label = \"可能是球\"\nprint(label)",
    choice: {
      prompt: "给图片分类前最先应该做什么？",
      options: ["观察可见特征", "随便选标签", "把图片删除"],
      answer: "观察可见特征",
    },
    order: {
      prompt: "排列一次图片分类任务。",
      steps: ["观察图片", "找出特征", "选择匹配标签"],
    },
    trace: {
      prompt: "代码会打印哪个标签？",
      code: "color = \"green\"\nlabel = \"leaf\" if color == \"green\" else \"cup\"\nprint(label)",
      answer: "leaf",
    },
  }),
  makeCourse({
    id: "upper-loop-maze",
    title: "循环指令迷宫",
    summary: "把重复路线压缩成循环，再用条件处理路口。",
    stage: "upper_primary",
    featured: true,
    knowledgePointTags: ["顺序", "循环", "条件"],
    objectives: ["识别连续重复的移动指令", "组合循环与条件走出网格迷宫"],
    activity: "先在方格纸上记录逐步路线，再用循环卡压缩重复片段。",
    overview: "程序按顺序执行指令。重复动作可以交给循环，遇到不同路况则由条件选择分支。",
    keyIdeas: ["顺序决定路径", "循环减少重复", "条件响应路口"],
    workedExample: "连续前进三格可写成重复 3 次前进；若前方有墙，再执行右转。",
    materials: ["方格迷宫纸", "方向指令卡", "路线记录表"],
    animationTemplate: "grid-program-runner",
    storyMoments: [
      "探测车先把完整路线逐格记录下来。",
      "记录中连续三次前进被圈成重复片段。",
      "岔路口加入“如果有墙就右转”的条件。",
      "探测车逐条执行压缩后的程序并抵达终点。",
    ],
    starterCode: "position = 0\nfor _ in range(3):\n    position += 1\nprint(position)",
    choice: {
      prompt: "同一条前进指令连续出现五次，哪种结构最合适？",
      options: ["循环", "随机选择", "删除指令"],
      answer: "循环",
    },
    order: {
      prompt: "排列编写迷宫程序的步骤。",
      steps: ["记录完整路线", "找出重复片段", "用循环替换并验证"],
    },
    trace: {
      prompt: "循环结束后 position 是多少？",
      code: "position = 1\nfor _ in range(2):\n    position += 2\nprint(position)",
      answer: "5",
    },
  }),
  makeCourse({
    id: "upper-fruit-classifier",
    title: "水果分拣训练场",
    summary: "用特征表训练一套透明的水果分类规则，并检查新样本。",
    stage: "upper_primary",
    featured: false,
    knowledgePointTags: ["训练样本", "特征表", "分类规则"],
    objectives: ["把图片特征整理成表格", "用训练样本形成规则并测试新图片"],
    activity: "小组填写颜色、形状、表皮三列特征表，交换样本检验规则。",
    overview: "训练样本给出已知图片和标签。我们从特征表中寻找稳定规律，再把规则用于没见过的新图片。",
    keyIdeas: ["样本带有标签", "特征需要可比较", "新样本检验规则"],
    workedExample: "多张橙色、近圆形、表皮有小点的样本都标为橙子，新图片符合三项时可预测为橙子。",
    materials: ["水果图片样本", "三列特征表", "训练与测试信封"],
    animationTemplate: "feature-table-classifier",
    storyMoments: [
      "分拣站把带标签的水果照片放进训练信封。",
      "同学逐张记录颜色、形状和表皮特征。",
      "小组从表格中写出可以检查的分类规则。",
      "测试信封打开，新图片用于检验规则是否可靠。",
    ],
    starterCode: "color = \"orange\"\nshape = \"round\"\nlabel = \"orange\" if color == \"orange\" and shape == \"round\" else \"other\"\nprint(label)",
    choice: {
      prompt: "哪一组最适合作为可比较的图片特征？",
      options: ["颜色和形状", "好不好吃", "拍照的人是谁"],
      answer: "颜色和形状",
    },
    order: {
      prompt: "排列建立并检验分类规则的步骤。",
      steps: ["查看带标签样本", "整理特征规律", "预测新图片标签"],
    },
    trace: {
      prompt: "代码输出什么？",
      code: "round_shape = True\norange_color = False\nprint(round_shape and orange_color)",
      answer: "False",
    },
  }),
  makeCourse({
    id: "middle-ai-foundations",
    title: "人工智能基础：从规则到学习",
    summary: "比较固定规则与从数据中学习的模型，认识样本、特征、标签和预测的边界。",
    stage: "middle_school",
    featured: true,
    knowledgePointTags: ["规则程序与机器学习", "数据样本", "特征与标签", "模型预测与误差"],
    objectives: [
      "区分人写好的固定规则与从样本中归纳规律的机器学习模型",
      "用生活图片案例说明数据、样本、特征、标签、模型和预测之间的关系",
      "解释预测不是事实，并指出模型可能出错的一个原因",
    ],
    activity: "查看校园失物图片卡，先写固定分类规则，再比较样本不足时的预测结果。",
    overview: "普通规则程序由人事先写清“如果什么情况就做什么”。机器学习模型则从带标签的样本中寻找规律，再对新样本给出预测。预测依据数据和特征，不等于事实；样本少、特征不完整或场景变化时，模型都可能出错。",
    keyIdeas: [
      "规则程序按人工写好的条件执行，机器学习从样本中学习模式",
      "数据由多个样本组成；特征是可比较的线索，标签是已知类别名称",
      "模型根据特征给出预测，预测需要用新证据检验",
      "错误并不总是偶然，缺少某类样本会让模型在该场景更不可靠",
    ],
    workedExample: "失物招领处想把图片分成“水杯”和“书本”。规则程序可以规定“有瓶盖且细长就标水杯”；机器学习则查看许多已标注图片中的形状、颜色和边缘特征。新图片被预测为水杯时，仍要人工核对，因为侧放的书本或被遮挡的水杯可能让模型判断错误。",
    materials: ["校园失物图片样本", "特征与标签记录表", "固定规则卡", "预测核对单"],
    animationTemplate: "rule-and-data-classification",
    storyMoments: [
      "星宝收到一组没有分类的校园失物照片，先发现只靠肉眼猜测并不可靠。",
      "它用固定规则卡处理清晰的水杯和书本，但遇到被遮挡的图片时规则无法确定。",
      "接着，星宝查看带有标签的样本表，记录形状、瓶盖和页面边缘等特征。",
      "模型对新图片给出预测，星宝用核对单确认结果，并记录一次错误来自样本不足。",
    ],
    starterCode: "features = {\"has_cap\": True, \"has_pages\": False}\n# 这是人工写好的规则，不是机器学习模型\nlabel = \"water bottle\" if features[\"has_cap\"] and not features[\"has_pages\"] else \"needs review\"\nprint(label)",
    choice: {
      prompt: "哪句话最准确地区分固定规则程序和机器学习？",
      options: [
        "规则程序执行人写好的条件；机器学习从带标签样本中归纳模式",
        "机器学习永远不会出错；规则程序一定会出错",
        "两者都只需要一张图片，不需要任何规则或样本",
      ],
      answer: "规则程序执行人写好的条件；机器学习从带标签样本中归纳模式",
    },
    order: {
      prompt: "排列一次用样本建立并核对图片分类预测的过程。",
      steps: ["收集带标签的图片样本", "记录可比较的特征", "让模型预测新图片", "核对预测并记录错误"],
    },
    trace: {
      prompt: "运行下面的固定规则后会打印什么？",
      code: "has_cap = True\nhas_pages = False\nlabel = \"water bottle\" if has_cap and not has_pages else \"needs review\"\nprint(label)",
      answer: "water bottle",
    },
    interpretation: {
      prompt: "模型把一张被遮挡的失物图片预测为“水杯”。下面哪种解释最合适？",
      result: "预测标签：水杯\n模型置信度：0.72\n图片状态：杯盖被遮挡",
      options: [
        "预测就是事实，不需要再核对图片",
        "这是基于现有样本和特征的预测，仍应结合图片或新证据核对",
        "只要置信度高于 0，就能证明模型从不出错",
      ],
      answer: "这是基于现有样本和特征的预测，仍应结合图片或新证据核对",
    },
    classification: {
      prompt: "观察固定训练样本后，为待分类失物选择最有证据支持的标签。",
      labels: ["水杯", "书本", "需要人工复核"],
      trainingSamples: [
        {
          id: "bottle-a",
          title: "训练样本 A",
          label: "水杯",
          features: ["有瓶盖", "细长圆柱形", "没有连续页面边缘"],
          evidence: "标签已由失物管理员核对为“水杯”。",
        },
        {
          id: "book-a",
          title: "训练样本 B",
          label: "书本",
          features: ["矩形封面", "有连续页面边缘", "没有瓶盖"],
          evidence: "标签已由失物管理员核对为“书本”。",
        },
        {
          id: "bottle-b",
          title: "训练样本 C",
          label: "水杯",
          features: ["有旋盖", "窄口", "侧面为连续弧形"],
          evidence: "标签已由失物管理员核对为“水杯”。",
        },
      ],
      testSample: {
        id: "lost-item-7",
        title: "待分类失物 #7",
        features: ["有旋盖", "细长圆柱形", "看不到连续页面边缘"],
        evidence: "照片光线正常，旋盖和瓶身轮廓均可见。",
      },
      answer: "水杯",
      classificationEvidence: "待分类失物同时符合两个水杯训练样本的旋盖、窄口/细长轮廓特征，且没有书本的页面边缘。这里的标签仅适用于这组固定样本；新角度或被遮挡时仍应复核。",
    },
  }),
  makeCourse({
    id: "middle-data-and-algorithms",
    title: "数据与算法：让信息可以计算",
    summary: "把图片、声音和文字整理成字段与列表，再用明确步骤处理和核对结果。",
    stage: "middle_school",
    featured: false,
    knowledgePointTags: ["数据表示", "表格与字段", "算法步骤", "排序与复杂度直觉"],
    objectives: [
      "说明文字、图片和声音进入程序前需要被组织为可处理的数据",
      "用字段、列表、条件和循环描述一个可执行的算法过程",
      "实现并测试相邻比较的冒泡排序，说明边界输入和比较次数的关系",
    ],
    activity: "把校园器材记录整理成字段与列表，先追踪一轮相邻比较，再完成可运行的排序函数。",
    overview: "程序不能直接理解一段杂乱的观察。我们先把对象、属性和顺序整理成数据：表格的一列是字段，一行是记录，列表保存有先后关系的值。算法是能重复执行的明确步骤；条件决定何时交换，循环让相邻比较持续进行。输入长度不同，所需比较次数也不同，因此结论必须回到具体输入核对。",
    keyIdeas: [
      "文字、图片和声音都需要先转成带有字段或数值的可处理数据",
      "算法由有限、明确且可重复的步骤组成，条件负责分支，循环负责重复",
      "冒泡排序每次只比较相邻元素，顺序错误时交换；一轮没有交换可以提前结束",
      "列表为空或只有一个元素时不需要比较，输入越长通常需要更多相邻比较",
    ],
    workedExample: "器材柜记录 [4, 1, 3] 需要从小到大排队。第一轮先比较 4 和 1，交换为 [1, 4, 3]；再比较 4 和 3，交换为 [1, 3, 4]。此时最大的 4 已到队尾，但还需要下一轮确认前两个数的顺序。",
    materials: ["校园器材记录表", "字段与列表标注卡", "相邻比较追踪表", "排序代码测试用例"],
    animationTemplate: "middle-bubble-sort-data-flow",
    storyMoments: [
      "星宝收到混合着编号、位置和照片说明的器材记录，先决定哪些信息需要成为字段。",
      "它把待归还天数提取为列表，并在追踪表中标出每一对相邻数字。",
      "每次左边数字更大就交换，星宝观察最大值如何在一轮中移动到队尾。",
      "最后它用空列表、单元素和重复数字测试排序步骤，确认算法没有只适用于一个例子。",
    ],
    starterCode: "def bubble_sort(values):\n    result = values[:]\n    # 每轮只比较相邻元素；本轮没有交换就结束\n    for end in range(len(result) - 1, 0, -1):\n        swapped = False\n        for index in range(end):\n            if result[index] > result[index + 1]:\n                result[index], result[index + 1] = result[index + 1], result[index]\n                swapped = True\n        if not swapped:\n            break\n    return result\n\nprint(bubble_sort([4, 1, 3]))",
    choice: {
      prompt: "整理校园器材记录时，哪一种做法最符合“字段”的含义？",
      options: ["把每件器材的编号、归还天数和位置分别放入命名列", "把所有描述合成一段长文字且不区分属性", "只保留最喜欢的一件器材的照片"],
      answer: "把每件器材的编号、归还天数和位置分别放入命名列",
    },
    order: {
      prompt: "排列一次用冒泡排序处理固定列表的基本过程。",
      steps: ["选择一对相邻元素", "判断左边是否更大", "需要时交换并继续下一对", "一轮无交换时结束"],
    },
    trace: {
      prompt: "代码会打印什么？",
      code: "values = [3, 1, 2]\nfor index in range(2):\n    if values[index] > values[index + 1]:\n        values[index], values[index + 1] = values[index + 1], values[index]\nprint(values)",
      answer: "[1, 2, 3]",
    },
    interpretation: {
      prompt: "下面的追踪结果最支持哪一种解释？",
      result: "输入列表：[]\n相邻比较次数：0\n输出列表：[]",
      options: [
        "空列表不是合法输入，算法必须报错",
        "没有元素就没有相邻对需要比较，直接返回空列表是合理结果",
        "即使没有元素，也必须执行至少一次交换",
      ],
      answer: "没有元素就没有相邻对需要比较，直接返回空列表是合理结果",
    },
  }),
  makeCourse({
    id: "middle-python-basics",
    title: "Python 编程入门：让步骤运行起来",
    summary: "用变量、条件、循环和函数把清晰的算法步骤写成可测试的小程序。",
    stage: "middle_school",
    featured: false,
    knowledgePointTags: ["Python 变量与类型", "条件判断", "循环与列表", "函数与测试"],
    objectives: [
      "用变量和列表保存任务中的可变化信息，并读出每个值的类型与含义",
      "用条件和循环把重复的筛选步骤写成可运行程序",
      "把逻辑封装成函数，并用空列表、混合数据等固定用例检查结果",
    ],
    activity: "为实验室器材清单编写小函数，筛选准备完成的器材，并用三组固定记录核对输出。",
    overview: "Python 程序把算法写成可以逐行执行的指令。变量给值一个名字，列表按顺序保存多项记录；条件决定一条记录是否满足要求，循环让同一检查应用到每一项。把这些步骤放进函数后，可以用不同输入重复测试。测试不是为了凑输出，而是为了确认空列表、全部未完成和混合记录都遵守同一规则。",
    keyIdeas: [
      "变量保存会变化的值；字符串、数字、布尔值和列表适合表达不同类型的信息",
      "if 根据布尔条件选择是否执行；for 会依次处理列表里的每一项",
      "函数把一个明确任务封装为可重复调用的步骤，并通过 return 给出结果",
      "固定测试用例应覆盖正常情况和边界情况，不能只验证一个刚好成功的输入",
    ],
    workedExample: "器材记录包含名称和是否已准备好。函数从空列表开始，依次查看每件器材；如果 ready 为 True，就把名称加入结果列表。输入 [] 时应返回 []；输入传感器、导线和机器人时，只返回状态为 True 的传感器和机器人。",
    materials: ["器材状态记录表", "变量与类型速查卡", "函数流程图", "固定测试用例表"],
    animationTemplate: "middle-python-function-flow",
    storyMoments: [
      "星宝把器材名称和准备状态分别存入清晰的记录，避免把所有信息写成一段文字。",
      "它用条件判断每件器材是否 ready，再用循环依次检查整个列表。",
      "重复步骤被放进 choose_ready_tools 函数，函数返回一份新的准备完成清单。",
      "星宝用空列表、混合状态和全部未完成三组固定输入测试函数，确认规则在边界情况也成立。",
    ],
    starterCode: "def choose_ready_tools(tools):\n    ready_names = []\n    for tool in tools:\n        if tool[\"ready\"]:\n            ready_names.append(tool[\"name\"])\n    return ready_names\n\nprint(choose_ready_tools([{\"name\": \"sensor\", \"ready\": True}, {\"name\": \"wire\", \"ready\": False}]))",
    choice: {
      prompt: "下面哪一种值最适合表示“器材是否已准备好”？",
      options: ["布尔值 True 或 False", "任意一段长说明文字", "只用一个随机数字且不说明含义"],
      answer: "布尔值 True 或 False",
    },
    order: {
      prompt: "排列筛选准备完成器材的函数执行过程。",
      steps: ["创建空的结果列表", "依次读取每件器材", "条件判断 ready 是否为 True", "把符合条件的名称加入结果并返回"],
    },
    trace: {
      prompt: "运行代码后会打印什么？",
      code: "names = []\nfor value in [\"sensor\", \"wire\", \"robot\"]:\n    if len(value) > 5:\n        names.append(value)\nprint(names)",
      answer: "['sensor']",
    },
    interpretation: {
      prompt: "下面的固定测试结果最支持哪一种结论？",
      result: "输入：[]，输出：[]\n输入：全部 ready=False，输出：[]\n输入：ready=True 与 False 混合，输出：所有 ready=True 的名称",
      options: [
        "函数只在一个示例上碰巧运行，不能说明边界情况",
        "这些用例覆盖空列表、没有匹配项和混合记录，支持函数遵守筛选规则",
        "只要有一次返回空列表，函数一定有错误",
      ],
      answer: "这些用例覆盖空列表、没有匹配项和混合记录，支持函数遵守筛选规则",
    },
  }),
  makeCourse({
    id: "middle-neural-signals",
    title: "图像分类与神经网络",
    summary: "追踪像素特征经过加权连接变成类别分数的全过程。",
    stage: "middle_school",
    featured: false,
    knowledgePointTags: ["像素输入", "加权连接", "类别概率"],
    objectives: ["描述输入层到输出层的数据流", "比较权重变化对类别分数的影响"],
    activity: "在透明网格上修改像素值，逐层记录两个隐藏特征和输出分数。",
    overview: "神经网络把像素数值送入多层计算。连接权重决定某个输入对下一层影响多大，最后的分数经归一化后用于比较类别。",
    keyIdeas: ["图片先表示为数值", "权重调节信号强弱", "最高分是预测而非事实"],
    workedExample: "竖线特征乘以较大正权重会提高“铅笔”分数；若背景噪声变强，两个类别分数可能更接近。",
    materials: ["像素透明网格", "权重连接条", "逐层数值记录单"],
    animationTemplate: "neural-network-forward-pass",
    storyMoments: [
      "一张八乘八灰度图被转换为 0 到 1 的像素输入。",
      "输入沿带权重的连接流向边缘与形状特征节点。",
      "隐藏特征继续汇总成两个类别的原始分数。",
      "分数转成可比较的概率，系统报告预测及不确定度。",
    ],
    starterCode: "pixels = [0.8, 0.2]\nweights = [0.7, -0.1]\nscore = sum(x * w for x, w in zip(pixels, weights))\nprint(round(score, 2))",
    choice: {
      prompt: "在其他值不变时，提高一条正权重通常会怎样影响对应信号？",
      options: ["增强贡献", "必定变为零", "删除输入"],
      answer: "增强贡献",
    },
    order: {
      prompt: "排列一次前向传播的数据流。",
      steps: ["读取像素输入", "计算隐藏特征", "比较类别分数"],
    },
    trace: {
      prompt: "score 的输出是多少？",
      code: "inputs = [1, 2]\nweights = [0.5, 0.25]\nscore = sum(x*w for x, w in zip(inputs, weights))\nprint(score)",
      answer: "1.0",
    },
  }),
  makeCourse({
    id: "middle-model-evaluation",
    title: "模型评价：让分数说清楚",
    summary: "把固定样本按来源留作测试集，用准确率、错误率和混淆矩阵检查预测表现。",
    stage: "middle_school",
    featured: false,
    knowledgePointTags: ["训练集与测试集", "准确率与错误率", "混淆矩阵"],
    objectives: ["说明训练集和测试集不能混用的原因", "根据准确率、错误率和混淆矩阵解释模型表现"],
    activity: "按拍摄批次留出测试集，逐项核对预测，再用矩阵定位模型把什么认错了。",
    overview: "评价模型时，训练样本用于形成规则，测试样本用于检查这些规则在没参与选择的数据上表现如何。准确率和错误率给出总体比例，混淆矩阵进一步说明错误发生在什么类别之间。",
    keyIdeas: ["先留出从未参与选择的测试集", "准确率和错误率来自同一批测试样本", "混淆矩阵把正确与混淆的类别分开记录"],
    workedExample: "把逆光窗边的四张图片留作测试，模型只认对两张，准确率是 2/4。混淆矩阵显示它把一张树叶认成水杯，也把一张水杯认成树叶。",
    materials: ["按拍摄批次整理的固定样本", "逐项预测核对表", "准确率与错误率计算表", "二分类混淆矩阵"],
    animationTemplate: "held-out-test-evaluation",
    storyMoments: [
      "星宝先把同一拍摄批次的四张图片完整留出，不让它们参与规则选择。",
      "其余两个批次的固定样本保留在训练集，用来形成当前分类规则。",
      "测试集逐张核对真实标签与模型预测，统计正确和错误次数。",
      "混淆矩阵把树叶与水杯之间的两类混淆显示出来，提醒我们继续检查逆光条件。",
    ],
    starterCode: "rows = [(\"leaf\", \"leaf\"), (\"cup\", \"leaf\"), (\"leaf\", \"cup\"), (\"cup\", \"cup\")]\ncorrect = sum(actual == predicted for actual, predicted in rows)\nprint(correct / len(rows))",
    choice: {
      prompt: "为什么测试集需要在规则选择完成后才使用？",
      options: ["避免根据测试结果反复调整规则，让分数虚高", "让测试集自动增加样本", "因为测试集不需要真实标签"],
      answer: "避免根据测试结果反复调整规则，让分数虚高",
    },
    order: {
      prompt: "排列一次规范的固定样本模型评价流程。",
      steps: ["按拍摄批次留出测试集", "用训练集固定当前规则", "核对测试集预测并计算指标"],
    },
    trace: {
      prompt: "代码会打印哪个准确率？",
      code: "actual = [\"leaf\", \"cup\", \"leaf\", \"cup\"]\npredicted = [\"leaf\", \"leaf\", \"cup\", \"cup\"]\ncorrect = sum(a == p for a, p in zip(actual, predicted))\nprint(correct / len(actual))",
      answer: "0.5",
    },
  }),
  makeCourse({
    id: "middle-data-bias",
    title: "数据偏差侦探社",
    summary: "比较数据分布与分类结果，找出样本缺口造成的系统性错误。",
    stage: "middle_school",
    featured: false,
    knowledgePointTags: ["数据分布", "混淆矩阵", "偏差"],
    objectives: ["用混淆矩阵定位集中错误", "解释训练数据缺口与模型偏差的关系"],
    activity: "对两组光照条件下的预测制作混淆矩阵，提出补采样方案。",
    overview: "模型错误不一定随机发生。如果某类场景在训练数据中很少，它可能持续得到较差结果，需要按分组指标检查。",
    keyIdeas: ["总体准确率会隐藏差异", "分组统计暴露错误模式", "补充代表性样本再评估"],
    workedExample: "室内照片准确率 90%，逆光照片只有 45%；补采多种逆光样本比重复室内样本更有针对性。",
    materials: ["预测结果卡", "混淆矩阵网格", "样本分布统计表"],
    animationTemplate: "confusion-matrix-investigation",
    storyMoments: [
      "侦探社收到一份看似不错的总体准确率报告。",
      "按光照分组后，错误集中在逆光照片。",
      "训练集统计显示逆光样本数量明显不足。",
      "团队制定补采样与重新评估方案，而不是只改一个答案。",
    ],
    starterCode: "correct = [9, 4]\ntotal = [10, 10]\nfor name, c, n in zip([\"indoor\", \"backlit\"], correct, total):\n    print(name, c / n)",
    choice: {
      prompt: "总体准确率较高时，为什么仍要查看分组结果？",
      options: ["可能隐藏集中错误", "让数字更多", "替代所有测试"],
      answer: "可能隐藏集中错误",
    },
    order: {
      prompt: "排列调查数据偏差的步骤。",
      steps: ["按条件分组结果", "定位错误集中的组", "检查并补充样本"],
    },
    trace: {
      prompt: "代码打印的准确率是多少？",
      code: "correct = 3\ntotal = 4\nprint(correct / total)",
      answer: "0.75",
    },
    interpretation: {
      prompt: "下面的评估结果最支持哪一个下一步？",
      result: "室内明亮组：9/10 正确\n逆光组：4/10 正确\n总体：13/20 正确",
      options: [
        "只看总体结果，不必比较不同光照条件",
        "优先检查逆光组缺少什么样本，再补充代表性逆光样本并重新评估",
        "因为室内组表现较好，所以删除逆光组结果",
      ],
      answer: "优先检查逆光组缺少什么样本，再补充代表性逆光样本并重新评估",
    },
  }),
  makeCourse({
    id: "middle-generative-ai",
    title: "生成式 AI 与提示设计：先约束，再核对",
    summary: "比较分类模型与生成模型，用目标、材料、约束和核对步骤设计可审查的提示。",
    stage: "middle_school",
    featured: false,
    knowledgePointTags: ["分类与生成", "提示目标与上下文", "输出约束", "事实核对与引用"],
    objectives: [
      "区分根据已有类别判断的分类任务和产生新文本、图像或代码的生成任务",
      "把目标、给定材料、输出格式和限制写进可检查的提示词",
      "说明生成回答需要回到来源、数据或实验记录核对，而不是直接当作事实",
    ],
    activity: "比较两条固定提示词，为实验室安全小结选择包含目标、材料、格式和核对步骤的版本。",
    overview: "生成式 AI 会根据输入生成新的文本、图像或代码；它不是自动可靠的资料库。一个适合学习任务的提示要说明目标，提供允许使用的材料，规定输出格式和边界，并要求把可核对的事实标出来源。提示中的限制让任务更清楚，但不能替代人工核对、授权和责任判断。",
    keyIdeas: [
      "分类模型在预先约定的类别间作预测，生成模型产生新的内容，两者都可能出错",
      "提示词先说清任务目标和学习对象，再给出允许使用的上下文材料",
      "格式、长度、引用和禁止事项是可检查的输出约束，不是装饰性语句",
      "涉及事实、数据和结论时，要回到给定来源、实验记录或可靠流程核对",
    ],
    workedExample: "提示 A 只说“写一段 AI 安全介绍”。提示 B 说明“依据给定的三条安全规则，用 80 字以内列出两项做法；每项标出规则编号；不补充材料外的事实；最后写出需要教师核对的一点”。B 的目标、材料范围、格式和核对动作都可检查，因此更适合课堂练习。",
    materials: ["两组固定提示词对照卡", "课堂安全规则摘录", "输出约束检查表", "来源与核对记录单"],
    animationTemplate: "prompt-constraint-check",
    storyMoments: [
      "星宝先分清本次任务是让模型分类已有记录，还是根据材料生成新的说明。",
      "它把学习目标、可使用的规则摘录和目标读者一起放进提示的上下文。",
      "星宝增加长度、列表格式、规则编号和不得编造材料外事实的约束。",
      "生成答案后，它逐条回到规则编号核对，并把无法核实的内容标记为需要继续查证。",
    ],
    starterCode: "prompt_parts = [\"目标：解释两条安全规则\", \"材料：仅使用规则 1-3\", \"格式：两条编号列表\", \"核对：标出对应规则编号\"]\nprint(\"\\n\".join(prompt_parts))",
    choice: {
      prompt: "哪一个任务更符合生成式 AI 的特点？",
      options: ["依据给定材料生成一份带规则编号的安全小结", "在 leaf、ball、cup 三个已有标签中选择一个", "把固定数字按从小到大比较并交换"],
      answer: "依据给定材料生成一份带规则编号的安全小结",
    },
    order: {
      prompt: "排列一次受控提示设计与核对的过程。",
      steps: ["明确学习目标和允许材料", "写明输出格式与边界", "生成后对照来源核对可验证内容", "记录仍需确认的限制或问题"],
    },
    trace: {
      prompt: "代码会打印多少个提示词组成部分？",
      code: "parts = [\"目标\", \"材料\", \"格式\", \"核对\"]\nprint(len(parts))",
      answer: "4",
    },
    interpretation: {
      prompt: "两条固定提示词中，哪一条更适合作为课堂生成练习？",
      result: "提示 A：写一段 AI 安全介绍。\n提示 B：只依据给定的三条规则，用两条编号列表说明做法；每条标出规则编号；不补充材料外的事实；最后指出一项仍需教师核对的内容。",
      options: [
        "提示 A，因为它没有任何范围或核对要求",
        "提示 B，因为目标、材料范围、输出格式和核对动作都可以逐项检查",
        "两条都能让生成内容自动成为正确事实",
      ],
      answer: "提示 B，因为目标、材料范围、输出格式和核对动作都可以逐项检查",
    },
  }),
  makeCourse({
    id: "middle-ai-safety",
    title: "AI 安全：先核对，再使用",
    summary: "在真实校园情境中判断隐私、授权、模型错误和责任边界，并用证据说明理由。",
    stage: "middle_school",
    featured: false,
    knowledgePointTags: ["隐私保护", "数据授权", "预测需要核对", "模型责任边界"],
    objectives: ["在使用 AI 前识别需要保护或授权的数据", "把模型输出视为需要核对的建议，并说明应由谁负责决定"],
    activity: "阅读校园任务情境，选择可执行的安全做法，并指出该做法保护了什么证据或边界。",
    overview: "AI 工具可以帮助整理和预测，但不能替人跳过隐私保护、数据授权和必要核对。模型给出的结果是预测，不是事实；涉及他人权益或高风险后果时，应由合适的人和流程作最终决定。",
    keyIdeas: ["先最小化并保护可识别的个人信息", "收集或使用他人数据前要有明确授权与用途", "预测需要用可靠证据或人工流程核对", "模型不能代替承担责任的人作高风险决定"],
    workedExample: "班级想用同学照片训练分类器。正确做法是说明用途、取得允许，只使用必要且已获授权的资料；即使模型说实验器材安全，也仍要按学校流程由教师检查。",
    materials: ["四张校园安全情境卡", "行动与证据配对表", "数据使用范围清单", "核对流程记录单"],
    animationTemplate: "ai-safety-evidence-check",
    storyMoments: [
      "星宝先圈出任务里包含姓名、照片和联系方式的可识别信息。",
      "它把每一项数据用途写清楚，并确认资料是否得到允许。",
      "模型给出预测后，星宝用观察记录和规定流程核对，而不是直接相信结果。",
      "面对可能伤害他人的高风险决定，星宝把模型限制和证据交给负责的成人或专业人员判断。",
    ],
    starterCode: "prediction = \"safe\"\nverified = False\nif prediction == \"safe\" and not verified:\n    print(\"继续按规定流程核对\")",
    choice: {
      prompt: "要为校园分类练习收集同学照片，哪种做法最合适？",
      options: ["先说明用途并取得允许，只保留完成任务需要的资料", "把全班照片直接上传到任意工具", "只要模型准确，就不需要询问照片来源"],
      answer: "先说明用途并取得允许，只保留完成任务需要的资料",
    },
    order: {
      prompt: "排列一次负责任地使用 AI 输出的流程。",
      steps: ["确认数据来源、用途和授权", "让模型给出可核对的预测或建议", "用可靠证据和规定流程核对后再决定"],
    },
    trace: {
      prompt: "代码会打印什么？",
      code: "prediction = \"pass\"\nverified = False\nprint(\"核对\" if prediction == \"pass\" and not verified else \"记录结果\")",
      answer: "核对",
    },
    interpretation: {
      prompt: "AI 说一套实验器材“完全安全”，但它没有看到现场情况。下面哪个下一步最有证据支持？",
      result: "模型输出：完全安全\n已知证据：模型没有现场传感器数据，也没有代替学校安全检查的权限",
      options: [
        "直接开始实验，因为模型已经给出结论",
        "把模型输出当作提示，按学校流程由教师核对现场条件并记录不确定性",
        "删除所有安全记录，避免模型被质疑",
      ],
      answer: "把模型输出当作提示，按学校流程由教师核对现场条件并记录不确定性",
    },
  }),
  makeCourse({
    id: "high-python-data-lab", title: "Python 数据实验", summary: "读取固定 CSV/JSON 数据，清洗缺失字段并准备可复核的统计与图表数据。", stage: "high_school", featured: true, knowledgePointTags: ["数据结构", "数据清洗", "描述统计"], objectives: ["用 json.loads 和 csv.DictReader 读取固定数据", "说明清洗规则如何影响统计结论", "把已核对的统计值转换为简单图表数据"], activity: "在固定 CSV 和 JSON 数据上运行统计函数，记录数据集版本、缺失值规则、统计输出和图表数据。", overview: "数据分析从可复现的输入开始。先明确字段和缺失值处理，再计算统计值；同一批记录用 CSV 和 JSON 两种格式核对，最后把统计结果准备成图表数据。", keyIdeas: ["数据结构决定读取方式", "清洗规则必须记录", "统计值不能脱离样本解释", "图表只呈现已核对的结果"], workedExample: "固定 JSON 和 CSV 各有 4 条记录，其中 1 条 score 缺失；按规则跳过缺失记录后，两种格式都得到有效记录 3 条、均值 4、最大值 6，柱状图数据为有效 3、缺失 1。", materials: ["固定 JSON 数据（scores-json-v1）", "固定 CSV 数据（scores-csv-v1）", "字段说明", "缺失值清洗记录", "统计与图表输出表"], animationTemplate: "python-data-basics", storyMoments: ["研究员载入固定 JSON 和 CSV。", "检查字段和缺失值。", "运行确定性统计函数并核对两种格式。", "把数据版本、清洗规则、统计和图表数据一起保存。"], starterCode: "import csv\nimport json\n\nDATASET_VERSIONS = {\"json\": \"scores-json-v1\", \"csv\": \"scores-csv-v1\"}\n\ndef summarize_scores(raw_data, input_format=\"json\"):\n    pass\n\ndef prepare_chart_data(summary):\n    pass", choice: { prompt: "清洗数据时最重要的记录是什么？", options: ["清洗规则和原因", "只保留最终图表", "删除所有异常值"], answer: "清洗规则和原因" }, order: { prompt: "排列可复现的数据分析流程。", steps: ["确认数据字段和格式", "记录清洗规则", "分别计算并核对统计值", "准备图表数据"] }, trace: { prompt: "4 条固定记录中有 1 条缺失时，有效记录数是？", code: "print(4 - 1)", answer: "3" } }),
  makeCourse({
    id: "high-ml-pipeline", title: "机器学习流程", summary: "冻结切分规则，用训练集多数类建立基线预测，比较测试集结果并识别数据泄漏。", stage: "high_school", featured: false, knowledgePointTags: ["数据切分", "基线模型", "数据泄漏"], objectives: ["区分训练、验证和测试的职责", "只用训练集形成基线并记录预测结果", "用显式泄漏案例说明为什么不能让测试数据影响特征选择"], activity: "按固定编号切分数据，记录训练集多数类基线预测，并用测试集多数类案例核对泄漏标记。", overview: "训练集用于拟合，验证集用于选择方案，测试集用于最后核验。基线必须来自训练集；如果把测试集标签用于选择基线，测试结果会被污染并产生数据泄漏。实验同时保存切分索引、预测列表、准确率、基线来源和泄漏案例，方便报告复核。", keyIdeas: ["切分规则先于模型选择", "基线预测只能从训练集统计", "测试集不能参与调参或选择基线", "泄漏案例需要在实验记录中明确标记"], workedExample: "固定 10 条标签记录后得到 6/2/2 的训练、验证、测试切分。训练集多数类为 cat，对测试集输出 [cat, cat]，准确率为 0.5；把 baseline_source 改成 test 后测试集全为 dog 的对照案例会标记 leakage_detected=True，不能把 1.0 当作无偏结果。", materials: ["固定数据集（pipeline-labels-v1）", "切分规则", "训练集基线预测表", "测试集准确率", "泄漏案例记录", "实验版本与参数"], animationTemplate: "dataset-split", storyMoments: ["先冻结切分规则。", "只用训练集形成多数类基线和测试预测。", "把测试集只用于最后核验。", "再运行测试集来源的对照案例，明确标记数据泄漏。"], starterCode: "def build_pipeline(rows, baseline_source=\"train\"):\n    pass", choice: { prompt: "哪项会造成数据泄漏？", options: ["用测试集反复选择特征或基线", "保存切分规则", "比较训练集结果"], answer: "用测试集反复选择特征或基线" }, order: { prompt: "排列流程。", steps: ["固定切分", "只用训练集建立基线预测", "在测试集最后核验", "检查并记录泄漏案例"] }, trace: { prompt: "固定 10 条记录按 index % 5 切分时，训练记录数是？", code: "print(6)", answer: "6" } }),
  makeCourse({
    id: "high-classification-regression", title: "分类、回归与指标", summary: "按问题类型选择分类或回归，统计混淆矩阵并用多个指标解释错误代价。", stage: "high_school", featured: false, knowledgePointTags: ["分类与回归", "混淆矩阵", "精确率与召回率", "均方误差"], objectives: ["为不同任务选择指标", "从混淆矩阵计算准确率、精确率、召回率和 F1，并在零分母边界返回确定的 0", "用多组连续样本计算 MSE，并比较漏检与误报代价下的指标选择"], activity: "计算固定二分类指标和多组回归误差，检查空样本/无正例边界，并分别根据漏检或误报代价选择指标。", overview: "分类输出有限类别，回归输出连续数值。准确率、精确率、召回率、F1 和均方误差回答的问题不同，必须从混淆矩阵和全部样本计算，不能互相替代。实验会保留 tp、fp、fn、tn、回归样本数、数据集与挑战版本；没有正例或没有正预测时 precision、recall、F1 按课程规则确定为 0。", keyIdeas: ["先确定任务类型和评价样本范围", "混淆矩阵的四个计数支撑分类指标", "零分母不是报错，按规则记录为 0", "MSE 要使用全部回归样本", "指标选择必须对应漏检或误报的错误代价"], workedExample: "固定四条分类结果得到 tp=1、fp=1、fn=1、tn=1，因此 accuracy、precision、recall 和 F1 都是 0.5；四条回归样本的平方误差为 1、1、9、0，MSE 为 2.75。没有正例或没有正预测时 precision、recall、F1 都记录为 0；漏检代价高选择 recall，误报代价高选择 precision。", materials: ["二分类结果与混淆矩阵", "零分母边界样本", "四条及以上回归样本", "MSE 计算表", "漏检/误报指标选择情境", "实验版本记录表"], animationTemplate: "classification-metrics", storyMoments: ["先识别分类或回归输出，并冻结样本范围。", "统计 tp、fp、fn、tn，计算分类指标并核对零分母边界。", "用全部回归样本计算平方误差和 MSE。", "分别模拟漏检代价高和误报代价高的场景，写出选择理由并保存版本化证据。"], starterCode: "def evaluate_metrics(classification_rows, regression_rows, error_cost):\n    pass", choice: { prompt: "连续房价预测属于？", options: ["回归", "分类", "排序"], answer: "回归" }, order: { prompt: "排列指标解释步骤。", steps: ["冻结样本和任务类型", "统计混淆矩阵或回归误差", "计算指标", "联系漏检/误报代价解释并记录版本"] }, trace: { prompt: "tp=1, fp=1 时 precision 是？", code: "print(1/(1+1))", answer: "0.5" }, classification: {
      prompt: "按训练集中的标签和特征，为新的风险记录选择一个类别。",
      labels: ["需要人工复核", "低风险", "高风险"],
      trainingSamples: [
        { id: "risk-a", title: "训练样本 A", label: "低风险", features: ["影响范围小", "可随时撤回", "没有个人敏感信息"], evidence: "审核记录将该变更标为低风险。" },
        { id: "risk-b", title: "训练样本 B", label: "高风险", features: ["影响范围大", "不可立即撤回", "涉及个人敏感信息"], evidence: "审核记录将该变更标为高风险。" },
        { id: "risk-c", title: "训练样本 C", label: "需要人工复核", features: ["影响范围不明", "撤回条件缺失", "授权记录不完整"], evidence: "审核记录要求先补齐证据再分类。" },
      ],
      testSample: { id: "risk-new-7", title: "待分类记录 #7", features: ["影响范围大", "无法立即撤回", "包含用户联系方式"], evidence: "风险记录显示影响范围与授权边界都需要关注。" },
      answer: "高风险",
      classificationEvidence: "待分类记录与高风险训练样本同时出现大范围影响、难以撤回和个人信息特征；标签只说明固定训练集规则下的判断，正式决策仍需人工审核。",
    } }),
  makeCourse({
    id: "high-neural-network-training", title: "神经网络训练", summary: "用固定多轮训练与验证曲线比较学习率，记录参数集版本并判断过拟合。", stage: "high_school", featured: false, knowledgePointTags: ["损失函数", "梯度下降", "学习率", "训练/验证曲线", "过拟合与正则化"], objectives: ["说明多轮梯度更新如何改变权重和损失", "比较不同学习率时的训练/验证曲线", "记录样本数、步数和参数集版本，按固定规则识别过拟合"], activity: "运行固定多轮训练曲线，保存学习率、初始参数集和样本数，找出最佳验证轮次并解释过拟合信号。", overview: "训练通过损失衡量预测误差，再沿梯度方向多轮更新参数。学习率决定每次更新的步长；参数集版本、样本数和曲线长度必须一起保存，才能复现实验。训练损失继续下降而验证损失在最低点后回升时，说明可能过拟合，应考虑早停或正则化，而不是只看最后一轮。", keyIdeas: ["损失是优化目标，曲线记录每一轮变化", "学习率和参数集版本决定一次实验能否复现", "train_curve 与 validation_curve 必须等长并保留原始点", "best_validation_loss 和 best_step 用于选择泛化较好的轮次", "训练下降且验证在最佳点后回升是确定性的过拟合信号"], workedExample: "参数集 weights-init-v1、样本数 8、学习率 0.1 的五轮训练损失为 [0.95, 0.7, 0.45, 0.2, 0.1]，验证损失为 [1.0, 0.65, 0.4, 0.45, 0.55]。最佳验证损失 0.4 出现在第 3 轮，最后验证损失回升到 0.55 且训练损失持续下降，因此标记 overfit_detected=True；再用学习率 0.2 的对照曲线比较。", materials: ["固定初始权重与参数集版本", "训练/验证多轮损失表", "样本数与步数记录", "学习率对照实验", "最佳验证轮次与过拟合记录单"], animationTemplate: "gradient-descent-demo", storyMoments: ["冻结样本数、初始参数集和实验版本。", "按轮次记录训练与验证损失，保证两条曲线等长。", "比较学习率 0.1 与 0.2 的最佳验证轮次和最终损失。", "根据训练下降且验证回升的规则标记过拟合，再提出早停或正则化方案。"], starterCode: "def analyze_training_curve(train_losses, validation_losses, learning_rate, parameter_set_id=\"weights-init-v1\", sample_count=8):\n    pass", choice: { prompt: "学习率主要控制什么？", options: ["每次更新的步长", "类别数量", "数据来源"], answer: "每次更新的步长" }, order: { prompt: "排列一次可复现的多轮训练实验。", steps: ["冻结样本、初始参数集和学习率", "计算每轮预测与损失", "记录训练/验证曲线并找最佳验证轮次", "根据回升规则判断过拟合并记录版本"] }, trace: { prompt: "验证损失在最低点后持续回升通常说明？", code: "print('overfit')", answer: "可能过拟合" } }),
  makeCourse({
    id: "high-multimodal-ai", title: "计算机视觉与多模态 AI", summary: "在固定数据集和输入版本上比较文本、图像、结构化与组合输入，并保留失败样本和隐私边界。", stage: "high_school", featured: false, knowledgePointTags: ["图像分类", "特征表示", "多模态输入", "失败样本", "数据授权"], objectives: ["说明文本、图像、结构化和组合输入携带的证据差异", "在 multimodal-samples-v2 与 vision-inputs-v2 上完成可复现对照", "保留失败、未授权和受限样本，解释指标不能脱离数据边界"], activity: "完成 multimodal-input-audit v2 对照实验，比较四种输入并记录版本、来源、失败样本、授权和隐私限制。", overview: "多模态系统可以同时处理文字、图像和结构化字段，但输入更多不代表结论一定正确。实验冻结数据集与输入版本，对同一 sample_id 分别运行 text、image、structured 和 combined；只有 available 且 authorized 的输入进入指标，未授权或受限输入仍要以排除证据保留。", keyIdeas: ["模态决定可观察证据，组合输入必须使用同一批 sample_id", "数据集版本、输入版本和 source_id 决定对照能否复现", "只有已授权且符合用途的输入进入准确率，未授权样本不能静默删除", "失败样本、restricted 边界和比较范围属于模型报告的一部分"], workedExample: "固定 multimodal-samples-v2/vision-inputs-v2 的 2 个样本后，text 与 image 各有 2 个可用输入且各正确 1 个；structured:s2 字段虽存在但未授权，因此只计 structured:s1；combined 两个样本均正确。报告保留 text:s2、image:s1 失败样本，以及 s2 的授权/隐私排除边界。", materials: ["固定数据集（multimodal-samples-v2）", "输入版本（vision-inputs-v2）", "text/image/structured/combined 对照表", "source_id 与授权记录", "失败样本清单", "隐私边界与适用范围清单"], animationTemplate: "multimodal-input-audit", storyMoments: ["研究员冻结 multimodal-samples-v2 与 vision-inputs-v2，并为每个输入记录 source_id。", "系统对同一批 sample_id 分别计算 text、image、structured 和 combined 结果。", "text:s2 与 image:s1 被保留为失败样本，未授权的 structured:s2 被排除但不删除。", "报告比较准确率，同时写出授权策略、restricted 隐私边界和不能推广到其他数据的限制。"], starterCode: "MULTIMODAL_DATASET_VERSION = \"multimodal-samples-v2\"\nMULTIMODAL_INPUT_VERSION = \"vision-inputs-v2\"\n\ndef compare_modalities(rows, dataset_version, input_version):\n    pass", choice: { prompt: "多模态实验报告中哪项不能省略？", options: ["固定版本、失败样本、来源和授权/隐私边界", "只保留最高准确率", "删除无法解释或未授权的样本"], answer: "固定版本、失败样本、来源和授权/隐私边界" }, order: { prompt: "排列一次可复现的多模态对照实验。", steps: ["冻结数据集/输入版本并核对来源", "按同一 sample_id 分别运行四种输入", "排除未授权/不可用输入但保留边界记录", "比较指标、失败样本并写出适用范围"] }, trace: { prompt: "固定实验比较的输入模态数量是多少？", code: "print(len([\"text\", \"image\", \"structured\", \"combined\"]))", answer: "4" }, interpretation: { prompt: "组合输入准确率更高，但 structured:s2 未获授权，最稳妥的结论是什么？", result: "组合输入：2/2 正确\nstructured：1/1 可授权输入正确；s2 被 restricted 排除\ntext:s2、image:s1 仍是失败样本", options: ["组合输入在这组固定版本和已授权样本上更好，但仍需保留失败与授权/隐私边界", "组合输入已经在所有场景可靠，可以删除排除样本", "为了提高准确率，把 restricted 输入当作正确样本计入"], answer: "组合输入在这组固定版本和已授权样本上更好，但仍需保留失败与授权/隐私边界" },
  }),
  makeCourse({
    id: "high-generative-ai-rag", title: "生成式 AI、大语言模型与 RAG", summary: "在 fixed-kb-v2/rag-query-v2 上比较无检索与固定知识库回答，核对引用匹配、未支持主张和工具权限。", stage: "high_school", featured: false, knowledgePointTags: ["上下文与提示", "结构化输出", "检索增强", "引用与权限", "幻觉核对"], objectives: ["解释固定知识库如何约束生成回答，并区分无检索与有检索", "在固定版本上核对 matched/unmatched 引用和 unsupported_claims", "保留失败回答和 requested/allowed/blocked 工具权限证据"], activity: "完成 rag-citation-check v3，比较无检索与有检索回答，记录知识库/查询版本、引用匹配、失败主张、改进策略和工具阻断。", overview: "生成式模型会根据上下文组织回答，但流畅不等于真实。实验冻结 fixed-kb-v2 和 rag-query-v2，只允许课程手册与审核片段；无检索回答没有可核对来源，有检索回答即使匹配引用仍可能留下未支持主张。程序必须保留两种回答的失败证据，并记录 fixed_retrieval 与被阻断的任意搜索/代码工具。", keyIdeas: ["无检索回答不能因语气流畅就当作事实", "matched_citations 只能来自固定来源白名单，未知引用进入 unmatched_citations", "claims 中没有出现在 supported_claims 的内容是 unsupported_claims，必须回到来源核对", "工具权限是实验结果的一部分，只允许 fixed_retrieval 并记录 blocked_tools", "知识库版本、查询版本和字段校验保证对照结果可复现"], workedExample: "fixed-kb-v2/rag-query-v2 的无检索回答声称“实验室周末免费开放”，没有引用因此状态为 unverified；有检索回答匹配课程手册但同时出现未知网页和同一未支持主张，状态为 needs_review。citation coverage 为 0.5，web_search/code_execution 请求全部 blocked。", materials: ["固定知识库（fixed-kb-v2）", "查询版本（rag-query-v2）", "无检索/有检索回答对照表", "claims/supported_claims/citations 核对表", "失败回答与改进策略", "工具权限边界与阻断记录"], animationTemplate: "rag-source-check", storyMoments: ["学生先提出需要事实依据的问题，系统冻结知识库和查询版本。", "系统分别生成无检索与固定知识库回答，保留两种回答的 claims。", "研究员核对课程手册匹配、未知网页和未支持主张，标记失败回答。", "工具权限面板记录 fixed_retrieval 被允许、web_search/code_execution 被阻断，报告给出回到来源的改进策略。"], starterCode: "KNOWLEDGE_BASE_VERSION = \"fixed-kb-v2\"\nQUERY_VERSION = \"rag-query-v2\"\n\ndef compare_retrieval(without_retrieval, with_retrieval, knowledge_base_version, query_version, allowed_sources, requested_tools):\n    pass", choice: { prompt: "有检索回答中出现未知网页引用和未支持主张，最稳妥的处理是什么？", options: ["保留 unmatched_citations 和 unsupported_claims，回到固定来源核对", "因为回答流畅就直接发布", "删除失败主张和未知引用再报告高匹配率"], answer: "保留 unmatched_citations 和 unsupported_claims，回到固定来源核对" }, order: { prompt: "排列一次可复现的 RAG 回答核对流程。", steps: ["冻结知识库/查询版本和来源白名单", "分别准备无检索与有检索 claims/citations", "核对 matched/unmatched 引用与 unsupported_claims", "记录工具权限、失败回答和改进策略"] }, trace: { prompt: "有检索回答包含 2 条引用，其中 1 条在固定白名单中，citation coverage 是？", code: "print(1 / 2)", answer: "0.5" }, interpretation: { prompt: "无检索回答和有检索回答都声称实验室周末免费开放，但固定来源没有这条信息，应该怎样处理？", result: "无检索：0 条引用；有检索：匹配课程手册、未知网页；未支持主张：实验室周末免费开放", options: ["两种回答都保留失败主张并标记待核对，有检索只能说明匹配引用增加，不能证明该主张", "把课程手册匹配当作整段回答都正确", "删除未支持主张以便报告看起来完整"], answer: "两种回答都保留失败主张并标记待核对，有检索只能说明匹配引用增加，不能证明该主张" },
  }),
  makeCourse({
    id: "high-bubble-analysis",
    title: "排序算法实验：冒泡排序",
    summary: "用比较次数、交换次数与输入结构评估冒泡排序的成本。",
    stage: "high_school",
    featured: true,
    knowledgePointTags: ["循环不变量", "时间复杂度", "实验测量"],
    objectives: ["用循环不变量说明算法正确性", "设计实验比较最好与最坏输入"],
    activity: "实现计数器，生成顺序、逆序和随机数组，提交包含证据的复杂度报告。",
    overview: "冒泡排序每轮把未排序区间的最大元素移到末端。循环不变量支撑正确性论证，比较次数随规模呈平方增长。",
    keyIdeas: ["轮末位置已经确定", "比较次数约为 n(n-1)/2", "提前退出改善已有序输入"],
    workedExample: "长度 5 的逆序数组需要 10 次相邻比较；带提前退出的有序数组只完成第一轮的 4 次比较。",
    materials: ["输入数据生成器", "比较交换计数表", "实验报告模板"],
    animationTemplate: "bubble-sort-complexity-lab",
    storyMoments: [
      "实验先固定数组规模，并定义比较与交换的计数方式。",
      "顺序、逆序和随机输入分别运行同一份算法。",
      "曲线展示规模翻倍后比较次数接近四倍。",
      "报告用不变量说明正确性，并注明提前退出的适用边界。",
    ],
    starterCode: "def bubble_sort(values):\n    values = values[:]\n    comparisons = 0\n    # TODO: 完成排序并统计 comparisons\n    return values, comparisons",
    choice: {
      prompt: "标准冒泡排序在逆序输入上的时间复杂度是什么？",
      options: ["O(n²)", "O(log n)", "O(1)"],
      answer: "O(n²)",
    },
    order: {
      prompt: "排列一次可复现实验流程。",
      steps: ["固定算法与计数口径", "改变输入规模并重复运行", "绘图并解释增长趋势"],
    },
    trace: {
      prompt: "代码输出的 comparisons 是多少？",
      code: "comparisons = 0\nfor end in range(3, 0, -1):\n    comparisons += end\nprint(comparisons)",
      answer: "6",
    },
  }),
  makeCourse({
    id: "high-image-model-audit",
    title: "图像分类系统审计",
    summary: "从数据切分、网络输出到分组指标，完成可复核的模型评估。",
    stage: "high_school",
    featured: false,
    knowledgePointTags: ["训练验证切分", "交叉熵", "模型审计"],
    objectives: ["解释训练集、验证集和测试集的不同用途", "根据概率与分组指标提出模型改进"],
    activity: "控制网络与训练参数，对两套数据切分进行对照实验并撰写模型卡。",
    overview: "图像分类系统不仅要输出概率，还要证明评估过程没有数据泄漏，并报告不同群体与场景下的表现。损失函数指导训练，独立测试集用于最终估计。",
    keyIdeas: ["数据切分防止自我验证", "损失衡量概率偏差", "审计关注分组表现与限制"],
    workedExample: "同一人物的连拍照片若跨入训练集和测试集，会让测试分数虚高；按拍摄会话分组切分更可靠。",
    materials: ["带来源标识的数据清单", "概率与损失计算表", "模型卡模板"],
    animationTemplate: "image-classifier-audit-pipeline",
    storyMoments: [
      "团队先按拍摄来源划分训练、验证和独立测试数据。",
      "网络输出类别概率，交叉熵对自信但错误的预测施加更大损失。",
      "验证集用于选择设置，测试集只在方案锁定后评估。",
      "模型卡记录分组指标、失败案例、适用范围与下一轮实验。",
    ],
    starterCode: "def accuracy(rows):\n    correct = sum(pred == label for pred, label in rows)\n    return correct / len(rows)\n\n# TODO: 分别计算各场景指标",
    choice: {
      prompt: "最终方案锁定前反复查看测试集会带来什么风险？",
      options: ["对测试集过拟合", "自动增加样本", "保证公平"],
      answer: "对测试集过拟合",
    },
    order: {
      prompt: "排列规范的模型评估流程。",
      steps: ["按来源划分数据", "用验证集选择方案", "锁定方案后评估测试集"],
    },
    trace: {
      prompt: "代码输出的准确率是多少？",
      code: "pred = [1, 0, 1, 1]\nlabel = [1, 1, 1, 0]\nprint(sum(a == b for a, b in zip(pred, label)) / len(label))",
      answer: "0.5",
    },
  }),
]);

function cloneCourse(course: DeepReadonly<CurriculumCourse>): CurriculumCourse {
  return structuredClone(course) as CurriculumCourse;
}

export function getCoursesForStage(stage: Stage): CurriculumCourse[] {
  const courses = CURRICULUM.filter((course) => course.stage === stage);
  if (stage !== "high_school") return courses.map(cloneCourse);

  const highSchoolOrder = [
    "high-python-data-lab",
    "high-bubble-analysis",
    "high-ml-pipeline",
    "high-classification-regression",
    "high-neural-network-training",
    "high-multimodal-ai",
    "high-generative-ai-rag",
    "high-image-model-audit",
  ];
  const order = new Map(highSchoolOrder.map((id, index) => [id, index]));
  return courses
    .toSorted((left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER))
    .map(cloneCourse);
}

export function getCourseById(id: string): CurriculumCourse | undefined {
  const course = CURRICULUM.find((candidate) => candidate.id === id);

  return course === undefined ? undefined : cloneCourse(course);
}

export function getFeaturedCourses(stage?: Stage): CurriculumCourse[] {
  return CURRICULUM.filter(
    (course) => course.featured && (stage === undefined || course.stage === stage),
  ).map(cloneCourse);
}
