import { CASTLE_LESSON_01 } from "./castle-lesson-01";
import { DESERT_LESSON_07 } from "./desert-lesson-07";
import { DESERT_LESSON_08 } from "./desert-lesson-08";
import { DESERT_LESSON_09 } from "./desert-lesson-09";
import { FOREST_LESSON_01 } from "./forest-lesson-01";
import { FOREST_LESSON_02 } from "./forest-lesson-02";
import { FOREST_LESSON_03 } from "./forest-lesson-03";
import { LAVA_LESSON_01 } from "./lava-lesson-01";
import { LAVA_LESSON_02 } from "./lava-lesson-02";
import { LAVA_LESSON_03 } from "./lava-lesson-03";

export * from "./storybook-manifest";
export * from "./source-registry";
export { CASTLE_LESSON_01 } from "./castle-lesson-01";
export { DESERT_LESSON_07 } from "./desert-lesson-07";
export { DESERT_LESSON_08 } from "./desert-lesson-08";
export { DESERT_LESSON_09 } from "./desert-lesson-09";
export { FOREST_LESSON_01 } from "./forest-lesson-01";
export { FOREST_LESSON_02 } from "./forest-lesson-02";
export { FOREST_LESSON_03 } from "./forest-lesson-03";
export { LAVA_LESSON_01 } from "./lava-lesson-01";
export { LAVA_LESSON_02 } from "./lava-lesson-02";
export { LAVA_LESSON_03 } from "./lava-lesson-03";

export const IMPORTED_STORYBOOKS = [
  FOREST_LESSON_01,
  FOREST_LESSON_02,
  FOREST_LESSON_03,
  CASTLE_LESSON_01,
  DESERT_LESSON_07,
  DESERT_LESSON_08,
  DESERT_LESSON_09,
  LAVA_LESSON_01,
  LAVA_LESSON_02,
  LAVA_LESSON_03,
] as const;

export function getImportedStorybookById(storybookId: string) {
  return IMPORTED_STORYBOOKS.find((storybook) => storybook.id === storybookId);
}
