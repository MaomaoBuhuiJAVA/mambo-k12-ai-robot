export type BattleDialogueSpeaker = "starbao" | "enemy";

export interface BattleStoryLine {
  readonly speaker: BattleDialogueSpeaker;
  readonly text: string;
}

export interface BattleStory {
  readonly intro: readonly BattleStoryLine[];
  readonly victory: readonly BattleStoryLine[];
  readonly defeat: readonly BattleStoryLine[];
}

interface BattleStorySeed {
  readonly chapterName: string;
  readonly challenge: string;
  readonly victoryLesson: string;
}

const STORY_SEEDS: Readonly<Record<string, BattleStorySeed>> = {
  "castle-1": {
    chapterName: "观察之章",
    challenge: "认真观察，再想一想答案",
    victoryLesson: "看清题目里的小线索，再做决定",
  },
  "core-lab": {
    chapterName: "数据之章",
    challenge: "分清信息，从例子里找规律",
    victoryLesson: "数据里藏着规律，要先仔细比较",
  },
  "desert-temple": {
    chapterName: "判断之章",
    challenge: "先找证据，再做判断",
    victoryLesson: "有证据的判断，才更可靠",
  },
  "lava-cavern": {
    chapterName: "安全之章",
    challenge: "保护隐私，核实信息，遵守规则",
    victoryLesson: "安全地使用 AI，是每位小小探索者的本领",
  },
  "tree-sanctuary": {
    chapterName: "协作之章",
    challenge: "人负责判断，AI 是学习助手",
    victoryLesson: "和 AI 一起学习时，人要负责思考和选择",
  },
};

const DEFAULT_STORY_SEED: BattleStorySeed = {
  chapterName: "知识之章",
  challenge: "认真思考，找到知识线索",
  victoryLesson: "愿意观察和思考，就是很棒的学习能力",
};

export function getBattleStory(moduleId: string, enemyName: string): BattleStory {
  const seed = STORY_SEEDS[moduleId] ?? DEFAULT_STORY_SEED;

  return {
    intro: [
      {
        speaker: "starbao",
        text: `知识星图守护行动开始！${enemyName}的${seed.chapterName}被知识碎片扰乱了。`,
      },
      {
        speaker: "enemy",
        text: `我是${enemyName}。想让碎片归位，要学会${seed.challenge}。`,
      },
      {
        speaker: "starbao",
        text: "每答一题，我们就点亮一束知识能量。准备好一起帮忙了吗？",
      },
    ],
    victory: [
      {
        speaker: "enemy",
        text: `谢谢你！${seed.chapterName}已经重新发光，我也恢复清醒了。`,
      },
      {
        speaker: "starbao",
        text: `太棒了！你收下${seed.chapterName}徽章。记住：${seed.victoryLesson}。`,
      },
    ],
    defeat: [
      {
        speaker: "starbao",
        text: "这次的答案已经给了我们线索。慢一点读题，再试一次就会更接近答案。",
      },
      {
        speaker: "enemy",
        text: `我会在这里等你。带着新发现回来，我们一起让${seed.chapterName}重新发光！`,
      },
    ],
  };
}

export function getBattleTurnDialogue(isCorrect: boolean, explanation: string): BattleStoryLine {
  return isCorrect
    ? { speaker: "starbao", text: `答对啦！${explanation}` }
    : { speaker: "enemy", text: `别着急，答案藏在这里：${explanation}` };
}
