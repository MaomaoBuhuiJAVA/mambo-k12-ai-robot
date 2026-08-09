import { describe, expect, it } from "vitest";

import { getBattleStory } from "./ai-battle-story";

describe("getBattleStory", () => {
  it.each([
    ["castle-1", "城堡守卫", "观察之章"],
    ["core-lab", "数据核心守卫", "数据之章"],
    ["desert-temple", "沙漠石像守卫", "判断之章"],
    ["lava-cavern", "熔岩巨龙", "安全之章"],
    ["tree-sanctuary", "古树守卫", "协作之章"],
  ])("creates a three-part elementary story for %s", (moduleId, enemyName, chapterName) => {
    const story = getBattleStory(moduleId, enemyName);

    expect(story.intro).toHaveLength(3);
    expect(story.intro.map((line) => line.speaker)).toEqual(["starbao", "enemy", "starbao"]);
    expect(story.intro.map((line) => line.text).join(" ")).toContain(chapterName);
    expect(story.victory).toHaveLength(2);
    expect(story.defeat).toHaveLength(2);
  });
});
