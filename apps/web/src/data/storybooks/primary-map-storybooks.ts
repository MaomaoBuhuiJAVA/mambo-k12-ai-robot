export type PrimaryMapRegionId = "forest" | "castle" | "technology" | "desert" | "volcano";

export interface PrimaryMapStorybookCard {
  readonly storybookId: string;
  readonly title: string;
  readonly available: boolean;
  readonly coverSrc?: string;
}

export interface PrimaryMapStorybookModule {
  readonly regionName: string;
  readonly battleModuleId: string;
  readonly storybooks: readonly [
    PrimaryMapStorybookCard,
    PrimaryMapStorybookCard,
    PrimaryMapStorybookCard,
  ];
}

export const PRIMARY_MAP_STORYBOOK_MODULES: Record<PrimaryMapRegionId, PrimaryMapStorybookModule> = {
  forest: {
    regionName: "森林",
    battleModuleId: "tree-sanctuary",
    storybooks: [
      { storybookId: "forest-lesson-01", title: "古树圣地的探险须知", available: true, coverSrc: "/assets/storybooks/forest-lesson-01/page-01.jpeg" },
      { storybookId: "forest-lesson-02", title: "年轮墙上的证据", available: true, coverSrc: "/assets/storybooks/forest-lesson-02/page-01.jpeg" },
      { storybookId: "forest-lesson-03", title: "通知上的名字", available: true, coverSrc: "/assets/storybooks/forest-lesson-03/page-01.jpeg" },
    ],
  },
  castle: {
    regionName: "城堡",
    battleModuleId: "castle-1",
    storybooks: [
      {
        storybookId: "castle-lesson-01",
        title: "星宝城堡 AI",
        available: true,
        coverSrc: "/assets/storybooks/castle-lesson-01/page-01.jpeg",
      },
      { storybookId: "castle-lesson-02", title: "城堡绘本 2", available: false },
      { storybookId: "castle-lesson-03", title: "城堡绘本 3", available: false },
    ],
  },
  technology: {
    regionName: "科技岛",
    battleModuleId: "core-lab",
    storybooks: [
      { storybookId: "technology-lesson-01", title: "科技绘本 1", available: false },
      { storybookId: "technology-lesson-02", title: "科技绘本 2", available: false },
      { storybookId: "technology-lesson-03", title: "科技绘本 3", available: false },
    ],
  },
  desert: {
    regionName: "沙漠",
    battleModuleId: "desert-temple",
    storybooks: [
      { storybookId: "desert-lesson-07", title: "线索和证据一样吗", available: true, coverSrc: "/assets/storybooks/desert-lesson-07/page-01.png" },
      { storybookId: "desert-lesson-08", title: "哪条证据更可靠", available: true, coverSrc: "/assets/storybooks/desert-lesson-08/page-01.png" },
      { storybookId: "desert-lesson-09", title: "证据不够时怎样判断", available: true, coverSrc: "/assets/storybooks/desert-lesson-09/page-01.png" },
    ],
  },
  volcano: {
    regionName: "火山",
    battleModuleId: "lava-cavern",
    storybooks: [
      { storybookId: "lava-lesson-01", title: "星宝熔岩山 AI 隐私小卫士", available: true, coverSrc: "/assets/storybooks/lava-lesson-01/page-01.png" },
      { storybookId: "lava-lesson-02", title: "星宝熔岩山 AI 防骗小卫士", available: true, coverSrc: "/assets/storybooks/lava-lesson-02/page-01.png" },
      { storybookId: "lava-lesson-03", title: "星宝熔岩山 AI 安全小卫士", available: true, coverSrc: "/assets/storybooks/lava-lesson-03/page-01.jpeg" },
    ],
  },
};

export function isPrimaryMapBattleUnlocked(
  module: PrimaryMapStorybookModule,
  completedStorybookIds: ReadonlySet<string>,
): boolean {
  return module.storybooks.every((storybook) => completedStorybookIds.has(storybook.storybookId));
}
