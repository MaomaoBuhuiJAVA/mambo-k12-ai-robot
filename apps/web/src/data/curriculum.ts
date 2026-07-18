import type { Stage } from "../lib/domain";

export type ExerciseType = "single_choice" | "order" | "code_trace";
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

export type CourseExercise =
  | SingleChoiceExercise
  | OrderExercise
  | CodeTraceExercise;

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
    id: "middle-neural-signals",
    title: "图像分类与神经网络",
    summary: "追踪像素特征经过加权连接变成类别分数的全过程。",
    stage: "middle_school",
    featured: true,
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
  return CURRICULUM.filter((course) => course.stage === stage).map(cloneCourse);
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
