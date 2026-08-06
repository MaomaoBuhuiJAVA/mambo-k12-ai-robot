export interface AiBattleQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: readonly [string, string, string, string];
  answerIndex: number;
  explanation: string;
}

export const AI_BATTLE_QUESTIONS: readonly AiBattleQuestion[] = [
  {
    id: "ai-definition",
    topic: "什么是人工智能",
    prompt: "下面哪一句最能说明人工智能？",
    options: [
      "让计算机从信息中学习并完成原本需要人来判断的任务",
      "让手机的电量永远不会减少",
      "把所有网页都存进一台电脑",
      "让键盘自动变得更大",
    ],
    answerIndex: 0,
    explanation: "人工智能是让机器利用数据和算法完成识别、预测、生成等智能任务的技术。",
  },
  {
    id: "ai-and-programs",
    topic: "AI 与普通程序的区别",
    prompt: "AI 程序和普通按规则编写的程序，常见的区别是什么？",
    options: [
      "AI 可以从数据中学习规律，普通程序通常执行人预先写好的固定规则",
      "AI 不需要电和网络，普通程序一定需要",
      "AI 只能在手机上运行，普通程序只能在电脑上运行",
      "AI 永远不会出错，普通程序经常出错",
    ],
    answerIndex: 0,
    explanation: "普通程序主要按明确规则执行；许多 AI 会从训练数据中学习模式，但两者都可能出错。",
  },
  {
    id: "data",
    topic: "什么是数据",
    prompt: "下列哪一项最适合作为“数据”的例子？",
    options: [
      "一组标注了天气和气温的记录",
      "同学的一次猜测",
      "一张没有内容的纸",
      "还没发生的未来事件",
    ],
    answerIndex: 0,
    explanation: "数据是记录下来的事实、测量结果、文字、图像或声音等信息。",
  },
  {
    id: "algorithm",
    topic: "什么是算法",
    prompt: "用“先洗菜，再切菜，最后炒菜”来说明算法，最合适的理解是？",
    options: [
      "算法是一套为完成任务而安排好的步骤",
      "算法是一种只能在机器人里使用的零件",
      "算法就是所有数据的总和",
      "算法能保证任何结果都完全正确",
    ],
    answerIndex: 0,
    explanation: "算法像解决问题的步骤说明书，它需要正确的输入和合适的设计。",
  },
  {
    id: "training",
    topic: "AI 为什么需要训练",
    prompt: "为什么图像识别 AI 通常要看许多带标签的图片？",
    options: [
      "通过大量例子学习图片中的共同特征和分类规律",
      "让电脑屏幕显示得更亮",
      "这样就不需要再检查结果",
      "为了把所有图片都公开给别人",
    ],
    answerIndex: 0,
    explanation: "训练让模型从大量例子中调整参数，逐步学会识别规律。",
  },
  {
    id: "machine-learning",
    topic: "机器学习的基本概念",
    prompt: "机器学习最接近下面哪种学习方式？",
    options: [
      "从许多示例中找规律，再用规律处理新情况",
      "把每个答案都提前写死，绝不改变",
      "只记住第一条看到的信息",
      "不使用任何输入就作出判断",
    ],
    answerIndex: 0,
    explanation: "机器学习会从训练样本中学习规律，并把学到的规律用于新的输入。",
  },
  {
    id: "generative-ai",
    topic: "生成式 AI 是什么",
    prompt: "哪项任务最符合生成式 AI 的能力？",
    options: [
      "根据提示创作一段故事或生成一张图片",
      "只把文件从一个文件夹移动到另一个文件夹",
      "把电脑的音量固定为 50%",
      "给所有账号设置同一个密码",
    ],
    answerIndex: 0,
    explanation: "生成式 AI 可以根据提示产生新的文字、图像、声音或代码等内容。",
  },
  {
    id: "hallucinations",
    topic: "AI 可能产生错误答案的原因",
    prompt: "AI 有时会一本正经地说出错误内容，较合理的原因是？",
    options: [
      "它根据学习到的模式生成内容，不一定真正核实了每个事实",
      "它每次都会故意欺骗用户",
      "只要联网，AI 就一定能知道全部事实",
      "AI 从来不使用训练数据",
    ],
    answerIndex: 0,
    explanation: "生成式 AI 擅长组织看似合理的内容，但可能出现编造或过时的信息。",
  },
  {
    id: "verify-content",
    topic: "如何判断 AI 生成内容是否可靠",
    prompt: "看到 AI 给出的重要学习结论时，最可靠的做法是什么？",
    options: [
      "查阅教材、权威来源或请老师核对关键信息",
      "因为语句通顺就直接相信",
      "立刻转发给所有同学",
      "只看答案的第一句话",
    ],
    answerIndex: 0,
    explanation: "涉及事实、健康、法律或学习结论时，应交叉核验来源和证据。",
  },
  {
    id: "privacy",
    topic: "个人隐私保护",
    prompt: "使用 AI 工具时，下面哪种信息不应随意输入？",
    options: [
      "身份证号、家庭住址和账号密码",
      "自己编写的一句公开诗歌",
      "已经公开的课本标题",
      "天气是否晴朗的描述",
    ],
    answerIndex: 0,
    explanation: "身份证号、地址、联系方式、密码等都属于敏感信息，应避免上传或分享。",
  },
  {
    id: "deepfake",
    topic: "深度伪造和虚假信息",
    prompt: "收到一段“老师紧急通知转账”的视频时，先做什么更安全？",
    options: [
      "通过学校官方渠道或直接联系老师核实",
      "马上按视频要求转发和付款",
      "只要声音像老师就完全相信",
      "把视频剪短后发到群里",
    ],
    answerIndex: 0,
    explanation: "深度伪造可以模仿声音和画面，遇到异常重要信息要用独立渠道验证。",
  },
  {
    id: "fairness",
    topic: "AI 使用中的公平与偏见",
    prompt: "如果训练数据很少包含某个地区或群体，AI 可能出现什么问题？",
    options: [
      "对这类情况的判断不够准确，甚至产生不公平结果",
      "自动变得更加公平",
      "不再需要任何数据",
      "可以保证所有人得到完全相同的答案",
    ],
    answerIndex: 0,
    explanation: "数据不完整或带有偏见时，模型可能学到不公平的模式，需要持续检查和改进。",
  },
  {
    id: "human-oversight",
    topic: "为什么不能完全依赖 AI",
    prompt: "为什么不能把 AI 的建议当成最终决定？",
    options: [
      "AI 可能缺少完整背景、理解错误或给出错误信息，人需要负责判断",
      "AI 不能处理任何文字",
      "AI 每次回答都会完全一样",
      "AI 不会使用数据",
    ],
    answerIndex: 0,
    explanation: "AI 是辅助工具，重要判断仍需要人结合事实、规则和价值观负责。",
  },
  {
    id: "human-responsibility",
    topic: "人类在 AI 使用中的责任",
    prompt: "用 AI 完成课程报告时，最负责任的做法是？",
    options: [
      "核对内容、标明参考和 AI 协助，并用自己的理解完成报告",
      "原样提交且说完全是自己写的",
      "删除所有资料来源",
      "让 AI 替自己做所有决定",
    ],
    answerIndex: 0,
    explanation: "使用者需要对最终内容负责，做到诚实、核验和尊重他人的成果。",
  },
  {
    id: "safe-use",
    topic: "如何安全、合理地使用 AI",
    prompt: "下列哪种使用 AI 的方式最安全、合理？",
    options: [
      "把它当学习助手，保护隐私、核对事实并遵守学校规则",
      "把所有个人资料都输入，要求它替自己考试",
      "看到任何回答都不核实就传播",
      "用它制作冒充同学的虚假视频",
    ],
    answerIndex: 0,
    explanation: "合理使用 AI 要保护隐私、验证信息、尊重他人并遵守规则。",
  },
];
